#!/usr/bin/env node
/**
 * verify-shorts.mjs — early technical preflight for vertical videos.
 *
 * asset-version: v0.3.0-rc.1 / 2026-07-22 / verify generated cuts from bound render metadata
 * owner_surface: claude-video-kit / T0580 / shorts acceptance
 * behavior_change: include first/last scenes and prefer a duration-matched render schedule when supplied
 * rollback: omit --metadata to retain visual scene detection; revert this file for legacy interval math
 *
 * Usage:
 *   node scripts/verify-shorts.mjs <video.mp4> [--format shorts|explainer]
 *     [--metadata <metadata.json>] [--check-audio]
 *
 * Hard gates (any failing → exit 1):
 *   1. Vertical 9:16 canvas, at least 720×1280
 *   2. Valid duration; shorts recipe ≤ 60s, explainer has no implicit cap
 *   3. Optional --check-audio uses the existing release gate's audio rules
 *
 * Soft warnings (printed, don't fail):
 *   - 720p is accepted but 1080p+ is recommended
 *   - Visual scene-cut rhythm and opening-hook prompts for human review
 *   - File size > 30MB (consider re-encoding before upload)
 *
 * This preflight never substitutes for the independent final-artifact review
 * or the hash-bound release-gate evaluate/verify before distribution.
 *
 * Safety: uses spawn() with arg arrays — no shell interpolation, args are
 * passed directly to ffprobe/ffmpeg without going through a shell.
 */

import { spawn } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { argv, exit } from "node:process";
import { fileURLToPath } from "node:url";

const MIN_VERTICAL_WIDTH = 720;
const MIN_VERTICAL_HEIGHT = 1280;
const RECOMMENDED_WIDTH = 1080;
const RECOMMENDED_HEIGHT = 1920;
const SHORTS_MAX_DURATION_S = 60;
const SHORTS_MUX_TAIL_TOLERANCE_S = 0.25;
const MAX_AVG_SCENE_INTERVAL_S = 3.0;
const FIRST_HOOK_WINDOW_S = 2.0;

function runArgv(cmd, args, acceptedCodes = [0]) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    child.on("close", (code) => {
      if (!acceptedCodes.includes(code)) {
        reject(new Error(`${cmd} exit ${code}: ${stderr || stdout}`));
      } else {
        resolve({ stdout, stderr, code });
      }
    });
    child.on("error", reject);
  });
}

async function probeMeta(path) {
  const { stdout } = await runArgv("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height,r_frame_rate,duration:format=duration,size",
    "-of",
    "json",
    path,
  ]);
  const data = JSON.parse(stdout);
  const stream = data.streams?.[0] ?? {};
  const fmt = data.format ?? {};
  const streamDuration = Number.parseFloat(stream.duration ?? "NaN");
  const containerDuration = Number.parseFloat(fmt.duration ?? "NaN");
  return {
    width: stream.width,
    height: stream.height,
    // AAC mux padding can extend the container after an exactly 60s video stream.
    duration: Number.isFinite(streamDuration) && streamDuration > 0
      ? streamDuration
      : containerDuration,
    containerDuration,
    sizeBytes: parseInt(fmt.size ?? "0", 10),
  };
}

/**
 * Detect scene changes via ffmpeg's scene filter. Returns timestamps (in
 * seconds) where a scene change exceeds the threshold.
 */
async function detectScenes(path, threshold = 0.1) {
  const { stderr } = await runArgv("ffmpeg", [
    "-i",
    path,
    "-filter:v",
    `select='gt(scene,${threshold})',showinfo`,
    "-f",
    "null",
    "-",
  ]);
  const ts = [];
  const re = /pts_time:([\d.]+)/g;
  let m;
  while ((m = re.exec(stderr)) !== null) {
    ts.push(parseFloat(m[1]));
  }
  return ts;
}

function parseOptions(args) {
  const options = { format: "shorts", metadataPath: undefined, checkAudio: false };
  const seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const name = args[index];
    if (!["--format", "--metadata", "--check-audio"].includes(name) || seen.has(name)) {
      throw new Error(`invalid or repeated option: ${name}`);
    }
    seen.add(name);
    if (name === "--check-audio") {
      options.checkAudio = true;
    } else {
      const value = args[++index];
      if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
      if (name === "--format") options.format = value;
      else options.metadataPath = value;
    }
  }
  if (!["shorts", "explainer"].includes(options.format)) {
    throw new Error(`unsupported format: ${options.format} (choose shorts or explainer)`);
  }
  return options;
}

async function checkAudioPreflight(videoPath) {
  const scriptPath = fileURLToPath(new URL("./video_release_gate.py", import.meta.url));
  const { stdout } = await runArgv(
    "python3",
    [scriptPath, "audio-preflight", "--video", videoPath],
    [0, 2],
  );
  const result = JSON.parse(stdout);
  if (!result || !["PASS", "FAIL"].includes(result.status)) {
    throw new Error("audio preflight returned an invalid result");
  }
  return result;
}

async function loadRenderSchedule(path, videoMeta) {
  let data;
  try {
    data = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new Error(`invalid render metadata: ${error.message}`);
  }

  const fps = Number(data.fps);
  const slides = data.slides;
  if (!Number.isFinite(fps) || fps <= 0 || !Array.isArray(slides) || slides.length === 0) {
    throw new Error("invalid render metadata: fps and at least one slide are required");
  }
  if (data.width !== videoMeta.width || data.height !== videoMeta.height) {
    throw new Error(
      `render metadata canvas ${data.width}×${data.height} does not match video ${videoMeta.width}×${videoMeta.height}`,
    );
  }

  const durations = slides.map((slide, index) => {
    const frames = Number(slide.durationInFrames);
    if (!Number.isFinite(frames) || frames <= 0) {
      throw new Error(`invalid render metadata: slide ${index} has no positive durationInFrames`);
    }
    return frames;
  });
  const scheduledDuration = durations.reduce((sum, frames) => sum + frames, 0) / fps;
  const tolerance = Math.max(0.25, 2 / fps);
  if (Math.abs(scheduledDuration - videoMeta.duration) > tolerance) {
    throw new Error(
      `render metadata duration ${fmt(scheduledDuration)}s does not match video ${fmt(videoMeta.duration)}s`,
    );
  }

  let elapsedFrames = 0;
  const scenes = [];
  for (const frames of durations.slice(0, -1)) {
    elapsedFrames += frames;
    scenes.push(elapsedFrames / fps);
  }
  return scenes;
}

function sceneIntervals(duration, scenes) {
  const boundaries = [
    0,
    ...scenes
      .filter((time) => Number.isFinite(time) && time > 0 && time < duration)
      .sort((a, b) => a - b),
    duration,
  ];
  const intervals = [];
  for (let i = 1; i < boundaries.length; i++) {
    intervals.push(boundaries[i] - boundaries[i - 1]);
  }
  return intervals;
}

function median(arr) {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function fmt(n, digits = 2) {
  return Number(n).toFixed(digits);
}

async function main() {
  const path = argv[2];
  if (!path || path.startsWith("--")) {
    console.error("usage: verify-shorts <video.mp4> [--format shorts|explainer] [--metadata <metadata.json>] [--check-audio]");
    exit(2);
  }
  const options = parseOptions(argv.slice(3));

  try {
    await stat(path);
  } catch {
    console.error(`file not found: ${path}`);
    exit(2);
  }

  const meta = await probeMeta(path);
  const scenes = options.metadataPath
    ? await loadRenderSchedule(options.metadataPath, meta)
    : await detectScenes(path);
  const sceneSource = options.metadataPath ? "metadata schedule" : "visual detector";

  const intervals = sceneIntervals(meta.duration, scenes);
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const medianInterval = median(intervals);

  const hookSceneCount = scenes.filter((t) => t <= FIRST_HOOK_WINDOW_S).length;

  const failures = [];
  if (!Number.isFinite(meta.width) || !Number.isFinite(meta.height) ||
      meta.width < MIN_VERTICAL_WIDTH || meta.height < MIN_VERTICAL_HEIGHT ||
      Math.abs(meta.width / meta.height - 9 / 16) > 0.004) {
    failures.push(
      `canvas ${meta.width}×${meta.height} is not supported 9:16 vertical (minimum ${MIN_VERTICAL_WIDTH}×${MIN_VERTICAL_HEIGHT})`,
    );
  }
  if (!Number.isFinite(meta.duration) || meta.duration <= 0 ||
      (options.format === "shorts" && meta.duration > SHORTS_MAX_DURATION_S)) {
    failures.push(
      options.format === "shorts"
        ? `duration ${fmt(meta.duration)}s must be positive and ≤ ${SHORTS_MAX_DURATION_S}s (shorts recipe target)`
        : `duration ${fmt(meta.duration)}s must be positive`,
    );
  }
  if (options.format === "shorts" && Number.isFinite(meta.containerDuration) &&
      meta.containerDuration > SHORTS_MAX_DURATION_S + SHORTS_MUX_TAIL_TOLERANCE_S) {
    failures.push(
      `container duration ${fmt(meta.containerDuration)}s exceeds ${SHORTS_MAX_DURATION_S}s plus ${SHORTS_MUX_TAIL_TOLERANCE_S}s codec padding allowance`,
    );
  }
  const audioResult = options.checkAudio ? await checkAudioPreflight(path) : undefined;
  if (audioResult?.status === "FAIL") {
    failures.push(`audio preflight failed: ${audioResult.failures.join("; ")}`);
  }
  const hardGateCount = options.checkAudio ? 3 : 2;

  const warnings = [];
  if (meta.width < RECOMMENDED_WIDTH || meta.height < RECOMMENDED_HEIGHT) {
    warnings.push(`${meta.width}×${meta.height} is valid 9:16 but below recommended ${RECOMMENDED_WIDTH}×${RECOMMENDED_HEIGHT}`);
  }
  if (options.format === "shorts") {
    if (avgInterval > MAX_AVG_SCENE_INTERVAL_S) {
      warnings.push(`avg detected scene interval ${fmt(avgInterval)}s > ${MAX_AVG_SCENE_INTERVAL_S}s (review pacing; cuts ≠ all motion)`);
    }
    if (medianInterval > 2.5) {
      warnings.push(`median detected scene interval ${fmt(medianInterval)}s > 2.5s (review pacing)`);
    }
  } else {
    warnings.push("explainer pacing requires independent chapter-level motion review (shorts cut thresholds do not apply)");
  }
  if (hookSceneCount === 0 && meta.duration > FIRST_HOOK_WINDOW_S) {
    warnings.push(`no detected cut in first ${FIRST_HOOK_WINDOW_S}s (review opening visuals; text/motion may not register)`);
  }
  if (options.format === "shorts" && Number.isFinite(meta.containerDuration) &&
      meta.duration <= SHORTS_MAX_DURATION_S &&
      meta.containerDuration > SHORTS_MAX_DURATION_S &&
      meta.containerDuration <= SHORTS_MAX_DURATION_S + SHORTS_MUX_TAIL_TOLERANCE_S) {
    warnings.push(`container duration ${fmt(meta.containerDuration)}s slightly exceeds ${SHORTS_MAX_DURATION_S}s (review codec padding and platform fit)`);
  }
  if (meta.sizeBytes > 30 * 1024 * 1024) {
    warnings.push(
      `file size ${fmt(meta.sizeBytes / 1024 / 1024)}MB > 30MB (consider re-encode)`,
    );
  }

  console.log(`# Vertical Video Preflight Report`);
  console.log(`file: ${path}`);
  console.log(``);
  console.log(`format: ${options.format}`);
  console.log(`canvas: ${meta.width}×${meta.height}`);
  console.log(`duration: ${fmt(meta.duration)}s`);
  if (Number.isFinite(meta.containerDuration)) {
    console.log(`container duration: ${fmt(meta.containerDuration)}s`);
  }
  console.log(`size: ${fmt(meta.sizeBytes / 1024 / 1024)}MB`);
  console.log(`scene source: ${sceneSource}`);
  console.log(`scenes detected: ${scenes.length}`);
  console.log(`avg interval: ${fmt(avgInterval)}s`);
  console.log(`median interval: ${fmt(medianInterval)}s`);
  console.log(`first-${FIRST_HOOK_WINDOW_S}s scene changes: ${hookSceneCount}`);
  if (audioResult) {
    console.log(`audio preflight: ${audioResult.status}`);
    if (audioResult.metrics?.integrated_lufs != null) {
      console.log(`audio loudness: ${fmt(audioResult.metrics.integrated_lufs)} LUFS`);
      console.log(`audio true peak: ${fmt(audioResult.metrics.true_peak_dbtp)} dBTP`);
    }
  } else {
    console.log(`audio preflight: NOT RUN (use --check-audio)`);
  }
  console.log(``);

  if (failures.length === 0) {
    console.log(`✅ PASS (${hardGateCount}/${hardGateCount} technical gates)`);
  } else {
    console.log(`❌ FAIL (${failures.length} of ${hardGateCount} technical gates failed)`);
    for (const f of failures) console.log(`  - ${f}`);
  }
  if (warnings.length > 0) {
    console.log(``);
    console.log(`⚠️ Warnings (non-blocking):`);
    for (const w of warnings) console.log(`  - ${w}`);
  }

  exit(failures.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err.message ?? err);
  exit(2);
});
