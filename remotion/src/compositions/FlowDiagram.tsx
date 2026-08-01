import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BrandedSlideLayout, BrandConfig } from "./BrandedSlideLayout";

/**
 * FlowDiagram — 资金 / 流程流动示意图，逐步演出
 *
 * 为什么存在（Leo 2026-08-01）：
 *   「画面必须得有用……不能是底下有字幕，上面再显示一遍一样的大文字」
 *   讲机制的分镜没有现成截图，必须用画面把机制演出来。
 *   典型场景：一笔钱分成两份被锁进两个盒子（双重抵押）→ 两盒合一（解法）。
 *
 * 设计：
 *   nodes  = 盒子（可标 locked 显示锁定态）
 *   edges  = 从 source 流向 target 的资金线，带流动小球
 *   steps  = 每一步在第几秒出现，按口播节奏逐个点亮
 */

export interface FlowNode {
  id: string;
  label: string;
  /** 归一化位置 0–1（画布内） */
  x: number;
  y: number;
  w?: number;
  sub?: string;
  color?: "orange" | "green" | "blue" | "gray";
  /** 出现时机（秒） */
  at?: number;
  /** 显示「已锁定」徽记 */
  locked?: boolean;
  /** 徽记出现时机（秒），默认 at+0.8 */
  lockAt?: number;
}

export interface FlowEdge {
  from: string;
  to: string;
  label?: string;
  at?: number;
  color?: "orange" | "green" | "blue" | "gray";
  /** 是否在线上跑流动小球 */
  animate?: boolean;
}

export interface FlowDiagramProps {
  slideNumber: number;
  totalSlides: number;
  durationInFrames?: number;
  brand?: BrandConfig;
  title?: string;
  nodes: FlowNode[];
  edges?: FlowEdge[];
  /** 底部结论，最后出现 */
  verdict?: string;
  verdictAt?: number;
  verdictColor?: "orange" | "green" | "blue" | "red";
}

const C = {
  orange: "#e8822a",
  green: "#4ade80",
  blue: "#60a5fa",
  gray: "#6b7280",
  red: "#f87171",
} as const;

export const FlowDiagram: React.FC<FlowDiagramProps> = ({
  slideNumber,
  totalSlides,
  durationInFrames = 240,
  brand,
  title,
  nodes,
  edges = [],
  verdict,
  verdictAt,
  verdictColor = "orange",
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // 画布区（标题下方、结论上方）
  // CAPTION_SAFE 同 ScreenshotSlide：字幕层固定 bottom:220px，两行会顶到 y≈0.70。
  // verdict 条也必须让在字幕之上，否则结论和字幕叠字。
  const CAPTION_SAFE = 290;
  const top = title ? height * 0.18 : height * 0.09;
  const bottom = CAPTION_SAFE + (verdict ? 150 : 0);
  const areaH = height - top - bottom;
  const areaW = width * 0.86;
  const areaX = width * 0.07;

  const px = (nx: number) => areaX + nx * areaW;
  const py = (ny: number) => top + ny * areaH;

  const nodeById = Object.fromEntries(nodes.map((n) => [n.id, n]));

  return (
    <BrandedSlideLayout
      slideNumber={slideNumber}
      totalSlides={totalSlides}
      durationInFrames={durationInFrames}
      brand={brand}
    >
      {title ? (
        <div
          style={{
            position: "absolute",
            left: "6%",
            top: "7%",
            fontSize: 54,
            fontWeight: 700,
            color: "#f9fafb",
            letterSpacing: "-0.01em",
            opacity: interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" }),
            transform: `translateY(${interpolate(frame, [0, 14], [16, 0], {
              extrapolateRight: "clamp",
            })}px)`,
          }}
        >
          {title}
        </div>
      ) : null}

      <AbsoluteFill>
        {/* 连线层 */}
        <svg
          width={width}
          height={height}
          style={{ position: "absolute", left: 0, top: 0 }}
        >
          {edges.map((e, i) => {
            const a = nodeById[e.from];
            const b = nodeById[e.to];
            if (!a || !b) return null;
            const at = (e.at ?? 1.2 + i * 0.5) * fps;
            const p = interpolate(frame - at, [0, 22], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            if (frame < at) return null;
            const col = C[e.color ?? "orange"];
            const x1 = px(a.x);
            const y1 = py(a.y);
            const x2 = px(b.x);
            const y2 = py(b.y);
            const cx = x1 + (x2 - x1) * p;
            const cy = y1 + (y2 - y1) * p;

            // 流动小球位置（沿已画出的线循环）
            const t = ((frame - at) % (fps * 1.6)) / (fps * 1.6);
            const bx = x1 + (cx - x1) * t;
            const by = y1 + (cy - y1) * t;

            return (
              <g key={i}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={cx}
                  y2={cy}
                  stroke={col}
                  strokeWidth={5}
                  strokeLinecap="round"
                  opacity={0.55}
                />
                {e.animate !== false && p > 0.98 ? (
                  <circle cx={bx} cy={by} r={11} fill={col} opacity={0.95} />
                ) : null}
                {e.label && p > 0.6 ? (
                  <text
                    x={(x1 + x2) / 2}
                    y={(y1 + y2) / 2 - 18}
                    fill="#c9c9d1"
                    fontSize={30}
                    textAnchor="middle"
                    opacity={interpolate(p, [0.6, 1], [0, 1])}
                  >
                    {e.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>

        {/* 节点层 */}
        {nodes.map((n, i) => {
          const at = (n.at ?? 0.4 + i * 0.6) * fps;
          const s = spring({
            frame: frame - at,
            fps,
            config: { damping: 15, stiffness: 130 },
          });
          if (frame < at) return null;
          const col = C[n.color ?? "gray"];
          const w = (n.w ?? 0.24) * areaW;
          const lockAt = (n.lockAt ?? (n.at ?? 0.4 + i * 0.6) + 1.0) * fps;
          const lockS = spring({
            frame: frame - lockAt,
            fps,
            config: { damping: 14, stiffness: 160 },
          });
          return (
            <div
              key={n.id}
              style={{
                position: "absolute",
                left: px(n.x) - w / 2,
                top: py(n.y) - 62,
                width: w,
                padding: "22px 26px",
                background: "rgba(255,255,255,0.045)",
                border: `3px solid ${col}`,
                borderRadius: 18,
                textAlign: "center",
                opacity: s,
                transform: `scale(${0.9 + 0.1 * s})`,
              }}
            >
              <div style={{ fontSize: 38, fontWeight: 700, color: "#fff" }}>
                {n.label}
              </div>
              {n.sub ? (
                <div style={{ fontSize: 26, color: "#a1a1aa", marginTop: 8 }}>
                  {n.sub}
                </div>
              ) : null}
              {n.locked && frame >= lockAt ? (
                <div
                  style={{
                    position: "absolute",
                    right: -14,
                    top: -18,
                    background: C.red,
                    color: "#0a0a0c",
                    fontSize: 24,
                    fontWeight: 700,
                    padding: "6px 14px",
                    borderRadius: 999,
                    opacity: lockS,
                    transform: `scale(${0.7 + 0.3 * lockS}) rotate(${
                      (1 - lockS) * -12
                    }deg)`,
                  }}
                >
                  已锁定
                </div>
              ) : null}
            </div>
          );
        })}

        {/* 结论条 */}
        {verdict ? (
          (() => {
            const at = (verdictAt ?? 4.5) * fps;
            const s = spring({
              frame: frame - at,
              fps,
              config: { damping: 16, stiffness: 120 },
            });
            if (frame < at) return null;
            return (
              <div
                style={{
                  position: "absolute",
                  left: areaX,
                  bottom: CAPTION_SAFE + 30,
                  width: areaW,
                  padding: "24px 32px",
                  background: `${C[verdictColor]}18`,
                  borderLeft: `8px solid ${C[verdictColor]}`,
                  borderRadius: "0 16px 16px 0",
                  fontSize: 44,
                  fontWeight: 700,
                  color: "#fff",
                  opacity: s,
                  transform: `translateX(${(1 - s) * -26}px)`,
                }}
              >
                {verdict}
              </div>
            );
          })()
        ) : null}
      </AbsoluteFill>
    </BrandedSlideLayout>
  );
};
