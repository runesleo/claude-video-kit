# Example: schoger-demo

The first video I made with this pipeline — a 30-second summary of 5 UI tips
from [@steveschoger](https://x.com/steveschoger)'s post, rendered in Chinese.

**Watch the final video**: [@runes_leo on X](https://x.com/runes_leo)

This folder contains only the script — no audio or image assets — so the
pipeline can re-render it end-to-end from scratch.

## Run

```bash
./scripts/render.sh examples/schoger-demo
```

## Notes

- Uses the default `text` / `code` / `cover` slide types only. No custom
  compositions. If the built-in compositions are enough for this demo, they
  are probably enough for most of your ideas too.
- Voice text (`voice_text`) is separate from on-screen text so you can narrate
  more naturally than what the slide shows.
- The `code` slide in the final tip doubles as a takeaway card.
