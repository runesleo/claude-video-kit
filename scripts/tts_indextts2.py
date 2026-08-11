#!/usr/bin/env python3
"""
tts_indextts2.py — Generate WAV files for each slide using local IndexTTS2.

Usage:
    python scripts/tts_indextts2.py examples/my-first

Reads:
    <project>/script.json

Writes:
    <project>/workspace/<slide_idx>.wav

Env:
    INDEXTTS2_FORCE=1   — 即使 workspace/<idx>.wav 已存在也重生成（改 tts_text / rules 后必开）
    INDEXTTS2_DIR       — path to cloned IndexTTS2 repo (required)
    INDEXTTS2_MODEL_DIR — checkpoint directory (default: $INDEXTTS2_DIR/checkpoints)
    INDEXTTS2_REF_AUDIO — reference voice WAV for cloning (required)
    VOICE_RULES_PATH    — optional JSON preprocessing rules; defaults to config sample

Setup:
    git clone https://github.com/index-tts/IndexTTS2 ~/tools/IndexTTS2
    cd ~/tools/IndexTTS2 && pip install -r requirements.txt
    # download model weights per their README
    See docs/indextts2.md for details.
"""
import json
import os
import re
import sys
import time
from pathlib import Path

DEFAULT_VOICE_RULES_PATH = Path(__file__).resolve().parents[1] / "config" / "voice-text-tts-rules.sample.json"
VOICE_RULES_PATH = Path(os.environ.get("VOICE_RULES_PATH", str(DEFAULT_VOICE_RULES_PATH))).expanduser()


def load_voice_rules(project=None) -> dict:
    """优先级：VOICE_RULES_PATH > <project>/voice-rules.json > kit 默认 sample。
    同 tts_cosyvoice.py，2026-08-01 修：项目级规则此前从不被读取。"""
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
    """Apply CN/EN mix preprocessing rules so IndexTTS2 reads acronyms correctly.

    Order:
      1. tokens (longest-first match) — exact-string replace for known phrases
      2. domain_suffix — .me / .com → ' 点 me' / ' 点 com'
      3. letters fallback — regex \\b[A-Z]{1,3}\\b on remaining capitals
    """
    if not text or not rules:
        return text

    tokens = rules.get("tokens", {}) or {}
    # 只跳过 JSON 元数据键（如 $comment），不能跳过「$460」这类合法 token —— 旧逻辑 not startswith("$") 会漏掉 $460
    def _token_keys() -> list:
        out = []
        for k in tokens.keys():
            if not isinstance(k, str):
                continue
            if k == "$comment" or k.startswith("$comment"):
                continue
            out.append(k)
        return sorted(out, key=len, reverse=True)

    for k in _token_keys():
        text = text.replace(k, tokens[k])

    if (rules.get("domain_suffix") or {}).get("enabled"):
        text = re.sub(r"\.([a-z]{2,4})\b", r" 点 \1", text)

    letters = rules.get("letters", {}) or {}
    if letters and rules.get("letters_fallback", True) is not False:
        def _replace_acronym(m):
            s = m.group(0)
            return " ".join(letters.get(c, c) for c in s)
        text = re.sub(r"\b[A-Z]{1,3}\b", _replace_acronym, text)

    return text

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


def extract_text(slide: dict) -> str:
    """Extract narration text from a slide, matching tts.py interface.

    tts_text（可选）：专供 IndexTTS 的中文友好稿；屏上字幕仍用 voice_text（分镜/观众可读）。
    解决「屏上要保留专名写法」与「口播不能堆英文」的矛盾 — 此前仅靠 tokens + letters 易复发念错。
    """
    tt = slide.get("tts_text")
    if isinstance(tt, str) and tt.strip():
        return tt.strip()
    if "voice_text" in slide:
        return slide["voice_text"]
    if "narration" in slide:
        return slide["narration"]
    # 有 text 就以 text 为准（同 tts_cosyvoice.py，2026-08-01 修）
    if slide.get("type") == "cover" and not (slide.get("text") or "").strip():
        parts = [slide.get("title", ""), slide.get("subtitle", "")]
        return " ".join(p for p in parts if p)
    return slide.get("text", "")


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: tts_indextts2.py <project_dir>", file=sys.stderr)
        return 1

    project = Path(sys.argv[1])
    script_path = project / "script.json"
    if not script_path.exists():
        print(f"script.json not found at {script_path}", file=sys.stderr)
        return 1

    # --- Env config ---
    indextts2_dir = os.environ.get("INDEXTTS2_DIR", "")
    if not indextts2_dir:
        print(
            "INDEXTTS2_DIR not set. Point it to your cloned IndexTTS2 repo.\n"
            "See docs/indextts2.md for setup.",
            file=sys.stderr,
        )
        return 1

    model_dir = os.environ.get(
        "INDEXTTS2_MODEL_DIR",
        os.path.join(indextts2_dir, "checkpoints"),
    )
    cfg_path = os.path.join(model_dir, "config.yaml")

    ref_audio = os.environ.get("INDEXTTS2_REF_AUDIO", "")
    if not ref_audio or not Path(ref_audio).exists():
        print(
            "INDEXTTS2_REF_AUDIO not set or file not found.\n"
            "Point it to a ~5-10s WAV of the target voice.",
            file=sys.stderr,
        )
        return 1

    # --- Load model ---
    sys.path.insert(0, indextts2_dir)
    os.environ["TOKENIZERS_PARALLELISM"] = "false"

    # Point HF cache to the local checkpoints to avoid network downloads.
    hf_cache = os.environ.get(
        "HF_HUB_CACHE",
        os.path.join(model_dir, "hf_cache"),
    )
    if os.path.isdir(hf_cache):
        os.environ["HF_HUB_CACHE"] = hf_cache

    import warnings
    warnings.filterwarnings("ignore")

    # Patch: force local_files_only so from_pretrained never hits the network.
    # Without this, transformers 4.50+ tries xet downloads that fail behind
    # restrictive networks (e.g. China mainland) and the offline flag alone
    # triggers a separate bug with xet-cached safetensors.
    import transformers.modeling_utils as _mu
    _orig_from_pretrained = _mu.PreTrainedModel.from_pretrained.__func__

    @classmethod  # type: ignore[misc]
    def _local_from_pretrained(cls, *a, **kw):
        kw["local_files_only"] = True
        return _orig_from_pretrained(cls, *a, **kw)

    _mu.PreTrainedModel.from_pretrained = _local_from_pretrained

    print(f"Loading IndexTTS2 from {model_dir}...", flush=True)
    t0 = time.time()
    from indextts.infer_v2 import IndexTTS2
    tts = IndexTTS2(model_dir=model_dir, cfg_path=cfg_path)
    print(f"Model loaded in {time.time() - t0:.1f}s", flush=True)

    # --- Read script ---
    script = json.loads(script_path.read_text())
    slides = script.get("slides", script) if isinstance(script, dict) else script

    workspace = project / "workspace"
    workspace.mkdir(exist_ok=True)

    voice_rules = load_voice_rules(project)
    if voice_rules:
        print(f"[voice rules] loaded {len(voice_rules.get('tokens', {}))} tokens + {len(voice_rules.get('letters', {}))} letters", flush=True)

    # --- Generate ---
    total = len(slides)
    success = 0
    for i, slide in enumerate(slides):
        # 2026-05-14 修：videoClip 类型不生成 wav（视频片段自带音轨），
        # 否则 script-to-html 期望的 wav 列表与实际不符报"多余 wav"错。
        if isinstance(slide, dict) and slide.get("type") == "videoClip":
            print(f"[{i}/{total}] videoClip — skip wav generation (uses clip's own audio)", flush=True)
            continue
        text = extract_text(slide)
        if not text:
            print(f"[{i}/{total}] no voice text, skipping", flush=True)
            continue

        out = workspace / f"{i:02d}.wav"
        force = os.environ.get("INDEXTTS2_FORCE", "").strip().lower() in (
            "1",
            "true",
            "yes",
        )
        if out.exists() and out.stat().st_size > 1024 and not force:
            print(f"[{i}/{total}] {out.name}: already exists, skip", flush=True)
            success += 1
            continue
        if force and out.exists():
            print(f"[{i}/{total}] {out.name}: INDEXTTS2_FORCE=1, regenerating", flush=True)

        tts_text = preprocess_voice_text(text, voice_rules)
        if tts_text != text:
            print(f"[{i}/{total}] {out.name}: {text[:40]}... → {tts_text[:40]}...", flush=True)
        else:
            print(f"[{i}/{total}] {out.name}: {text[:50]}...", flush=True)

        t1 = time.time()
        tts.infer(ref_audio, tts_text, str(out))
        elapsed = time.time() - t1

        if out.exists():
            try:
                speed = float(os.environ.get("INDEXTTS2_SPEED", "1.0"))  # ⛔ 不要改回 1.08，倍速有爆破音
            except ValueError:
                speed = 1.0
            if abs(speed - 1.0) > 0.01:
                import subprocess
                tmp = out.with_suffix(".tmp.wav")
                cp = subprocess.run(
                    ["ffmpeg", "-y", "-i", str(out), "-filter:a", f"atempo={speed:.3f}", str(tmp), "-loglevel", "error"],
                    check=False,
                )
                if cp.returncode == 0 and tmp.exists():
                    tmp.replace(out)
            # === 2026-05-14 修：per-wav loudnorm 到 -20 LUFS ===
            # IndexTTS2 输出 mean_volume ~ -35 dB，与 videoClip (volume 0.55 后 ~-20dB) 严重不齐。
            # daily.sh amix 加 dynaudnorm 后又造成"声音慢慢起来"(AGC ramp)。
            # 正解：TTS wav 在此处 normalize 到一致响度，amix 时不再需要 dynaudnorm，淡入直接进入。
            import subprocess as _sp
            tmp_ln = out.with_suffix(".ln.wav")
            cp_ln = _sp.run(
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
        else:
            print(f"  ❌ generation failed", flush=True)

    print(f"\nDone: {success}/{total} slides generated → {workspace}/", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
