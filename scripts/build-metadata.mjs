#!/usr/bin/env node
/**
 * build-metadata.mjs
 *
 * Walks <project>/script.json + <project>/workspace/*.wav + captions.json,
 * computes per-slide durationInFrames from actual WAV duration, and emits
 * <project>/metadata.json for Remotion to consume via --props.
 *
 * WAV duration is read from the header (no ffprobe dependency):
 *   data chunk size / byte rate = seconds
 *
 * Usage: node scripts/build-metadata.mjs <project_dir>
 */
import fs from "node:fs";
import path from "node:path";

function wavDurationSeconds(wavPath) {
  const fd = fs.openSync(wavPath, "r");
  try {
    const header = Buffer.alloc(44);
    fs.readSync(fd, header, 0, 44, 0);
    // bytes 24-27: sample rate; 28-31: byte rate; 40-43: data chunk size
    const byteRate = header.readUInt32LE(28);
    const dataSize = header.readUInt32LE(40);
    if (!byteRate) throw new Error("invalid wav header");
    return dataSize / byteRate;
  } finally {
    fs.closeSync(fd);
  }
}

function main() {
  const project = process.argv[2];
  if (!project) {
    console.error("usage: build-metadata.mjs <project_dir>");
    process.exit(1);
  }

  const script = JSON.parse(
    fs.readFileSync(path.join(project, "script.json"), "utf8")
  );
  const workspace = path.join(project, "workspace");
  const captionsPath = path.join(workspace, "captions.json");
  const captions = fs.existsSync(captionsPath)
    ? JSON.parse(fs.readFileSync(captionsPath, "utf8"))
    : {};

  const fps = script.fps ?? 30;
  const BUFFER_FRAMES = 15; // ~0.5s pad so audio doesn't clip
  const MIN_FRAMES = 45;

  const slides = script.slides.map((slide, i) => {
    const idx = String(i).padStart(2, "0");
    const wav = path.join(workspace, `${idx}.wav`);
    let durationInFrames = MIN_FRAMES;
    let audio;
    if (fs.existsSync(wav)) {
      const seconds = wavDurationSeconds(wav);
      durationInFrames = Math.ceil(seconds * fps) + BUFFER_FRAMES;
      audio = `${idx}.wav`;
    }
    return {
      ...slide,
      durationInFrames,
      audio,
      captions: captions[idx] ?? undefined,
    };
  });

  const meta = {
    title: script.title ?? "untitled",
    width: script.width ?? 1080,
    height: script.height ?? 1920,
    fps,
    slides,
  };

  const out = path.join(project, "metadata.json");
  fs.writeFileSync(out, JSON.stringify(meta, null, 2));
  console.log(`→ ${out}`);
  const total = slides.reduce((a, s) => a + s.durationInFrames, 0);
  console.log(`total: ${slides.length} slides, ${total} frames (${(total / fps).toFixed(1)}s)`);
}

main();
