#!/usr/bin/env bash
# asset-version: v0.3.0-rc.1
# updated: 2026-07-22
# owner_surface: claude-video-kit / video-explainer rendering
# behavior_change: add an explicit script-timed caption mode for the no-key canonical demo
# rollback: remove VIDEO_EXPLAINER_ALIGN_MODE handling and restore best-effort Whisper alignment
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
ALIGN_MODE="${VIDEO_EXPLAINER_ALIGN_MODE:-whisper}"
case "$ALIGN_MODE" in
  whisper|script) ;;
  *)
    echo "unsupported VIDEO_EXPLAINER_ALIGN_MODE: $ALIGN_MODE (expected whisper or script)" >&2
    exit 2
    ;;
esac

echo "▶ [1/4] TTS (backend: ${TTS_BACKEND:-cosyvoice})"
PYTHON="${PYTHON:-python3}"
# 默认 cosyvoice：唯一使用本人克隆音色的后端。其余后端是通用音色，
# 用在本人署名的内容上等于换了个人说话，因此不作默认，也不作兜底。
# 未知值一律报错退出 —— 旧版 `fish|*` 的通配兜底会把任何拼错的后端名
# 静默导向付费 API（2026-08-17 即因此在未确认的情况下产生了一次付费消耗）。
case "${TTS_BACKEND:-cosyvoice}" in
  cosyvoice)
    "$PYTHON" "$KIT_ROOT/scripts/tts_cosyvoice.py" "$PROJECT"
    ;;
  indextts2)
    "$PYTHON" "$KIT_ROOT/scripts/tts_indextts2.py" "$PROJECT"
    ;;
  fish)
    echo "  ⚠️  fish = 通用音色 + 付费 API，非本人声音。仅供对照测试，不要用于发布内容。" >&2
    "$PYTHON" "$KIT_ROOT/scripts/tts.py" "$PROJECT"
    ;;
  *)
    echo "unsupported TTS_BACKEND: ${TTS_BACKEND} (expected cosyvoice, indextts2 or fish)" >&2
    exit 2
    ;;
esac

if [[ "$ALIGN_MODE" == "script" ]]; then
  echo "▶ [2/4] Script-timed caption align (demo-quality, no Whisper download)"
  "$PYTHON" "$KIT_ROOT/scripts/align.py" "$PROJECT" --legacy-char-ratio
else
  echo "▶ [2/4] Whisper align"
  "$PYTHON" "$KIT_ROOT/scripts/align.py" "$PROJECT" || echo "  (align failed, continuing without captions)"
fi

echo "▶ [3/4] Build metadata"
node "$KIT_ROOT/scripts/build-metadata.mjs" "$PROJECT"

echo "▶ [4/4] Remotion render"
mkdir -p "$PROJECT/out"
cd "$KIT_ROOT/remotion"
# Note: Remotion v4 --props expects either inline JSON or doesn't auto-load
# file paths reliably. We pass file content via $(cat) so the JSON is inlined.
PROPS_JSON="$(cat "$PROJECT/metadata.json")"
./node_modules/.bin/remotion render src/index.ts Main "$PROJECT/out/full.mp4" \
  --props="$PROPS_JSON" \
  --public-dir="$PROJECT/workspace"

echo "✅ done → $PROJECT/out/full.mp4"
