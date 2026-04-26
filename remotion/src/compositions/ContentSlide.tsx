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
        {badge && (
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 16,
              background: `linear-gradient(135deg, ${badgeGradient[0]}, ${badgeGradient[1]})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              fontWeight: 800,
              color: "#fff",
              transform: `scale(${interpolate(badgeSpring, [0, 1], [0.5, 1])})`,
              opacity: badgeSpring,
              flexShrink: 0,
            }}
          >
            {badge}
          </div>
        )}
        <div
          style={{
            fontSize: 52,
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
                    fontSize: 34,
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
            fontSize: 34,
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
