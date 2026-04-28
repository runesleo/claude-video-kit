"""Build SRT from captions.json + metadata.json (frame-relative → global)."""
import json
from pathlib import Path

ROOT = Path(__file__).parent
META = json.loads((ROOT / "metadata.json").read_text())
CAPS = json.loads((ROOT / "workspace/captions.json").read_text())
FPS = META["fps"]

def fmt(frame: int) -> str:
    s = frame / FPS
    h = int(s // 3600)
    m = int((s % 3600) // 60)
    sec = s - h * 3600 - m * 60
    return f"{h:02d}:{m:02d}:{sec:06.3f}".replace(".", ",")

offset_frames = 0
lines = []
idx_global = 0
for i, slide in enumerate(META["slides"]):
    key = f"{i:02d}"
    for cap in CAPS.get(key, []):
        idx_global += 1
        gf_from = offset_frames + cap["from"]
        gf_to = offset_frames + cap["to"]
        lines.append(f"{idx_global}\n{fmt(gf_from)} --> {fmt(gf_to)}\n{cap['text']}\n")
    offset_frames += slide["durationInFrames"]

(ROOT / "distribute/subtitles-zh.srt").write_text("\n".join(lines))
print(f"→ distribute/subtitles-zh.srt ({idx_global} cues)")
