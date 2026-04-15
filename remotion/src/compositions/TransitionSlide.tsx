import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BrandedSlideLayout, BrandConfig } from "./BrandedSlideLayout";

export interface TransitionSlideProps {
  slideNumber: number;
  totalSlides: number;
  durationInFrames?: number;
  brand?: BrandConfig;

  title: string;
  /** Optional centered bullets below the title */
  bullets?: string[];
  /** Bullet text color. Default = accent green */
  bulletColor?: string;
}

/**
 * Transition slide: big centered title + optional centered bullet list.
 *
 * Use between sections to signal "topic change". Title springs in with
 * scale, bullets stagger in below.
 */
export const TransitionSlide: React.FC<TransitionSlideProps> = ({
  slideNumber,
  totalSlides,
  durationInFrames,
  brand,
  title,
  bullets,
  bulletColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSpring = spring({
    frame: frame - 10,
    fps,
    config: { damping: 15 },
  });

  const color = bulletColor ?? brand?.accentColor ?? "#4fae50";

  return (
    <BrandedSlideLayout
      slideNumber={slideNumber}
      totalSlides={totalSlides}
      durationInFrames={durationInFrames}
      brand={brand}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 50,
        }}
      >
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            color: "#f9fafb",
            transform: `scale(${interpolate(titleSpring, [0, 1], [0.85, 1])})`,
            opacity: titleSpring,
            textAlign: "center",
          }}
        >
          {title}
        </div>

        {bullets && bullets.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 20,
              alignItems: "center",
            }}
          >
            {bullets.map((bullet, i) => {
              const s = spring({
                frame: frame - 30 - i * 10,
                fps,
                config: { damping: 18 },
              });
              return (
                <div
                  key={i}
                  style={{
                    fontSize: 32,
                    color,
                    fontWeight: 600,
                    opacity: s,
                    transform: `translateY(${interpolate(s, [0, 1], [20, 0])}px)`,
                  }}
                >
                  {bullet}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </BrandedSlideLayout>
  );
};
