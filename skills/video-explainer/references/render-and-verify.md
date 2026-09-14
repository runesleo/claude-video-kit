# Render and verify

## Render

For an already configured local environment:

```bash
node scripts/video-explainer.mjs render <project>
```

For a credential-free macOS proof only:

```bash
node scripts/video-explainer.mjs render <project> --demo-quality
```

`--demo-quality` clears Fish Audio variables for the child process, uses macOS `say`, and aligns captions from reviewed script text without loading Whisper. It is not a production voice path.

## Objective verify

Run:

```bash
node scripts/verify-shorts.mjs <project>/out/full.mp4 \
  --metadata <project>/metadata.json
```

For generated videos, the duration-matched render schedule is the authoritative scene source; this avoids treating dark programmatic transitions as static frames. Without `--metadata`, the verifier falls back to visual scene detection. Both paths measure the opening and every scene interval, including the first and last.

Require a 1080×1920 canvas, no more than 60 seconds, an average scene interval of no more than 3 seconds, and a scene change in the first 2 seconds. Report soft warnings separately from hard failures.

This objective pass is necessary but insufficient. It does not prove hierarchy, alignment, phone-size readability, animation polish, end-card correctness, or chapter-level loudness consistency.

## Rendered-output review

After objective verification, a reviewer distinct from the producer must watch the exact MP4 and write `render-review-input.json` using the checks in [review-gate.md](review-gate.md).

Run:

```bash
node scripts/video-explainer.mjs review-render <project>/out/full.mp4 \
  --input <project>/render-review-input.json
```

The command writes `render-review-result.json` next to the video by default and binds the receipt to the MP4 SHA-256. Any re-render makes the receipt stale.

The rendered review must pass five design-quality checks — hierarchy, simplicity, clarity, legibility, and craft — plus `audio_consistency` and `end_card`. `audio_consistency` is separate because the current objective verifier does not yet automate chapter-level LUFS consistency.

The canonical `demo` command runs pre-render review, render, and objective verification in order and writes `video-explainer-result.json`. It deliberately reports the rendered-output review as not run: a demo cannot independently self-approve its own visual/audio output. Treat that result as local evidence, not publication approval.
