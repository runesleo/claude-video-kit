/**
 * RangeSpan — compare how far two quantities travel between percentiles.
 *
 * Use when the argument is "factor A varies far more than factor B, so A wins
 * regardless of B". Log-scaled tracks make a 462× and a 71× span visually
 * comparable; the multiplier is the punchline and lands last.
 *
 * script.json:
 *   {
 *     "type": "rangeSpan",
 *     "title": "池子的跨度，远大于份额的跨度",
 *     "chart": {
 *       "rows": [
 *         {"label": "日成交额 vol24", "lo": 6.5, "hi": 3001, "loLabel": "$6.5", "hiLabel": "$3,001",
 *          "span": "462×", "tone": "accent", "note": "决定 pool，正相关"},
 *         {"label": "队列份额 q", "lo": 0.0042, "hi": 0.30, "loLabel": "0.00", "hiLabel": "0.30",
 *          "span": "71×", "note": "冷门的优势项，反相关"}
 *       ],
 *       "axisNote": "p10 → p90（对数刻度）"
 *     }
 *   }
 */
import React from "react";
import { interpolate } from "remotion";
import { ChartFrame, DS, useGrow } from "./chartBase";

export type SpanRow = {
  label: string;
  lo: number;
  hi: number;
  loLabel?: string;
  hiLabel?: string;
  span: string;
  tone?: "accent" | "invalid" | "verified" | "neutral";
  note?: string;
};

const toneColor = (tone?: SpanRow["tone"]) =>
  tone === "accent" ? DS.accent
    : tone === "invalid" ? DS.invalid
    : tone === "verified" ? DS.verified
    : "#4a5568";

const SpanTrack: React.FC<{ row: SpanRow; globalLo: number; globalHi: number; delay: number }> = ({
  row,
  globalLo,
  globalHi,
  delay,
}) => {
  const g = useGrow(delay);
  const gSpan = useGrow(delay + 16);
  const c = toneColor(row.tone);

  // log scale so a 462× and a 71× span are both legible on one axis
  const lg = (v: number) => Math.log10(Math.max(v, 1e-6));
  const pos = (v: number) => ((lg(v) - lg(globalLo)) / (lg(globalHi) - lg(globalLo))) * 100;
  const left = pos(row.lo);
  const right = pos(row.hi);
  const width = interpolate(g, [0, 1], [0, right - left]);

  return (
    <div style={{ marginBottom: 54 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <div style={{ fontSize: 32, fontWeight: 700 }}>{row.label}</div>
        {row.note && <div style={{ fontSize: 24, color: DS.muted }}>{row.note}</div>}
      </div>
      <div style={{ position: "relative", height: 60 }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 26,
            height: 4,
            background: DS.panel,
            borderRadius: 2,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `${left}%`,
            top: 22,
            width: `${width}%`,
            height: 12,
            background: c,
            borderRadius: 6,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `${left}%`,
            top: 14,
            transform: "translateX(-50%)",
            width: 4,
            height: 28,
            background: c,
            opacity: g,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `${left + width}%`,
            top: 14,
            transform: "translateX(-50%)",
            width: 4,
            height: 28,
            background: c,
            opacity: g,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `${left}%`,
            top: 0,
            transform: "translateX(-50%)",
            fontSize: 22,
            fontFamily: DS.mono,
            color: DS.muted,
            opacity: g,
          }}
        >
          {row.loLabel ?? row.lo}
        </div>
        <div
          style={{
            position: "absolute",
            left: `${left + width}%`,
            top: 0,
            transform: "translateX(-50%)",
            fontSize: 22,
            fontFamily: DS.mono,
            color: DS.muted,
            opacity: g,
          }}
        >
          {row.hiLabel ?? row.hi}
        </div>
        <div
          style={{
            position: "absolute",
            left: `calc(${left + width}% + 34px)`,
            top: -6,
            fontSize: 44,
            fontWeight: 900,
            fontFamily: DS.mono,
            color: c,
            opacity: gSpan,
            transform: `scale(${interpolate(gSpan, [0, 1], [0.7, 1])})`,
            whiteSpace: "nowrap",
          }}
        >
          {row.span}
        </div>
      </div>
    </div>
  );
};

export const RangeSpan: React.FC<{
  title: string;
  subtitle?: string;
  footnote?: string;
  slideNumber?: number;
  totalSlides?: number;
  rows: SpanRow[];
  axisNote?: string;
}> = ({ title, subtitle, footnote, slideNumber, totalSlides, rows, axisNote }) => {
  const globalLo = Math.min(...rows.map((r) => r.lo));
  const globalHi = Math.max(...rows.map((r) => r.hi));
  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      footnote={footnote}
      slideNumber={slideNumber}
      totalSlides={totalSlides}
    >
      {/* 倍数标签画在轨道右端之外，需为最长的一条预留，否则会压住轨道或出画 */}
      <div style={{ width: "100%", paddingRight: 240 }}>
        {rows.map((r, i) => (
          <SpanTrack key={r.label} row={r} globalLo={globalLo} globalHi={globalHi} delay={10 + i * 20} />
        ))}
        {axisNote && (
          <div style={{ fontSize: 22, color: DS.muted, fontFamily: DS.mono, marginTop: -20 }}>
            {axisNote}
          </div>
        )}
      </div>
    </ChartFrame>
  );
};
