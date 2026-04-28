"""Modal serverless batch TTS with IndexTTS2 on A10G GPU.

Same pipeline as the PnL v7 video — pinned IndexTTS2 commit 830f6f8 + fp16 +
CUDA + kwargs API, which produces materially better voice than the local Mac
MPS fp32 path.

Run from laptop:
  modal run scripts/modal_tts_batch.py --project examples/<project>

Reads <project>/script.json, writes <project>/workspace/<NN>.wav.
Requires Modal volume 'indextts2-ckpt' (already populated 2026-04-22).
"""
import modal
from pathlib import Path
import json
import time
import argparse

app = modal.App("claude-video-kit-tts")

image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("git", "ffmpeg", "libsndfile1", "build-essential")
    .run_commands(
        "git clone https://github.com/index-tts/index-tts /root/index-tts",
        "cd /root/index-tts && git checkout 830f6f8 && pip install -e .",
    )
)

ckpt_vol = modal.Volume.from_name("indextts2-ckpt")


@app.function(
    gpu="A10G",
    image=image,
    volumes={"/ckpt": ckpt_vol},
    timeout=3600,
)
def infer_batch(voice_ref_bytes: bytes, entries: dict) -> dict:
    import os
    import sys
    import tempfile
    import time
    import shutil

    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"

    work = "/root/index-tts"
    target = f"{work}/checkpoints"
    if os.path.islink(target):
        os.unlink(target)
    elif os.path.isdir(target):
        shutil.rmtree(target)
    os.symlink("/ckpt", target)

    os.chdir(work)
    sys.path.insert(0, work)
    print(f"checkpoints -> {os.path.realpath(target)}: {os.listdir(target)[:5]}", flush=True)

    ref_path = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
    with open(ref_path, "wb") as f:
        f.write(voice_ref_bytes)

    from indextts.infer_v2 import IndexTTS2
    t0 = time.time()
    tts = IndexTTS2(
        cfg_path="checkpoints/config.yaml",
        model_dir="checkpoints",
        use_fp16=True,
        device="cuda",
    )
    print(f"loaded in {time.time()-t0:.1f}s", flush=True)

    results = {}
    for num in sorted(entries.keys(), key=int):
        text = entries[num]
        out_path = f"/tmp/{num}.wav"
        t0 = time.time()
        tts.infer(
            spk_audio_prompt=ref_path,
            text=text,
            output_path=out_path,
            verbose=False,
        )
        dt = time.time() - t0
        print(f"slide {num} ({len(text)} chars) done {dt:.1f}s", flush=True)
        with open(out_path, "rb") as f:
            results[num] = f.read()
    return results


@app.local_entrypoint()
def main(project: str = "examples/ai-resume-bias-truth-shorts"):
    KIT_ROOT = Path(__file__).resolve().parent.parent
    PROJECT = (KIT_ROOT / project).resolve()
    WORKSPACE = PROJECT / "workspace"
    WORKSPACE.mkdir(exist_ok=True)
    SCRIPT = PROJECT / "script.json"
    VOICE_REF = Path.home() / "Projects/content/voice-clone/leo_indextts_ref.wav"

    if not SCRIPT.exists():
        raise SystemExit(f"missing {SCRIPT}")
    if not VOICE_REF.exists():
        raise SystemExit(f"missing voice ref {VOICE_REF}")

    data = json.loads(SCRIPT.read_text())
    entries = {}
    for i, slide in enumerate(data.get("slides", [])):
        text = slide.get("voice_text") or slide.get("text") or slide.get("title")
        if not text:
            continue
        entries[str(i)] = text
    if not entries:
        raise SystemExit("no voice_text in script.json")

    print(f">> submitting {len(entries)} slides to Modal A10G...")
    t0 = time.time()
    results = infer_batch.remote(VOICE_REF.read_bytes(), entries)
    dt = time.time() - t0

    for num, wav_bytes in results.items():
        out = WORKSPACE / f"{int(num):02d}.wav"
        out.write_bytes(wav_bytes)
    print(f">> {len(results)} wavs saved to {WORKSPACE} in {dt/60:.1f}min")
