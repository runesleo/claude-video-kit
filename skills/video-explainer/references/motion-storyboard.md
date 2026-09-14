# Motion storyboard

Before writing or approving a production `script.json`, design the information movement. The canonical machine-readable artifact is `<project>/motion-storyboard.json`.

The point is not to add more animation. The point is to stop defaulting to title + card + bullets when the information itself has a better visual form.

## Required schema

```json
{
  "schema": "motion-storyboard/v1",
  "title": "One clear story",
  "scenes": [
    {
      "id": "S01",
      "duration_hint_s": 5,
      "information_purpose": "What must the viewer understand here?",
      "visual_metaphor": "A timeline whose gap stretches after the first event.",
      "motion_grammar": ["timeline", "stretch", "threshold"],
      "why_motion_beats_card": "The argument is about elapsed time, so changing distance makes the delay visible instead of merely naming it.",
      "three_d": {
        "used": false,
        "reason": "A one-dimensional time relationship does not benefit from depth."
      }
    }
  ]
}
```

Every production storyboard needs at least three scenes. Every scene must provide:

- `information_purpose` — the single comprehension job of the scene.
- `visual_metaphor` — the visual structure that represents that information.
- `motion_grammar` — how information changes over time, not merely how an element enters.
- `why_motion_beats_card` — why this treatment communicates better than a static text/card layout.
- `duration_hint_s` — a positive duration estimate.
- `three_d.used` — explicit `true` or `false`.

If `three_d.used=true`, `three_d.reason` must explain the information ROI. “Looks premium”, floating coins, decorative particles, logo spins, or camera depth without explanatory value do not qualify.

## Motion grammar

Prefer verbs that explain information:

- time: `timeline`, `time-compression`, `progression`, `window-compression`
- state: `state-transition`, `gating`, `threshold`, `lock`, `unlock`
- causality/flow: `flow`, `handoff`, `trace`, `network`, `assemble`
- comparison: `split`, `compare`, `before-after`, `converge`, `diverge`
- quantitative change: `trajectory`, `count`, `chart`, `scale`, `range`
- mechanism: `transform`, `sequence`, `explode`, `recombine`
- focus: `zoom-detail`, `mask`, `highlight` when the focus change itself explains something

`fade`, `slide`, `zoom`, `pop`, `wipe`, opacity changes and similar entrance/exit effects are allowed as polish, but they do not count as an information model by themselves.

## Card-stack guard

A card can be correct when the information really is a discrete record or UI object. It is not the default visual metaphor.

The checker blocks a storyboard when too much of the sequence is explicitly planned as cards, text panels, or bullet lists, or when too many scenes use only generic entrance/exit motion. The current ceiling is 25% (with a minimum allowance of one scene).

## 3D gate

3D is an exception, not a quality badge. Use it only when depth, spatial topology, object geometry, or camera parallax materially improves understanding. Examples that may justify it:

- a physical product whose geometry matters;
- a spatial network/path where depth prevents ambiguity;
- a layered system whose occlusion/depth is the explanation;
- an object transformation that cannot be communicated clearly in 2D/2.5D.

Do not use 3D merely to make a finance/crypto scene feel expensive. It raises preview and render complexity and therefore must earn its place.

## Production gate

Production rendering runs:

```bash
python3 scripts/check_storyboard.py <project>
```

before paid/expensive TTS and Remotion work. The only missing-storyboard exception is the explicit `--demo-quality` / script-alignment path, which is already labeled non-publication-quality.

This storyboard gate complements the eleven-check independent review and the rendered-output review. It does not replace facts, privacy, copyright, audio consistency, end-card checks, or the canonical visual design system.
