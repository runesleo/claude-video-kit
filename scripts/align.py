#!/usr/bin/env python3
"""
align.py — Word-level caption alignment via faster-whisper.

Reads:
    <project>/workspace/*.wav

Writes:
    <project>/workspace/captions.json
        { "<slide_idx>": [ { "from": frame, "to": frame, "text": "..." }, ... ] }

Usage:
    python scripts/align.py <project_dir> [--fps 30] [--model base]
"""
import argparse
import json
from pathlib import Path


def transcribe(wav_path: Path, model, fps: int, t2s=None):
    segments, _ = model.transcribe(
        str(wav_path),
        word_timestamps=True,
        vad_filter=False,
        # Whisper auto-detects but for short clips it can guess wrong.
        # Hint Chinese explicitly so we get reliable results on CN content.
        language="zh",
        # Bias toward simplified Chinese vocab. Whisper still emits
        # traditional sometimes; we post-process with opencc below.
        initial_prompt="以下是简体中文的内容。",
    )
    captions = []
    # Group ~8 words per caption line for readability
    buf_text, buf_start, buf_end = [], None, None
    for seg in segments:
        for word in seg.words or []:
            if buf_start is None:
                buf_start = word.start
            buf_text.append(word.word.strip())
            buf_end = word.end
            if len(buf_text) >= 8:
                text = "".join(buf_text).strip()
                if t2s:
                    text = t2s.convert(text)
                captions.append({
                    "from": int(buf_start * fps),
                    "to": int(buf_end * fps),
                    "text": text,
                })
                buf_text, buf_start, buf_end = [], None, None
    if buf_text:
        text = "".join(buf_text).strip()
        if t2s:
            text = t2s.convert(text)
        captions.append({
            "from": int((buf_start or 0) * fps),
            "to": int((buf_end or 0) * fps),
            "text": text,
        })
    return captions


def wav_duration(wav_path: Path) -> float:
    import subprocess
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(wav_path)],
        text=True,
    )
    return float(out.strip())


def split_by_punct(text: str):
    import re
    # Split on Chinese/English sentence punctuation but keep non-empty pieces.
    parts = re.split(r"[，,。.！!？?；;]", text)
    return [p.strip() for p in parts if p.strip()]


def captions_from_script(text: str, wav_path: Path, fps: int):
    """Build captions from script's caption_text (or voice_text).

    Splits on punctuation, allocates each chunk a slice of wav duration
    proportional to its character count. 100% accurate text + natural
    breaks at punctuation, no Whisper guessing.
    """
    pieces = split_by_punct(text)
    if not pieces:
        return []
    duration = wav_duration(wav_path)
    total_chars = sum(len(p) for p in pieces) or 1
    captions = []
    cursor = 0.0
    for piece in pieces:
        share = len(piece) / total_chars
        seg_seconds = duration * share
        captions.append({
            "from": int(cursor * fps),
            "to": int((cursor + seg_seconds) * fps),
            "text": piece,
        })
        cursor += seg_seconds
    return captions


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("project")
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--model", default="base")
    ap.add_argument("--force-whisper", action="store_true",
                    help="Ignore script caption_text/voice_text, transcribe via Whisper")
    args = ap.parse_args()

    project = Path(args.project)
    workspace = project / "workspace"
    wavs = sorted(workspace.glob("*.wav"))
    if not wavs:
        print(f"no wav files under {workspace}")
        return 1

    # Prefer script.json's caption_text/voice_text — accurate text + natural
    # punctuation breaks, no Whisper transcription errors.
    script_path = project / "script.json"
    script = None
    if script_path.exists() and not args.force_whisper:
        script = json.loads(script_path.read_text())

    result = {}
    whisper_model = None
    t2s = None

    for wav in wavs:
        idx = wav.stem  # "00", "01", ...
        slide_idx = int(idx)
        caption_source = None
        if script and slide_idx < len(script.get("slides", [])):
            slide = script["slides"][slide_idx]
            caption_source = slide.get("voice_text") or slide.get("caption_text")

        if caption_source:
            print(f"aligning {wav.name} from script ({len(caption_source)} chars)...")
            result[idx] = captions_from_script(caption_source, wav, args.fps)
        else:
            # Fall back to Whisper
            if whisper_model is None:
                from faster_whisper import WhisperModel
                try:
                    from opencc import OpenCC
                    t2s = OpenCC("t2s")
                except ImportError:
                    print("opencc not installed; captions may contain traditional chars")
                    t2s = None
                whisper_model = WhisperModel(args.model, device="auto", compute_type="int8")
            print(f"aligning {wav.name} via whisper...")
            result[idx] = transcribe(wav, whisper_model, args.fps, t2s=t2s)

    out = workspace / "captions.json"
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(f"→ {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
