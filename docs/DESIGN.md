# DESIGN.md

> Single source of truth for the visual system of `claude-video-kit`.
> Read this before editing `script.json`, adding a new slide type, or
> changing any composition under `remotion/src/compositions/`.

This file is **descriptive**, not aspirational. Every value below is grepped
out of the actual code in `remotion/src/`. If you change the code and don't
update this file, the file is wrong — fix it.

---

## 1. Brand tokens

### Accent colors (5)

| Token  | Hex       | Used for                                              |
|--------|-----------|-------------------------------------------------------|
| green  | `#4fae50` | Default brand accent · Inflow · positive · drift glow |
| blue   | `#1060b0` | Position · neutral data                               |
| orange | `#ee943e` | Top-gradient finisher · attention                     |
| red    | `#ef4444` (with `#dc2626` gradient pair) | Outflow · warning · badge   |
| gold   | `#f0c040` | Risk · highlight                                      |

The brand mark on every slide is the top tri-color line:
`linear-gradient(90deg, #4fae50, #1060b0, #ee943e)`. Don't override it
unless the entire video is off-brand on purpose.

### Backgrounds (4 levels, dark only)

| Hex       | Where                                                        |
|-----------|--------------------------------------------------------------|
| `#0a0a0f` | `BrandedSlideLayout` page bg (deepest)                       |
| `#0b0b0f` | `CodeSlide`, `TextSlide` page bg                             |
| `#0d1117` / `#111318` | `TableSlide` zebra rows                          |
| `#16161e` | `CodeSlide` content card                                     |

Cover uses a gradient: `linear-gradient(180deg, #0b0b0f 0%, #1a1a25 100%)`.

### Text gray scale (6 stops)

`#fff` → `#f9fafb` → `#e5e7eb` → `#9ca3af` → `#6b7280` → `#4b5563`

| Stop      | Use                                                  |
|-----------|------------------------------------------------------|
| `#fff`    | Cover title, TextSlide caption-on-bg                 |
| `#f9fafb` | Rich-slide titles (content / table / formula / transition) |
| `#e5e7eb` | Body / bullet text                                   |
| `#9ca3af` | Subtitles, secondary labels, brand URL line          |
| `#6b7280` | Code header, tertiary labels                         |
| `#4b5563` | Slide counter only                                   |

---

## 2. Typography

### Font stacks (3, by purpose)

| Stack                                                              | Used by                                |
|--------------------------------------------------------------------|----------------------------------------|
| `"PingFang SC", "SF Pro Display", "Helvetica Neue", sans-serif`    | `BrandedSlideLayout` default — body, watermark |
| `-apple-system, Inter, sans-serif`                                 | `CoverSlide`, `TextSlide` titles       |
| `'Geist Mono', 'SF Mono', monospace`                               | `CodeSlide` (header + body), formula tokens |

The PingFang stack is the primary for any new slide that mixes Chinese and
English. Don't introduce a 4th stack unless you're adding a fundamentally
new slide kind (e.g. handwriting, display).

### Size ladder (px, 16 stops actually in use)

| Size | Use                                                            |
|------|----------------------------------------------------------------|
| 96   | CoverSlide title (the only place this big)                     |
| 72   | TextSlide title                                                |
| 64   | TransitionSlide title                                          |
| 52   | Rich-slide titles: content / table / formula                   |
| 48   | TextSlide body-on-card                                         |
| 44   | CodeSlide code body                                            |
| 40   | CoverSlide subtitle                                            |
| 36   | ContentSlide badge                                             |
| 34   | ContentSlide body / bullets                                    |
| 32   | TransitionSlide bullets                                        |
| 28   | FormulaSlide row label, TableSlide footer                      |
| 26   | FormulaSlide token pill, NumberTicker default                  |
| 24   | CodeSlide header label, TableSlide header row                  |
| 22   | FormulaSlide sub-label                                         |
| 18   | Slide counter (bottom-left), brand handle                      |
| 14   | Brand URL                                                      |

If you need a size that's not on the ladder, you're probably solving the
wrong problem. Pick the nearest existing size first.

---

## 3. Slide types

The pipeline has **7 slide types**. Two tiers:

### Core (minimal, generic)

| Type   | Schema                                                         | Use when                                  |
|--------|----------------------------------------------------------------|-------------------------------------------|
| `cover`| `title`, `subtitle?`                                           | Slide 1 only. Big hero.                   |
| `text` | `text`, `voice_text`                                           | A single sentence on a dark slide.        |
| `code` | `language`, `code`, `voice_text`                               | Verbatim code. Don't paraphrase in here.  |

### Rich (branded, animated, data-heavy)

| Type        | Schema                                                                           | Use when                                       |
|-------------|----------------------------------------------------------------------------------|------------------------------------------------|
| `content`   | `title`, `badge?`, `bullets?` OR `body`, `brand?`                                | Bullet lists with a numeric/colored badge.     |
| `table`     | `title`, `tableData: { headers, rows }`                                          | 3+ rows of comparison or metrics.              |
| `formula`   | `title`, `formulaGroups: [{ label, tokens, color }]`                             | Decomposing a quantity into colored components.|
| `transition`| `title`, `bullets?`, `bulletColor?`                                              | Chapter break or "now we're switching to ___". |

Rules:

- Don't reach for `content` when `text` will do — fewer slide types per
  video reads tighter.
- `formula` color must come from the 5-token palette (green/blue/red/gold/orange).
  Don't introduce a 6th color just because you have a 6th category.
- `table` rows render with a NumberTicker animation. Don't put non-numeric
  cells into `cell.color` — the animation assumes numeric.

---

## 4. Layout

### Page padding

- `BrandedSlideLayout`: `80px 120px` for the main content frame.
- `CoverSlide` / `TextSlide`: `80px` all around (full-bleed).
- `CodeSlide`: `60px` outer, `48px 56px` for the code card.

### Spacing (gap)

`50` (transition rows) → `28 / 24 / 20` (vertical sections) → `16 / 14 / 12`
(formula tokens, brand cluster).

### Brand watermark (bottom-right)

- Logo: 56×56 px, `borderRadius: 12`, 2px border in accent color.
- Handle: 18px / 600, `letterSpacing: 0.3`.
- URL: 14px, `#9ca3af`.
- Cluster `gap: 14px`, opacity `0.92`.

### Slide counter (bottom-left)

`18px / #4b5563` at `bottom: 40, left: 120`. Don't move it. It's the only
visual anchor that helps reviewers reference a slide by index.

---

## 5. Motion

`BrandedSlideLayout` ships these defaults — don't reimplement per-slide:

| Phase       | Frames | Effect                                        |
|-------------|--------|-----------------------------------------------|
| Enter fade  | 0–15   | opacity 0 → 1                                 |
| Enter scale | 0–20   | scale 0.985 → 1                               |
| Sustain     | every  | 6s breathing radial gradient (drift)          |
| Exit fade   | last 12 frames | opacity → 0.15                        |

Adding a new motion to a slide should be **on top of** these, not in place
of them. If you want zero motion (e.g. a still hero), pass
`durationInFrames` undefined to skip exit fade — don't bypass the layout.

---

## 6. Do's and Don'ts

**Do:**

- Reuse one of the 16 existing font sizes.
- Reuse one of the 5 accent colors for any new colored element.
- Keep `cover` for slide 1 only.
- Pass `brand` through `Metadata`, not per-slide hardcoded.
- Verify a new slide renders against the dark `#0a0a0f` page bg, not white.

**Don't:**

- Don't add a 6th brand color. Pick the closest of the 5.
- Don't use the 96px size anywhere except `CoverSlide`.
- Don't put code into `text` — `CodeSlide` exists for a reason
  (monospace + header + scroll guard).
- Don't paraphrase code in `voice_text` — read it literally so subtitle
  alignment matches what's on screen.
- Don't override `topGradient` for a single slide. It's a video-wide brand
  signal, not a slide-level decoration.
- Don't introduce light backgrounds. The whole system assumes dark.

---

## 7. How AI should use this file

When asked to **edit `script.json`** or **add a new composition**:

1. Pick a slide type from §3 first. If none fit, stop and ask — adding a
   new type is a system change, not a config change.
2. Pull colors from §1 (accents) and font sizes from §2 (ladder). Reject
   any value not on those tables.
3. Cross-check §6 Don'ts before writing the diff.
4. If the change requires a value outside this file's tables, say so
   explicitly in the diff message — don't silently introduce it.

When asked to **change a slide composition's code**:

1. Update the matching value in this file in the same commit.
2. If you remove a value, remove its row from §1 / §2.

This file is the contract. If it drifts from the code, the code wins, but
that's a bug in process, not a feature of the system.
