/**
 * asset-version: v0.3.0-rc.1 / 2026-07-22 / remove duplicate code-slide captions
 * owner_surface: claude-video-kit / code slides
 * behavior_change: captions render only through Root's shared CaptionsLayer
 * rollback: restore the local active-caption overlay below the code panel
 */
import React from "react";
import { AbsoluteFill } from "remotion";

type Caption = { from: number; to: number; text: string };

export const CodeSlide: React.FC<{
  code: string;
  language: string;
  captions?: Caption[];
}> = ({ code, language, captions }) => {
  // Root owns the single caption overlay for every slide type. Keep this prop
  // for metadata/API compatibility, but never render a second local layer.
  void captions;

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

    </AbsoluteFill>
  );
};
