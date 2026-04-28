/**
 * Video preset system — phase 1 (shorts only; mid/long stub for phase 2-3).
 *
 * A preset bundles canvas size, fps, font scale, motion intensity and
 * default per-slide duration so a metadata.json with `preset: "shorts"`
 * doesn't have to hard-code width/height/font sizes for every slide.
 *
 * Components read `fontScale` from preset and multiply their base font sizes,
 * so the same script renders readable on shorts (big text) and balanced on
 * mid/long (smaller text).
 */

export type Preset = "shorts" | "mid" | "long";

export type MotionIntensity = "high" | "medium" | "low";

export interface PresetConfig {
  width: number;
  height: number;
  fps: number;
  /** Multiplier applied to component base font sizes. shorts uses ~1.6x. */
  fontScale: number;
  /** Drives spring stiffness, KenBurns amplitude, stagger delay. */
  motionIntensity: MotionIntensity;
  /** Default per-slide duration in frames if metadata doesn't specify. */
  defaultDurationFrames: number;
  /** Hard upper bound on total video length in seconds (platform compat). */
  maxDurationSeconds: number;
}

export const PRESET_CONFIG: Record<Preset, PresetConfig> = {
  // Phase 1 target — vertical 1080x1920, big text, dense motion, ≤60s.
  // 60s upper bound = YouTube Shorts hard cap (also 抖音 普通号).
  // Default 60 frames @ 30fps = 2s per slide → 30 slides max ≈ matches dense rhythm.
  shorts: {
    width: 1080,
    height: 1920,
    fps: 30,
    fontScale: 1.3,
    motionIntensity: "high",
    defaultDurationFrames: 60,
    maxDurationSeconds: 60,
  },

  // Phase 2 stub — keep horizontal 1080p, balanced motion, 8-20min target.
  // 20min cap matches typical YouTube tutorial / B站 知识区 length.
  mid: {
    width: 1920,
    height: 1080,
    fps: 30,
    fontScale: 1.0,
    motionIntensity: "medium",
    defaultDurationFrames: 240,
    maxDurationSeconds: 1200,
  },

  // Phase 3 stub — long-form podcast/walkthrough, slow motion, chapterized.
  // 2h cap covers most "drive-and-listen" content without forcing splits.
  long: {
    width: 1920,
    height: 1080,
    fps: 30,
    fontScale: 0.9,
    motionIntensity: "low",
    defaultDurationFrames: 480,
    maxDurationSeconds: 7200,
  },
};

/**
 * Resolve preset → effective dimensions/fps. If metadata has no preset,
 * fall back to its own width/height/fps so existing horizontal examples
 * keep working unchanged.
 */
export function resolvePreset(
  preset: Preset | undefined,
  fallback: { width: number; height: number; fps: number },
): { width: number; height: number; fps: number; config?: PresetConfig } {
  if (preset && PRESET_CONFIG[preset]) {
    const cfg = PRESET_CONFIG[preset];
    return { width: cfg.width, height: cfg.height, fps: cfg.fps, config: cfg };
  }
  return fallback;
}
