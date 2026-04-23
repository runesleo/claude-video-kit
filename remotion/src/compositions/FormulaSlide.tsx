import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BrandedSlideLayout, BrandConfig } from "./BrandedSlideLayout";

export interface FormulaGroup {
  /** Short label displayed to the left (e.g. "流入 +", "Inflow +") */
  label: string;
  /** Tokens (e.g. field names) to pill-render */
  tokens: string[];
  /** Pill color scheme — auto-picks green/red/blue based on role. Default green. */
  color?: "green" | "red" | "blue" | "gold" | "orange";
}

export interface FormulaSlideProps {
  slideNumber: number;
  totalSlides: number;
  durationInFrames?: number;
  brand?: BrandConfig;

  title: string;
  /** Ordered groups. Each group's tokens spring-in after the previous. */
  groups: FormulaGroup[];
  /** Caption rendered below the formula card */
  caption?: string;
  /** Prefix text above formula, e.g. "PnL =". Default "=" */
  prefix?: string;
}

const COLOR_MAP = {
  green: { bg: "rgba(79, 174, 80, 0.15)", border: "#4fae50", text: "#4fae50" },
  red: { bg: "rgba(239, 68, 68, 0.15)", border: "#ef4444", text: "#ef4444" },
  blue: { bg: "rgba(16, 96, 176, 0.15)", border: "#1060b0", text: "#1060b0" },
  gold: { bg: "rgba(240, 192, 64, 0.15)", border: "#f0c040", text: "#f0c040" },
  orange: { bg: "rgba(238, 148, 62, 0.15)", border: "#ee943e", text: "#ee943e" },
};

/**
 * Formula slide: renders labeled groups of colored "pill" tokens, one by one.
 *
 * Each token springs in with scale + opacity. Groups animate sequentially so
 * the viewer can follow along as narration explains each part.
 *
 * Example:
 *   <FormulaSlide
 *     title="Cash flow method"
 *     groups={[
 *       { label: "Inflow +", tokens: ["SELL", "REDEEM", "MERGE"], color: "green" },
 *       { label: "Outflow −", tokens: ["BUY", "SPLIT"], color: "red" },
 *       { label: "Position +", tokens: ["UNREALIZED"], color: "blue" },
 *     ]}
 *     caption="Sum raw cash flow from trading records"
 *   />
 */
export const FormulaSlide: React.FC<FormulaSlideProps> = ({
  slideNumber,
  totalSlides,
  durationInFrames,
  brand,
  title,
  groups,
  caption,
  prefix = "PnL =",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Compute when each group's first token starts animating
  const GROUP_OFFSET = 30;
  const TOKEN_STAGGER = 10;

  let tokenCount = 0;

  return (
    <BrandedSlideLayout
      slideNumber={slideNumber}
      totalSlides={totalSlides}
      durationInFrames={durationInFrames}
      brand={brand}
    >
      <div
        style={{
          fontSize: 52,
          fontWeight: 700,
          color: "#f9fafb",
          opacity: titleOpacity,
          marginBottom: 50,
        }}
      >
        {title}
      </div>

      <div
        style={{
          background: "linear-gradient(135deg, #111827, #1f2937)",
          borderRadius: 20,
          padding: "50px 60px",
          border: "1px solid #374151",
        }}
      >
        <div style={{ fontSize: 28, color: "#9ca3af", marginBottom: 30 }}>
          {prefix}
        </div>

        {groups.map((group, gi) => {
          const palette = COLOR_MAP[group.color ?? "green"];
          const tokens = group.tokens.map((token) => {
            const startFrame = GROUP_OFFSET + tokenCount * TOKEN_STAGGER;
            tokenCount += 1;
            const s = spring({
              frame: frame - startFrame,
              fps,
              config: { damping: 15 },
            });
            return (
              <div
                key={token}
                style={{
                  padding: "12px 28px",
                  borderRadius: 12,
                  backgroundColor: palette.bg,
                  border: `1px solid ${palette.border}`,
                  color: palette.text,
                  fontSize: 26,
                  fontWeight: 600,
                  fontFamily: "monospace",
                  opacity: s,
                  transform: `scale(${interpolate(s, [0, 1], [0.8, 1])})`,
                }}
              >
                {token}
              </div>
            );
          });

          return (
            <div
              key={gi}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                marginBottom: gi < groups.length - 1 ? 24 : 0,
              }}
            >
              <span style={{ fontSize: 22, color: "#6b7280", width: 110 }}>
                {group.label}
              </span>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {tokens}
              </div>
            </div>
          );
        })}
      </div>

      {caption && (
        <div
          style={{
            marginTop: 40,
            fontSize: 28,
            color: "#9ca3af",
            opacity: interpolate(
              frame,
              [GROUP_OFFSET + tokenCount * TOKEN_STAGGER + 10, GROUP_OFFSET + tokenCount * TOKEN_STAGGER + 30],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            ),
          }}
        >
          {caption}
        </div>
      )}
    </BrandedSlideLayout>
  );
};
