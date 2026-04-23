#!/usr/bin/env python3
"""shift-subtitles.py — shift every timestamp in an .srt by a fixed offset.

Typical use case: you prepended an N-second intro clip to the rendered video
via scripts/prepend-cover.sh, and now the existing .srt needs to slide
forward by the same N seconds.

Usage:
    shift-subtitles.py --input in.srt --offset-seconds 3 --output out.srt

Negative offsets are rejected when they'd push any timestamp below 0.
"""

import argparse
import re
import sys
from pathlib import Path

# Matches "HH:MM:SS,mmm --> HH:MM:SS,mmm [trailing cue settings]".
# Optional trailing settings (e.g. "X1:... X2:... Y1:... Y2:..." or
# "line:80% align:center") are preserved untouched.
TIMESTAMP_LINE = re.compile(
    r"^(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})(?P<tail>.*)$"
)


def to_ms(h: str, m: str, s: str, ms: str) -> int:
    return ((int(h) * 60 + int(m)) * 60 + int(s)) * 1000 + int(ms)


def from_ms(total_ms: int) -> str:
    if total_ms < 0:
        raise ValueError(f"negative timestamp after shift: {total_ms}ms")
    hours, rem = divmod(total_ms, 3_600_000)
    minutes, rem = divmod(rem, 60_000)
    seconds, millis = divmod(rem, 1000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{millis:03d}"


def shift_line(line: str, offset_ms: int) -> tuple[str, bool]:
    """Return (possibly shifted line, is_cue_line)."""
    # Strip EOL for matching, remember it, reattach on output.
    if line.endswith("\r\n"):
        eol = "\r\n"
        body = line[:-2]
    elif line.endswith("\n"):
        eol = "\n"
        body = line[:-1]
    else:
        eol = ""
        body = line
    match = TIMESTAMP_LINE.match(body)
    if not match:
        return line, False
    start = to_ms(*match.group(1, 2, 3, 4)) + offset_ms
    end = to_ms(*match.group(5, 6, 7, 8)) + offset_ms
    tail = match.group("tail") or ""
    return f"{from_ms(start)} --> {from_ms(end)}{tail}{eol}", True


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--input", required=True, help="input .srt path")
    ap.add_argument("--offset-seconds", type=float, required=True,
                    help="seconds to add (positive) or subtract (negative)")
    ap.add_argument("--output", required=True, help="output .srt path")
    args = ap.parse_args()

    offset_ms = int(round(args.offset_seconds * 1000))

    src = Path(args.input)
    dst = Path(args.output)
    if not src.is_file():
        print(f"error: input not found: {src}", file=sys.stderr)
        return 1

    # Read as bytes to preserve BOM if present.
    raw = src.read_bytes()
    encoding = "utf-8-sig" if raw.startswith(b"\xef\xbb\xbf") else "utf-8"
    text = raw.decode(encoding)
    # splitlines(keepends=True) preserves \r\n vs \n exactly.
    lines = text.splitlines(keepends=True)
    shifted_lines: list[str] = []
    cue_count = 0
    try:
        for line in lines:
            new_line, is_cue = shift_line(line, offset_ms)
            shifted_lines.append(new_line)
            if is_cue:
                cue_count += 1
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    dst.parent.mkdir(parents=True, exist_ok=True)
    out_bytes = "".join(shifted_lines).encode(encoding)
    dst.write_bytes(out_bytes)
    print(f"→ {dst} (offset {args.offset_seconds:+.3f}s, {cue_count} cues shifted)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
