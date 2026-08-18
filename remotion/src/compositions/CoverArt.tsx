/**
 * CoverArt — 数据封面：左边说结论，右边给证据。
 *
 * 为什么不用纯文字大标题（2026-08-18）：
 * kit 原本只有 `gen_video_cover.py`，它只会把标题放大铺满。而实际效果最好的那张封面
 * （另一条片子自研的 290 行 PIL 脚本）是左文字右数据图表 —— 封面本身就在证明标题。
 * 那个脚本把数据源硬编码成了具体的 csv/parquet 路径，无法复用，于是后来的片子只能退回
 * 纯文字模板：**好的做法留在了某一条片子里，管线里没有。**
 *
 * 这里改成用片内已有的图表组件渲封面：色板自动一致（同一份 design-system.json），
 * 数据直接取自 script.json 的图表镜，不再有第二套硬编码。
 *
 * 用法（remotion still）：
 *   remotion still src/index.ts CoverArt out/cover-16x9.png --props='{...}'
 */
import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import ds from "../../../config/design-system.json";
import { BarCompare, BarItem } from "./charts/BarCompare";
import { ThresholdGrid, ThresholdCell } from "./charts/ThresholdGrid";

const DS = {
  canvas: ds.canvas.base,
  text: ds.text.primary,
  muted: ds.text.muted,
  accent: ds.semantic.accent,
  sans: ds.typography.sans.join(", "),
  mono: ds.typography.mono.join(", "),
};

export type CoverArtProps = {
  eyebrow?: string;
  /** 主标题。用 \n 手动断行 —— 封面标题的断行位置是语义的，不交给自动折行。 */
  title: string;
  /** 强调片段：title 里出现的这段文字用强调色。 */
  highlight?: string;
  subtitle?: string;
  footnote?: string;
  watermark?: string;
  /** 右侧证据图。省略则退化为纯文字封面（版式仍与片内一致）。 */
  chart?:
    | { type: "barCompare"; items: BarItem[]; unit?: string; decimals?: number }
    | { type: "thresholdGrid"; cells: ThresholdCell[]; verdict?: string };
};

export const CoverArt: React.FC<CoverArtProps> = ({
  eyebrow,
  title,
  highlight,
  subtitle,
  footnote,
  watermark = ds.cover.watermark,
  chart,
}) => {
  const lines = title.split("\n");
  const { width, height } = useVideoConfig();
  // 竖版（9:16）左右分栏会把两边都挤扁 —— 改成上下：结论在上，证据在下。
  // 判据用宽高比而不是具体尺寸，这样 4:3、1:1 之类也能落到正确的那一支。
  const ratio = width / height;
  const portrait = ratio < 0.9;          // 9:16 才走上下分栏
  const narrow = ratio >= 0.9 && ratio < 1.5;  // 4:3 仍是左右，但可用横向空间少得多
  const pad = portrait ? "150px 90px" : narrow ? "80px 76px" : "96px 110px";
  // 竖版整幅只放一栏，字号可以大；4:3 左右都要挤，标题必须收下来否则被折成四行。
  const titleSize = portrait ? 104 : narrow ? 62 : 80;
  const subSize = portrait ? 40 : narrow ? 27 : 32;
  const footSize = portrait ? 27 : narrow ? 20 : 23;
  const eyebrowSize = portrait ? 34 : narrow ? 23 : 28;
  return (
    <AbsoluteFill style={{ background: DS.canvas, fontFamily: DS.sans, color: DS.text }}>
      {/* 顶部品牌渐变条 —— 与片内一致 */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 6,
          background: `linear-gradient(90deg, ${ds.semantic.verified}, ${ds.semantic.accent})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(1200px 700px at 22% 42%, ${ds.semantic.accent}14, transparent 70%)`,
        }}
      />

      <div style={{ display: "flex", flexDirection: portrait ? "column" : "row", height: "100%", padding: pad, gap: portrait ? 72 : 56 }}>
        {/* 左：结论 */}
        <div
          style={{
            flex: chart ? (portrait ? "0 0 42%" : narrow ? "0 0 47%" : "0 0 44%") : "1",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          {eyebrow && (
            <div
              style={{
                fontSize: eyebrowSize,
                color: DS.accent,
                fontFamily: DS.mono,
                letterSpacing: "0.14em",
                marginBottom: 26,
              }}
            >
              {eyebrow}
            </div>
          )}
          <div style={{ fontSize: titleSize, fontWeight: 900, lineHeight: 1.2, letterSpacing: "-0.035em" }}>
            {lines.map((ln, i) => (
              <div key={i}>
                {highlight && ln.includes(highlight) ? (
                  <>
                    {ln.split(highlight)[0]}
                    <span style={{ color: DS.accent }}>{highlight}</span>
                    {ln.split(highlight)[1]}
                  </>
                ) : (
                  ln
                )}
              </div>
            ))}
          </div>
          {subtitle && (
            <div style={{ fontSize: subSize, color: DS.muted, marginTop: 26, lineHeight: 1.45 }}>
              {subtitle}
            </div>
          )}
          {footnote && (
            <div style={{ fontSize: footSize, color: DS.muted, fontFamily: DS.mono, marginTop: 28 }}>
              {footnote}
            </div>
          )}
        </div>

        {/* 右：证据。封面自己就在证明标题，而不是只喊一句口号。 */}
        {chart && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", minWidth: 0 }}>
            {chart.type === "barCompare" && (
              <BarCompare
                bare
                title=""
                items={chart.items}
                unit={chart.unit}
                decimals={chart.decimals}
              />
            )}
            {chart.type === "thresholdGrid" && (
              <ThresholdGrid bare title="" cells={chart.cells} verdict={chart.verdict} />
            )}
          </div>
        )}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 46,
          right: portrait ? 84 : 110,
          fontSize: 24,
          color: DS.muted,
          fontFamily: DS.mono,
        }}
      >
        {watermark}
      </div>
    </AbsoluteFill>
  );
};
