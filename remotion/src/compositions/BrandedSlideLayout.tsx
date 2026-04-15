import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export interface BrandConfig {
  /** URL or staticFile() path to a logo image, ~64px square */
  logoSrc?: string;
  /** Social handle shown next to logo (e.g. "@runes_leo") */
  handle?: string;
  /** URL shown below handle (e.g. "leolabs.me") */
  url?: string;
  /** Accent color — used for handle text + logo border. Default: #4fae50 */
  accentColor?: string;
}

export interface BrandedSlideLayoutProps {
  children: React.ReactNode;
  /** Current slide number (1-indexed) for counter */
  slideNumber: number;
  /** Total slides in the composition */
  totalSlides: number;
  /**
   * Duration of this slide's enclosing Sequence in frames.
   * Needed to compute exit fade. Omit → no exit fade.
   */
  durationInFrames?: number;
  /** Optional brand watermark config; omit → no watermark */
  brand?: BrandConfig;
  /** Top border gradient colors. Default: neutral dark greys */
  topGradient?: [string, string, string];
  /** Page background color. Default: "#0a0a0f" */
  background?: string;
  /** Radial gradient drift color (behind content). Default: green tint */
  driftColor?: string;
}

/**
 * Layered slide background with subtle sustained motion:
 *   1. Enter fade (0 → 1 over 15 frames / 0.5s)
 *   2. Enter scale (0.985 → 1 over 20 frames)
 *   3. Drifting radial gradient (6s cycle) — breaks the "static slideshow" feel
 *   4. Exit fade (last 12 frames before Sequence ends)
 *
 * Use as the root of every slide:
 *   <BrandedSlideLayout
 *     slideNumber={3}
 *     totalSlides={31}
 *     durationInFrames={900}
 *     brand={{ logoSrc: staticFile("logo.jpg"), handle: "@me", url: "me.com" }}
 *   >
 *     ...your slide content...
 *   </BrandedSlideLayout>
 */
export const BrandedSlideLayout: React.FC<BrandedSlideLayoutProps> = ({
  children,
  slideNumber,
  totalSlides,
  durationInFrames,
  brand,
  topGradient = ["#4fae50", "#1060b0", "#ee943e"],
  background = "#0a0a0f",
  driftColor = "rgba(79, 174, 80, 0.08)",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  const exitOpacity = durationInFrames
    ? interpolate(
        frame,
        [durationInFrames - 12, durationInFrames],
        [1, 0.15],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      )
    : 1;

  const opacity = enterOpacity * exitOpacity;
  const enterScale = interpolate(frame, [0, 20], [0.985, 1], {
    extrapolateRight: "clamp",
  });

  // Drifting radial gradient — 6-second breathe cycle
  const cycleSeconds = 6;
  const t = (frame / fps / cycleSeconds) * Math.PI * 2;
  const driftX = 50 + Math.sin(t) * 8;
  const driftY = 30 + Math.cos(t * 0.7) * 6;

  const accent = brand?.accentColor ?? "#4fae50";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: background,
        fontFamily:
          '"PingFang SC", "SF Pro Display", "Helvetica Neue", sans-serif',
        opacity,
      }}
    >
      {/* Drifting radial gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 60% 50% at ${driftX}% ${driftY}%, ${driftColor}, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      {/* Top tri-color line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, ${topGradient[0]}, ${topGradient[1]}, ${topGradient[2]})`,
        }}
      />

      {/* Main content with enter scale */}
      <div
        style={{
          padding: "80px 120px",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          transform: `scale(${enterScale})`,
          transformOrigin: "center",
        }}
      >
        {children}
      </div>

      {/* Bottom-left slide counter */}
      <span
        style={{
          position: "absolute",
          bottom: 40,
          left: 120,
          color: "#4b5563",
          fontSize: 18,
        }}
      >
        {slideNumber} / {totalSlides}
      </span>

      {/* Bottom-right brand watermark (optional) */}
      {brand && (brand.logoSrc || brand.handle) && (
        <div
          style={{
            position: "absolute",
            bottom: 32,
            right: 50,
            display: "flex",
            alignItems: "center",
            gap: 14,
            opacity: 0.92,
          }}
        >
          {brand.logoSrc && (
            <Img
              src={brand.logoSrc}
              style={{
                width: 56,
                height: 56,
                borderRadius: 12,
                border: `2px solid ${accent}`,
              }}
            />
          )}
          {(brand.handle || brand.url) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {brand.handle && (
                <span
                  style={{
                    color: accent,
                    fontSize: 18,
                    fontWeight: 600,
                    letterSpacing: 0.3,
                  }}
                >
                  {brand.handle}
                </span>
              )}
              {brand.url && (
                <span
                  style={{
                    color: "#9ca3af",
                    fontSize: 14,
                    letterSpacing: 0.3,
                  }}
                >
                  {brand.url}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </AbsoluteFill>
  );
};
