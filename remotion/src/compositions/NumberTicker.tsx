import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

/**
 * Detects if a cell text contains a rolling-animatable number.
 * Returns [prefix, number, suffix] if yes, null otherwise.
 *
 * Examples:
 *   "+$2,203万"  → ["+$", 2203, "万"]
 *   "0.10%"      → ["", 0.10, "%"]
 *   "<$10"       → ["<$", 10, ""]
 *   "78.6%"      → ["", 78.6, "%"]
 *   "符号反转"    → null (no number)
 *
 * Use in tables/cells to progressively animate from 0 → final value,
 * giving a "counter rolling" effect that feels alive versus static text.
 */
export function parseAnimatable(
  text: string,
): [string, number, string] | null {
  const m = text.match(/^([+\-]?[<>]?\$?)([\d,]+(?:\.\d+)?)(.*)$/);
  if (!m) return null;
  const numStr = m[2].replace(/,/g, "");
  const num = parseFloat(numStr);
  if (!Number.isFinite(num)) return null;
  return [m[1], num, m[3]];
}

export interface NumberTickerProps {
  prefix: string;
  value: number;
  suffix: string;
  /** Frame (relative to enclosing Sequence) when rolling starts */
  startFrame: number;
  /** How many frames to roll from 0 → value */
  durationFrames?: number;
  /** Keep thousands separator commas in integer part */
  withCommas?: boolean;
  color?: string;
  fontSize?: number;
  fontWeight?: number;
  style?: React.CSSProperties;
}

/**
 * Rolls a number from 0 → target with ease-out-cubic.
 *
 * Preserves original decimal places so "0.10%" ends at "0.10%", not "0%".
 * Uses tabular-nums so digit widths don't jitter during animation.
 */
export const NumberTicker: React.FC<NumberTickerProps> = ({
  prefix,
  value,
  suffix,
  startFrame,
  durationFrames = 35,
  withCommas = true,
  color = "#e5e7eb",
  fontSize = 26,
  fontWeight = 700,
  style,
}) => {
  const frame = useCurrentFrame();

  const progress = interpolate(
    frame,
    [startFrame, startFrame + durationFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Ease-out cubic
  const eased = 1 - Math.pow(1 - progress, 3);
  const current = value * eased;

  const decimalPlaces =
    value % 1 === 0 ? 0 : (value.toString().split(".")[1] || "").length;

  const formatted = withCommas
    ? current.toLocaleString("en-US", {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      })
    : current.toFixed(decimalPlaces);

  return (
    <span
      style={{
        color,
        fontSize,
        fontWeight,
        fontVariantNumeric: "tabular-nums",
        ...style,
      }}
    >
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};
