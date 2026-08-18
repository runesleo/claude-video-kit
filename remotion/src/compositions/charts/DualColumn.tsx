/**
 * DualColumn — paired bars per category, with the ratio as the punchline.
 *
 * Use when the claim is "A beats B across every category, no exceptions". Pairs
 * grow together so the reader compares within a row first, then the ratio column
 * lands and the repetition across rows does the arguing.
 *
 * script.json:
 *   {
 *     "type": "dualColumn",
 *     "title": "② 冷热：热门碾压冷门，四类无一例外",
 *     "chart": {
 *       "leftLabel": "冷门半", "rightLabel": "热门半", "unit": "bps",
 *       "groups": [
 *         {"label": "Crypto", "left": 24.1, "right": 544.1, "ratio": "0.04×"},
 *         {"label": "Sports", "left": 15.7, "right": 149.9, "ratio": "0.10×"}
 *       ]
 *     }
 *   }
 */
import React from "react";
import { interpolate } from "remotion";
import { ChartFrame, DS, useCountUp, useGrow } from "./chartBase";

export type DualGroup = {
  label: string;
  left: number;
  right: number;
  /** Pre-formatted ratio string — keeps rounding decisions in the data, not the view. */
  ratio: string;
};

const Row: React.FC<{
  group: DualGroup;
  max: number;
  delay: number;
  rowH: number;
}> = ({ group, max, delay, rowH }) => {
  const gL = useGrow(delay);
  const gR = useGrow(delay + 4);
  const gRatio = useGrow(delay + 14);
  const nL = useCountUp(group.left, delay);
  const nR = useCountUp(group.right, delay + 4);

  const barH = rowH * 0.34;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24, height: rowH }}>
      <div style={{ flex: "0 0 330px", fontSize: 28, textAlign: "right", fontWeight: 600 }}>
        {group.label}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        {/* 冷门半 —— the side being refuted */}
        <div style={{ position: "relative", height: barH }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${interpolate(gL, [0, 1], [0, (group.left / max) * 100])}%`,
              background: DS.invalid,
              borderRadius: 6,
              opacity: 0.9,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: `calc(${interpolate(gL, [0, 1], [0, (group.left / max) * 100])}% + 16px)`,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 24,
              fontFamily: DS.mono,
              color: DS.invalid,
              whiteSpace: "nowrap",
              opacity: gL,
            }}
          >
            {nL.toFixed(1)}
          </div>
        </div>
        {/* 热门半 */}
        <div style={{ position: "relative", height: barH }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${interpolate(gR, [0, 1], [0, (group.right / max) * 100])}%`,
              background: DS.accent,
              borderRadius: 6,
              opacity: 0.9,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: `calc(${interpolate(gR, [0, 1], [0, (group.right / max) * 100])}% + 16px)`,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 24,
              fontFamily: DS.mono,
              color: DS.accent,
              whiteSpace: "nowrap",
              opacity: gR,
            }}
          >
            {nR.toFixed(1)}
          </div>
        </div>
      </div>

      <div
        style={{
          flex: "0 0 150px",
          fontSize: 40,
          fontWeight: 900,
          fontFamily: DS.mono,
          color: DS.text,
          textAlign: "right",
          opacity: gRatio,
          transform: `scale(${interpolate(gRatio, [0, 1], [0.75, 1])})`,
        }}
      >
        {group.ratio}
      </div>
    </div>
  );
};

export const DualColumn: React.FC<{
  title: string;
  subtitle?: string;
  footnote?: string;
  slideNumber?: number;
  totalSlides?: number;
  groups: DualGroup[];
  leftLabel: string;
  rightLabel: string;
  unit?: string;
  ratioHeader?: string;
}> = ({
  title,
  subtitle,
  footnote,
  slideNumber,
  totalSlides,
  groups,
  leftLabel,
  rightLabel,
  unit = "",
  ratioHeader = "冷/热",
}) => {
  const max = Math.max(...groups.flatMap((g) => [g.left, g.right]), 1);
  // 每组两条，组数多时整体高度容易顶到底部字幕带 —— 上限按组数收敛，
  // 而不是固定值：四组时 rowH≈104，两组时仍能用满 120。
  const rowH = Math.min(120, 430 / Math.max(groups.length, 1));

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      footnote={footnote}
      slideNumber={slideNumber}
      totalSlides={totalSlides}
    >
      <div style={{ width: "100%", paddingRight: 40 }}>
        {/* legend doubles as the column header so the two bars never need re-explaining */}
        <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 18 }}>
          <div style={{ flex: "0 0 330px" }} />
          <div style={{ flex: 1, display: "flex", gap: 28, fontSize: 24, color: DS.muted }}>
            <span style={{ color: DS.invalid }}>■ {leftLabel}</span>
            <span style={{ color: DS.accent }}>■ {rightLabel}</span>
            {unit && <span>· {unit}</span>}
          </div>
          <div style={{ flex: "0 0 150px", fontSize: 22, color: DS.muted, textAlign: "right" }}>
            {ratioHeader}
          </div>
        </div>

        {groups.map((g, i) => (
          <Row key={g.label} group={g} max={max} delay={10 + i * 9} rowH={rowH} />
        ))}
      </div>
    </ChartFrame>
  );
};
