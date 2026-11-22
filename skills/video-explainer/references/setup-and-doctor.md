# Setup and doctor

Use this reference for a new machine or a blocked doctor result.

## Install the Skill or plugin

Recommended Skill-only installation:

```bash
npx skills add runesleo/claude-video-kit --skill video-explainer
```

For Claude Code plugins, register the existing marketplace and install its entry:

```text
/plugin marketplace add runesleo/x-reader
/plugin install video-explainer-kit@runesleo
```

The source repository also includes a one-entry Claude Code marketplace for HOL directory installs: `/plugin marketplace add runesleo/claude-video-kit` followed by `/plugin install video-explainer-kit@video-explainer`. Both marketplaces install the same plugin source; the existing `runesleo/x-reader` entry continues to pin releases. These commands do not install rendering dependencies. Run the local commands below from a clone of the kit repository.

## Runtime prerequisites

- Node.js 20 or newer
- Python 3.10 or newer
- `ffmpeg` and `ffprobe`
- Installed dependencies under `remotion/node_modules`
- A writable output directory

## Choose the check that matches the run

For the no-key demo on macOS:

```bash
node scripts/video-explainer.mjs doctor --demo --json --output <output-directory>
```

This requires macOS `say`. The `demo` command runs this same check and deliberately clears Fish credentials before rendering. Configured paid providers do not make the demo available on Linux or Windows. The result remains demo-quality and cannot replace final-artifact review.

For your own `legacy_remotion` project:

```bash
node scripts/video-explainer.mjs doctor --json --output <output-directory>
```

This follows the same `TTS_BACKEND` selection as `render.sh`:

| Backend | Local prerequisites checked |
| --- | --- |
| `cosyvoice` (default) | Exported `DASHSCOPE_API_KEY` and `COSYVOICE_VOICE_ID`; Python `dashscope` module |
| `fish` (explicit opt-in) | Exported `FISH_AUDIO_API_KEY` and `FISH_AUDIO_VOICE_ID`; Python `requests` module. Incomplete configuration blocks this check; choose `doctor --demo` explicitly for the keyless macOS path. |
| `indextts2` (explicit opt-in) | `INDEXTTS2_DIR` containing `indextts/infer_v2.py`, model directory containing `config.yaml`, and an existing `INDEXTTS2_REF_AUDIO` file. Model directory defaults to `$INDEXTTS2_DIR/checkpoints`, or uses `INDEXTTS2_MODEL_DIR`. |

Use the same exported environment for doctor and render. Both use the interpreter selected by `PYTHON` (default `python3`); doctor uses that interpreter for the Python version and module checks. Doctor checks the exported default provider configuration, not a project's per-slide voices. It does not load `.env`; it checks credential presence without printing, copying, validating remotely, or writing the values. The Fish renderer can separately load `.env` and per-slide voice overrides, so missing exported defaults must not be interpreted as proof that a normal render is keyless. Python module checks do not import provider SDKs. IndexTTS2 weights and runtime dependencies are not loaded or exercised. A pass is a local prerequisite check, not proof of valid remote credentials, successful narration, alignment, or publication quality. Doctor makes no TTS request and creates no output directory.

## Recovery actions

- Missing Node: install Node 20+.
- Missing Python: install Python 3.10+.
- Missing `ffmpeg` or `ffprobe`: install ffmpeg and rerun doctor.
- Missing Remotion: run `npm install` inside `remotion/`, then rerun doctor.
- Missing CosyVoice configuration: export the two CosyVoice variables and install `dashscope` in the Python environment used by render.
- Missing Fish configuration: explicitly choose `TTS_BACKEND=fish`, export its credentials, and install `requests`; use `doctor --demo` for the keyless macOS path.
- Missing IndexTTS2 paths: follow `docs/indextts2.md`; doctor does not install models or dependencies.
- Output not writable: choose a different directory; do not weaken filesystem permissions broadly.

Do not start dependency installation, account signup, API-key creation, or a paid TTS call unless the user has authorized that separate action.
