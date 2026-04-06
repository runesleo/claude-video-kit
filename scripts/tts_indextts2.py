#!/usr/bin/env python3
"""
tts_indextts2.py — Local IndexTTS2 backend (advanced, GPU required).

This is a placeholder entrypoint. See docs/indextts2.md for setup:
  1. Clone https://github.com/index-tts/IndexTTS2
  2. Download the model weights
  3. Set INDEXTTS2_CHECKPOINT env var
  4. Invoke this script with the same interface as tts.py

The actual inference wiring is left to the user because model paths and
CUDA setups vary wildly. The intent is documentation, not a silent runtime
dependency.
"""
import sys

print(
    "IndexTTS2 backend is not wired in this release.\n"
    "See docs/indextts2.md for local setup, or use scripts/tts.py (Fish Audio).",
    file=sys.stderr,
)
sys.exit(2)
