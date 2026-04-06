#!/usr/bin/env python3
"""
tts.py — Generate WAV files for each slide using Fish Audio.

Usage:
    python scripts/tts.py examples/my-first

Reads:
    <project>/script.json

Writes:
    <project>/workspace/<slide_idx>.wav

Env:
    FISH_AUDIO_API_KEY   — required
    FISH_AUDIO_VOICE_ID  — default voice; per-slide "voice" field overrides

If FISH_AUDIO_API_KEY is missing, falls back to `say` (macOS) / `espeak` for
local dry-runs so the pipeline still exercises end-to-end.
"""
import json
import os
import sys
import shutil
import subprocess
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

FISH_API = "https://api.fish.audio/v1/tts"


def fish_tts(text: str, out_path: Path, voice_id: str, api_key: str) -> None:
    import requests
    r = requests.post(
        FISH_API,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "text": text,
            "reference_id": voice_id,
            "format": "wav",
        },
        timeout=120,
    )
    r.raise_for_status()
    out_path.write_bytes(r.content)


def local_fallback(text: str, out_path: Path) -> None:
    """macOS `say` fallback so pipeline runs without an API key."""
    if shutil.which("say"):
        aiff = out_path.with_suffix(".aiff")
        subprocess.run(["say", "-o", str(aiff), text], check=True)
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(aiff), str(out_path)],
            check=True,
            capture_output=True,
        )
        aiff.unlink()
        return
    raise RuntimeError(
        "No TTS backend available. Set FISH_AUDIO_API_KEY or install `say`/ffmpeg."
    )


def extract_text(slide: dict) -> str:
    if "voice_text" in slide:
        return slide["voice_text"]
    if slide.get("type") == "cover":
        parts = [slide.get("title", ""), slide.get("subtitle", "")]
        return " ".join(p for p in parts if p)
    if slide.get("type") == "code":
        return slide.get("voice_text", "")
    return slide.get("text", "")


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: tts.py <project_dir>", file=sys.stderr)
        return 1

    project = Path(sys.argv[1])
    script_path = project / "script.json"
    if not script_path.exists():
        print(f"script.json not found at {script_path}", file=sys.stderr)
        return 1

    script = json.loads(script_path.read_text())
    workspace = project / "workspace"
    workspace.mkdir(exist_ok=True)

    api_key = os.environ.get("FISH_AUDIO_API_KEY", "")
    default_voice = os.environ.get("FISH_AUDIO_VOICE_ID", "")

    for i, slide in enumerate(script["slides"]):
        text = extract_text(slide)
        if not text:
            print(f"slide {i}: no voice text, skipping")
            continue
        out = workspace / f"{i:02d}.wav"
        voice = slide.get("voice") or default_voice
        print(f"[{i}] → {out.name}: {text[:40]}...")
        if api_key and voice:
            fish_tts(text, out, voice, api_key)
        else:
            local_fallback(text, out)

    return 0


if __name__ == "__main__":
    sys.exit(main())
