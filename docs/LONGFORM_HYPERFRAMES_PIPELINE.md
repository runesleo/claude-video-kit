# Long-form HyperFrames Pipeline · Overview

> **Scope**: 8–15 minute **horizontal** (1920×1080) videos rendered with **HyperFrames + GSAP**, not Remotion shorts.  
> **Last updated**: 2026-05-26 (long-form dogfood)

This repo (`claude-video-kit`) ships **shared building blocks**. The **HyperFrames composition layer** (`script-to-html.mjs` · ~2500 lines · landscape CSS · preview embed) lives in the production long-form workspace and has already been proven in production delivery; this public kit documents the reusable pieces.

---

## What lives in this repo (public)

| Component | Path | Role |
|-----------|------|------|
| TTS · CosyVoice | `scripts/tts_cosyvoice.py` | DashScope long-form voice (recommended ≥8min) |
| TTS · IndexTTS2 | `scripts/tts_indextts2.py` | Local / short clips |
| Caption align | `scripts/align.py` | Whisper word timestamps + script text |
| Distribute pack | `scripts/build-distribute-pack.mjs` | Bilibili / Douyin / XHS metadata folders |
| Metadata | `scripts/build-metadata.mjs` | Chapters for upload |
| Cover | `scripts/gen_video_cover.py` | Platform cover sizes |

---

## What lives in the production long-form workspace

| Component | Role |
|-----------|------|
| `scripts/script-to-html.mjs` | **`script.json` → `index.html`** · 横版编排 SSOT（production workflow） |
| `daily.sh` | End-to-end: review → crosscheck → TTS → align → HyperFrames render → BGM |
| `scripts/build-slide-review.mjs` + `slide-review-server.mjs` | Per-slide audio/caption/script review UI |
| `scripts/slide-approval.mjs` | Sign-off gate before render |
| `scripts/build-shot-sheet.mjs` | Full-video `preview.html` |
| `lanes/_long-form.md` | 12–15min writing rules |
| `SSOT-LONG-FORM-REVIEW.md` | Acceptance workflow |

If you open-source a fork, copy or link these docs — they are the operational SSOT for long-form quality.

---

## End-to-end flow (long-form)

```
paid article / draft.md
  → script-outline.json (time-coded beats)
  → script.json (voice_text expanded · ≥3800 chars for ~12min)
  → daily.sh --stage review     (long-form voice_chars gate)
  → crosscheck (recommended)
  → CosyVoice TTS → align → script-to-html
  → slide-review (all slides approved)
  → preview.html full listen
  → daily.sh --stage render
  → build-distribute-pack.mjs
```

---

## Duration gate (critical)

**Slide count ≠ duration.** A 28-slide script with ~1200 characters of voiceover is ~4 minutes, not 12.

Published long-form reference:

- ~2536 voice chars → ~7.6 min rendered
- Target 12–15 min → **~3800–4500+ voice chars**

The production long-form workflow auto-lints `long-form` projects and hard-fails when `voice_chars < 3000`.

---

## Render stack difference vs shorts

| | Shorts (this repo default) | Long-form (HyperFrames) |
|--|------------------------------|-------------------------|
| Aspect | 9:16 | 16:9 |
| Engine | Remotion (`render.sh`) | HyperFrames (`npx hyperframes render`) |
| Review | Studio / distribute | **slide-review.html** + approval JSON |
| TTS | **CosyVoice** | **CosyVoice** |

> **TTS backend is CosyVoice for both formats — this is not a per-format choice.**
> When the channel publishes under a person's own name, the voice is part of that
> identity; a stock voice makes it someone else talking, and the output sounds
> perfectly fine, so no QA step will ever catch it. `render.sh` therefore defaults
> to `cosyvoice`, `COSYVOICE_VOICE_ID` has no fallback to a preset voice, and an
> unrecognised `TTS_BACKEND` exits non-zero instead of silently falling through to
> a paid API. IndexTTS2 and Fish remain available for A/B comparison only.

---

## Environment variables (long-form render)

```bash
VOICE_WAV_BOUNDARY_SKIP=1   # after per-slide review; boundary can truncate CosyVoice heads
VIDEO_CROSSCHECK_STRICT=1   # paid / high-stakes scripts
SLIDE_REVIEW_SKIP=1         # emergency only — skips approval gate
```

---

## Examples in this repo

Shorts examples under `examples/` follow `docs/SHORTS_PIPELINE.md`.  
Long-form HyperFrames examples are content-linked and should use an anonymized project structure when added under `examples/`.

---

## Related docs

- [SHORTS_PIPELINE.md](./SHORTS_PIPELINE.md) — vertical ≤60s Remotion path
- [bgm-library-and-mux-flow.md](./bgm-library-and-mux-flow.md) — post-render audio used by the long-form workflow
