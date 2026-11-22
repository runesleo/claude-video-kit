# Quickstart

This repository provides the `video-explainer` Agent Skill, a deterministic Remotion fallback, and separate checks for the exact final MP4. The Skill can also guide an agent to use a direct-video capability or other tools; those external video models are **not bundled** here.

## 0. Requirements

- Node.js 20+ and Python 3.10+
- `ffmpeg` and `ffprobe` (on macOS: `brew install ffmpeg`)
- Remotion dependencies installed locally
- **For the no-key demo:** macOS with built-in `say`. This demo intentionally does not use a paid TTS provider.

`doctor` checks the runtime, Remotion installation, selected TTS prerequisites, and output-directory permissions. It follows `TTS_BACKEND` (default `cosyvoice`); `doctor --demo` checks the macOS `say` path used by the keyless demo. It is **not** an end-to-end render test, a remote credential check, or a check of every optional Python package.

## 1. First success on macOS (no API keys)

```bash
git clone https://github.com/runesleo/claude-video-kit.git
cd claude-video-kit
npm ci --prefix remotion
python3 -m pip install -r scripts/requirements.txt

# Optional: register the Agent Skill with your coding agent.
npx skills add runesleo/claude-video-kit --skill video-explainer

npm run doctor -- --demo
npm run demo
```

`npm run demo` creates a **new timestamped folder** under `out/video-explainer-demo-*/`. The local MP4 is at `out/video-explainer-demo-*/out/full.mp4`; the run also writes review and verification records. This uses macOS `say` plus script-timed demo captions, runs the Remotion fallback, and checks the short's objective properties.

**The demo output is not publication-ready.** The bundled sample review is not an independent review of your own video, and the demo deliberately skips the separate final-artifact review and platform release gate. It does not upload or publish.

On Linux/Windows, `npm run demo` is **not a supported first-run path**, even if Fish Audio credentials exist: demo mode explicitly clears them and expects macOS `say`. Do not claim a successful cross-platform no-key demo from a passing `doctor`.

For Claude Code plugin installation, use the existing marketplace: `/plugin marketplace add runesleo/x-reader`, then `/plugin install video-explainer-kit@runesleo`. The kit repository is the plugin source, not a marketplace. The `npx skills add` route above remains the recommended Skill-only installation.

## 2. Produce your own reviewed explainer

Start with [the Agent Skill](../skills/video-explainer/SKILL.md). It chooses among:

1. `direct_artifact`: an available model/capability produces an MP4; **no model is bundled**.
2. `agent_orchestrated`: the agent chooses tools; tool availability and results vary.
3. `legacy_remotion`: the repository's local, repeatable TTS → alignment → Remotion fallback.

For `legacy_remotion`, prepare a `motion-storyboard.json` and a project `script.json` with the independent review input **before** rendering. The standard commands are:

```bash
node scripts/video-explainer.mjs review <project> --input <project>/review-input.json
node scripts/video-explainer.mjs render <project>
node scripts/verify-shorts.mjs <project>/out/full.mp4 --format shorts --metadata <project>/metadata.json --check-audio
node scripts/video-explainer.mjs review-render <project>/out/full.mp4 --input <project>/render-review-input.json
```

Use [motion-storyboard guidance](../skills/video-explainer/references/motion-storyboard.md), [review-gate guidance](../skills/video-explainer/references/review-gate.md), and [render-and-verify guidance](../skills/video-explainer/references/render-and-verify.md) to prepare the required files. The eleven pre-render checks are judged by a different reviewer; a current `pass` receipt is required for `legacy_remotion`. Other strategies skip unnecessary intermediate files but **not** the final MP4 review. For a longer vertical explainer use `--format explainer --check-audio` instead of the shorts recipe's 60-second target; scene-cut pacing is advisory and cannot replace human motion review.

Before any platform handoff, finish cover/audio/subtitle edits and run the separate [final release gate](./RELEASE_GATE.md) on the **exact final master**. The Skill itself never uploads, schedules, or publishes.

### TTS backend selection (only for your own production projects)

`scripts/render.sh` currently defaults to `TTS_BACKEND=cosyvoice` (not Fish Audio). This backend requires `DASHSCOPE_API_KEY`, `COSYVOICE_VOICE_ID`, and Python `dashscope` configured by the user.

Fish Audio is **opt-in**, using `TTS_BACKEND=fish` in the **process environment**, plus `FISH_AUDIO_API_KEY` and `FISH_AUDIO_VOICE_ID`. The Fish script also attempts to read a local `.env`, but editing `.env` alone does **not** change the shell's `TTS_BACKEND` default. Optional IndexTTS2 requires separate local setup. Live TTS calls may incur provider charges; there is no paid call in the keyless macOS demo.

Before a production render, run `npm run doctor` in the same exported environment. It checks CosyVoice's credential presence and `dashscope`, or Fish Audio's credential presence and `requests`. It does not load `.env` or test credentials against the provider. For IndexTTS2 it checks the local checkout, model config, and reference audio paths without loading weights or running inference. See [setup and doctor](../skills/video-explainer/references/setup-and-doctor.md) for the exact scope.

The older `examples/my-first/script.json` illustrates the legacy format; **do not** run `./scripts/render.sh examples/my-first` as a first-run command. That sample lacks the required production `motion-storyboard.json` and the direct command would be blocked by today's gate.

## 3. Preview and customize

```bash
cd remotion
npm run studio
```

Remotion Studio provides a local live preview of the composition. For schema, typography, and slide changes, read [DESIGN.md](./DESIGN.md). A custom `script.json` is **not** sufficient to start a guarded production render; the current storyboard and review requirements still apply.

## 4. Network notes

Dependencies are installed from npm/PyPI. Remotion may download Chrome Headless Shell on first use. Production Whisper alignment downloads a model from Hugging Face on first use; **the macOS no-key demo does not download Whisper**, because it uses script-timed captions. These hosts may be inaccessible on some networks, including mainland China. Use a proxy only if you already have one configured, and verify that setup independently.

## Troubleshooting

- **`doctor: BLOCKED`** — follow its reported action: check Node/Python, `ffmpeg`, Remotion dependencies, a writable output directory, and the chosen TTS backend.
- **`demo output already exists`** — use plain `npm run demo` for a fresh timestamped path, or specify a different `--output` directory. The demo will not overwrite an existing directory.
- **`motion-storyboard.json missing`** — this is a production gate, not a dependency error. Create and validate the storyboard before running `render`.
- **`review receipt missing/stale`** — complete an independent eleven-check review of the current script, then rerun. Do not reuse an older pass after editing.
- **Missing CosyVoice configuration / Fish Audio 401** — confirm you selected the intended backend and configured that provider's environment and credentials. The default backend does not automatically switch to Fish Audio.
- **Whisper alignment errors** — production alignment can leave a render without captions; verify the actual final video rather than assuming success from the existence of an MP4.
