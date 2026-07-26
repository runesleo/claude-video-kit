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
    FISH_AUDIO_API_KEY   — required for Fish Audio
    FISH_AUDIO_VOICE_ID  — default voice; per-slide "voice" field overrides
    SAY_VOICE            — optional macOS `say -v` name for keyless fallback
                           (e.g. Tingting for zh_CN demo quality)

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


def edge_tts_fallback(text: str, out_path: Path) -> bool:
    """Optional edge-tts fallback (better Chinese than macOS say when Fish unset)."""
    if not shutil.which("edge-tts") or not shutil.which("ffmpeg"):
        return False
    voice = os.environ.get("EDGE_TTS_VOICE", "zh-CN-YunyangNeural").strip()
    rate = os.environ.get("EDGE_TTS_RATE", "+8%").strip()
    mp3 = out_path.with_suffix(".mp3")
    try:
        subprocess.run(
            [
                "edge-tts",
                "--voice", voice,
                "--rate", rate,
                "--text", text,
                "--write-media", str(mp3),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        subprocess.run(
            [
                "ffmpeg", "-y", "-i", str(mp3),
                "-acodec", "pcm_s16le", "-ar", "44100", "-ac", "1",
                str(out_path),
            ],
            check=True,
            capture_output=True,
        )
        mp3.unlink(missing_ok=True)
        print(f"  (edge-tts fallback: {voice})")
        return True
    except (OSError, subprocess.CalledProcessError) as exc:
        print(f"  (edge-tts failed: {exc})")
        mp3.unlink(missing_ok=True)
        return False


def local_fallback(text: str, out_path: Path) -> None:
    """Prefer edge-tts when available; else macOS `say` for keyless dry-runs."""
    prefer = os.environ.get("TTS_FALLBACK", "edge").strip().lower()
    if prefer != "say" and edge_tts_fallback(text, out_path):
        return
    if shutil.which("say"):
        aiff = out_path.with_suffix(".aiff")
        cmd = ["say", "-o", str(aiff)]
        voice = os.environ.get("SAY_VOICE", "").strip()
        if voice:
            cmd.extend(["-v", voice])
        cmd.append(text)
        subprocess.run(cmd, check=True)
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(aiff), str(out_path)],
            check=True,
            capture_output=True,
        )
        aiff.unlink()
        print("  (macOS say fallback)")
        return
    raise RuntimeError(
        "No TTS backend available. Set FISH_AUDIO_API_KEY, install edge-tts, or say/ffmpeg."
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
