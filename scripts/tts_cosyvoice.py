#!/usr/bin/env python3
"""
tts_cosyvoice.py — Generate WAV per slide using Alibaba DashScope CosyVoice.

接口对齐 tts_indextts2.py:
  - input: <project_dir>/script.json
  - output: <project_dir>/workspace/<idx>.wav (16-bit PCM, 16/22.05/24/44.1 kHz)
  - cache: 已存在且 > 1KB 跳过，除非 COSYVOICE_FORCE=1
  - videoClip skip (自带音轨)
  - 复用 voice-text-tts-rules.json 预处理 (但 CosyVoice 中英混排比 IndexTTS 强，可减少 tokens 替换)
  - per-wav loudnorm -20 LUFS (跟 IndexTTS2 流程一致，amix 不再 dynaudnorm)

Env:
  DASHSCOPE_API_KEY      (P0 必填)
  COSYVOICE_MODEL        默认 "cosyvoice-v3.5-plus"
  COSYVOICE_VOICE_ID     必填；预制音色（默认 voice）或 voice clone 创建后的 id
  COSYVOICE_FORCE        =1 强制重生成
  COSYVOICE_SPEED        默认 1.0。⛔ 禁止倍速——Leo 规则：加速产生爆破音。
                         （2026-08-01 由 1.08 改为 1.0；此前默认值导致多条视频被无意加速）
  COSYVOICE_FORMAT       "wav" / "mp3" 默认 wav
  VOICE_RULES_PATH       optional JSON preprocessing rules; defaults to config sample

Usage:
  python tts_cosyvoice.py <project_dir>

Setup:
  pip install dashscope
  export DASHSCOPE_API_KEY=<your_dashscope_api_key>
  export COSYVOICE_VOICE_ID=voice_xxx   # 见 leo_voice_clone_create.py 拿 voice_id
"""
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

DEFAULT_VOICE_RULES_PATH = Path(__file__).resolve().parents[1] / "config" / "voice-text-tts-rules.sample.json"
VOICE_RULES_PATH = Path(os.environ.get("VOICE_RULES_PATH", str(DEFAULT_VOICE_RULES_PATH))).expanduser()


def load_voice_rules(project=None) -> dict:
    """优先级：环境变量 VOICE_RULES_PATH > <project>/voice-rules.json > kit 默认 sample。

    2026-08-01：此前只认默认 sample，项目目录里的 voice-rules.json **从来不被读**。
    于是 Ondo 那期在项目里写好的 SPYon / QQQon / USDC 规则形同虚设，
    SPYon 被念成「斯派」、QQQon 念成「QQ-KONE」——而且 7-31 给 USDT 加的规则
    也是加在项目文件里，同样一直没生效（当时以为修好了）。
    「配置放在了工具不看的地方」不会报错，只会安静地念错。
    """
    candidates = []
    if os.environ.get("VOICE_RULES_PATH"):
        candidates.append(Path(os.environ["VOICE_RULES_PATH"]).expanduser())
    if project is not None:
        candidates.append(Path(project) / "voice-rules.json")
    candidates.append(DEFAULT_VOICE_RULES_PATH)

    for p in candidates:
        if p.exists():
            try:
                rules = json.loads(p.read_text())
                print(f"[voice rules] source: {p}", flush=True)
                return rules
            except Exception as e:
                print(f"[warn] failed to load voice rules {p}: {e}", flush=True)
    return {}


def preprocess_voice_text(text: str, rules: dict) -> str:
    """与 tts_indextts2.py 同款预处理（tokens / domain_suffix / letters_fallback）.

    注意：CosyVoice-v3.5 对中英混排和数字念法本就比 IndexTTS2 更好；letters_fallback
    在新 voice rules 已默认 false（CHANGELOG #45 反复试出），这里只跑 tokens 替换。
    """
    if not text or not rules:
        return text

    tokens = rules.get("tokens", {}) or {}
    keys = [k for k in tokens.keys() if isinstance(k, str) and not (k == "$comment" or k.startswith("$comment"))]
    for k in sorted(keys, key=len, reverse=True):
        text = text.replace(k, tokens[k])

    if (rules.get("domain_suffix") or {}).get("enabled"):
        text = re.sub(r"\.([a-z]{2,4})\b", r" 点 \1", text)

    letters = rules.get("letters", {}) or {}
    if letters and rules.get("letters_fallback", False):
        def _replace_acronym(m):
            s = m.group(0)
            return " ".join(letters.get(c, c) for c in s)
        text = re.sub(r"\b[A-Z]{1,3}\b", _replace_acronym, text)

    return text


def extract_text(slide: dict) -> str:
    """tts_text 优先；与 tts_indextts2.py 一致。"""
    tt = slide.get("tts_text")
    if isinstance(tt, str) and tt.strip():
        return tt.strip()
    if "voice_text" in slide:
        return slide["voice_text"]
    if "narration" in slide:
        return slide["narration"]
    # 2026-08-01：cover 分支必须让位给显式 text。
    # 事故：Ondo 那期封面与片尾写了 title/subtitle 做画面，text 里另有口播稿，
    # 结果 TTS 念的是标题（「做市商的资金被锁了两次 这才是股权永续真正的瓶颈」），
    # 整段开场白和结语的配音直接丢失，而画面看起来完全正常。
    # 有 text 就以 text 为准；title 只是没写口播时的兜底。
    if slide.get("type") == "cover" and not (slide.get("text") or "").strip():
        parts = [slide.get("title", ""), slide.get("subtitle", "")]
        return " ".join(p for p in parts if p)
    return slide.get("text", "")


def synthesize_one(text: str, out_path: Path, model: str, voice: str, fmt: str) -> bool:
    """调 CosyVoice 合成一段语音并落地到 out_path（wav）.

    CosyVoice-v3.5 SDK 走 WebSocket（dashscope.audio.tts_v2.SpeechSynthesizer）.
    """
    import dashscope
    from dashscope.audio.tts_v2 import SpeechSynthesizer

    api_key = os.environ.get("DASHSCOPE_API_KEY", "")
    if not api_key:
        print("DASHSCOPE_API_KEY not set", file=sys.stderr)
        return False
    dashscope.api_key = api_key
    # 北京地域 WebSocket
    dashscope.base_websocket_api_url = os.environ.get(
        "DASHSCOPE_WS_URL",
        "wss://dashscope.aliyuncs.com/api-ws/v1/inference",
    )

    synthesizer = SpeechSynthesizer(model=model, voice=voice)
    try:
        audio = synthesizer.call(text)
    except Exception as e:
        print(f"  ❌ CosyVoice call failed: {e}", flush=True)
        return False

    if not audio:
        print(f"  ❌ CosyVoice returned empty audio", flush=True)
        return False

    # CosyVoice 默认返回 mp3 byte stream。若 format != wav，直接落地。
    # 我们要 wav 给 hyperframes 用，统一走 ffmpeg 转 wav (22050 Hz, mono, 16bit)
    tmp_raw = out_path.with_suffix(".raw")
    tmp_raw.write_bytes(audio)
    cp = subprocess.run(
        [
            "ffmpeg", "-y",
            "-i", str(tmp_raw),
            "-ar", "22050", "-ac", "1", "-sample_fmt", "s16",
            str(out_path),
            "-loglevel", "error",
        ],
        check=False,
    )
    tmp_raw.unlink(missing_ok=True)

    if cp.returncode != 0 or not out_path.exists():
        print(f"  ❌ ffmpeg convert to wav failed (rc={cp.returncode})", flush=True)
        return False

    try:
        req_id = synthesizer.get_last_request_id()
        delay = synthesizer.get_first_package_delay()
        print(f"     [metric] req={req_id} firstPkgDelay={delay}ms", flush=True)
    except Exception:
        pass
    return True


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: tts_cosyvoice.py <project_dir>", file=sys.stderr)
        return 1

    project = Path(sys.argv[1])
    script_path = project / "script.json"
    if not script_path.exists():
        print(f"script.json not found at {script_path}", file=sys.stderr)
        return 1

    api_key = os.environ.get("DASHSCOPE_API_KEY", "")
    if not api_key:
        print("DASHSCOPE_API_KEY not set. Get one from https://bailian.console.aliyun.com/", file=sys.stderr)
        return 1

    # 2026-05-15 smoke test：v3.5-plus 预制音色名跟文档对不上（可能只支持 voice clone），
    # 先用 cosyvoice-v2 + longxiaochun_v2 跑通管线。最终生产用 Leo voice clone（target_model 自己指定）。
    # 2026-08-01 修 bug：此前 _meta 注入写在这段之后，导致 script.json 的
    # cosyvoice_speed / model / voice 永远不生效（读的是环境变量或默认值）。
    # 这就是「语速改了又变回 1.18」的根因。必须先注入再读。
    script_preload = json.loads(script_path.read_text())
    _m = script_preload.get("_meta", {}) if isinstance(script_preload, dict) else {}
    for _env, _key in (("COSYVOICE_MODEL", "cosyvoice_model"),
                       ("COSYVOICE_VOICE_ID", "cosyvoice_voice"),
                       ("COSYVOICE_SPEED", "cosyvoice_speed")):
        if not os.environ.get(_env) and _m.get(_key) is not None:
            os.environ[_env] = str(_m[_key])

    model = os.environ.get("COSYVOICE_MODEL", "cosyvoice-v2")
    voice = os.environ.get("COSYVOICE_VOICE_ID", "longxiaochun_v2")
    fmt = os.environ.get("COSYVOICE_FORMAT", "wav")
    try:
        speed = float(os.environ.get("COSYVOICE_SPEED", "1.0"))  # ⛔ 不要改回 1.08，倍速有爆破音
    except ValueError:
        speed = 1.0
    # fail closed，不是 warning。2026-08-01：此处原本只打印警告然后照跑，
    # 于是 ~/.zshenv 里遗留的 COSYVOICE_SPEED=1.18 连续污染了两期视频而没人拦住。
    # 「警告不是守卫」——要拦就得真的退出。
    if speed != 1.0:
        print(f"⛔ speed={speed}x —— Leo 规则：TTS 一律 1.0，倍速产生爆破音。已中止。\n"
              f"   来源排查顺序：环境变量 COSYVOICE_SPEED（当前 shell / ~/.zshenv）"
              f" > script.json 的 _meta.cosyvoice_speed > 本脚本默认值。\n"
              f"   确需倍速请显式 TTS_ALLOW_SPEEDUP=1 重跑。", flush=True)
        if os.environ.get("TTS_ALLOW_SPEEDUP") != "1":
            sys.exit(3)

    try:
        import dashscope  # noqa: F401
        from dashscope.audio.tts_v2 import SpeechSynthesizer  # noqa: F401
    except ImportError:
        print("dashscope SDK 未安装。pip install dashscope", file=sys.stderr)
        return 1

    print(f"CosyVoice config: model={model} voice={voice} speed={speed}x format={fmt}", flush=True)

    script = script_preload
    slides = script.get("slides", script) if isinstance(script, dict) else script
    workspace = project / "workspace"
    workspace.mkdir(exist_ok=True)

    voice_rules = load_voice_rules(project)
    if voice_rules:
        print(
            f"[voice rules] loaded {len(voice_rules.get('tokens', {}))} tokens + "
            f"{len(voice_rules.get('letters', {}))} letters",
            flush=True,
        )

    total = len(slides)
    success = 0
    force = os.environ.get("COSYVOICE_FORCE", "").strip().lower() in ("1", "true", "yes")
    for i, slide in enumerate(slides):
        if isinstance(slide, dict) and slide.get("type") == "videoClip":
            print(f"[{i}/{total}] videoClip — skip wav generation (uses clip's own audio)", flush=True)
            continue
        text = extract_text(slide)
        if not text:
            print(f"[{i}/{total}] no voice text, skipping", flush=True)
            continue

        out = workspace / f"{i:02d}.wav"
        if out.exists() and out.stat().st_size > 1024 and not force:
            print(f"[{i}/{total}] {out.name}: already exists, skip", flush=True)
            success += 1
            continue
        if force and out.exists():
            print(f"[{i}/{total}] {out.name}: COSYVOICE_FORCE=1, regenerating", flush=True)

        tts_text = preprocess_voice_text(text, voice_rules)
        if tts_text != text:
            print(f"[{i}/{total}] {out.name}: {text[:40]}... → {tts_text[:40]}...", flush=True)
        else:
            print(f"[{i}/{total}] {out.name}: {text[:50]}...", flush=True)

        t1 = time.time()
        ok = synthesize_one(tts_text, out, model, voice, fmt)
        elapsed = time.time() - t1
        if not ok:
            print(f"  ❌ generation failed", flush=True)
            continue

        # 速率调整（与 IndexTTS2 流程一致：atempo）
        if abs(speed - 1.0) > 0.01:
            tmp = out.with_suffix(".tmp.wav")
            cp = subprocess.run(
                ["ffmpeg", "-y", "-i", str(out), "-filter:a", f"atempo={speed:.3f}", str(tmp), "-loglevel", "error"],
                check=False,
            )
            if cp.returncode == 0 and tmp.exists():
                tmp.replace(out)

        # per-wav loudnorm 到 -20 LUFS （和 IndexTTS2 流程一致）
        tmp_ln = out.with_suffix(".ln.wav")
        cp_ln = subprocess.run(
            ["ffmpeg", "-y", "-i", str(out),
             "-af", "loudnorm=I=-20:LRA=7:TP=-3",
             str(tmp_ln), "-loglevel", "error"],
            check=False,
        )
        if cp_ln.returncode == 0 and tmp_ln.exists():
            tmp_ln.replace(out)

        size_kb = out.stat().st_size / 1024
        print(f"  ✅ {size_kb:.0f} KB, {elapsed:.1f}s, speed={speed}x, normalized=-20 LUFS", flush=True)
        success += 1

    print(f"\nDone: {success}/{total} slides generated → {workspace}/", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
