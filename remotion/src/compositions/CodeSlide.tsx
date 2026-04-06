import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

type Caption = { from: number; to: number; text: string };

export const CodeSlide: React.FC<{
  code: string;
  language: string;
  captions?: Caption[];
}> = ({ code, language, captions }) => {
  const frame = useCurrentFrame();
  const active = captions?.find((c) => frame >= c.from && frame < c.to);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0b0b0f",
        alignItems: "center",
        justifyContent: "center",
        padding: 60,
      }}
    >
      <div
        style={{
          background: "#16161e",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 20,
          padding: "48px 56px",
          maxWidth: 960,
          width: "100%",
        }}
      >
        <div
          style={{
            fontSize: 24,
            color: "#6b7280",
            marginBottom: 24,
            fontFamily: "'Geist Mono', 'SF Mono', monospace",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          {language}
        </div>
        <pre
          style={{
            margin: 0,
            fontSize: 44,
            lineHeight: 1.5,
            color: "#e5e7eb",
            fontFamily: "'Geist Mono', 'SF Mono', monospace",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {code}
        </pre>
      </div>

      {active && (
        <div
          style={{
            position: "absolute",
            bottom: 160,
            left: 80,
            right: 80,
            textAlign: "center",
            fontSize: 44,
            fontWeight: 500,
            color: "#fff",
            background: "rgba(0,0,0,0.6)",
            padding: "18px 28px",
            borderRadius: 12,
          }}
        >
          {active.text}
        </div>
      )}
    </AbsoluteFill>
  );
};
