/**
 * BarCompare — horizontal bar ranking with staggered growth and count-up labels.
 *
 * Use when the point is "these categories are not equal, and the order may be
 * the opposite of what you expected". Bars grow in sequence so the eye lands on
 * the ranking before the numbers finish counting.
 *
 * script.json:
 *   {
 *     "type": "barCompare",
 *     "title": "① 品类：体育垫底，不是最好",
 *     "subtitle": "rebateEv bps 中位 · n=1,004",
 *     "chart": {
 *       "unit": "bps",
 *       "items": [
 *         {"label": "Economics/Culture/Weather", "value": 175.2, "tone": "accent"},
 *         {"label": "Crypto",  "value": 120.9},
 *         {"label": "Finance/Politics/Tech", "value": 54.9},
 *         {"label": "Sports",  "value": 51.2, "tone": "invalid", "note": "群内说法里的赢家"}
 *       ]
 *     },
 *     "footnote": "2026-08-03 单次快照"
 *   }
 */
import React from "react";
import { interpolate } from "remotion";
import { ChartFrame, DS, useCountUp, useGrow } from "./chartBase";

export type BarItem = {
  label: string;
  value: number;
  /** accent = the one to look at; invalid = the claim being refuted; default = neutral */
  tone?: "accent" | "invalid" | "verified" | "neutral";
  note?: string;
};

const toneColor = (tone?: BarItem["tone"]) =>
  tone === "accent" ? DS.accent
    : tone === "invalid" ? DS.invalid
    : tone === "verified" ? DS.verified
    : "#3a4454";

/** One row. Kept as its own component so the hooks below are never called in a loop. */
const BarRow: React.FC<{
  item: BarItem;
  max: number;
  rowH: number;
  delay: number;
  compact: boolean;
  unit: string;
  decimals: number;
}> = ({ item, max, rowH, delay, unit, decimals, compact }) => {
  const g = useGrow(delay);
  const n = useCountUp(item.value, delay);
  const w = interpolate(g, [0, 1], [0, (item.value / max) * 100]);
  const c = toneColor(item.tone);
  const emphasised = Boolean(item.tone && item.tone !== "neutral");

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 26, height: rowH }}>
      <div
        style={{
          flex: compact ? "0 0 210px" : "0 0 430px",
          fontSize: compact ? 22 : 29,
          textAlign: "right",
          color: emphasised ? DS.text : DS.muted,
          fontWeight: emphasised ? 700 : 400,
        }}
      >
        {item.label}
      </div>
      {/* 右侧留白：数值+注释画在条形末端外侧，条形区必须留出空间，否则最长的一条会被画布右缘裁掉 */}
      <div style={{ flex: 1, position: "relative", height: rowH * 0.58, marginRight: compact ? 150 : 300 }}>
        <div style={{ position: "absolute", inset: 0, background: DS.panel, borderRadius: 10 }} />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${w}%`,
            background: c,
            borderRadius: 10,
            opacity: 0.92,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `calc(${w}% + 22px)`,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: compact ? 27 : 34,
            fontWeight: 800,
            fontFamily: DS.mono,
            color: emphasised ? c : DS.muted,
            whiteSpace: "nowrap",
            opacity: g,
          }}
        >
          {n.toFixed(decimals)}
          {unit && <span style={{ fontSize: 22, marginLeft: 6 }}>{unit}</span>}
          {item.note && (
            <span style={{ fontSize: 22, color: DS.muted, marginLeft: 16, fontFamily: DS.sans }}>
              {item.note}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export const BarCompare: React.FC<{
  title: string;
  subtitle?: string;
  footnote?: string;
  slideNumber?: number;
  totalSlides?: number;
  /** 裸模式：封面等场景只要图表主体 */
  bare?: boolean;
  items: BarItem[];
  unit?: string;
  decimals?: number;
}> = ({ title, subtitle, footnote, slideNumber, totalSlides, items, unit = "", decimals = 1, bare }) => {
  const max = Math.max(...items.map((i) => i.value), 1);
  const rowH = Math.min(112, 560 / Math.max(items.length, 1));

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      footnote={footnote}
      slideNumber={slideNumber}
      totalSlides={totalSlides}
      bare={bare}
    >
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 18 }}>
        {items.map((it, i) => (
          <BarRow
            key={it.label}
            item={it}
            max={max}
            rowH={rowH}
            delay={8 + i * 7}
            compact={Boolean(bare)}
            unit={unit}
            decimals={decimals}
          />
        ))}
      </div>
    </ChartFrame>
  );
};
