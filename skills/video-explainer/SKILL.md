---
name: video-explainer
description: Turn a research brief or finished script into a motion-planned, reviewed, narrated, rendered, and verified vertical explainer video. Use when an agent must create a short 9:16 explainer, enforce motion-first preproduction plus independent review gates, run a no-key local demo, diagnose the video toolchain, or verify a generated MP4 before any manual publication step.
---

# Video Explainer

Version note: v0.3.0-rc.1 / 2026-09-14 / Add motion-first preproduction on top of the design-quality and rendered-output gates. Production rendering requires a machine-checked `motion-storyboard.json`; the explicit demo-quality path may omit it. Keep upload, account access, credentials, private voice assets, and hosted rendering out of scope. Rollback: revert the 2026-09-14 storyboard-gate changes while keeping the existing review gates.

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

2. Turn the brief into `motion-storyboard.json` **before** treating the script as ready. For every scene, define its information purpose, visual metaphor, motion grammar, why motion communicates better than a static card, duration hint, and explicit 3D decision.

   Read [motion-storyboard.md](references/motion-storyboard.md), then validate:

   ```bash
   python3 scripts/check_storyboard.py <project>
   ```

   Production planning must not default to title + card + bullets. Generic entrance/exit effects (`fade`, `slide`, `zoom`, etc.) do not count as an information model by themselves. 3D is an exception that must earn its render/debug cost with a concrete comprehension benefit.

3. Convert the approved information plan into `script.json`. Keep claims traceable, use supported slide types, target 9:16, and stay inside the canonical design system. The script should implement the storyboard rather than replacing it with easier card layouts. Read [brief-to-script.md](references/brief-to-script.md) for the input/output contract.

4. Require an independent pre-render review. Write `review-input.json`, then run:

   ```bash
   node scripts/video-explainer.mjs review <project> --input <project>/review-input.json
   ```

   Read [review-gate.md](references/review-gate.md) for the eleven required checks. In addition to facts, structure, duration, visual feasibility, privacy, and copyright, every script must pass hierarchy, simplicity, clarity, legibility, and craft. These are quality principles, not permission to imitate another brand or bypass `config/design-system.json`.

   If any check is `fix` or `block`, revise and review again. Never render from that receipt. Any script edit makes the receipt stale.

5. Render only after a current pass receipt. The production render path rechecks `motion-storyboard.json` **before TTS** so a card-stack rewrite cannot silently bypass the storyboard step:

   ```bash
   node scripts/video-explainer.mjs render <project>
   ```

   On macOS, use `--demo-quality` only for a credential-free first success. It forces the built-in `say` voice and script-timed captions; that explicit demo path may omit a storyboard and is never publication-quality. Read [render-and-verify.md](references/render-and-verify.md) before running a custom project.

6. Verify the MP4 objectively, then require an independent rendered-output review. The objective verifier checks canvas, duration, and scene rhythm. It does **not** prove visual polish or chapter-level loudness consistency.

   ```bash
   node scripts/verify-shorts.mjs <project>/out/full.mp4 \
     --metadata <project>/metadata.json

   node scripts/video-explainer.mjs review-render <project>/out/full.mp4 \
     --input <project>/render-review-input.json
   ```

   The rendered-output review rechecks hierarchy, simplicity, clarity, legibility, and craft on the actual moving image, plus separate `audio_consistency` and `end_card` checks. Its receipt is bound to the exact MP4 SHA-256; a changed render invalidates it.

7. Report the storyboard validation, video path, pre-render review receipt, objective verification result, rendered-output review receipt, elapsed time, and known limitations. A local pass is evidence for the artifact, not publication approval.

## Canonical first success

Run the repository-owned neutral demo:

```bash
node scripts/video-explainer.mjs demo --output /tmp/video-explainer-first-success
```

The demo must create a current pre-render pass receipt before TTS, render locally without an API key on supported macOS, and run the shorts verifier. The explicit demo-quality script-alignment path may omit `motion-storyboard.json`; this exception exists to preserve a credential-free tooling smoke test, not to define production quality. The demo intentionally does **not** self-approve the rendered-output gate because an independent reviewer must inspect the actual MP4. It must not read an account, upload media, or send the brief to a remote service.

## Stop conditions

- Stop production TTS/render when `motion-storyboard.json` is missing or fails its gate. The only exception is the explicit demo-quality script-alignment path.
- Stop before TTS/render when the pre-render review is missing, stale, `fix`, or `block`.
- Stop short of publication-quality acceptance when rendered-output review is missing, stale, `fix`, or `block`.
- Stop when doctor reports a required runtime missing; give its exact action.
- Stop before any upload, public post, deploy, paid API call, credential setup, or account action and return that boundary to the user.
- Read [errors-and-privacy.md](references/errors-and-privacy.md) for recovery and data-handling rules.
