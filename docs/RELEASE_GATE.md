# Final release gate

`claude-video-kit` owns the complete pipeline, including the final release gate
ported from `runesleo/video-release-gate` for issue #27. The former repository is
a historical extract, not a separate installation or product.

The sequence is:

```text
script-bound pre-render review → render → verify-shorts
  → finish cover/subtitle/audio edits → exact final master
  → objective verification + independent final-artifact review
  → release-gate evaluate → release-gate verify → distribution handoff
  → downstream verify again immediately before authorized upload/schedule
```

The existing `video-explainer review`, `review-render`, and the four objective
`verify-shorts` checks stay in place. The release gate adds final asset, platform,
audio, and quality-profile evidence. A pre-render pass or shorts pass is not a
release pass. An intermediate render's review cannot approve a changed master.
No command here uploads, schedules, publishes, or authorizes an account action.

## Prepare final evidence

Finish every media-changing step (including `prepend-cover.sh`, subtitles, audio
normalization, and platform variants) first. Keep the final MP4, cover, QA files,
and review inside an explicit project directory. Symlinks resolving outside that
directory are rejected. `--canonical-root` optionally restricts the project to a
larger allowed directory; by default the explicit project directory is the root.

Run `verify-shorts` on the **final** short, not just the pre-edit render. Use
`--metadata` only when it matches the final timeline. Run the existing independent
`review-render` on those same bytes, then complete the platform release review:

```bash
node scripts/verify-shorts.mjs examples/my-first/out/final.mp4
node scripts/video-explainer.mjs review-render examples/my-first/out/final.mp4 \
  --input examples/my-first/render-review-input.json

python3 scripts/video_release_gate.py review-template --platform bilibili \
  > examples/my-first/FINAL-REVIEW-bilibili.json
```

The template starts `PENDING`, with false checks and unset scores. A reviewer
distinct from the producer must inspect the final video and cover, record their
SHA-256 hashes, fill the quality scores/checks, and set `status` to `PASS` only
after review. Never generate a passing review merely to unblock the pipeline.
The older `render-review-result.json` is separate evidence and is not silently
converted into this platform release receipt.

Each of `FACT-CHECK.md`, `AUDIO-QA.md`, and `RENDER-QA.md` must contain the exact
final video SHA-256, for example `final_video_sha256: <64 hex characters>`.
These are substantive QA records; including a hash alone does not prove QA.

The versioned [quality profile](../config/video_quality_profile.json) supplies
motion/composition/pacing/platform-fit/visual-freshness floors and mandatory
review checks. Profile changes invalidate older gate receipts, even when media
bytes have not changed.

## Evaluate and hand off

Requirements: Python 3.10+, Node 20+ for distribution packs, and both `ffmpeg`
and `ffprobe` on PATH for evaluation. No Python packages, API keys, or accounts.

From the repository root:

```bash
python3 scripts/video_release_gate.py evaluate \
  --project-dir examples/my-first \
  --video examples/my-first/out/final.mp4 \
  --cover examples/my-first/cover-bilibili.png \
  --platform bilibili \
  --fact-qa examples/my-first/FACT-CHECK.md \
  --audio-qa examples/my-first/AUDIO-QA.md \
  --render-qa examples/my-first/RENDER-QA.md \
  --review-receipt examples/my-first/FINAL-REVIEW-bilibili.json \
  --output examples/my-first/VIDEO-RELEASE-GATE-bilibili.json

node scripts/build-distribute-pack.mjs examples/my-first \
  --platform bilibili \
  --video examples/my-first/out/final.mp4 \
  --cover examples/my-first/cover-bilibili.png \
  --release-receipt examples/my-first/VIDEO-RELEASE-GATE-bilibili.json \
  --intro-offset 3
```

`evaluate` measures integrated loudness (-14 ±1.5 LUFS), LRA (≤8 LU), true peak
(≤-1.5 dBTP), representative-window mean-level spread (≤8 dB), and near-silence
ratio (≤45%). It requires exactly one video stream and one stereo 48 kHz audio
stream, with audio covering the video timeline (at most 0.25 seconds of codec
timing skew). Missing tails and ambiguous multiple tracks fail closed. Sample
windows pad absent audio as silence and use the actual duration for short clips.
Missing/failed/non-finite measurements fail closed. All inputs are hashed again after evaluation to catch
changes made during inspection. `issue` remains an alias of `evaluate`.

Cover sizes are **this kit's release presets**, not a claim about every upload
size accepted by a platform: Bilibili/YouTube 1920×1080;
Xiaohongshu/WeChat Channels/Douyin 2160×2880. X has an optional cover; once
supplied, its hash remains mandatory at verification.

`build-distribute-pack` verifies **before writing** and emits one explicitly
selected platform (Bilibili, Xiaohongshu, or Douyin). Repeat with that platform's
own review, cover, and release receipt for each additional destination. The old
command without release arguments now fails closed. The four existing text files
retain their format; `05-release-handoff.json` identifies the verified assets and
receipt. YouTube/X/WeChat integrations use the same standalone `verify` command.

## Last check before an external action

Every downstream uploader/scheduler must run this command at the point of use,
use the explicit same paths, and abort on **any nonzero exit or unreadable output**:

```bash
python3 scripts/video_release_gate.py verify \
  --receipt examples/my-first/VIDEO-RELEASE-GATE-bilibili.json \
  --project-dir examples/my-first \
  --video examples/my-first/out/final.mp4 \
  --cover examples/my-first/cover-bilibili.png \
  --platform bilibili
```

Exit codes: `0` PASS, `2` gate FAIL, `64` usage/config error. Python CLI stdout is
JSON (apart from `--help`); `npm run release-gate -- ...` is a convenience wrapper,
not a clean-stdout machine interface. `verify` rehashes all assets, three QA docs,
review, and current profile; revalidates reviewer independence, review checks,
scores, and recorded objective measurements against current policy. It does not
rerun expensive audio measurement for unchanged bytes. It checks the snapshot
again at the end, including the gate receipt itself; the pack consumes these
verified bindings instead of rereading an unchecked receipt.

These are local, unsigned evidence receipts. Reviewer IDs are declarations, not
identity authentication; prose QA and visual judgments still require a real
independent reviewer. Keep the project stable between verification and upload.
A persisted pack can become stale, so pack creation never replaces the final
point-of-use verification. Hash binding is not publication authorization.

## Port map and validation

Source snapshot: `runesleo/video-release-gate@531bcd9d8210d0d8683586b1ac94175637ed6a46` (MIT).

| Source | Canonical implementation |
| --- | --- |
| `video_release_gate.py` | `scripts/video_release_gate.py` |
| `video_quality_profile.json` | `config/video_quality_profile.json` (unchanged profile) |
| `tests/test_video_release_gate.py` | `tests/test_video_release_gate.py` (original eight plus integration regressions) |
| Standalone CLI/docs | `npm run release-gate`, this guide, bilingual README entrypoints |
| Missing last-mile wiring | `scripts/build-distribute-pack.mjs`, required verification before any output |

Run `npm run check` for all Node and Python tests, shell syntax, Python compile,
and Remotion TypeScript checks. `npm run test:release-gate` also exercises a local
FFmpeg-generated synthetic video through evaluate → verify → pack → drift
rejection. That media test skips if FFmpeg is absent; CI installs it explicitly.
Tests do not approve real content or publish anything.
