# Advanced: IndexTTS2 local backend

The default TTS backend is [Fish Audio](https://fish.audio/?code=VCG6XOES4XIY2),
which is dead simple and has excellent Chinese voice cloning. But if you want
offline / free / reproducible voices, [IndexTTS2](https://github.com/index-tts/IndexTTS2)
is the open-source option.

## Caveats

- Requires a CUDA GPU (or Apple Silicon with MPS — experimental).
- Model weights are several GB.
- First-run latency is significant.
- `scripts/tts_indextts2.py` in this repo is a **placeholder** — it documents
  the interface but does not include model wiring, because paths and CUDA
  setups vary wildly.

## Setup sketch

```bash
git clone https://github.com/index-tts/IndexTTS2 ~/tools/IndexTTS2
cd ~/tools/IndexTTS2
pip install -r requirements.txt
# download weights per their README

export INDEXTTS2_CHECKPOINT=~/tools/IndexTTS2/checkpoints/v2
```

Then swap the TTS stage in `scripts/render.sh`:

```bash
python3 "$KIT_ROOT/scripts/tts_indextts2.py" "$PROJECT"
```

Contributions welcome — if you get IndexTTS2 wired cleanly, open a PR.
