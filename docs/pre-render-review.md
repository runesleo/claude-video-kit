# Pre-render review gate

> Convention, not code — but the highest-leverage 5 minutes in the pipeline.

## Why

The v0.1 pipeline turns `script.json` into `out/full.mp4` in roughly 30
minutes (TTS + Whisper align + Remotion render). Every factual error caught
*after* render costs another 30 minutes to fix — plus re-running
`build-distribute-pack` and re-uploading 4 platform packages.

Every error caught *before* TTS costs zero re-render time.

## The gate

Before you run `scripts/render.sh`, hand the final `script.json` to a second
model (not the one that wrote it) and ask it to look for:

1. **Factual claims** — numbers, dates, names, API behavior. Anything that
   could be wrong in a way the author's eye would skip.
2. **Terminology drift** — a term used two different ways across slides.
3. **Narrative gaps** — a slide whose `voice_text` assumes knowledge the
   previous slide didn't establish.
4. **Compliance landmines** — for China-distribution (Bilibili / Douyin /
   Xiaohongshu) channels, flag words that will get the upload throttled.
5. **Brand-safety own-goals** — over-aggressive sanitization that strips
   discoverability (removing a product name from a video *about* that product).

Any model works. The only rule: **not the model that wrote the script**.

## Example prompt

```
Review this video script for a short-form video that will go to
Bilibili / YouTube / Xiaohongshu / Douyin. Flag:

1. Factual errors (numbers, dates, names, API behavior)
2. Terminology used inconsistently across slides
3. Narrative gaps (a slide assuming something never established)
4. Compliance-sensitive words for China platforms
5. Over-sanitization that would hurt discoverability

Do not rewrite. Just list issues with slide index and a one-line fix suggestion.

<paste script.json>
```

## When to skip

- You're iterating on a single slide's style, not changing voice content
- The script is 3 slides or fewer **and** has no numeric claims, factual
  assertions, or platform-sensitive terms (if any of those are present, size
  doesn't save you — run the gate anyway)
- You've already reviewed this exact script within the last hour

## When it pays off most

- 10+ slide videos with numeric claims
- Scripts generated from a research doc (high risk of drift)
- First time publishing a video on a new topic / vertical
- Anything that will run on multiple platforms (one fix vs. four uploads)

---

This is a convention, not an automated gate. If you want to automate it,
`scripts/render.sh` is the place to add a `--review-with <model>` flag.
