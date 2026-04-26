import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BrandedSlideLayout, BrandConfig } from "./BrandedSlideLayout";
import { NumberTicker, parseAnimatable } from "./NumberTicker";

/** A cell: plain text, or `{text, color}` for styled cells */
export type TableCell = string | { text: string; color?: string };

interface TableSlideProps {
  slideNumber: number;
  totalSlides: number;
  durationInFrames?: number;
  brand?: BrandConfig;

  title: string;
  headers: string[];
  rows: TableCell[][];
  footer?: string;
  /**
   * When true (default), cells that look like numbers
   * (e.g. "$2,203万", "0.10%") animate from 0 → value.
   * First column is skipped (treated as labels).
   */
  animateNumbers?: boolean;
}

/**
 * Data table slide with staggered row entrance and optional number rolling.
 *
 * Each row springs in from the left, delayed by 12 frames (0.4s) per row.
 * Numeric cells roll from 0 → final value with ease-out-cubic for a
 * "counter animation" feel that turns static data into dynamic info-graphic.
 */
export const TableSlide: React.FC<TableSlideProps> = ({
  slideNumber,
  totalSlides,
  durationInFrames,
  brand,
  title,
  headers,
  rows,
  footer,
  animateNumbers = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleX = interpolate(frame, [0, 25], [-20, 0], {
    extrapolateRight: "clamp",
  });

  const colCount = headers.length;

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
          transform: `translateX(${titleX}px)`,
        }}
      >
        {title}
      </div>

      <div
        style={{
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid #1f2937",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${colCount}, 1fr)`,
            backgroundColor: "#111827",
            padding: "20px 32px",
          }}
        >
          {headers.map((h) => (
            <div
              key={h}
              style={{
                fontSize: 24,
                fontWeight: 600,
                color: "#9ca3af",
                letterSpacing: 0.5,
              }}
            >
              {h}
            </div>
          ))}
        </div>

        {rows.map((row, i) => {
          const rowStart = 30 + i * 12;
          const rowSpring = spring({
            frame: frame - rowStart,
            fps,
            config: { damping: 18 },
          });

          return (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${colCount}, 1fr)`,
                padding: "20px 32px",
                backgroundColor: i % 2 === 0 ? "#0d1117" : "#111318",
                borderTop: "1px solid #1f2937",
                opacity: rowSpring,
                transform: `translateX(${interpolate(rowSpring, [0, 1], [-40, 0])}px)`,
              }}
            >
              {row.map((cell, j) => {
                const isObj = typeof cell === "object" && cell !== null;
                const text = isObj ? cell.text : cell;
                const color = isObj ? cell.color : "#e5e7eb";
                const weight = isObj ? 700 : j === 0 ? 500 : 400;

                const parsed =
                  animateNumbers && j > 0 ? parseAnimatable(text) : null;

                return (
                  <div
                    key={j}
                    style={{ display: "flex", alignItems: "center" }}
                  >
                    {parsed ? (
                      <NumberTicker
                        prefix={parsed[0]}
                        value={parsed[1]}
                        suffix={parsed[2]}
                        startFrame={rowStart + 8}
                        durationFrames={30}
                        color={color}
                        fontSize={26}
                        fontWeight={weight}
                      />
                    ) : (
                      <span
                        style={{
                          fontSize: 26,
                          color,
                          fontWeight: weight,
                        }}
                      >
                        {text}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {footer && (
        <div
          style={{
            marginTop: 40,
            fontSize: 28,
            color: "#9ca3af",
            opacity: interpolate(
              frame,
              [30 + rows.length * 12 + 20, 30 + rows.length * 12 + 40],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            ),
          }}
        >
          {footer}
        </div>
      )}
    </BrandedSlideLayout>
  );
};
