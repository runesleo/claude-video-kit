# Brief to script

Produce one project directory containing `motion-storyboard.json` and `script.json`.

The storyboard comes first for production work. `script.json` is the narrated implementation of that information plan, not permission to collapse difficult scenes back into generic cards.

## Required script shape

```json
{
  "title": "One clear idea",
  "preset": "shorts",
  "width": 1080,
  "height": 1920,
  "fps": 30,
  "slides": [
    {
      "type": "cover",
      "title": "Hook",
      "subtitle": "Promise",
      "voice_text": "Hook narration."
    },
    {
      "type": "text",
      "text": "On-screen point",
      "voice_text": "Natural narration for that point."
    }
  ]
}
```

Use existing slide types: `cover`, `text`, `code`, `content`, `table`, `formula`, `transition`, or `numberHero`. Do not add a new composition for the canonical first success.

## Storyboard-to-script rule

Before calling the script ready, run:

```bash
python3 scripts/check_storyboard.py <project>
```

For production work, every major script scene should be traceable to a storyboard scene's `information_purpose`, `visual_metaphor`, and `motion_grammar`. If an existing slide type cannot express the approved metaphor, report the mismatch explicitly instead of silently replacing it with a text/card layout.

The explicit `--demo-quality` path may omit a storyboard because it is a tooling smoke test, not a production-quality video path.

## Script rules

- Lead with one comprehensible hook; close with one result or next step.
- Keep on-screen text shorter than narration.
- Put narration in `voice_text` for every slide, including covers. The script-timed demo path uses it as the reviewed caption source.
- Make every number, date, attribution, and product behavior reviewable from the supplied source material.
- Avoid personal data, local absolute paths, tokens, account identifiers, private voices, and unlicensed media.
- Target 20–30 seconds for the canonical demo; measure the actual output rather than promising the estimate.
- Keep upload and platform-specific publishing copy outside `script.json`.
- Do not use generic `fade`/`slide`/`zoom` polish as a substitute for the storyboard's information motion.
- Do not introduce 3D when the storyboard marks `three_d.used=false`; if the information model changes enough to require 3D, revise and revalidate the storyboard first.
