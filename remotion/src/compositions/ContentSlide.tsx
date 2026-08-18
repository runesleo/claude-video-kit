import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BrandedSlideLayout, BrandConfig } from "./BrandedSlideLayout";

interface ContentSlideProps {
  slideNumber: number;
  totalSlides: number;
  durationInFrames?: number;
  brand?: BrandConfig;

  title: string;
  /** Optional bullets (stagger fade in from left). If omitted, use `body`. */
  bullets?: string[];
  /** Alternative body text when no bullets (e.g. a paragraph) */
  body?: string;
  /** Optional corner badge (e.g. "#1", "Pit 3"). Renders with spring scale. */
  badge?: string;
  /** Badge gradient (from, to). Default: red gradient (for "pit" badges) */
  badgeGradient?: [string, string];
  /** Multiplier for all font sizes (driven by preset). */
  fontScale?: number;
}

/**
 * A flexible content slide: title + optional badge + bullets OR body text.
 *
 * Animations:
 *   - Title fades in (frames 10-25)
 *   - Badge springs in with scale (frame 5+)
 *   - Bullets stagger in from left (frame 30+, each 12 frames apart)
 */
export const ContentSlide: React.FC<ContentSlideProps> = ({
  slideNumber,
  totalSlides,
  durationInFrames,
  brand,
  title,
  bullets,
  body,
  badge,
  badgeGradient = ["#ef4444", "#dc2626"],
  fontScale = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const badgeSpring = spring({
    frame: frame - 5,
    fps,
    config: { damping: 12 },
  });

  const titleOpacity = interpolate(frame, [10, 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const hasBullets = bullets && bullets.length > 0;

  return (
    <BrandedSlideLayout
      slideNumber={slideNumber}
      totalSlides={totalSlides}
      durationInFrames={durationInFrames}
      brand={brand}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          marginBottom: hasBullets || body ? 50 : 60,
        }}
      >
        {badge &&
          (() => {
            // badge 原本是写死的 80×80 方块 + fontSize 36，没有任何溢出保护。
            // 超过约 2 个全角字就会溢出容器，压在标题和第一条 bullet 上 ——
            // 而且渲染不报错，成片看起来"有画面"，QA 只有靠人眼才发现。
            // 实测一条 5 badge 的片子里 3 个是长文本（日期、相关系数、一句提醒）。
            // 所以短标签保持方块，长标签自动转 pill：宽度随内容走，永不换行，
            // 字号按长度收敛，flexShrink:0 保证它不挤压右侧标题。
            const chars = Array.from(badge).length;
            const isPill = chars > 2;
            const fs = (isPill ? (chars > 6 ? 24 : 28) : 36) * fontScale;
            return (
              <div
                style={{
                  ...(isPill
                    ? { padding: "0 22px", minWidth: 80 }
                    : { width: 80 }),
                  height: 80,
                  borderRadius: 16,
                  background: `linear-gradient(135deg, ${badgeGradient[0]}, ${badgeGradient[1]})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: fs,
                  fontWeight: 800,
                  color: "#fff",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  transform: `scale(${interpolate(badgeSpring, [0, 1], [0.5, 1])})`,
                  opacity: badgeSpring,
                  flexShrink: 0,
                }}
              >
                {badge}
              </div>
            );
          })()}
        <div
          style={{
            fontSize: 52 * fontScale,
            fontWeight: 700,
            color: "#f9fafb",
            opacity: titleOpacity,
          }}
        >
          {title}
        </div>
      </div>

      {hasBullets ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {bullets.map((bullet, i) => {
            const s = spring({
              frame: frame - 30 - i * 12,
              fps,
              config: { damping: 18 },
            });
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 20,
                  opacity: s,
                  transform: `translateX(${interpolate(s, [0, 1], [-30, 0])}px)`,
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: brand?.accentColor ?? "#4fae50",
                    flexShrink: 0,
                    marginTop: 18,
                  }}
                />
                <div
                  style={{
                    fontSize: 34 * fontScale,
                    color: "#e5e7eb",
                    lineHeight: 1.8,
                  }}
                >
                  {bullet}
                </div>
              </div>
            );
          })}
        </div>
      ) : body ? (
        <div
          style={{
            fontSize: 34 * fontScale,
            color: "#e5e7eb",
            lineHeight: 2,
            maxWidth: 1400,
            opacity: interpolate(frame, [25, 45], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          {body}
        </div>
      ) : null}
    </BrandedSlideLayout>
  );
};
