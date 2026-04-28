import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { NumberTicker, parseAnimatable } from "./NumberTicker";

/**
 * NumberHero — a single big number occupies most of the screen, with a short
 * label underneath. Built for shorts-style "data hook" moments where the
 * viewer needs to grok the number in <1s.
 *
 * Renders:
 *   - background gradient + subtle radial glow behind the number
 *   - number with count-up animation (reuses NumberTicker)
 *   - label below in dimmer accent
 *   - optional badge above (e.g. "真相一" / "Fact 1")
 *
 * Auto-detects whether `value` is a pre-formatted string ("67%") or a raw
 * number — strings get parsed via parseAnimatable so both shapes work.
 */
export interface NumberHeroProps {
  /** Either "67%" or 67 — both supported. */
  value: string | number;
  /** Optional unit appended after the number (overrides parsed suffix). */
  suffix?: string;
  /** Optional prefix (overrides parsed prefix), e.g. "$" / "+" */
  prefix?: string;
  /** Subtitle / label below the number. */
  label: string;
  /** Optional small badge above (renders as accent pill). */
  badge?: string;
  /** Accent color for badge + glow. Defaults to brand-friendly amber. */
  accentColor?: string;
  /** Base font size for the number. Multiplied by fontScale at runtime. */
  baseFontSize?: number;
  /** Multiplier applied to all font sizes (driven by preset fontScale). */
  fontScale?: number;
  /** Frames after slide start when count-up begins. */
  countUpStartFrame?: number;
  /** Frames spent rolling 0 → value. */
  countUpDurationFrames?: number;
}

export const NumberHero: React.FC<NumberHeroProps> = ({
  value,
  suffix,
  prefix,
  label,
  badge,
  accentColor = "#f59e0b",
  baseFontSize = 240,
  fontScale = 1,
  countUpStartFrame = 8,
  countUpDurationFrames = 30,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Parse value — accept "67%" or 67. If string with non-numeric suffix the
  // parser handles units; if explicit prefix/suffix provided, those override.
  let parsedPrefix = "";
  let parsedNumber: number;
  let parsedSuffix = "";
  if (typeof value === "number") {
    parsedNumber = value;
  } else {
    const parsed = parseAnimatable(value);
    if (parsed) {
      [parsedPrefix, parsedNumber, parsedSuffix] = parsed;
    } else {
      // Value isn't animatable (e.g. "N/A") — fall back to static render.
      parsedNumber = NaN;
    }
  }
  const finalPrefix = prefix ?? parsedPrefix;
  const finalSuffix = suffix ?? parsedSuffix;

  // Spring entrance: number scales from 0.85 → 1.0, label fades in shortly after.
  const numberSpring = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 120, mass: 0.6 },
  });
  const labelOpacity = interpolate(frame, [10, 24], [0, 1], {
    extrapolateRight: "clamp",
  });
  const badgeOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });

  const numberFont = baseFontSize * fontScale;
  const labelFont = 56 * fontScale;
  const badgeFont = 32 * fontScale;

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #0b0b0f 0%, #1a1a25 100%)",
        alignItems: "center",
        justifyContent: "center",
        padding: 80,
        fontFamily: "-apple-system, Inter, sans-serif",
      }}
    >
      {/* Radial glow behind number for visual weight */}
      <div
        style={{
          position: "absolute",
          width: numberFont * 3,
          height: numberFont * 3,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accentColor}33 0%, transparent 60%)`,
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          textAlign: "center",
          color: "#fff",
        }}
      >
        {badge && (
          <div
            style={{
              opacity: badgeOpacity,
              fontSize: badgeFont,
              fontWeight: 600,
              color: accentColor,
              padding: "10px 28px",
              border: `2px solid ${accentColor}`,
              borderRadius: 999,
              display: "inline-block",
              marginBottom: 40,
              letterSpacing: "0.05em",
            }}
          >
            {badge}
          </div>
        )}

        <div
          style={{
            transform: `scale(${0.85 + numberSpring * 0.15})`,
            opacity: numberSpring,
            transformOrigin: "center",
          }}
        >
          {Number.isFinite(parsedNumber) ? (
            <NumberTicker
              prefix={finalPrefix}
              value={parsedNumber}
              suffix={finalSuffix}
              startFrame={countUpStartFrame}
              durationFrames={countUpDurationFrames}
              fontSize={numberFont}
              fontWeight={800}
              color="#fff"
              style={{
                letterSpacing: "-0.04em",
                lineHeight: 1.0,
                textShadow: `0 0 60px ${accentColor}66`,
              }}
            />
          ) : (
            <span
              style={{
                fontSize: numberFont,
                fontWeight: 800,
                letterSpacing: "-0.04em",
                lineHeight: 1.0,
                color: "#fff",
                textShadow: `0 0 60px ${accentColor}66`,
              }}
            >
              {String(value)}
            </span>
          )}
        </div>

        <div
          style={{
            opacity: labelOpacity,
            marginTop: 60,
            fontSize: labelFont,
            fontWeight: 500,
            color: "#9ca3af",
            lineHeight: 1.3,
            maxWidth: 900,
            margin: "60px auto 0",
          }}
        >
          {label}
        </div>
      </div>
    </AbsoluteFill>
  );
};
