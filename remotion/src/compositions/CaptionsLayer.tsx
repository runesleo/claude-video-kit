import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export interface Caption {
  from: number;
  to: number;
  text: string;
}

export type CaptionPosition = "top" | "center" | "bottom";

interface CaptionsLayerProps {
  captions?: Caption[];
  /** Multiplier for caption font size (driven by preset). */
  fontScale?: number;
  /** Vertical placement on canvas. Default "bottom" (lower-third). */
  position?: CaptionPosition;
  /** Words to highlight with accent color + bold. Case-sensitive substring match. */
  highlight?: string[];
  /** Accent color for highlighted words. Default amber. */
  accentColor?: string;
  /** Max characters per line (CJK considered 1 char each). Default 10. */
  maxCharsPerLine?: number;
}

/**
 * Wrap text into lines respecting maxCharsPerLine. CJK characters count as 1
 * each (matches typical short-video subtitle conventions where 8-12 CJK
 * chars/line is the readable sweet spot).
 *
 * Latin words are kept atomic (not broken mid-word).
 */
function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let current = "";
  // Tokenize: CJK runs as individual chars, Latin words as atomic.
  const tokens = text.match(/[一-龥　-〿＀-￯]|[A-Za-z0-9]+|[^\s]/g) ?? [];

  for (const tok of tokens) {
    if (current.length + tok.length > maxChars && current.length > 0) {
      lines.push(current);
      current = tok;
    } else {
      current += tok;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

/**
 * Render a string with substring matches in `highlight` styled with accent
 * color + bold. Returns React fragments suitable for direct rendering.
 */
function renderWithHighlight(
  text: string,
  highlight: string[] | undefined,
  accentColor: string,
): React.ReactNode {
  if (!highlight || highlight.length === 0) return text;

  // Build regex from highlight terms (escape special chars).
  const escaped = highlight.map((h) =>
    h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  const re = new RegExp(`(${escaped.join("|")})`, "g");
  const parts = text.split(re);

  return parts.map((part, i) =>
    highlight.includes(part) ? (
      <span
        key={i}
        style={{
          color: accentColor,
          fontWeight: 900,
        }}
      >
        {part}
      </span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );
}

/**
 * Captions layer for short-video pipeline. Renders the active caption
 * (one whose [from, to) range contains current frame) with:
 *   - large font (56 base × fontScale, ~90px @ shorts)
 *   - heavy black outline (4px) for readability over any background
 *   - keyword highlight (accent color + bold)
 *   - CJK-aware line wrapping (≤10 chars/line by default)
 *   - per-caption spring entrance (no static fade)
 */
export const CaptionsLayer: React.FC<CaptionsLayerProps> = ({
  captions,
  fontScale = 1,
  position = "bottom",
  highlight,
  accentColor = "#f59e0b",
  maxCharsPerLine = 10,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!captions || captions.length === 0) return null;

  const active = captions.find((c) => frame >= c.from && frame < c.to);
  if (!active) return null;

  const lines = wrapText(active.text, maxCharsPerLine);
  const captionFont = 56 * fontScale;

  // Spring entrance per-caption: starts at this caption's `from` frame.
  const captionSpring = spring({
    frame: frame - active.from,
    fps,
    config: { damping: 16, stiffness: 140, mass: 0.5 },
  });

  // Vertical position mapping.
  const positionStyle: React.CSSProperties =
    position === "top"
      ? { top: 120 }
      : position === "center"
        ? { top: "50%", transform: "translateY(-50%)" }
        : { bottom: 220 };

  // Heavy black outline via layered text-shadow for crisp readability.
  const outlineShadow = [
    "-4px -4px 0 #000",
    "4px -4px 0 #000",
    "-4px 4px 0 #000",
    "4px 4px 0 #000",
    "-4px 0 0 #000",
    "4px 0 0 #000",
    "0 -4px 0 #000",
    "0 4px 0 #000",
    "0 0 24px rgba(0,0,0,0.8)",
  ].join(", ");

  return (
    <div
      style={{
        position: "absolute",
        left: 60,
        right: 60,
        textAlign: "center",
        opacity: captionSpring,
        transform: `${positionStyle.transform ?? ""} translateY(${interpolate(captionSpring, [0, 1], [16, 0])}px)`,
        ...positionStyle,
        zIndex: 10,
        pointerEvents: "none",
      }}
    >
      {lines.map((line, i) => (
        <div
          key={i}
          style={{
            fontSize: captionFont,
            fontWeight: 800,
            color: "#fff",
            lineHeight: 1.25,
            textShadow: outlineShadow,
            fontFamily:
              "-apple-system, 'PingFang SC', 'Hiragino Sans', 'Microsoft YaHei', Inter, sans-serif",
            letterSpacing: "0.02em",
          }}
        >
          {renderWithHighlight(line, highlight, accentColor)}
        </div>
      ))}
    </div>
  );
};
