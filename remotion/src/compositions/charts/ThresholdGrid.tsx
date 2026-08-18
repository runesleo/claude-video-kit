/**
 * ThresholdGrid — one cell per category against a pass/fail threshold.
 *
 * Use when the finding is an absence: not "this one is low" but "every single
 * one is zero". Cells land one after another so the repetition is felt, then a
 * verdict line states what the uniformity means. A bar chart would waste its
 * strength here — there is nothing to compare, which is the whole point.
 *
 * script.json:
 *   {
 *     "type": "thresholdGrid",
 *     "title": "冷门半 · 能过官方 $1 日结门槛的比例",
 *     "chart": {
 *       "cells": [
 *         {"label": "Crypto", "value": "0%"},
 *         {"label": "Economics/Culture/Weather", "value": "0%"},
 *         {"label": "Finance/Politics/Tech", "value": "0%"},
 *         {"label": "Sports", "value": "0%"}
 *       ],
 *       "verdict": "四个品类，无一例外 —— 一分钱拿不到"
 *     }
 *   }
 */
import React from "react";
import { interpolate } from "remotion";
import { ChartFrame, DS, useGrow } from "./chartBase";

export type ThresholdCell = {
  label: string;
  value: string;
  /** default fail = the value is below the bar; pass flips it to the verified colour */
  state?: "fail" | "pass";
};

const Cell: React.FC<{ cell: ThresholdCell; delay: number }> = ({ cell, delay }) => {
  const g = useGrow(delay);
  const fail = cell.state !== "pass";
  const c = fail ? DS.invalid : DS.verified;
  return (
    <div
      style={{
        flex: 1,
        background: DS.panel,
        border: `2px solid ${c}33`,
        borderRadius: 18,
        padding: "34px 28px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        opacity: g,
        transform: `translateY(${interpolate(g, [0, 1], [24, 0])}px)`,
      }}
    >
      <div
        style={{
          fontSize: 78,
          fontWeight: 900,
          fontFamily: DS.mono,
          color: c,
          letterSpacing: "-0.04em",
          lineHeight: 1,
        }}
      >
        {cell.value}
      </div>
      <div style={{ fontSize: 22, color: DS.muted, textAlign: "center", lineHeight: 1.35 }}>
        {cell.label}
      </div>
    </div>
  );
};

export const ThresholdGrid: React.FC<{
  title: string;
  subtitle?: string;
  footnote?: string;
  slideNumber?: number;
  totalSlides?: number;
  /** 裸模式：封面等场景只要图表主体 */
  bare?: boolean;
  cells: ThresholdCell[];
  verdict?: string;
}> = ({ title, subtitle, footnote, slideNumber, totalSlides, cells, verdict, bare }) => {
  const gVerdict = useGrow(12 + cells.length * 8);
  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      footnote={footnote}
      slideNumber={slideNumber}
      totalSlides={totalSlides}
      bare={bare}
    >
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 40 }}>
        <div style={{ display: "flex", gap: 24 }}>
          {cells.map((c, i) => (
            <Cell key={c.label} cell={c} delay={10 + i * 8} />
          ))}
        </div>
        {verdict && (
          <div
            style={{
              fontSize: 40,
              fontWeight: 800,
              textAlign: "center",
              color: DS.text,
              opacity: gVerdict,
              transform: `translateY(${interpolate(gVerdict, [0, 1], [14, 0])}px)`,
            }}
          >
            {verdict}
          </div>
        )}
      </div>
    </ChartFrame>
  );
};
