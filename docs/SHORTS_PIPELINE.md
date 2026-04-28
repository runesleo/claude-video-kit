# Shorts Pipeline

Phase 1 of claude-video-kit's video format routing: vertical 9:16 short
videos (≤60s, big text, dense motion) for YouTube Shorts / 抖音 / TikTok /
小红书 / B 站 Shorts.

## Quick start

```jsonc
{
  "title": "My shorts",
  "preset": "shorts",
  "width": 1080,        // ignored when preset is set
  "height": 1920,       // ignored when preset is set
  "fps": 30,            // ignored when preset is set
  "slides": [
    {
      "type": "numberHero",
      "durationInFrames": 60,
      "heroValue": "67%",
      "heroLabel": "of AI screening tools prefer AI-rewritten resumes",
      "heroBadge": "Truth #1",
      "heroAccentColor": "#10b981"
    },
    {
      "type": "text",
      "textMode": "hero",
      "textReveal": "spring",
      "durationInFrames": 60,
      "text": "But the bias direction\nisn't what you'd guess",
      "accentColor": "#ef4444"
    }
  ]
}
```

Render + verify:

```bash
cd remotion && npx remotion render Main ../out/shorts.mp4 --props=../my-shorts/metadata.json
cd .. && node scripts/verify-shorts.mjs out/shorts.mp4
```

## Preset system

Set `preset: "shorts"` (or `"mid"` / `"long"`, stub for phase 2-3) to
override canvas dimensions, fps, and font scale in one place.

| Preset | Canvas    | fps | fontScale | Default slide | Max duration |
|--------|-----------|-----|-----------|---------------|--------------|
| shorts | 1080×1920 | 30  | 1.6×      | 60 frames     | 60s          |
| mid    | 1920×1080 | 30  | 1.0×      | 240 frames    | 1200s        |
| long   | 1920×1080 | 30  | 0.9×      | 480 frames    | 7200s        |

Without `preset`, the metadata's own `width` / `height` / `fps` are used
(legacy mode — keeps existing horizontal examples working unchanged).

## Slide types added in Phase 1

### `numberHero` — data-hook moment

One big number occupies most of the screen with a short label and optional
accent badge. Number animates from 0 → target via ease-out cubic
(`NumberTicker`), with spring entrance + radial glow behind it.

```jsonc
{
  "type": "numberHero",
  "durationInFrames": 60,
  "heroValue": "67%",     // accepts "67%" or 67 — auto-detects format
  "heroLabel": "AI prefers AI-rewritten resumes",
  "heroBadge": "Truth #1",
  "heroPrefix": "+",      // optional, overrides parsed prefix
  "heroSuffix": "%",      // optional, overrides parsed suffix
  "heroAccentColor": "#10b981"
}
```

### `text` with `textMode: "hero"`

Existing `text` slide gains a hero mode: big font (96 base × fontScale ≈
154px @ shorts), spring or typewriter reveal, radial accent glow.

```jsonc
{
  "type": "text",
  "textMode": "hero",
  "textReveal": "spring",     // or "typewriter"
  "durationInFrames": 60,
  "text": "AI 帮你改简历\n真的有用吗？",
  "accentColor": "#f59e0b"
}
```

## Captions

Captions are rendered globally by `CaptionsLayer` at the slide level — same
styling for every slide type. To add captions, attach them to any slide:

```jsonc
{
  "type": "text",
  "textMode": "hero",
  "durationInFrames": 90,
  "text": "Three truths about AI resume bias",
  "captions": [
    { "from": 0,  "to": 30, "text": "三个真相" },
    { "from": 30, "to": 90, "text": "关于 AI 简历偏见" }
  ],
  "captionHighlight": ["真相", "AI"],
  "captionPosition": "bottom"
}
```

Features:

- 56px base × fontScale ≈ 90px @ shorts
- Heavy 4px black outline (readable over any background)
- Keyword highlight via `captionHighlight: string[]` → accent color + bold
- CJK-aware line wrap (≤10 chars/line, configurable via `captionMaxCharsPerLine`)
- Spring entrance per caption (no static fade)
- Position: `top` / `center` / `bottom` (default lower-third)

## Objective verification gate

`scripts/verify-shorts.mjs` runs `ffprobe` + `ffmpeg` scene detection on a
rendered mp4 and checks 4 hard gates:

1. Canvas is 1080×1920
2. Duration ≤ 60s (YouTube Shorts hard cap)
3. Average scene-change interval ≤ 3.0s
4. ≥1 scene change in the first 2s (animated hook entrance)

Plus 2 soft warnings (median interval > 2.5s, file size > 30MB).

Use it as a pre-publish gate:

```bash
node scripts/verify-shorts.mjs out/shorts.mp4
# ✅ PASS (4/4 hard gates) → exit 0
# ❌ FAIL (2 of 4 hard gates failed) → exit 1
```

The horizontal v1 of `examples/ai-resume-bias-truth/out/full.mp4` (76s,
1920×1080, static slides) fails all 4 gates — the rebuild as
`examples/ai-resume-bias-truth-shorts/` passes all 4 (1080×1920, 32.7s,
13 scene cuts, avg 2.17s interval).

## Rhythm guidance

Shorts viral norm (industry consensus, no data fetched):

- Median scene change: 1.5-2.5s (TikTok / 抖音 dense end)
- YouTube Shorts: 2-4s (slightly slower)
- Hook (first 2s): big number / reversal / visual surprise — never static
- Subtitle font: 8-12% of canvas height
- Per-slide duration: 1.5-3s, max ~5s for "explanation" slides

## What's not in Phase 1

- Whisper-driven word-level timecode → auto-cut sub-shots from a single wav
- Pexels / Pixabay B-roll auto-fetch
- Mid-video / long-video presets and slide types
- LLM script generation from topic → metadata.json
- Font-height-ratio OCR check (verify-shorts soft gate phase 2)
