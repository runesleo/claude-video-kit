/**
 * chartBase — shared foundation for every data-visualisation slide.
 *
 * Why this exists (2026-08-18): the pipeline had no chart primitives at all.
 * A deck whose own pre-production gate required "~70% real data visualisation"
 * shipped with 0% — not because anyone skipped a step, but because the only
 * building blocks available were text slides and text-laid-out tables. The gate
 * was a sentence in a markdown file; nothing could turn it into pixels.
 *
 * Every chart slide reads its palette from config/design-system.json via
 * this module, so covers, frames and charts cannot drift apart again.
 */
import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import ds from "../../../../config/design-system.json";

export const DS = {
  canvas: ds.canvas.base,
  panel: ds.canvas.panel,
  text: ds.text.primary,
  muted: ds.text.muted,
  accent: ds.semantic.accent,
  accentDeep: ds.semantic.accentDeep,
  verified: ds.semantic.verified,
  invalid: ds.semantic.invalid,
  sans: ds.typography.sans.join(", "),
  mono: ds.typography.mono.join(", "),
  safeX: ds.layout.safeAreaX,
  safeY: ds.layout.safeAreaY,
} as const;

/** Eased 0→1 used by every chart so growth animations feel like one system. */
export const useGrow = (delayFrames = 0, damping = 18) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delayFrames, fps, config: { damping, mass: 0.6 } });
};

/** Count-up for numeric labels; respects the same delay as the bar it labels. */
export const useCountUp = (target: number, delayFrames = 0, durationFrames = 24) => {
  const frame = useCurrentFrame();
  return interpolate(frame - delayFrames, [0, durationFrames], [0, target], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
};

/** Vertical space reserved at the bottom of every chart for the captions overlay. */
const CAPTION_BAND = 132;

export const ChartFrame: React.FC<{
  title: string;
  subtitle?: string;
  footnote?: string;
  slideNumber?: number;
  totalSlides?: number;
  children: React.ReactNode;
}> = ({ title, subtitle, footnote, slideNumber, totalSlides, children }) => {
  const t = useGrow(0);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: DS.canvas,
        padding: `${DS.safeY}px ${DS.safeX}px`,
        display: "flex",
        flexDirection: "column",
        fontFamily: DS.sans,
        color: DS.text,
      }}
    >
      <div style={{ opacity: t, transform: `translateY(${interpolate(t, [0, 1], [18, 0])}px)` }}>
        <div style={{ fontSize: 58, fontWeight: 800, letterSpacing: "-0.03em" }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 30, color: DS.muted, marginTop: 12 }}>{subtitle}</div>
        )}
      </div>

      {/* CaptionsLayer 覆盖在所有镜之上，其基线距画布底 96px（design-system.layout）。
          文字卡不受影响，但图表会被字幕压住 —— 实测柱状条与散点云都被遮过。
          因此内容区底部预留一条字幕带，图表永远画在它上方。 */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          marginTop: 36,
          paddingBottom: CAPTION_BAND,
        }}
      >
        {children}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ fontSize: 22, color: DS.muted, fontFamily: DS.mono, maxWidth: 1300 }}>
          {footnote}
        </div>
        {slideNumber != null && totalSlides != null && (
          <div style={{ fontSize: 20, color: DS.muted, fontFamily: DS.mono }}>
            {slideNumber} / {totalSlides}
          </div>
        )}
      </div>
    </div>
  );
};
