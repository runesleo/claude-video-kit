/**
 * asset-version: v0.3.0-rc.1 / 2026-07-22 / preserve Latin spacing across caption wraps
 * owner_surface: claude-video-kit / T0580 / shorts captions
 * behavior_change: whitespace is retained while visible-character limits remain unchanged
 * rollback: restore the whitespace-dropping token loop from the previous revision
 */
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
  const tokens = text.match(/\s+|[一-龥　-〿＀-￯]|[A-Za-z0-9]+|[^\s]/g) ?? [];
  const totalLen = tokens.reduce(
    (sum, token) => sum + (/^\s+$/.test(token) ? 0 : token.length),
    0,
  );

  // Short caption → single line, no forced split
  if (totalLen <= maxChars + 2) return [text];

  // Cap at 3 lines hard. targetPerLine = totalLen/3 guarantees fit
  // even when individual tokens (e.g. "DeepSeek") exceed maxChars.
  const targetLines = Math.min(3, Math.ceil(totalLen / maxChars));
  const targetPerLine = Math.ceil(totalLen / targetLines) + 2;

  const lines: string[] = [];
  let current = "";
  let currentLen = 0;
  for (const tok of tokens) {
    if (/^\s+$/.test(tok)) {
      if (current.length > 0) current += tok;
      continue;
    }
    if (/^[^\p{L}\p{N}]+$/u.test(tok) && current.trim().length > 0) {
      current = `${current.trimEnd()}${tok}`;
      currentLen += tok.length;
      continue;
    }
    if (currentLen + tok.length > targetPerLine && current.trim().length > 0) {
      lines.push(current.trimEnd());
      current = tok;
      currentLen = tok.length;
    } else {
      current += tok;
      currentLen += tok.length;
    }
  }
  if (current.trim().length > 0) lines.push(current.trim());
  // Hard cap: merge any 4th+ line back into line 3
  while (lines.length > 3) {
    const tail = lines.pop()!;
    const head = lines[lines.length - 1];
    const spacer = /[A-Za-z0-9]$/.test(head) && /^[A-Za-z0-9]/.test(tail) ? " " : "";
    lines[lines.length - 1] = `${head}${spacer}${tail}`;
  }
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
  maxCharsPerLine,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  if (!captions || captions.length === 0) return null;

  const active = captions.find((c) => frame >= c.from && frame < c.to);
  if (!active) return null;

  // 2026-08-01：默认值原本写死 10 —— 那是竖版 1080 宽的数。横版 1920 沿用同一个值，
  // 每句都被切成三行小短条（「同时还得在传统券商那 / 边备一笔现金和股票库 / 存去对冲」），
  // 既断在词中间，又因为行数多而压住画面里的结论条和截图。
  // 每字约占 88px 宽（含字距），按画布宽度算才对。
  const autoMax = Math.max(10, Math.round(width / 88));
  const lines = wrapText(active.text, maxCharsPerLine ?? autoMax);
  const captionFont = 38 * fontScale;

  // Spring entrance per-caption: starts at this caption's `from` frame.
  // Bouncy pop-in: scale 0.5 → 1 with overshoot for "蹦" feel.
  const captionSpring = spring({
    frame: frame - active.from,
    fps,
    config: { damping: 8, stiffness: 180, mass: 0.4 },
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
        opacity: Math.min(1, captionSpring * 1.5),
        transform: `${positionStyle.transform ?? ""} scale(${interpolate(captionSpring, [0, 1], [0.55, 1])}) translateY(${interpolate(captionSpring, [0, 1], [50, 0])}px)`,
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
            fontFamily: "STHeiti, 'PingFang SC', -apple-system, sans-serif",
            letterSpacing: "0.02em",
          }}
        >
          {renderWithHighlight(line, highlight, accentColor)}
        </div>
      ))}
    </div>
  );
};
