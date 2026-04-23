#!/usr/bin/env node
/**
 * build-distribute-pack.mjs
 *
 * Emits per-platform upload packages for a rendered project.
 *
 *   <project>/distribute/{bilibili,youtube,xiaohongshu,douyin}/
 *     01-title.txt
 *     02-description.txt
 *     03-chapters.txt
 *     04-tags.txt
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
 *   node scripts/build-distribute-pack.mjs <project_dir> [--intro-offset 3]
 */
import fs from "node:fs";
import path from "node:path";

// Per-platform blacklists. YouTube is exempt (no China regulator surface).
// Keep lists conservative and WARN on match instead of silently stripping —
// operators should decide whether the match is a false-positive like
// "盈利模型" (a neutral analytics term) before deleting text.
const PLATFORM_BANNED_WORDS = {
  bilibili:    ["博彩", "赌博", "下注", "押注", "投注"],
  douyin:      ["博彩", "赌博", "下注", "押注", "投注"],
  xiaohongshu: ["博彩", "赌博", "下注", "押注", "投注"],
  youtube:     [],
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
    } else if (a === "-h" || a === "--help") {
      opts.help = true;
    } else {
      positional.push(a);
    }
  }
  return { positional, opts };
}

function main() {
  const { positional, opts } = parseArgs(process.argv.slice(2));
  if (opts.help || positional.length === 0) {
    console.log("usage: build-distribute-pack.mjs <project_dir> [--intro-offset 3]");
    process.exit(opts.help ? 0 : 2);
  }
  const project = positional[0];

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

  for (const p of PLATFORMS) {
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

main();
