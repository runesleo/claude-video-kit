import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

interface CoverSlideProps {
  title: string;
  subtitle?: string;
  /** Multiplier for all font sizes (driven by preset). */
  fontScale?: number;
}

/**
 * Cover / opening slide. Title springs in with scale + Y translation,
 * subtitle follows with delayed fade. Subtle KenBurns zoom across full
 * duration prevents the slide from going static after the entrance.
 */
export const CoverSlide: React.FC<CoverSlideProps> = ({
  title,
  subtitle,
  fontScale = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const titleSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 110, mass: 0.7 },
  });
  const subtitleOpacity = interpolate(frame, [12, 28], [0, 1], {
    extrapolateRight: "clamp",
  });

  // KenBurns: 1.0 → 1.05 across slide duration for sustained motion.
  const kenBurns = interpolate(frame, [0, durationInFrames], [1.0, 1.05], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const titleFont = 96 * fontScale;
  const subtitleFont = 40 * fontScale;

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #0b0b0f 0%, #1a1a25 100%)",
        alignItems: "center",
        justifyContent: "center",
        padding: 80,
        transform: `scale(${kenBurns})`,
        transformOrigin: "center",
      }}
    >
      <div
        style={{
          opacity: titleSpring,
          transform: `scale(${0.9 + titleSpring * 0.1}) translateY(${interpolate(titleSpring, [0, 1], [24, 0])}px)`,
          textAlign: "center",
          color: "#fff",
        }}
      >
        <div
          style={{
            fontSize: titleFont,
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
              opacity: subtitleOpacity,
              marginTop: 32,
              fontSize: subtitleFont,
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
