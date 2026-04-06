# claude-video-kit

> AI-powered short-form video pipeline. Write a script → get a rendered vertical video.
> **TTS** (Fish Audio / IndexTTS2) + **Caption alignment** (Whisper) + **Code-as-video** (Remotion).

[中文说明](./README.zh.md) · [Quickstart](./docs/quickstart.md) · [Example](./examples/schoger-demo/)

Built and used daily by **[@runes_leo](https://x.com/runes_leo)** — an AI × Crypto independent builder. This is the same pipeline behind [my first AI-generated short](https://x.com/runes_leo).

---

## Why

Short-form vertical videos (TikTok / YouTube Shorts / Bilibili) are the highest-leverage content format right now, but the production cost is brutal: record voice, shoot B-roll, edit, caption, export. Most builders give up after video #1.

This kit turns video production into **"write a JSON script → run one command"**. Your content is literally code — diffable, versionable, and iteratable. If you already live in a terminal, you'll love it.

```
script.json  ──▶  TTS  ──▶  *.wav  ──▶  Whisper align  ──▶  captions.json
                                                                    │
                                       build-metadata ◀─────────────┘
                                              │
                                              ▼
                                      Remotion render
                                              │
                                              ▼
                                         out/full.mp4
```

## Stack

| Layer | Tool | Why |
|---|---|---|
| TTS (default) | **[Fish Audio](https://fish.audio/?code=VCG6XOES4XIY2)** | Best CN voice cloning, API is trivial. Uses my referral code — both of us get credits. |
| TTS (advanced) | **IndexTTS2** (local) | Offline, free, needs a GPU. See `docs/indextts2.md`. |
| Caption alignment | **Whisper** (`whisper.cpp` or `faster-whisper`) | Word-level timestamps for burned-in captions. |
| Video engine | **[Remotion](https://remotion.dev)** | Write video in React. Hot-reload, TypeScript, git-friendly. |

## Install

```bash
git clone https://github.com/runesleo/claude-video-kit.git
cd claude-video-kit

# JS (Remotion)
cd remotion && npm install && cd ..

# Python (TTS + Whisper)
pip install -r scripts/requirements.txt

# Env
cp .env.example .env  # fill in FISH_AUDIO_API_KEY
```

## Quickstart

```bash
# 1. Write a script
$EDITOR examples/my-first/script.json

# 2. Generate voices + align captions + build metadata
./scripts/render.sh examples/my-first

# 3. Done → out/full.mp4
```

See [`docs/quickstart.md`](./docs/quickstart.md) for the full walkthrough.

## Script format

```json
{
  "title": "My first AI video",
  "width": 1080,
  "height": 1920,
  "fps": 30,
  "slides": [
    { "type": "cover", "title": "Your idea", "subtitle": "in 30 seconds" },
    { "type": "text",  "text": "First point", "voice": "steady-male" },
    { "type": "code",  "language": "ts", "code": "const x = 1;", "voice": "steady-male" }
  ]
}
```

Each slide's duration is **computed from the generated WAV** — no manual frame counting.

## Status

`v0.1` · Used daily, rough edges expected. Star the repo if you want to follow along.

## Roadmap

- [ ] v0.2 — AI-generated B-roll clips (no more screen recording)
- [ ] v0.3 — Auto cover generator
- [ ] v0.4 — Multi-voice conversations
- [ ] v1.0 — Web UI for non-coders

## Credits & affiliate disclosure

This project uses **[Fish Audio](https://fish.audio/?code=VCG6XOES4XIY2)** for TTS by default. The link is a referral code — if you sign up through it, I get credits at no cost to you. You can also use IndexTTS2 locally and skip it entirely.

Also: if you're into prediction markets, I trade on **[Polymarket](https://polymarket.com/?via=runesleo)** (also a referral link) and open-source my tooling at [claude-prediction-toolkit](https://github.com/runesleo/claude-prediction-toolkit).

## License

MIT © Leo ([@runes_leo](https://x.com/runes_leo))

---

<sub>Built with [Claude Code](https://claude.com/claude-code). If you ship something with this kit, tag me — I'd love to see it.</sub>
