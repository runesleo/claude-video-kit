import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

type Caption = { from: number; to: number; text: string };

export const TextSlide: React.FC<{ text: string; captions?: Caption[] }> = ({
  text,
  captions,
}) => {
  const frame = useCurrentFrame();
  const active = captions?.find((c) => frame >= c.from && frame < c.to);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0b0b0f",
        alignItems: "center",
        justifyContent: "center",
        padding: 80,
      }}
    >
      <div
        style={{
          fontSize: 72,
          fontWeight: 600,
          color: "#fff",
          lineHeight: 1.3,
          textAlign: "center",
          maxWidth: 900,
          fontFamily: "-apple-system, Inter, sans-serif",
        }}
      >
        {text}
      </div>

      {active && (
        <div
          style={{
            position: "absolute",
            bottom: 200,
            left: 80,
            right: 80,
            textAlign: "center",
            fontSize: 48,
            fontWeight: 500,
            color: "#fff",
            background: "rgba(0,0,0,0.6)",
            padding: "20px 32px",
            borderRadius: 12,
          }}
        >
          {active.text}
        </div>
      )}
    </AbsoluteFill>
  );
};
