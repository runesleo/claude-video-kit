---
name: video-explainer
description: Turn a research brief, finished script, or generated MP4 into a reviewed and verified vertical explainer video. Use when an agent should choose the simplest current production strategy, preserve strict final-artifact quality gates, run the deterministic Remotion fallback, diagnose the local toolchain, or verify an existing MP4 before any manual publication step.
---

# Video Explainer

Version note: v0.3.0-rc.1 / 2026-09-27 / Make production strategy adaptive while keeping the deterministic Remotion recipe as a strict fallback. Final-artifact acceptance is strategy-independent and bound to the exact MP4 bytes. Keep upload, account access, credentials, private voice assets, hosted rendering, and publication out of scope.

Produce a local video and evidence packet. Never upload or publish from this skill.

## Core contract

This Skill separates **what must be true of the final artifact** from **how the artifact is produced**.

Before forcing an existing recipe, run a capability challenge:

1. Can the current model or available capability produce the final MP4 directly at the required quality?
2. Which requirements are real product, safety, brand, or evidence invariants?
3. Which existing steps only compensate for older model limitations?
4. Can intermediate stages be skipped without weakening final acceptance?
5. What is the simplest strategy likely to pass the final gates?
6. If that strategy fails, fall back to the deterministic repository-owned recipe.

Choose one execution strategy:

- `direct_artifact` — a current model/capability produces the final MP4 directly. Do not require `motion-storyboard.json`, `script.json`, TTS, alignment, or Remotion merely to satisfy a historical recipe.
- `agent_orchestrated` — an agent may choose and combine tools as implementation details. Intermediate artifacts are optional unless they are needed to satisfy the brief or evidence requirements.
- `legacy_remotion` — use the repository-owned deterministic path when direct generation cannot preserve facts, branding, layout control, narration identity, or other required qualities.

All three strategies converge on objective MP4 verification plus an independent final-artifact review. Production freedom never bypasses final acceptance.

## Install

The deterministic fallback orchestrates a local clone of `claude-video-kit`; it does not bundle the renderer. From the repository root, install the runtime and register the Skill with:

```bash
npm ci --prefix remotion
npx skills add runesleo/claude-video-kit --skill video-explainer
```

For repository development, run commands from the repository root.

## Workflow

1. Read the brief and run the capability challenge above. Select `direct_artifact`, `agent_orchestrated`, or `legacy_remotion`. Prefer the simplest strategy that can plausibly pass the same final acceptance contract.

2. If using `direct_artifact` or `agent_orchestrated`, produce the final 9:16 MP4 without manufacturing legacy intermediate files just to satisfy the old recipe. Then skip to Step 6.

3. If using `legacy_remotion`, run the read-only doctor before changing a project:

   ```bash
   node scripts/video-explainer.mjs doctor --output <output-directory>
   ```

   Read [setup-and-doctor.md](references/setup-and-doctor.md) when doctor blocks or the environment is new.

4. For `legacy_remotion`, turn the brief into `motion-storyboard.json` **before** treating the script as ready. For every scene, define its information purpose, visual metaphor, motion grammar, why motion communicates better than a static card, duration hint, and explicit 3D decision.

   Read [motion-storyboard.md](references/motion-storyboard.md), then validate:

   ```bash
   python3 scripts/check_storyboard.py <project>
   ```

   Production planning in this deterministic path must not default to title + card + bullets. Generic entrance/exit effects (`fade`, `slide`, `zoom`, etc.) do not count as an information model by themselves. 3D is an exception that must earn its render/debug cost with a concrete comprehension benefit.

5. For `legacy_remotion`, convert the approved information plan into `script.json`, require the independent pre-render review, and render only from a current pass receipt:

   ```bash
   node scripts/video-explainer.mjs review <project> --input <project>/review-input.json
   node scripts/video-explainer.mjs render <project>
   ```

   Read [brief-to-script.md](references/brief-to-script.md) and [review-gate.md](references/review-gate.md). The pre-render gate checks facts, structure, duration, visual feasibility, hierarchy, simplicity, clarity, legibility, craft, privacy, and copyright. Any script edit makes that receipt stale.

   On macOS, use `--demo-quality` only for a credential-free first success. It forces the built-in demo voice and script-timed captions; that explicit demo path may omit a storyboard and is never publication-quality. Read [render-and-verify.md](references/render-and-verify.md) before running a custom project.

6. For **every strategy**, verify the exact final MP4 objectively:

   ```bash
   node scripts/verify-shorts.mjs <video.mp4>
   ```

   For the deterministic Remotion path, prefer bound render metadata when available:

   ```bash
   node scripts/verify-shorts.mjs <project>/out/full.mp4 \
     --metadata <project>/metadata.json
   ```

   The objective verifier checks canvas, duration, and scene rhythm. It does **not** prove factual correctness, visual polish, privacy, copyright, narration consistency, or end-card correctness.

7. Require an independent final-artifact review bound to the exact MP4 SHA-256:

   ```bash
   node scripts/video-explainer.mjs review-render <video.mp4> \
     --input <render-review-input.json>
   ```

   The final-artifact review is strategy-independent. It requires:
   - facts
   - structure
   - duration
   - hierarchy
   - simplicity
   - clarity
   - legibility
   - craft
   - privacy
   - copyright
   - audio_consistency
   - end_card

   Record `production_strategy` in the review input when known. It is traceability metadata, not a quality waiver.

   If any final-artifact check is `fix` or `block`, revise or regenerate. A changed MP4 invalidates the receipt.

8. Report the chosen production strategy, video path, objective verification result, final-artifact review receipt, elapsed time, and known limitations. For `legacy_remotion`, also report storyboard validation and the pre-render receipt. A local pass is evidence for the artifact, not publication approval.

## Fallback rule

If `direct_artifact` or `agent_orchestrated` fails final acceptance, first determine whether another autonomous attempt can reasonably fix the defect. If deterministic control is required for facts, data visualization, brand layout, narration identity, or reproducibility, fall back to `legacy_remotion`.

Do not force the deterministic recipe merely because it exists. Do not accept a direct artifact merely because it was generated by a newer model.

## Canonical first success

Run the repository-owned neutral demo:

```bash
node scripts/video-explainer.mjs demo --output /tmp/video-explainer-first-success
```

The demo exercises the deterministic fallback. It must create a current pre-render pass receipt before TTS, render locally without an API key on supported macOS, and run the shorts verifier. The explicit demo-quality script-alignment path may omit `motion-storyboard.json`; this exception exists to preserve a credential-free tooling smoke test, not to define production quality. The demo intentionally does **not** self-approve the final-artifact gate because an independent reviewer must inspect the actual MP4. It must not read an account, upload media, or send the brief to a remote service.

## Stop conditions

- Stop the `legacy_remotion` production path when `motion-storyboard.json` is missing or fails its gate. The only exception is the explicit demo-quality script-alignment path.
- Stop `legacy_remotion` before TTS/render when the pre-render review is missing, stale, `fix`, or `block`.
- Stop every strategy short of publication-quality acceptance when final-artifact review is missing, stale, `fix`, or `block`.
- Stop when objective MP4 verification fails.
- Stop when doctor reports a required runtime missing for the deterministic fallback; give its exact action.
- Stop before any upload, public post, deploy, paid API call, credential setup, or account action and return that boundary to the user.
- Read [errors-and-privacy.md](references/errors-and-privacy.md) for recovery and data-handling rules.
