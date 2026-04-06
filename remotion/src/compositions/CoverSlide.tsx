import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

export const CoverSlide: React.FC<{ title: string; subtitle?: string }> = ({
  title,
  subtitle,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const translateY = interpolate(frame, [0, 20], [20, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #0b0b0f 0%, #1a1a25 100%)",
        alignItems: "center",
        justifyContent: "center",
        padding: 80,
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${translateY}px)`,
          textAlign: "center",
          color: "#fff",
        }}
      >
        <div
          style={{
            fontSize: 96,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            fontFamily: "-apple-system, Inter, sans-serif",
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              marginTop: 32,
              fontSize: 40,
              color: "#9ca3af",
              fontWeight: 400,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
