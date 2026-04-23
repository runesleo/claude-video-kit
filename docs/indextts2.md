# IndexTTS2 local TTS backend

[IndexTTS2](https://github.com/index-tts/IndexTTS2) is a free, open-source voice cloning model.
It produces natural Chinese speech from a ~5-10 second reference audio clip.

## When to use

- You want **offline / free / reproducible** voice generation
- You have a **GPU** (CUDA) or Apple Silicon (MPS — experimental)
- You want to **clone your own voice** without a paid API

The default backend is [Fish Audio](https://fish.audio/?code=VCG6XOES4XIY2),
which requires no local setup. Use IndexTTS2 when you want local control.

## Setup

```bash
# 1. Clone the repo
git clone https://github.com/index-tts/IndexTTS2 ~/tools/IndexTTS2
cd ~/tools/IndexTTS2

# 2. Install dependencies
pip install -r requirements.txt

# 3. Download model weights (see their README for links)
# Weights go into ~/tools/IndexTTS2/checkpoints/

# 4. Record or prepare a 5-10 second WAV of the target voice
# Save it somewhere accessible, e.g. ~/voice-ref.wav
```

## Environment variables

Add these to your `.env` or export them:

```bash
# Required: path to cloned IndexTTS2 repo
INDEXTTS2_DIR=~/tools/IndexTTS2

# Optional: checkpoint directory (default: $INDEXTTS2_DIR/checkpoints)
INDEXTTS2_MODEL_DIR=~/tools/IndexTTS2/checkpoints

# Required: reference voice WAV for cloning
INDEXTTS2_REF_AUDIO=~/voice-ref.wav

# Tell render.sh to use IndexTTS2 instead of Fish Audio
TTS_BACKEND=indextts2
```

## Usage

```bash
# Direct
python3 scripts/tts_indextts2.py examples/my-first

# Via render.sh (set TTS_BACKEND=indextts2)
TTS_BACKEND=indextts2 ./scripts/render.sh examples/my-first
```

The script reads `<project>/script.json`, generates one WAV per slide into
`<project>/workspace/`, and the rest of the pipeline (align → metadata → render)
continues unchanged.

## Notes

- First run loads the model (~5-10 seconds on GPU, longer on MPS)
- Each slide takes 2-8 seconds to generate depending on text length
- Output is 24 kHz mono WAV — Whisper alignment works fine with this
- For best results, use a clean reference recording with minimal background noise
