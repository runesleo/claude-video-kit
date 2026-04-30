"""Modal serverless batch TTS with IndexTTS2 on A10G GPU.

Pinned IndexTTS2 commit 830f6f8 + fp16 + CUDA + kwargs API, which produces
materially better voice than the local Mac MPS fp32 path.

Setup:
  - Set the VOICE_REF env var to your IndexTTS2 voice reference wav path.
  - Populate the Modal volume 'indextts2-ckpt' with IndexTTS2 weights (one-time).

Run from laptop:
  VOICE_REF=~/path/to/voice-ref.wav modal run scripts/modal_tts_batch.py \\
      --project examples/<project>

Reads <project>/script.json, writes <project>/workspace/<NN>.wav.
"""
import os
import modal
from pathlib import Path
import json
import time
import argparse

app = modal.App("claude-video-kit-tts")


# Pronunciation pre-processing.
#
# IndexTTS2 (even on Modal A10G fp16) sometimes mispronounces English letter
# initialisms and domain names embedded in Chinese context. Substitute with
# Chinese phonetic equivalents BEFORE TTS so audio comes out right; the
# original voice_text in script.json stays unchanged so align/caption still
# render the original spelling.
#
# Add new entries when you hit a new mispronunciation. Order matters:
# longer / more-specific keys first to avoid partial-match conflicts.
PRONUNCIATION_FIXES = [
    # 域名 "." 不加空格会被当中文句号读错节奏（Leo 验收 OK）
    ("leolabs.me", "leolabs点 me"),
    # 注: "AI" 历史撞过 IndexTTS2 不稳定读成 "A1"/"I1"。直译"诶艾"或
    # 替换"人工智能"都不自然（Leo 反馈"英文不能这样读"）。当前策略 =
    # 多次跑 + _good/<NN>.wav 锁定念对的版本（wav cache 复用机制），
    # 不靠预处理替换。voice_text 给足上下文 hint 即可。
]


def apply_pronunciation_fixes(text: str) -> str:
    for k, v in PRONUNCIATION_FIXES:
        text = text.replace(k, v)
    return text


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
    voice_ref_env = os.environ.get("VOICE_REF", "").strip()
    if not voice_ref_env:
        raise SystemExit(
            "VOICE_REF env var not set. Point it at your IndexTTS2 voice reference wav, "
            "e.g. VOICE_REF=~/voice-clone-ref.wav"
        )
    VOICE_REF = Path(voice_ref_env).expanduser().resolve()

    if not SCRIPT.exists():
        raise SystemExit(f"missing {SCRIPT}")
    if not VOICE_REF.exists():
        raise SystemExit(f"missing voice ref {VOICE_REF}")

    data = json.loads(SCRIPT.read_text())

    # _good/ wav cache reuse mechanism.
    #
    # IndexTTS2 is non-deterministic (sampling temperature). Same voice_text
    # may pronounce English words right one run and wrong another. Workflow:
    #   1. Run modal_tts → listen
    #   2. For slides that pronounced correctly: cp workspace/NN.wav workspace/_good/NN.wav
    #   3. Re-run modal_tts → automatically skips slides with _good/NN.wav, only
    #      regenerates the failed ones
    #   4. Repeat until all marked good. From then on, modal cost = 0 for
    #      unchanged voice_text.
    GOOD_DIR = WORKSPACE / "_good"
    GOOD_DIR.mkdir(exist_ok=True)

    entries = {}
    reused = 0
    for i, slide in enumerate(data.get("slides", [])):
        text = slide.get("voice_text") or slide.get("text") or slide.get("title")
        if not text:
            continue

        good_wav = GOOD_DIR / f"{i:02d}.wav"
        if good_wav.exists():
            target = WORKSPACE / f"{i:02d}.wav"
            target.write_bytes(good_wav.read_bytes())
            print(f"  slide {i}: reusing _good/{i:02d}.wav (skip modal)", flush=True)
            reused += 1
            continue

        fixed = apply_pronunciation_fixes(text)
        if fixed != text:
            print(f"  slide {i}: pronunciation fixed → {fixed[:60]}...", flush=True)
        entries[str(i)] = fixed

    if not entries:
        print(f">> all {reused} slides reused from _good/, skipping modal entirely")
        return

    print(f">> submitting {len(entries)} slides to Modal A10G ({reused} reused from _good/)...")
    t0 = time.time()
    results = infer_batch.remote(VOICE_REF.read_bytes(), entries)
    dt = time.time() - t0

    for num, wav_bytes in results.items():
        out = WORKSPACE / f"{int(num):02d}.wav"
        out.write_bytes(wav_bytes)
    print(f">> {len(results)} wavs saved to {WORKSPACE} in {dt/60:.1f}min")
    print(f">> tip: cp workspace/NN.wav workspace/_good/NN.wav to lock pronunciations you like")
