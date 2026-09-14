---
name: video-explainer
description: Turn a research brief or finished script into a reviewed, narrated, rendered, and verified vertical explainer video. Use when an agent must create a short 9:16 explainer, enforce independent pre-render and rendered-output review gates, run a no-key local demo, diagnose the video toolchain, or verify a generated MP4 before any manual publication step.
---

# Video Explainer

Version note: v0.3.0-rc.1 / 2026-09-14 / Extend the guarded brief-to-video workflow with design-quality checks and a rendered-output receipt bound to the exact MP4 bytes. Keep upload, account access, credentials, private voice assets, and hosted rendering out of scope. Rollback: revert the 2026-09-14 review-gate changes and continue using the prior six-check review.

Produce a local video and evidence packet. Never upload or publish from this skill.

## Install

This Skill orchestrates a local clone of `claude-video-kit`; it does not bundle the renderer. From the repository root, install the runtime and register the Skill with:

```bash
npm ci --prefix remotion
npx skills add runesleo/claude-video-kit --skill video-explainer
```

For repository development, run commands from the repository root.

## Workflow

1. Run the read-only doctor before changing a project:

   ```bash
   node scripts/video-explainer.mjs doctor --output <output-directory>
   ```

   Read [setup-and-doctor.md](references/setup-and-doctor.md) when doctor blocks or the environment is new.

2. Convert the brief into `script.json`. Keep claims traceable, use supported slide types, target 9:16, and stay inside the canonical design system. Read [brief-to-script.md](references/brief-to-script.md) for the input/output contract.

3. Require an independent pre-render review. Write `review-input.json`, then run:

   ```bash
   node scripts/video-explainer.mjs review <project> --input <project>/review-input.json
   ```

   Read [review-gate.md](references/review-gate.md) for the eleven required checks. In addition to facts, structure, duration, visual feasibility, privacy, and copyright, every script must pass hierarchy, simplicity, clarity, legibility, and craft. These are quality principles, not permission to imitate another brand or bypass `config/design-system.json`.

   If any check is `fix` or `block`, revise and review again. Never render from that receipt. Any script edit makes the receipt stale.

4. Render only after a current pass receipt:

   ```bash
   node scripts/video-explainer.mjs render <project>
   ```

   On macOS, use `--demo-quality` only for a credential-free first success. It forces the built-in `say` voice and script-timed captions; label the result as demo-quality. Read [render-and-verify.md](references/render-and-verify.md) before running a custom project.

5. Verify the MP4 objectively, then require an independent rendered-output review. The objective verifier checks canvas, duration, and scene rhythm. It does **not** prove visual polish or chapter-level loudness consistency.

   ```bash
   node scripts/verify-shorts.mjs <project>/out/full.mp4 \
     --metadata <project>/metadata.json

   node scripts/video-explainer.mjs review-render <project>/out/full.mp4 \
     --input <project>/render-review-input.json
   ```

   The rendered-output review rechecks hierarchy, simplicity, clarity, legibility, and craft on the actual moving image, plus separate `audio_consistency` and `end_card` checks. Its receipt is bound to the exact MP4 SHA-256; a changed render invalidates it.

6. Report the video path, pre-render review receipt, objective verification result, rendered-output review receipt, elapsed time, and known limitations. A local pass is evidence for the artifact, not publication approval.

## Canonical first success

Run the repository-owned neutral demo:

```bash
node scripts/video-explainer.mjs demo --output /tmp/video-explainer-first-success
```

The demo must create a current pre-render pass receipt before TTS, render locally without an API key on supported macOS, and run the shorts verifier. The demo intentionally does **not** self-approve the rendered-output gate because an independent reviewer must inspect the actual MP4. It must not read an account, upload media, or send the brief to a remote service.

## Stop conditions

- Stop before TTS/render when the pre-render review is missing, stale, `fix`, or `block`.
- Stop short of publication-quality acceptance when rendered-output review is missing, stale, `fix`, or `block`.
- Stop when doctor reports a required runtime missing; give its exact action.
- Stop before any upload, public post, deploy, paid API call, credential setup, or account action and return that boundary to the user.
- Read [errors-and-privacy.md](references/errors-and-privacy.md) for recovery and data-handling rules.
