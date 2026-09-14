#!/usr/bin/env python3
"""check_storyboard.py — reject card-stack-by-default video planning before TTS/render.

Usage:
    python3 scripts/check_storyboard.py <project_dir>

Canonical input: <project_dir>/motion-storyboard.json
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

SCHEMA = "motion-storyboard/v1"
REQUIRED_TEXT_FIELDS = (
    "id",
    "information_purpose",
    "visual_metaphor",
    "why_motion_beats_card",
)
GENERIC_MOTION = {
    "fade", "fade-in", "fade-out", "crossfade", "slide", "slide-in", "slide-out",
    "zoom", "scale", "pop", "wipe", "opacity",
}
CARD_WORDS = (
    "text card", "text-card", "card stack", "bullet list", "text panel",
    "卡片", "文字卡", "卡片堆叠", "bullet", "列表",
)


def clean(value) -> str:
    return str(value or "").strip()


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__.strip(), file=sys.stderr)
        return 1

    project = Path(sys.argv[1]).resolve()
    path = project / "motion-storyboard.json"
    if not path.exists():
        print(f"❌ motion storyboard missing: {path}", file=sys.stderr)
        return 2

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"❌ invalid motion-storyboard.json: {exc}", file=sys.stderr)
        return 2

    errors: list[str] = []
    if data.get("schema") != SCHEMA:
        errors.append(f"schema must be {SCHEMA}")

    scenes = data.get("scenes")
    if not isinstance(scenes, list) or len(scenes) < 3:
        errors.append("scenes must contain at least 3 planned scenes")
        scenes = scenes if isinstance(scenes, list) else []

    seen_ids: set[str] = set()
    generic_only = 0
    card_like = 0
    three_d_count = 0

    for index, scene in enumerate(scenes, start=1):
        label = f"scene {index}"
        if not isinstance(scene, dict):
            errors.append(f"{label} must be an object")
            continue

        for field in REQUIRED_TEXT_FIELDS:
            value = clean(scene.get(field))
            if not value:
                errors.append(f"{label} missing {field}")
            elif field == "why_motion_beats_card" and len(value) < 12:
                errors.append(f"{label} why_motion_beats_card is too vague (<12 chars)")

        scene_id = clean(scene.get("id"))
        if scene_id:
            if scene_id in seen_ids:
                errors.append(f"duplicate scene id: {scene_id}")
            seen_ids.add(scene_id)

        duration = scene.get("duration_hint_s")
        if not isinstance(duration, (int, float)) or duration <= 0:
            errors.append(f"{label} duration_hint_s must be a positive number")

        grammar = scene.get("motion_grammar")
        if not isinstance(grammar, list) or not grammar or any(not clean(x) for x in grammar):
            errors.append(f"{label} motion_grammar must be a non-empty string array")
        else:
            normalized = {clean(x).lower() for x in grammar}
            if normalized.issubset(GENERIC_MOTION):
                generic_only += 1

        metaphor = clean(scene.get("visual_metaphor")).lower()
        if any(word in metaphor for word in CARD_WORDS):
            card_like += 1

        three_d = scene.get("three_d")
        if not isinstance(three_d, dict) or not isinstance(three_d.get("used"), bool):
            errors.append(f"{label} three_d.used must be true or false")
        elif three_d["used"]:
            three_d_count += 1
            reason = clean(three_d.get("reason"))
            if len(reason) < 20:
                errors.append(f"{label} uses 3D without a specific ROI reason (>=20 chars required)")

    n = len(scenes)
    if n:
        max_generic = max(1, math.floor(n * 0.25))
        if generic_only > max_generic:
            errors.append(
                f"{generic_only}/{n} scenes use only generic entrance/exit motion; max allowed is {max_generic}. "
                "Use motion to explain state, flow, comparison, sequence, trajectory, or another information change."
            )

        max_card_like = max(1, math.floor(n * 0.25))
        if card_like > max_card_like:
            errors.append(
                f"{card_like}/{n} scenes are card/list-like; max allowed is {max_card_like}. "
                "Redesign the information as a visual metaphor instead of a card stack."
            )

    total_duration = sum(
        float(scene.get("duration_hint_s", 0))
        for scene in scenes
        if isinstance(scene, dict) and isinstance(scene.get("duration_hint_s"), (int, float))
    )

    print(
        f"motion storyboard: scenes={n} · duration_hint={total_duration:.1f}s · "
        f"generic_only={generic_only} · card_like={card_like} · 3d={three_d_count}"
    )

    if errors:
        print("❌ MOTION STORYBOARD BLOCKED", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return 2

    print("✅ MOTION STORYBOARD PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
