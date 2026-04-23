#!/usr/bin/env bash
# prepend-cover.sh — prepend a still-image cover as a N-second intro to a video.
#
# Auto-detects target width/height/fps (as an exact rational) and audio stream
# presence/sample-rate/channel-layout from the main video so the intro clip
# matches exactly. This lets concat demuxer stay in lossless `-c copy`; when
# codec params mismatch we fall back to a re-encode.
#
# Usage:
#   prepend-cover.sh --cover cover.png --video main.mp4 [--duration 3] --out out.mp4
#
# Pair with scripts/shift-subtitles.py to offset accompanying .srt by the same
# --duration value.

set -euo pipefail

COVER=""
VIDEO=""
DURATION=3
OUT=""

require_value() {
  # $1 = flag name, $2 = value (may be empty), exits if missing.
  if [[ $# -lt 2 || -z "${2:-}" || "${2:0:2}" == "--" ]]; then
    echo "error: flag $1 requires a value" >&2
    exit 2
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --cover)    require_value "$1" "${2:-}"; COVER="$2";    shift 2 ;;
    --video)    require_value "$1" "${2:-}"; VIDEO="$2";    shift 2 ;;
    --duration) require_value "$1" "${2:-}"; DURATION="$2"; shift 2 ;;
    --out)      require_value "$1" "${2:-}"; OUT="$2";      shift 2 ;;
    -h|--help)
      sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *)
      echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$COVER" || -z "$VIDEO" || -z "$OUT" ]]; then
  echo "usage: $0 --cover X.png --video Y.mp4 [--duration 3] --out Z.mp4" >&2
  exit 2
fi
[[ -f "$COVER" ]] || { echo "cover not found: $COVER" >&2; exit 1; }
[[ -f "$VIDEO" ]] || { echo "video not found: $VIDEO" >&2; exit 1; }

command -v ffmpeg  >/dev/null || { echo "ffmpeg not in PATH"  >&2; exit 1; }
command -v ffprobe >/dev/null || { echo "ffprobe not in PATH" >&2; exit 1; }

# Probe main video: width/height and the exact rational frame rate.
WIDTH=$(ffprobe -v error -select_streams v:0 -show_entries stream=width  -of csv=p=0 "$VIDEO")
HEIGHT=$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 "$VIDEO")
FPS=$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 "$VIDEO")
# Some streams report "0/0" in r_frame_rate; fall back to avg_frame_rate.
if [[ -z "$FPS" || "$FPS" == "0/0" ]]; then
  FPS=$(ffprobe -v error -select_streams v:0 -show_entries stream=avg_frame_rate -of csv=p=0 "$VIDEO")
fi
[[ -n "$FPS" && "$FPS" != "0/0" ]] || { echo "could not determine fps for $VIDEO" >&2; exit 1; }

# Probe audio: does main have an audio stream, and if so what's sample rate + layout?
AUDIO_CODEC=$(ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of csv=p=0 "$VIDEO" || true)
HAS_AUDIO=0
AUDIO_RATE=44100
AUDIO_LAYOUT="stereo"
if [[ -n "$AUDIO_CODEC" ]]; then
  HAS_AUDIO=1
  AUDIO_RATE=$(ffprobe -v error -select_streams a:0 -show_entries stream=sample_rate -of csv=p=0 "$VIDEO" || echo 44100)
  LAYOUT_PROBE=$(ffprobe -v error -select_streams a:0 -show_entries stream=channel_layout -of csv=p=0 "$VIDEO" || true)
  if [[ -n "$LAYOUT_PROBE" && "$LAYOUT_PROBE" != "unknown" ]]; then
    AUDIO_LAYOUT="$LAYOUT_PROBE"
  else
    CHANNELS=$(ffprobe -v error -select_streams a:0 -show_entries stream=channels -of csv=p=0 "$VIDEO" || echo 2)
    case "$CHANNELS" in
      1) AUDIO_LAYOUT="mono" ;;
      2) AUDIO_LAYOUT="stereo" ;;
      *) AUDIO_LAYOUT="stereo" ;;
    esac
  fi
fi

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

INTRO="$TMPDIR/intro.mp4"
CONCAT_LOG="$TMPDIR/concat-copy.err"

# Build intro: still image × DURATION seconds, matching WIDTHxHEIGHT@FPS.
# If main video has audio, build a silent track matching its sample rate +
# channel layout; otherwise skip audio entirely so concat stays consistent.
VIDEO_FILTER="scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p"

if [[ "$HAS_AUDIO" == "1" ]]; then
  ffmpeg -y -loglevel error \
    -loop 1 -framerate "$FPS" -t "$DURATION" -i "$COVER" \
    -f lavfi -t "$DURATION" -i "anullsrc=channel_layout=${AUDIO_LAYOUT}:sample_rate=${AUDIO_RATE}" \
    -vf "$VIDEO_FILTER" \
    -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -r "$FPS" \
    -c:a aac -b:a 128k -shortest \
    "$INTRO"
else
  ffmpeg -y -loglevel error \
    -loop 1 -framerate "$FPS" -t "$DURATION" -i "$COVER" \
    -vf "$VIDEO_FILTER" \
    -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -r "$FPS" \
    -an \
    "$INTRO"
fi

# Resolve absolute paths for the concat demuxer, then escape single quotes
# and backslashes inside the ffconcat file syntax (file 'path').
resolve_abs() {
  python3 -c 'import os,sys; print(os.path.abspath(sys.argv[1]))' "$1"
}
ffconcat_escape() {
  # Replace \ → \\ then ' → '\\''  (ffconcat file line escaping)
  python3 -c '
import sys
s = sys.argv[1]
s = s.replace("\\", "\\\\").replace("'\''", "\\'\''")
print(s)
' "$1"
}

INTRO_ABS=$(resolve_abs "$INTRO")
VIDEO_ABS=$(resolve_abs "$VIDEO")
INTRO_ESC=$(ffconcat_escape "$INTRO_ABS")
VIDEO_ESC=$(ffconcat_escape "$VIDEO_ABS")

CONCAT="$TMPDIR/concat.txt"
{
  printf "file '%s'\n" "$INTRO_ESC"
  printf "file '%s'\n" "$VIDEO_ESC"
} > "$CONCAT"

# Try lossless copy first; if codec params differ, fall back to re-encode.
# Keep copy-concat stderr so fallback failures can be diagnosed.
if ffmpeg -y -loglevel error -f concat -safe 0 -i "$CONCAT" -c copy "$OUT" 2>"$CONCAT_LOG"; then
  :
else
  echo "⚠️  copy-concat failed, re-encoding (slower but safe)" >&2
  if [[ -s "$CONCAT_LOG" ]]; then
    echo "   copy-concat stderr:" >&2
    sed 's/^/     /' "$CONCAT_LOG" >&2
  fi
  if [[ "$HAS_AUDIO" == "1" ]]; then
    ffmpeg -y -loglevel error -f concat -safe 0 -i "$CONCAT" \
      -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
      -c:a aac -b:a 128k "$OUT"
  else
    ffmpeg -y -loglevel error -f concat -safe 0 -i "$CONCAT" \
      -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
      -an "$OUT"
  fi
fi

echo "→ $OUT (prepended ${DURATION}s cover @ ${WIDTH}x${HEIGHT}@${FPS}fps, audio=${HAS_AUDIO})"
