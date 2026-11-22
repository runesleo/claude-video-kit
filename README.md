# claude-video-kit

**English** · [中文](./README.zh.md) · [README.en.md](./README.en.md)

**Video Explainer Kit** is an Agent Skill for producing and checking **reviewed, verified vertical explainer videos** from a research brief, script, or existing MP4. It can select direct generation, agent-orchestrated tools, or the repository's deterministic TTS + caption alignment + Remotion fallback.

**Who it's for:** people using Claude Code, Codex, Cursor, or another capable AI agent to make research / technical explainers, and who value a repeatable 9:16 workflow with independent quality checks.  
**Who it's not for:** a hosted video editor, a Claude-only API product, or a guaranteed one-click “topic → polished AI B-roll Short” service. This repository ships a local Remotion fallback and verification tools; direct video-generation models are not bundled.

> **[v0.3.0-rc.2](https://github.com/runesleo/claude-video-kit/releases/tag/v0.3.0-rc.2) (public release candidate):** installable `video-explainer` Agent Skill. The `legacy_remotion` path requires an independent, script-hash-bound pre-render review; every strategy requires verification and an independent review bound to the exact final MP4. The Skill never uploads or publishes.

## Install as a plugin

- **Claude Code**: add the existing marketplace, then install its named entry:

  ```text
  /plugin marketplace add runesleo/x-reader
  /plugin install video-explainer-kit@runesleo
  ```

- **Codex**: `codex plugin marketplace add runesleo/x-reader`, then `codex plugin add video-explainer-kit@runesleo`

The marketplace is [runesleo/x-reader](https://github.com/runesleo/x-reader); `claude-video-kit` is the plugin source, not a standalone marketplace. For the recommended Agent Skill installation, use `npx skills add` below. Installing the plugin or Skill does not install the local rendering dependencies.

## Fastest first success: Agent Skill

```bash
git clone https://github.com/runesleo/claude-video-kit.git
cd claude-video-kit
npm ci --prefix remotion
npx skills add runesleo/claude-video-kit --skill video-explainer
npm run doctor -- --demo
npm run demo   # macOS + built-in say only; writes a new timestamped demo folder

# npm scripts are thin wrappers — the underlying command works the same:
#   node scripts/video-explainer.mjs demo --output /tmp/video-explainer-first-success
```

The no-key `demo` exercises this local clone's Remotion fallback **on macOS**. It uses the built-in `say` voice and script-timed captions, writes a new timestamped output folder, checks a 1080×1920 MP4, and **does not** perform final-artifact review or qualify the video for publication. For real `legacy_remotion` projects, first prepare a motion storyboard, then run `review` and `render`; `fix`, `block`, missing, or stale receipts stop rendering. The eleven pre-render checks are judged by an independent reviewer — the tool enforces the recorded process, not the truth of those judgments. Direct/agent-orchestrated strategies may skip legacy intermediate files but must pass final MP4 review and release gates.

Use `npm run doctor` without `--demo` for your selected production backend: it follows `TTS_BACKEND`, defaulting to CosyVoice. Doctor checks local prerequisites and exported configuration; it does not authenticate with a provider or generate narration. See [setup and doctor](skills/video-explainer/references/setup-and-doctor.md).

> Editing scripts or compositions? Read [docs/DESIGN.md](docs/DESIGN.md) first — it's the design system contract.

## Final release gate

The canonical `video-release-gate` implementation now lives in this pipeline:
[`scripts/video_release_gate.py`](scripts/video_release_gate.py) and
[`config/video_quality_profile.json`](config/video_quality_profile.json).
Keep the pre-render receipt, `review-render`, and `verify-shorts`; then evaluate
the **final master after all edits**, with hash-bound QA and independent review.
`build-distribute-pack` requires a current release receipt and verifies it before
writing any handoff. Downstream uploaders must verify again immediately before an
authorized action. No uploader or automatic publication is added.

See [the complete evaluate → verify → handoff commands](docs/RELEASE_GATE.md).

## What you get

- **Guarded Remotion fallback** — once a project has the required storyboard and current pass receipt, `render` orchestrates TTS, alignment, metadata, and Remotion; use `npm run demo` for a keyless first run on macOS.
- **Metadata-driven timing** — slide durations computed from actual WAV length, no manual frame counting.
- **Composable slides** — `cover`, `text`, `code` compositions out of the box, each drop-in replaceable.
- **Explicit TTS backends** — `render.sh` defaults to CosyVoice (requires your DashScope key and cloned voice ID); Fish Audio is opt-in via `TTS_BACKEND=fish`, and local IndexTTS2 requires its own setup. The no-key demo deliberately uses macOS `say`.
- **Word-level captions** — faster-whisper produces frame-accurate caption tracks that burn into the render.
- **Remotion Studio hot reload** — iterate on compositions in React with live preview.

## How the deterministic Remotion fallback works

```
script.json ──▶ TTS ──▶ *.wav ──▶ Whisper align ──▶ captions.json
                                                            │
                                  build-metadata ◀──────────┘
                                         │
                                         ▼
                                  Remotion render ──▶ out/full.mp4
```

**Input** (`examples/my-first/script.json`):
```json
{
  "title": "My first AI video",
  "fps": 30,
  "width": 1080,
  "height": 1920,
  "slides": [
    { "type": "cover", "title": "Hello world", "subtitle": "in 10 seconds" },
    { "type": "text",  "text": "This is my first AI-rendered video.",
      "voice_text": "This is my first AI-rendered video." },
    { "type": "code",  "language": "ts",
      "code": "const video = await kit.render(script);",
      "voice_text": "One function call, one video file." }
  ]
}
```

**First run (macOS, no keys)**:
```bash
npm run demo
```

**Output**: `out/video-explainer-demo-*/out/full.mp4` — a 1080×1920 demo-quality vertical video. `examples/my-first/script.json` remains a legacy input example; calling `render.sh` directly on that example without the required motion storyboard is **not** a supported current first-run path.

## Setup

**Clone and install:**
```bash
git clone https://github.com/runesleo/claude-video-kit.git
cd claude-video-kit
cd remotion && npm install && cd ..
pip install -r scripts/requirements.txt
cp .env.example .env   # optional: only if you choose a provider that reads these settings
```

**AI coding agents:** start with the [Agent Skill](skills/video-explainer/SKILL.md) and [current quickstart](docs/quickstart.md). Production requires its documented storyboard/review/final-MP4 gates; do not treat old single-script examples as current first-run recipes.

## Requirements

- Node 20+
- Python 3.10+
- ffmpeg (`brew install ffmpeg`)
- **Keyless demo:** macOS built-in `say` (the `demo` command intentionally clears Fish credentials; it is not the Linux/Windows demo path).
- **Production Remotion narration:** default `cosyvoice` requires `DASHSCOPE_API_KEY`, `COSYVOICE_VOICE_ID`, and the `dashscope` Python package; optional Fish Audio requires its own key/voice and an explicitly set `TTS_BACKEND=fish` environment variable.
- (Optional) CUDA GPU if you separately configure local IndexTTS2.

Fish Audio is an optional provider, not a requirement for this kit. Its [signup link](https://fish.audio/?code=VCG6XOES4XIY2) is relevant only if you choose that backend.

That's it. No video editor, no recording gear, no timeline.

## Supported slide types

| Type | Purpose | Required fields | Optional fields |
|------|---------|----------------|----------------|
| `cover` | Opening / closing cards | `title` | `subtitle` |
| `text` | Narrated text slide | `text`, `voice_text` | `voice`, `textMode` (`"hero"` for big-font shorts hook), `textReveal` (`"spring"` \| `"typewriter"`), `accentColor` |
| `code` | Code-as-video blocks | `code`, `language`, `voice_text` | `voice` |
| `numberHero` | Big-number data hook (shorts) | `heroValue` | `heroLabel`, `heroBadge`, `heroPrefix`, `heroSuffix`, `heroAccentColor` |

**`voice_text`** is the narration script — kept separate from on-screen `text` so your voice-over can be more natural than what the slide shows. **`voice`** can override a per-slide provider voice where the selected backend supports it (including Fish Audio); do not assume the override behaves identically across backends.

Add your own slide type by dropping a new composition into `remotion/src/compositions/` and registering it in `Root.tsx`. See `docs/quickstart.md`.

## Shorts pipeline (vertical 9:16)

Phase 1 adds a vertical short-video pipeline: 1080×1920 canvas, dense motion, big text — built for YouTube Shorts / 抖音 / TikTok / 小红书 / B 站 Shorts. Set `"preset": "shorts"` in metadata to flip canvas + font scale in one place; render normally, then run `node scripts/verify-shorts.mjs <out.mp4> --format shorts --check-audio` for a technical preflight (9:16 canvas, recipe duration and shared release-gate audio rules). A 720×1280 vertical video is accepted with a resolution warning; scene-cut rhythm and opening-cut detection are review prompts, not hard failures or aesthetic scores. For longer vertical explainers, use `--format explainer`. Every final video still needs independent visual/factual review and the separate release gate before distribution. See [`docs/SHORTS_PIPELINE.md`](docs/SHORTS_PIPELINE.md) for slide-type schema, captions config, and rhythm guidance.

## Examples in this repo

- **`examples/my-first/`** — a legacy 3-slide `script.json` example, not a current production-ready project. For a first run, use the guarded `npm run demo` path.
- **`examples/schoger-demo/`** — the script behind [my first AI-generated short on X](https://x.com/runes_leo). A worked example of a real shipped video, kept for reference (assets not included, only the script).

## Historical verification (v0.1)

The original v0.1 release was end-to-end tested on macOS (Apple Silicon) with `examples/my-first`. This historical result is **not** a fresh-install acceptance test of all v0.3.0-rc.2 strategies. The shipped pipeline produces a **1080×1920 @ 30fps, 8 seconds, 442 KB** vertical mp4 — narration via Fish Audio (or `say` fallback if no API key), captions via Whisper, render via Remotion. See `docs/quickstart.md` for first-run notes (including China network setup).

## Historical limitations (v0.1; some may be superseded)

- **The `say` fallback is rough and never qualifies a demo for publication.** Without an API key the pipeline degrades to macOS `say`, which is fine for "does my pipeline run end-to-end" but ships with two real annoyances: (a) it can't disambiguate Chinese homographs, e.g. `行` in `一行代码` gets read as `háng` instead of `xíng`; (b) Whisper's `base` model struggles to align robotic synthetic voices, so captions drift by a beat. A better voice backend may help, but pronunciation and caption alignment still need explicit review.
- No automatic cover generator — covers are whatever the `cover` slide renders
- No B-roll / video clip support — slides are still-frame + audio + captions
- Single voice per video (per-slide voice override is in the schema but undertested)
- IndexTTS2 backend is a placeholder — script is documented, CUDA wiring is left to the user
- Chinese is the primary tested language; other languages work but captioning quality scales with Whisper model size (`base` → `medium` → `large-v3`)

## What's new in v0.2 — post-render pipeline

The v0.1 pipeline stopped at `out/full.mp4`. v0.2 adds the "every time you make
a video, you end up redoing this" steps into composable scripts you can chain
or compose; the release gate is mandatory before handoff:

- **`scripts/prepend-cover.sh`** — prepend a still-image cover clip (default
  3s) to the rendered video. Probes the main video's width/height/fps and
  matches them exactly so concat stays lossless. Falls back to re-encode only
  if codec params differ.
- **`scripts/shift-subtitles.py`** — shift every timestamp in an `.srt` by a
  fixed offset. Pair with `prepend-cover.sh` when you need captions to stay
  aligned after adding an intro.
- **`scripts/build-distribute-pack.mjs`** — emit per-platform upload packages
  (one of Bilibili / Xiaohongshu / Douyin per invocation) after release verification, with chapter timestamps derived
  from `metadata.json`. Supports a blacklist-based compliance pass that strips
  regulator-sensitive words while keeping brand names — stripping brands costs
  vertical-search discoverability.
- **Pre-render review gate** (historical v0.2 description; see the current [`video-explainer` Skill](skills/video-explainer/SKILL.md))
  — originally a manual convention, now enforced through a script-hash-bound review receipt for the legacy Remotion path. Have an independent reviewer read the
  script. TTS + render costs ~30 min per iteration; 5 min of review usually
  avoids 2 hours of rerun.

Historical v0.2 chained usage (not a current first-run recipe; current storyboard, review, and final-release gates still apply):

```bash
# 1. Render as usual (v0.1)
./scripts/render.sh examples/my-first

# 2. Prepend cover
./scripts/prepend-cover.sh \
  --cover my-cover.png \
  --video examples/my-first/out/full.mp4 \
  --duration 3 \
  --out examples/my-first/out/full-with-cover.mp4

# 3. Complete final QA/review and evaluate full-with-cover.mp4 (see docs/RELEASE_GATE.md).
# 4. Verify and build one platform's handoff; repeat with each platform's evidence.
node ./scripts/build-distribute-pack.mjs examples/my-first --intro-offset 3 \
  --platform bilibili --video examples/my-first/out/full-with-cover.mp4 \
  --cover examples/my-first/cover-bilibili.png \
  --release-receipt examples/my-first/VIDEO-RELEASE-GATE-bilibili.json
```

`shift-subtitles.py` is an optional utility for the case where you keep a
separate `.srt` file outside the v0.1 pipeline (e.g. exported from Whisper
and used as an overlay). The v0.1 pipeline burns captions during Remotion
render, so most users don't need it.

```bash
./scripts/shift-subtitles.py \
  --input path/to/captions.srt \
  --offset-seconds 3 \
  --output path/to/captions-with-intro.srt
```

Each script is self-contained and independently runnable — use the ones you
need, skip the rest.

## Roadmap

**Pipeline**
- [ ] v0.3 — AI-generated B-roll clips (SDXL / video models for visual variety)
- [ ] v0.4 — Auto cover image generator (1080×1920, platform-aware)
- [ ] v0.5 — Multi-voice conversations (multiple voice IDs per script)

**Compositions**
- [ ] Chart slide (render data as animated SVG)
- [ ] Diff slide (before/after comparison, Schoger-style)
- [ ] Diagram slide (Mermaid → animated reveal)

**Tooling**
- [ ] Web UI — non-coders can edit scripts in a browser
- [ ] `kit init` CLI — scaffold new video projects without copying examples

**API** (planned)
- [ ] REST endpoint for render-as-a-service — POST a script, receive an MP4

## About the author

*Leo ([@runes_leo](https://x.com/runes_leo)) — AI × Crypto independent builder. Trading on [Polymarket](https://polymarket.com/?r=githuball&via=runes-leo&utm_source=github&utm_content=claude-video-kit), building data and trading systems with Claude Code and Codex.*

[leolabs.me](https://leolabs.me) — writing · community · open-source tools · indie projects · all platforms.

[X Subscription](https://x.com/runes_leo/creator-subscriptions/subscribe) — paid content weekly, or just buy me a coffee 😁

*Learn in public, Build in public.*

## Data and network access

The kit runs on your machine. There is no telemetry, and nothing is sent to the author's servers. The offline demo (`node scripts/video-explainer.mjs demo`) uses the local macOS `say` voice and script-timed captions, so it calls no API.

When you render your own video, data goes only to the services you choose:

| What | Where it goes |
|---|---|
| Narration text, default `cosyvoice` backend | Alibaba Cloud DashScope (`wss://dashscope.aliyuncs.com`, or `DASHSCOPE_WS_URL`), with your `DASHSCOPE_API_KEY` |
| Narration text, `fish` backend | `api.fish.audio`, only if you set `FISH_AUDIO_API_KEY` and `FISH_AUDIO_VOICE_ID`; without them it falls back to the local `say` command |
| Narration text, `indextts2` backend | Nowhere: it runs your local IndexTTS2 checkout with network downloads turned off |
| Narration text and your voice reference audio, optional `scripts/modal_tts_batch.py` | Modal, only when you run it yourself with `modal run`; the Modal image clones `github.com/index-tts/index-tts` |
| Word-level caption alignment | Runs locally with faster-whisper, which downloads the Whisper model from Hugging Face on first use |
| Video rendering | Runs locally with Remotion, which downloads Chrome Headless Shell into `remotion/node_modules` on the first render |

Setup downloads dependencies you install yourself: Remotion and its packages from the npm registry (`npm ci --prefix remotion`), and the Python packages in `scripts/requirements.txt` (plus `dashscope` for CosyVoice) from PyPI.

TTS backends read credentials from their supported process environment; Fish Audio's script also attempts `.env` loading. Simply editing `.env` does **not** set `TTS_BACKEND` for `render.sh`. Credentials are used only when you explicitly choose the corresponding provider; the keyless demo clears Fish credentials.

Stored only on your machine: everything a render produces inside your project folder (`workspace/` audio and captions, `metadata.json`, `out/full.mp4`, review and gate receipts), demo output (`out/video-explainer-demo-*` in the kit, or the path you pass with `--output`), and model caches (Hugging Face cache for Whisper, Chrome Headless Shell under `remotion/node_modules`).

## License

MIT
