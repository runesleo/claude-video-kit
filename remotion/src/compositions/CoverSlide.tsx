import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { LEO_LOGO_DATA_URL } from "./leoLogoData";

interface CoverSlideProps {
  title: string;
  subtitle?: string;
  /** Multiplier for all font sizes (driven by preset). */
  fontScale?: number;
  /** Eyebrow line above title — Geist Mono uppercase, brand-system style. */
  eyebrow?: string;
  /** Brand accent color for glow + eyebrow. */
  accentColor?: string;
  /** Show brand watermark (logo + handle + URL) at bottom. Defaults true. */
  showWatermark?: boolean;
  /** Watermark handle text (overrides default). */
  watermarkHandle?: string;
  /** Watermark URL text (overrides default). */
  watermarkUrl?: string;
  /** Optional logo file URL (passed to Img/staticFile). */
  logoSrc?: string;
  /** EndCard mode: shows multi-platform CTA row (X / site / channel) below subtitle. */
  endCard?: boolean;
  /** EndCard CTAs (3 lines). */
  endCardCTAs?: { label: string; value: string }[];
}

/**
 * Cover / opening slide + EndCard mode. Title springs in with scale + Y
 * translation, subtitle follows with delayed fade. Subtle KenBurns prevents
 * the slide going static. Watermark layer pinned bottom for brand identity.
 */
export const CoverSlide: React.FC<CoverSlideProps> = ({
  title,
  subtitle,
  fontScale = 1,
  eyebrow,
  accentColor = "#f59e0b",
  showWatermark = true,
  watermarkHandle = "@runes_leo",
  watermarkUrl = "leolabs.me",
  logoSrc,
  endCard = false,
  endCardCTAs,
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
  const ctaOpacity = interpolate(frame, [22, 40], [0, 1], {
    extrapolateRight: "clamp",
  });
  const watermarkOpacity = interpolate(frame, [8, 24], [0, 1], {
    extrapolateRight: "clamp",
  });

  const kenBurns = interpolate(frame, [0, durationInFrames], [1.0, 1.05], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const titleFont = (endCard ? 92 : 80) * fontScale;
  const subtitleFont = 40 * fontScale;
  const eyebrowFont = 22 * fontScale;
  const ctaFont = 30 * fontScale;

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
      {/* radial accent glow behind title */}
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "55%",
          top: "20%",
          background: `radial-gradient(ellipse at center, ${accentColor}26 0%, transparent 65%)`,
          filter: "blur(60px)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          opacity: 1,
          transform: `scale(${0.96 + titleSpring * 0.04})`,
          textAlign: "center",
          color: "#fff",
          maxWidth: 1000,
        }}
      >
        {eyebrow && (
          <div
            style={{
              opacity: 1,
              fontSize: eyebrowFont,
              fontFamily:
                "'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace",
              fontWeight: 500,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: accentColor,
              marginBottom: 28,
            }}
          >
            {eyebrow}
          </div>
        )}
        <div
          style={{
            fontSize: titleFont,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            fontFamily: "'Inter', -apple-system, 'PingFang SC', sans-serif",
            textShadow: `0 0 80px ${accentColor}55`,
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
              color: "#cbd5e1",
              fontWeight: 500,
              letterSpacing: "-0.01em",
            }}
          >
            {subtitle}
          </div>
        )}
        {endCard && endCardCTAs && endCardCTAs.length > 0 && (
          <div
            style={{
              opacity: ctaOpacity,
              marginTop: 56,
              display: "flex",
              flexDirection: "column",
              gap: 18,
              alignItems: "center",
            }}
          >
            {endCardCTAs.map((cta, i) => (
              <div
                key={i}
                style={{
                  fontSize: ctaFont,
                  fontFamily:
                    "'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace",
                  color: "#fff",
                  display: "flex",
                  gap: 16,
                  alignItems: "baseline",
                }}
              >
                <span
                  style={{
                    color: accentColor,
                    fontSize: ctaFont * 0.7,
                    textTransform: "uppercase",
                    letterSpacing: "0.15em",
                    fontWeight: 600,
                  }}
                >
                  {cta.label}
                </span>
                <span style={{ fontWeight: 500 }}>{cta.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showWatermark && (
        // Bottom-right brand watermark — same template as the PnL v7 video:
        // logo image + handle + URL stacked. Anchored to the corner so it's
        // out of the way of the title but still legible.
        <div
          style={{
            position: "absolute",
            bottom: 50,
            right: 50,
            display: "flex",
            alignItems: "center",
            gap: 14,
            opacity: watermarkOpacity * 0.92,
          }}
        >
          {logoSrc && (
            <Img
              src={LEO_LOGO_DATA_URL}
              style={{
                width: 64 * fontScale,
                height: 64 * fontScale,
                borderRadius: 12,
                border: `2px solid ${accentColor}`,
              }}
            />
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span
              style={{
                color: accentColor,
                fontSize: 20 * fontScale,
                fontWeight: 600,
                letterSpacing: 0.3,
              }}
            >
              {watermarkHandle}
            </span>
            <span
              style={{
                color: "#9ca3af",
                fontSize: 16 * fontScale,
                letterSpacing: 0.3,
              }}
            >
              {watermarkUrl}
            </span>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
