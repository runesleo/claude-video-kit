# Pre-render review gate

> The canonical implementation is the script-bound `video-explainer` review receipt. This file explains why the gate exists; it is no longer merely a convention.

## Why

The pipeline turns `script.json` into a rendered video through TTS, alignment, and Remotion. Errors caught after render cost a full re-render plus another distribution-pack cycle. Errors caught before TTS are cheap.

A second problem is subtler: a script can be factually correct and technically renderable while still producing a frame that feels wrong — weak hierarchy, unnecessary decoration, poor phone-size readability, inconsistent spacing, or noisy motion. Those defects need explicit criteria rather than model taste.

## Canonical gate

Before `scripts/render.sh` can run through the guarded entrypoint, a reviewer distinct from the script author must review the exact `script.json` bytes and pass all eleven checks:

1. **facts** — numbers, dates, names, API behavior, and other factual claims.
2. **structure** — hook, explanation, transitions, and close are coherent.
3. **duration** — narration fits the target duration.
4. **visual_feasibility** — every planned scene maps to a supported composition and the existing design system.
5. **hierarchy** — each frame has one clear primary read.
6. **simplicity** — no element exists without an information, evidence, navigation, or brand job.
7. **clarity** — scale, spacing, position, labels, and contrast establish the reading order.
8. **legibility** — text and evidence remain readable at actual phone viewing size.
9. **craft** — alignment, spacing rhythm, typography, components, charts, transitions, and motion are internally consistent.
10. **privacy** — no private, identifying, credential, or unauthorized material.
11. **copyright** — media and copy are owned, licensed, or otherwise permitted.

Run:

```bash
node scripts/video-explainer.mjs review <project> --input <project>/review-input.json
```

Any `fix` or `block` stops rendering. Any edit to `script.json` invalidates the receipt.

The five design-quality checks are informed by Apple platform design guidance as a quality lens, not a visual style target: https://developer.apple.com/design/

They do **not** authorize changes to `config/design-system.json`, one-off colors, new font stacks, or Apple-like styling. The existing brand system remains authoritative.

## Why pre-render review is not enough

Some defects only exist in the actual MP4: visual centering can feel wrong after animation, captions can collide at real speed, transitions can become noisy, and chapter-level audio can jump even when the script is fine.

After render, run objective verification and then the separate, video-bound rendered-output review documented in `skills/video-explainer/references/review-gate.md`.

The rendered-output gate rechecks hierarchy, simplicity, clarity, legibility, and craft on the moving image, plus separate `audio_consistency` and `end_card` checks. The audio check is deliberately separate from design quality because the current verifier does not yet automate chapter-level LUFS consistency.

## When the gate pays off most

- 10+ slide videos with numeric claims.
- Scripts generated from research documents where terminology can drift.
- First-time topics or new visual compositions.
- Multi-platform videos where one mistake multiplies across uploads.
- Any artifact where the first reaction is “nothing is obviously broken, but it looks wrong.”
