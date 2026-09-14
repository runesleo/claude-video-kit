# Changelog

All notable local release-candidate changes are recorded here. A version entry does not imply that a tag, GitHub Release, or package publication exists.

## Unreleased — 2026-09-14

- Expand the guarded pre-render review from six checks to eleven by adding design-quality gates for hierarchy, simplicity, clarity, legibility, and craft.
- Treat those five checks as quality principles rather than permission to imitate another brand or bypass the canonical design system.
- Add `review-render`, an independent rendered-output review bound to the exact MP4 SHA-256 so a script pass cannot stand in for actual visual acceptance.
- Recheck the five design-quality dimensions on the moving image and keep `audio_consistency` plus platform-correct `end_card` as separate post-render checks.
- Reject legacy six-check receipts instead of silently grandfathering them through the stronger gate.
- Add a machine-checked `motion-storyboard.json` production gate before TTS/render so information purpose, visual metaphor, and motion grammar are designed before slide implementation.
- Block card-stack-by-default planning, excessive generic entrance/exit motion, and unexplained 3D usage while retaining an explicit demo-quality exception.
- Keep the neutral demo honest: it can prove pre-render review, render, and objective verification locally, but it cannot self-approve rendered-output quality.

## 0.3.0-rc.1 — 2026-07-22

- Add the installable `video-explainer` Agent Skill with progressive setup, scripting, review, render, verification, error, and privacy references.
- Add a read-only doctor and neutral no-key macOS first-success demo.
- Let doctor validate a not-yet-created output path through its nearest writable parent without creating files.
- Bind review receipts to the exact `script.json`; independent `fix` and `block` receipts cannot start rendering.
- Add script-timed caption alignment for the demo path so first success does not require a Whisper download.
- Verify generated scene rhythm from duration-matched render metadata, while retaining visual detection for standalone videos.
- Preserve spaces in wrapped Latin captions and remove the duplicate code-slide caption layer.
- Add root tests, static checks, bilingual activation docs, and a minimal CI candidate.

Known release boundary: this is a local candidate only. Push, tag, GitHub Release, and public promotion require separate approval.
