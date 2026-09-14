# Review gates

Use a reviewer distinct from the script author or video producer. Review the exact bytes that will proceed to the next stage.

The design-quality lens is informed by Apple platform design guidance, but it is **not** an instruction to imitate Apple visuals. Existing Leo Labs brand tokens, templates, platform rules, and content requirements remain authoritative. The five checks below are quality principles: hierarchy, simplicity, clarity, legibility, and craft.

Reference: https://developer.apple.com/design/

## 1. Pre-render gate

Create `review-input.json` with all eleven checks:

```json
{
  "author": "writer-agent",
  "reviewer": "independent-reviewer",
  "checks": {
    "facts": { "status": "pass", "notes": "Sources support every factual claim." },
    "structure": { "status": "pass", "notes": "Hook, explanation, and close are coherent." },
    "duration": { "status": "pass", "notes": "Narration fits the target duration." },
    "visual_feasibility": { "status": "pass", "notes": "Every slide maps to an existing composition." },
    "hierarchy": { "status": "pass", "notes": "Each frame has one obvious primary message." },
    "simplicity": { "status": "pass", "notes": "No element exists without an information or brand job." },
    "clarity": { "status": "pass", "notes": "Type, spacing, contrast, and labels establish the reading order." },
    "legibility": { "status": "pass", "notes": "Text remains readable at actual phone viewing size." },
    "craft": { "status": "pass", "notes": "Alignment, spacing, type, components, and motion are internally consistent." },
    "privacy": { "status": "pass", "notes": "No private or identifying material." },
    "copyright": { "status": "pass", "notes": "All media and copy are owned or permitted." }
  }
}
```

Each status must be `pass`, `fix`, or `block`. The aggregate receipt takes the worst status. The command binds the receipt to the current `script.json` SHA-256:

```bash
node scripts/video-explainer.mjs review <project> --input <project>/review-input.json
```

Any script edit makes the receipt stale. Re-run independent review after edits. Do not manually alter `review-result.json` to bypass the gate.

### How to apply the five design checks

- **Hierarchy** — can a viewer identify the intended first read within roughly three seconds? Competing titles, equal-weight callouts, or decorative focal points are a failure.
- **Simplicity** — remove elements that do not change comprehension, evidence, navigation, or brand recognition. Simplicity means eliminating unnecessary decisions, not merely making the screen sparse.
- **Clarity** — prefer scale, spacing, position, labels, and contrast over extra boxes, gradients, badges, or decoration.
- **Legibility** — judge at real phone size, not only on a 1920 px canvas. Dense Chinese text, tiny footnotes, weak contrast, and subtitle collisions are failures.
- **Craft** — inspect alignment, spacing rhythm, font usage, component consistency, chart labeling, transition timing, and motion. Motion that adds visual noise without explaining change is a failure.

These checks supplement `config/design-system.json`; they do not authorize new colors, fonts, templates, or one-off visual systems.

## 2. Rendered-output gate

A script can pass while the actual MP4 still looks wrong. After rendering and objective verification, review the exact rendered video bytes with a second reviewer.

Create `render-review-input.json`:

```json
{
  "producer": "render-agent",
  "reviewer": "independent-render-reviewer",
  "checks": {
    "hierarchy": { "status": "pass", "notes": "Primary focus survives the actual render." },
    "simplicity": { "status": "pass", "notes": "No rendered element creates unnecessary visual load." },
    "clarity": { "status": "pass", "notes": "Reading order and labels are unambiguous in motion." },
    "legibility": { "status": "pass", "notes": "Phone-size viewing, captions, charts, and footnotes are readable." },
    "craft": { "status": "pass", "notes": "Alignment, spacing, animation, and visual rhythm are polished." },
    "audio_consistency": { "status": "pass", "notes": "No chapter-to-chapter loudness, pacing, or voice-level jump was detected." },
    "end_card": { "status": "pass", "notes": "The correct platform-specific end card is present, unobscured, and readable." }
  }
}
```

Then bind the receipt to the exact MP4 SHA-256:

```bash
node scripts/video-explainer.mjs review-render <project>/out/full.mp4 \
  --input <project>/render-review-input.json
```

If the MP4 changes, the rendered-output receipt becomes stale. `fix` or `block` is not publication-quality acceptance.

`audio_consistency` is intentionally separate from the five design principles. The current objective verifier does not yet automate chapter-level LUFS consistency, so a manual independent check is required rather than pretending the design gate solves audio QA.
