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
  COSYVOICE_MODEL        默认 "cosyvoice-v2"（docstring 此前写 v3.5-plus，与代码不符，已按代码更正）
  COSYVOICE_VOICE_ID     **必填，无默认**；voice clone 创建后的 id。
                         未设置直接报错退出 —— 不再 fallback 到预制音色 longxiaochun_v2，
                         否则 env 漏设会静默生成一整条陌生人声音的片子
  COSYVOICE_FORCE        =1 强制重生成
  COSYVOICE_SPEED        默认 1.0（**不倍速**：变速会压掉爆破音）。1.08 是与 IndexTTS2 的对照口径，非生产默认
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


def load_voice_rules() -> dict:
    if not VOICE_RULES_PATH.exists():
        return {}
    try:
        return json.loads(VOICE_RULES_PATH.read_text())
    except Exception as e:
        print(f"[warn] failed to load voice rules: {e}", flush=True)
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
    if slide.get("type") == "cover":
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
    model = os.environ.get("COSYVOICE_MODEL", "cosyvoice-v2")
    # 不再 fallback 到预制音色。此前默认是 longxiaochun_v2，一旦 env 漏设就会
    # 静默用陌生人的声音生成整条片，而产物听起来完全正常 —— 只有本人能听出不对。
    voice = os.environ.get("COSYVOICE_VOICE_ID")
    if not voice:
        raise SystemExit(
            "COSYVOICE_VOICE_ID 未设置。本管线只用本人克隆音色，不接受预制音色兜底。\n"
            "  取得 voice_id：python scripts/leo_voice_clone_create.py\n"
            "  仅在明确要对照预制音色时，才显式 export COSYVOICE_VOICE_ID=longxiaochun_v2"
        )
    fmt = os.environ.get("COSYVOICE_FORMAT", "wav")
    # 默认 1.0，不倍速：变速会压掉爆破音，是本人明确定过的规则。
    # 旧默认 1.08 是为对齐 IndexTTS2 的语速，但那属于对照口径，不该成为生产默认。
    try:
        speed = float(os.environ.get("COSYVOICE_SPEED", "1.0"))
    except ValueError:
        speed = 1.0

    try:
        import dashscope  # noqa: F401
        from dashscope.audio.tts_v2 import SpeechSynthesizer  # noqa: F401
    except ImportError:
        print("dashscope SDK 未安装。pip install dashscope", file=sys.stderr)
        return 1

    print(f"CosyVoice config: model={model} voice={voice} speed={speed}x format={fmt}", flush=True)

    script = json.loads(script_path.read_text())
    slides = script.get("slides", script) if isinstance(script, dict) else script
    workspace = project / "workspace"
    workspace.mkdir(exist_ok=True)

    voice_rules = load_voice_rules()
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
        # ⚠️ 必须显式重设 -ar/-ac/-sample_fmt：ffmpeg 的 loudnorm 滤镜内部按 192kHz
        # 工作，不指定输出格式时会把 22.05kHz 的语音写成 192kHz —— 文件大 8.7 倍，
        # 且没有任何警告。上游那次 `-ar 22050` 的转换会被这一步悄悄推翻。
        tmp_ln = out.with_suffix(".ln.wav")
        cp_ln = subprocess.run(
            ["ffmpeg", "-y", "-i", str(out),
             "-af", "loudnorm=I=-20:LRA=7:TP=-3",
             "-ar", "22050", "-ac", "1", "-sample_fmt", "s16",
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
