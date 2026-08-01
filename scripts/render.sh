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

PYTHON="${PYTHON:-python3}"

# 2026-08-01：后端必须能从 script.json 的 _meta.tts_backend 读。
# 事故：Ondo 那期用 cosyvoice 克隆音色录好后，跑了一次 render.sh，
# 默认 fish 后端把 15.wav 直接覆盖成了别人的声音（27.9s → 22.8s）。
# 「项目该用哪个后端」是项目的属性，不该只活在某次调用的环境变量里。
BACKEND="${TTS_BACKEND:-$("$PYTHON" - "$PROJECT" <<'PY'
import json,sys,pathlib
try:
    d=json.loads((pathlib.Path(sys.argv[1])/"script.json").read_text())
    print(d.get("_meta",{}).get("tts_backend","") or "")
except Exception:
    print("")
PY
)}"
BACKEND="${BACKEND:-fish}"
echo "▶ [1/4] TTS (backend: $BACKEND)"
case "$BACKEND" in
  cosyvoice)
    "$PYTHON" "$KIT_ROOT/scripts/tts_cosyvoice.py" "$PROJECT"
    ;;
  indextts2)
    "$PYTHON" "$KIT_ROOT/scripts/tts_indextts2.py" "$PROJECT"
    ;;
  fish|*)
    "$PYTHON" "$KIT_ROOT/scripts/tts.py" "$PROJECT"
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
