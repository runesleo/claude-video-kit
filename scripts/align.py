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


def transcribe(wav_path: Path, model, fps: int):
    segments, _ = model.transcribe(
        str(wav_path),
        word_timestamps=True,
        vad_filter=False,
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
                captions.append({
                    "from": int(buf_start * fps),
                    "to": int(buf_end * fps),
                    "text": "".join(buf_text).strip(),
                })
                buf_text, buf_start, buf_end = [], None, None
    if buf_text:
        captions.append({
            "from": int((buf_start or 0) * fps),
            "to": int((buf_end or 0) * fps),
            "text": "".join(buf_text).strip(),
        })
    return captions


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("project")
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--model", default="base")
    args = ap.parse_args()

    from faster_whisper import WhisperModel

    project = Path(args.project)
    workspace = project / "workspace"
    wavs = sorted(workspace.glob("*.wav"))
    if not wavs:
        print(f"no wav files under {workspace}")
        return 1

    model = WhisperModel(args.model, device="auto", compute_type="int8")
    result = {}
    for wav in wavs:
        idx = wav.stem  # "00", "01", ...
        print(f"aligning {wav.name}...")
        result[idx] = transcribe(wav, model, args.fps)

    out = workspace / "captions.json"
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(f"→ {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
