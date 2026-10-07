#!/usr/bin/env node
/**
 * build-distribute-pack.mjs
 *
 * Verifies the final release gate, then emits one platform's local handoff.
 *
 *   <project>/distribute/{bilibili,xiaohongshu,douyin}/
 *
 * This command never uploads or publishes. Downstream publishers must verify
 * the same release receipt again immediately before any external action.
 *     01-title.txt
 *     02-description.txt
 *     03-chapters.txt
 *     04-tags.txt
 *     05-release-handoff.json
 *
 * Chapter timestamps come from <project>/metadata.json by cumulatively
 * summing each slide's durationInFrames (divided by fps). If an intro was
 * prepended via scripts/prepend-cover.sh, pass --intro-offset to push every
 * chapter forward by that many seconds.
 *
 * Compliance policy: strips a small blacklist of regulator-sensitive words
 * (博彩 / 赌博 / 下注 / 盈利 / 押注 / 投注). Brand names are explicitly kept —
 * stripping them costs vertical-search discoverability.
 *
 * Per-platform overrides live in script.json under `platforms.{name}` and
 * may set any of: title, description, tags. Anything missing falls back to
 * the top-level title / summary / tags.
 *
 * Usage:
 *   node scripts/build-distribute-pack.mjs <project_dir> --platform bilibili
 *     --video <final.mp4> --cover <cover.png> --release-receipt <receipt.json>
 *     [--intro-offset 3]
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Per-platform blacklists. Keep lists conservative and WARN on match instead
// of silently stripping — operators should decide whether the match is a
// false-positive like "盈利模型" (a neutral analytics term) before deleting text.
const PLATFORM_BANNED_WORDS = {
  bilibili:    ["博彩", "赌博", "下注", "押注", "投注"],
  douyin:      ["博彩", "赌博", "下注", "押注", "投注"],
  xiaohongshu: ["博彩", "赌博", "下注", "押注", "投注"],
};
const PLATFORMS = Object.keys(PLATFORM_BANNED_WORDS);

function sanitize(text, bannedWords, warnings) {
  if (typeof text !== "string" || text.length === 0 || bannedWords.length === 0) {
    return typeof text === "string" ? text : (text ?? "");
  }
  let out = text;
  for (const word of bannedWords) {
    if (out.includes(word)) {
      warnings.push(word);
      out = out.split(word).join("");
    }
  }
  return out;
}

function framesToTimestamp(frames, fps) {
  if (!Number.isFinite(fps) || fps <= 0) throw new Error(`invalid fps: ${fps}`);
  // Round (not floor) so a 3.9s intro lands at 00:04, not 00:03 —
  // consistent with how chapter labels should match the audible moment.
  const totalSeconds = Math.max(0, Math.round(frames / fps));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function buildChapters(slides, fps, introOffsetSeconds, bannedWords, warnings) {
  let cumulativeFrames = Math.max(0, Math.round(introOffsetSeconds * fps));
  const lines = [];
  for (const slide of slides) {
    const label = slide.chapter ?? slide.title ?? slide.id ?? "章节";
    lines.push(`${framesToTimestamp(cumulativeFrames, fps)} ${sanitize(String(label), bannedWords, warnings)}`);
    const dur = Number(slide.durationInFrames);
    if (!Number.isFinite(dur) || dur <= 0) {
      throw new Error(`slide "${label}" has invalid durationInFrames: ${slide.durationInFrames}`);
    }
    cumulativeFrames += dur;
  }
  return lines.join("\n");
}

function parseArgs(argv) {
  const positional = [];
  const opts = { introOffset: 0 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--intro-offset") {
      const v = parseFloat(argv[++i]);
      if (!Number.isFinite(v)) throw new Error("--intro-offset needs a number");
      opts.introOffset = v;
    } else if (["--platform", "--video", "--cover", "--release-receipt"].includes(a)) {
      const value = argv[++i];
      if (!value || value.startsWith("--")) throw new Error(`${a} requires a value`);
      opts[a.slice(2)] = value;
    } else if (a === "-h" || a === "--help") {
      opts.help = true;
    } else if (a.startsWith("-")) {
      throw new Error(`unknown option: ${a}`);
    } else {
      positional.push(a);
    }
  }
  return { positional, opts };
}

function main() {
  const { positional, opts } = parseArgs(process.argv.slice(2));
  if (opts.help || positional.length === 0) {
    console.log("usage: build-distribute-pack.mjs <project_dir> --platform <bilibili|xiaohongshu|douyin> --video <final.mp4> --cover <cover.png> --release-receipt <receipt.json> [--intro-offset 3]");
    process.exit(opts.help ? 0 : 2);
  }
  if (positional.length !== 1) throw new Error("provide exactly one project directory");
  const project = path.resolve(positional[0]);
  for (const name of ["platform", "video", "cover", "release-receipt"]) {
    if (!opts[name]) throw new Error(`release gate requires --${name}; no distribution files written`);
  }
  if (!PLATFORMS.includes(opts.platform)) throw new Error(`unsupported pack platform: ${opts.platform}`);
  const gateScript = fileURLToPath(new URL("./video_release_gate.py", import.meta.url));
  const verified = spawnSync("python3", [gateScript, "verify",
    "--project-dir", project, "--platform", opts.platform,
    "--video", path.resolve(opts.video), "--cover", path.resolve(opts.cover),
    "--receipt", path.resolve(opts["release-receipt"]),
  ], { encoding: "utf8", shell: false });
  if (verified.error || verified.status !== 0) {
    throw new Error(`release gate refused handoff: ${verified.error?.message || verified.stdout || verified.stderr}`);
  }
  const report = JSON.parse(verified.stdout);
  if (report.status !== "PASS" || !report.verified) throw new Error("release gate returned no verified bindings");

  const scriptPath = path.join(project, "script.json");
  const metaPath = path.join(project, "metadata.json");
  if (!fs.existsSync(scriptPath)) {
    console.error(`error: ${scriptPath} not found`);
    process.exit(1);
  }
  if (!fs.existsSync(metaPath)) {
    console.error(`error: ${metaPath} not found — run build-metadata.mjs first`);
    process.exit(1);
  }

  const script = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));

  const baseTitle = script.title ?? "untitled";
  const baseDesc = script.summary ?? script.description ?? "";
  const baseTags = Array.isArray(script.tags) ? script.tags : [];
  const platformConfigs = script.platforms ?? {};

  for (const p of [opts.platform]) {
    const cfg = platformConfigs[p] ?? {};
    const dir = path.join(project, "distribute", p);
    fs.mkdirSync(dir, { recursive: true });

    const banned = PLATFORM_BANNED_WORDS[p] ?? [];
    const warnings = [];

    const title = sanitize(cfg.title ?? baseTitle, banned, warnings);
    const desc = sanitize(cfg.description ?? cfg.desc ?? baseDesc, banned, warnings);
    // Chapters re-computed per platform because the banned-word filter may
    // differ (YouTube keeps terms that Bilibili would strip).
    const chapters = buildChapters(meta.slides ?? [], meta.fps ?? 30, opts.introOffset, banned, warnings);
    const tagsSource = Array.isArray(cfg.tags) ? cfg.tags : baseTags;
    const tags = tagsSource
      .map((t) => sanitize(String(t), banned, warnings))
      .filter((t) => t.length > 0);

    fs.writeFileSync(path.join(dir, "01-title.txt"), title + "\n", "utf8");
    fs.writeFileSync(path.join(dir, "02-description.txt"), desc + "\n", "utf8");
    fs.writeFileSync(path.join(dir, "03-chapters.txt"), chapters + "\n", "utf8");
    fs.writeFileSync(path.join(dir, "04-tags.txt"), tags.join(" ") + "\n", "utf8");
    fs.writeFileSync(path.join(dir, "05-release-handoff.json"), JSON.stringify({
      schema: "video_release_handoff.v1",
      ...report.verified,
      next_step: "Run video_release_gate.py verify again immediately before upload or schedule. A local PASS is not publication authorization.",
    }, null, 2) + "\n", "utf8");

    let line = `→ ${dir}/ (title=${title.length}ch, desc=${desc.length}ch, tags=${tags.length})`;
    if (warnings.length > 0) {
      const unique = [...new Set(warnings)];
      line += `\n  ⚠️  stripped banned words: ${unique.join(", ")} — check if any are false positives (e.g. "盈利模型") and restore manually if so`;
    }
    console.log(line);
  }

  if (opts.introOffset > 0) {
    console.log(`chapters shifted by intro-offset ${opts.introOffset}s`);
  }
}

try {
  main();
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exitCode = 2;
}
