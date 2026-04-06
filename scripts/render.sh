#!/usr/bin/env bash
# render.sh — end-to-end pipeline: script.json → out/full.mp4
#
# Usage: ./scripts/render.sh <project_dir>
#
# Stages:
#   1. TTS        → workspace/*.wav
#   2. Align      → workspace/captions.json
#   3. Metadata   → metadata.json
#   4. Remotion   → out/full.mp4
set -euo pipefail

PROJECT="${1:-}"
if [[ -z "$PROJECT" ]]; then
  echo "usage: $0 <project_dir>" >&2
  exit 1
fi
PROJECT="$(cd "$PROJECT" && pwd)"
KIT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "▶ [1/4] TTS"
python3 "$KIT_ROOT/scripts/tts.py" "$PROJECT"

echo "▶ [2/4] Whisper align"
python3 "$KIT_ROOT/scripts/align.py" "$PROJECT" || echo "  (align failed, continuing without captions)"

echo "▶ [3/4] Build metadata"
node "$KIT_ROOT/scripts/build-metadata.mjs" "$PROJECT"

echo "▶ [4/4] Remotion render"
mkdir -p "$PROJECT/out"
cd "$KIT_ROOT/remotion"
npx remotion render src/index.ts Main "$PROJECT/out/full.mp4" \
  --props="$PROJECT/metadata.json" \
  --public-dir="$PROJECT/workspace"

echo "✅ done → $PROJECT/out/full.mp4"
