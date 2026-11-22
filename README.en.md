# Video Explainer Kit — English documentation

The current English documentation is maintained in [README.md](README.md).

Video Explainer Kit is an installable `video-explainer` Agent Skill for producing and checking vertical explainers from research, a script, or an existing MP4. It supports direct or agent-orchestrated production and a local Remotion fallback. External video-generation models are not bundled.

Start with:

- [Current overview and installation](README.md#install-as-a-plugin), including the `runesleo/x-reader` marketplace and recommended `npx skills add` route.
- [Quickstart](docs/quickstart.md), including the macOS no-key demo and production backend selection.
- [Agent Skill](skills/video-explainer/SKILL.md) and [setup / doctor](skills/video-explainer/references/setup-and-doctor.md).
- [Final release gate](docs/RELEASE_GATE.md) for the exact final master.

The deterministic production path keeps its storyboard and independent pre-render review. Every strategy still requires final-video verification and independent review. The demo is not publication-ready, and the Skill never uploads or publishes.
