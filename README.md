# claude-video-kit

**English** · [中文](./README.zh.md)

Turn a JSON script into a vertical short video. TTS + Whisper caption alignment + Remotion render, all automated. Built for people who'd rather write code than open a video editor.

## What you get

- **One-command pipeline** — `./scripts/render.sh <project>` runs TTS, alignment, metadata build, and Remotion render end-to-end.
- **Metadata-driven timing** — slide durations computed from actual WAV length, no manual frame counting.
- **Composable slides** — `cover`, `text`, `code` compositions out of the box, each drop-in replaceable.
- **Dual TTS backends** — Fish Audio API (default, excellent Chinese cloning) or local IndexTTS2 (free, GPU required).
- **Word-level captions** — faster-whisper produces frame-accurate caption tracks that burn into the render.
- **Remotion Studio hot reload** — iterate on compositions in React with live preview.

## How it works

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

**Run**:
```bash
./scripts/render.sh examples/my-first
```

**Output**: `examples/my-first/out/full.mp4` — a 1080×1920 vertical video with narration and captions, timed exactly to the generated audio.

## Setup

**Clone and install:**
```bash
git clone https://github.com/runesleo/claude-video-kit.git
cd claude-video-kit
cd remotion && npm install && cd ..
pip install -r scripts/requirements.txt
cp .env.example .env   # fill FISH_AUDIO_API_KEY, FISH_AUDIO_VOICE_ID
```

**Any AI coding agent:**
Point your agent at `docs/quickstart.md` and `examples/schoger-demo/`. The whole pipeline is four scripts — an agent can read, modify, and run it without framework knowledge.

## Requirements

- Node 20+
- Python 3.10+
- ffmpeg (`brew install ffmpeg`)
- Fish Audio API key (default TTS) — or skip it and use the macOS `say` fallback for local testing
- (Optional) CUDA GPU if you want to run IndexTTS2 locally

New to Fish Audio? [Create an account here](https://fish.audio/?code=VCG6XOES4XIY2) — best-in-class Chinese voice cloning with a trivial API.

That's it. No video editor, no recording gear, no timeline.

## Supported slide types

| Type | Purpose | Required fields | Optional fields |
|------|---------|----------------|----------------|
| `cover` | Opening / closing cards | `title` | `subtitle` |
| `text` | Narrated text slide | `text`, `voice_text` | `voice` |
| `code` | Code-as-video blocks | `code`, `language`, `voice_text` | `voice` |

**`voice_text`** is the narration script — kept separate from on-screen `text` so your voice-over can be more natural than what the slide shows. **`voice`** overrides the default Fish Audio voice ID for that slide.

Add your own slide type by dropping a new composition into `remotion/src/compositions/` and registering it in `Root.tsx`. See `docs/quickstart.md`.

## Examples in this repo

- **`examples/my-first/`** — 3-slide starter template. Copy this folder, edit `script.json`, render. The fastest way to get a working video.
- **`examples/schoger-demo/`** — the script behind [my first AI-generated short on X](https://x.com/runes_leo). A worked example of a real shipped video, kept for reference (assets not included, only the script).

## Verified

This release was end-to-end tested on macOS (Apple Silicon) with `examples/my-first`. The shipped pipeline produces a **1080×1920 @ 30fps, 8 seconds, 442 KB** vertical mp4 — narration via Fish Audio (or `say` fallback if no API key), captions via Whisper, render via Remotion. See `docs/quickstart.md` for first-run notes (including China network setup).

## Known limitations (v0.1)

- **The `say` fallback is rough — use Fish Audio for anything you'll publish.** Without an API key the pipeline degrades to macOS `say`, which is fine for "does my pipeline run end-to-end" but ships with two real annoyances: (a) it can't disambiguate Chinese homographs, e.g. `行` in `一行代码` gets read as `háng` instead of `xíng`; (b) Whisper's `base` model struggles to align robotic synthetic voices, so captions drift by a beat. Both vanish with a real Fish Audio voice.
- No automatic cover generator — covers are whatever the `cover` slide renders
- No B-roll / video clip support — slides are still-frame + audio + captions
- Single voice per video (per-slide voice override is in the schema but undertested)
- IndexTTS2 backend is a placeholder — script is documented, CUDA wiring is left to the user
- Chinese is the primary tested language; other languages work but captioning quality scales with Whisper model size (`base` → `medium` → `large-v3`)

## Roadmap

**Pipeline**
- [ ] v0.2 — AI-generated B-roll clips (SDXL / video models for visual variety)
- [ ] v0.3 — Auto cover image generator (1080×1920, platform-aware)
- [ ] v0.4 — Multi-voice conversations (multiple voice IDs per script)

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

## License

MIT
