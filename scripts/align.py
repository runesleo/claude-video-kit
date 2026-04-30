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
    # Split on Chinese/English sentence punctuation, but DON'T split on:
    #   - "." between digits (e.g. 9.11, 9.9 — domain decimals)
    #   - "." between letters (e.g. leolabs.me, U.S. — domain dots, abbrevs)
    # Without this guard, captions from "9.11 比 9.9 大" would render
    # "9", "11 比 9", "9 大" with the decimal point lost.
    pattern = r"[，,。！!？?；;]|(?<![\w\d])\.|\.(?![\w\d])"
    parts = re.split(pattern, text)
    return [p.strip() for p in parts if p and p.strip()]


def captions_from_script(text: str, wav_path: Path, fps: int):
    """Build captions from script's voice_text using char-ratio split.

    Legacy fallback. Splits on punctuation, allocates each chunk a slice
    of wav duration proportional to its character count. Inaccurate when
    voice_text has mixed Chinese + English / proper nouns (different read
    speeds). Use captions_from_script_whisper_aligned() for production.
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


def captions_from_script_whisper_aligned(text: str, wav_path: Path, fps: int, model, t2s=None):
    """Hybrid: whisper word timestamps for accurate timing + voice_text for caption text.

    Whisper transcribes the wav with word_timestamps=True. We then map
    voice_text character positions to whisper character positions (linear
    stretch) to read out the actual time at each punctuation boundary.
    This handles uneven read speed (Chinese vs English vs proper nouns)
    that pure char-ratio cannot.

    Falls back to char-ratio if whisper produces no words.
    """
    segments, _ = model.transcribe(
        str(wav_path),
        word_timestamps=True,
        vad_filter=False,
        language="zh",
        initial_prompt="以下是简体中文的内容。",
    )
    # Build per-character end-time map from whisper words.
    whisper_char_times = []  # list of cumulative end times, one per char
    for seg in segments:
        for word in seg.words or []:
            wt = word.word.strip()
            if t2s:
                wt = t2s.convert(wt)
            n = len(wt)
            if n == 0:
                continue
            t_start = word.start
            t_end = word.end
            # Distribute word duration uniformly across its chars
            for k in range(n):
                ch_end = t_start + (t_end - t_start) * (k + 1) / n
                whisper_char_times.append(ch_end)

    if not whisper_char_times:
        # Whisper failed; fall back
        return captions_from_script(text, wav_path, fps)

    pieces = split_by_punct(text)
    if not pieces:
        return []

    voice_total = sum(len(p) for p in pieces) or 1
    whisper_total = len(whisper_char_times)
    duration = wav_duration(wav_path)

    captions = []
    voice_cursor = 0
    for piece in pieces:
        start_voice = voice_cursor
        end_voice = voice_cursor + len(piece)

        # Map voice char position to whisper char position
        start_whisper = int(start_voice * whisper_total / voice_total)
        end_whisper = int(end_voice * whisper_total / voice_total)
        # Clamp
        start_whisper = max(0, min(start_whisper, whisper_total - 1))
        end_whisper = max(0, min(end_whisper, whisper_total - 1))

        start_time = 0.0 if start_whisper == 0 else whisper_char_times[start_whisper - 1]
        end_time = whisper_char_times[end_whisper]

        # Clamp to wav duration
        end_time = min(end_time, duration)
        start_time = min(start_time, end_time)

        captions.append({
            "from": int(start_time * fps),
            "to": int(end_time * fps),
            "text": piece,
        })
        voice_cursor = end_voice

    return captions


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("project")
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--model", default="base")
    ap.add_argument("--force-whisper", action="store_true",
                    help="Ignore script caption_text/voice_text, transcribe via Whisper")
    ap.add_argument("--legacy-char-ratio", action="store_true",
                    help="Use old char-ratio split (no whisper). Inaccurate with mixed CN/EN.")
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

        # Lazy-load whisper unless using legacy char-ratio mode
        def _ensure_whisper():
            nonlocal whisper_model, t2s
            if whisper_model is None:
                from faster_whisper import WhisperModel
                try:
                    from opencc import OpenCC
                    t2s = OpenCC("t2s")
                except ImportError:
                    print("opencc not installed; captions may contain traditional chars")
                    t2s = None
                whisper_model = WhisperModel(args.model, device="auto", compute_type="int8")
            return whisper_model, t2s

        if caption_source and args.legacy_char_ratio:
            print(f"aligning {wav.name} from script (legacy char-ratio, {len(caption_source)} chars)...")
            result[idx] = captions_from_script(caption_source, wav, args.fps)
        elif caption_source:
            wm, ts = _ensure_whisper()
            print(f"aligning {wav.name} via whisper-timed voice_text ({len(caption_source)} chars)...")
            result[idx] = captions_from_script_whisper_aligned(caption_source, wav, args.fps, wm, t2s=ts)
        else:
            wm, ts = _ensure_whisper()
            print(f"aligning {wav.name} via whisper transcription...")
            result[idx] = transcribe(wav, wm, args.fps, t2s=ts)

    out = workspace / "captions.json"
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(f"→ {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
