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
    INDEXTTS2_DIR       — path to cloned IndexTTS2 repo (required)
    INDEXTTS2_MODEL_DIR — checkpoint directory (default: $INDEXTTS2_DIR/checkpoints)
    INDEXTTS2_REF_AUDIO — reference voice WAV for cloning (required)

Setup:
    git clone https://github.com/index-tts/IndexTTS2 ~/tools/IndexTTS2
    cd ~/tools/IndexTTS2 && pip install -r requirements.txt
    # download model weights per their README
    See docs/indextts2.md for details.
"""
import json
import os
import sys
import time
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


def extract_text(slide: dict) -> str:
    """Extract narration text from a slide, matching tts.py interface."""
    if "voice_text" in slide:
        return slide["voice_text"]
    if "narration" in slide:
        return slide["narration"]
    if slide.get("type") == "cover":
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

    # --- Generate ---
    total = len(slides)
    success = 0
    for i, slide in enumerate(slides):
        text = extract_text(slide)
        if not text:
            print(f"[{i}/{total}] no voice text, skipping", flush=True)
            continue

        out = workspace / f"{i:02d}.wav"
        print(f"[{i}/{total}] {out.name}: {text[:50]}...", flush=True)

        t1 = time.time()
        tts.infer(ref_audio, text, str(out))
        elapsed = time.time() - t1

        if out.exists():
            size_kb = out.stat().st_size / 1024
            print(f"  ✅ {size_kb:.0f} KB, {elapsed:.1f}s", flush=True)
            success += 1
        else:
            print(f"  ❌ generation failed", flush=True)

    print(f"\nDone: {success}/{total} slides generated → {workspace}/", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
