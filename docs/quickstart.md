# Quickstart

## 0. Prereqs

- Node 20+
- Python 3.10+
- ffmpeg (`brew install ffmpeg`)
- (Optional) Fish Audio API key — [get one](https://fish.audio/?code=VCG6XOES4XIY2)

## 1. Install

```bash
git clone https://github.com/runesleo/claude-video-kit.git
cd claude-video-kit

cd remotion && npm install && cd ..
pip install -r scripts/requirements.txt

cp .env.example .env
# edit .env → fill FISH_AUDIO_API_KEY, FISH_AUDIO_VOICE_ID
```

No Fish Audio key? Skip it — the pipeline falls back to macOS `say` so
you can exercise end-to-end on day 1. Voice quality will be rough.

## 2. Your first video

The repo ships with `examples/my-first/` — a 3-slide starter template
already wired up. Just run it:

```bash
./scripts/render.sh examples/my-first
```

Output lands in `examples/my-first/out/full.mp4`.

To make it your own, edit `examples/my-first/script.json` and run again.
Or copy the folder to a new name:

```bash
cp -r examples/my-first examples/my-second
$EDITOR examples/my-second/script.json
./scripts/render.sh examples/my-second
```

## 3. Iterate

Open `remotion/` in another terminal:

```bash
cd remotion && npm run studio
```

Remotion Studio gives you hot-reload preview. Tweak compositions in
`src/compositions/`, save, watch the video update live.

## 4. Add your own slide type

1. Create `remotion/src/compositions/MySlide.tsx`
2. Register it in `remotion/src/Root.tsx`'s `Main` switch
3. Use it from `script.json`: `{ "type": "my_slide", ... }`

Keep compositions dumb — they should render from props only. All timing
comes from `metadata.json`, which `build-metadata.mjs` produces from WAV
durations. This is the whole trick: **never count frames by hand**.

## Troubleshooting

- **"Fish Audio 401"** — wrong API key or voice_id. Check the dashboard.
- **Whisper is slow on first run** — it downloads the model. Subsequent
  runs are fast.
- **Remotion render crashes on audio** — make sure your wavs exist under
  `<project>/workspace/` and `metadata.json` references them correctly.
- **Audio cuts off at end of slide** — increase `BUFFER_FRAMES` in
  `scripts/build-metadata.mjs`.
