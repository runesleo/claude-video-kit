/**
 * Scatter — correlation cloud with an optional trend line and r annotation.
 *
 * Use when the claim is about direction of association ("the first half of that
 * intuition is right, the second half isn't"). Points fade in as a cloud, then
 * the trend line draws, then r lands — so the viewer sees the shape before the
 * statistic, not after.
 *
 * Points may be supplied directly, or generated deterministically from a target
 * r via `synth` when the real cloud is too dense to ship as JSON. Synthetic
 * clouds MUST be labelled in the footnote — see the guard in the component.
 *
 * script.json:
 *   {
 *     "type": "scatter",
 *     "title": "那个直觉的前半段是对的",
 *     "chart": {
 *       "xLabel": "log 日成交额",
 *       "yLabel": "log 队列份额",
 *       "r": -0.315,
 *       "rLabel": "corr(log vol24, log q)",
 *       "synth": {"n": 160, "seed": 193},
 *       "synthDisclosure": "示意云，r 与实测一致；逐点原始数据见 artifact"
 *     }
 *   }
 */
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ChartFrame, DS, useGrow } from "./chartBase";

export type Pt = { x: number; y: number };

/** Deterministic LCG — same seed always yields the same cloud across renders. */
const lcg = (seed: number) => {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

/** Box-Muller from a seeded uniform source. */
const synthCloud = (n: number, r: number, seed: number): Pt[] => {
  const rand = lcg(seed);
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const u1 = Math.max(rand(), 1e-9);
    const u2 = rand();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const z1 = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2);
    pts.push({ x: z0, y: r * z0 + Math.sqrt(Math.max(1 - r * r, 0)) * z1 });
  }
  return pts;
};

export const Scatter: React.FC<{
  title: string;
  subtitle?: string;
  footnote?: string;
  slideNumber?: number;
  totalSlides?: number;
  points?: Pt[];
  synth?: { n: number; seed: number };
  synthDisclosure?: string;
  r: number;
  rLabel?: string;
  xLabel?: string;
  yLabel?: string;
}> = ({
  title,
  subtitle,
  footnote,
  slideNumber,
  totalSlides,
  points,
  synth,
  synthDisclosure,
  r,
  rLabel,
  xLabel,
  yLabel,
}) => {
  const frame = useCurrentFrame();
  const gLine = useGrow(30);
  const gR = useGrow(46);

  const pts = points ?? (synth ? synthCloud(synth.n, r, synth.seed) : []);
  const isSynth = !points && Boolean(synth);

  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const xLo = Math.min(...xs, -3), xHi = Math.max(...xs, 3);
  const yLo = Math.min(...ys, -3), yHi = Math.max(...ys, 3);
  const px = (x: number) => ((x - xLo) / (xHi - xLo)) * 100;
  const py = (y: number) => (1 - (y - yLo) / (yHi - yLo)) * 100;

  const W = 1180, H = 560;

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      slideNumber={slideNumber}
      totalSlides={totalSlides}
      footnote={
        // A synthetic cloud must always say so on-screen — a shape that looks
        // like measured data but isn't is exactly the kind of thing that gets
        // screenshotted and quoted back later.
        [footnote, isSynth ? synthDisclosure ?? "示意云（非逐点实测），r 取自实测" : null]
          .filter(Boolean)
          .join(" · ")
      }
    >
      <div style={{ display: "flex", alignItems: "center", gap: 40, width: "100%" }}>
        <div style={{ position: "relative", width: W, height: H, flex: "0 0 auto" }}>
          <div style={{ position: "absolute", inset: 0, background: DS.panel, borderRadius: 14 }} />
          {[25, 50, 75].map((g) => (
            <React.Fragment key={g}>
              <div style={{ position: "absolute", left: `${g}%`, top: 0, bottom: 0, width: 1, background: "#222a36" }} />
              <div style={{ position: "absolute", top: `${g}%`, left: 0, right: 0, height: 1, background: "#222a36" }} />
            </React.Fragment>
          ))}

          {pts.map((p, i) => {
            const appear = interpolate(frame - 6 - (i % 40) * 0.5, [0, 10], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${px(p.x)}%`,
                  top: `${py(p.y)}%`,
                  width: 9,
                  height: 9,
                  marginLeft: -4.5,
                  marginTop: -4.5,
                  borderRadius: "50%",
                  background: DS.accent,
                  opacity: appear * 0.55,
                }}
              />
            );
          })}

          {/* trend line: y = r·x on the standardised cloud */}
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
            <line
              x1={`${px(xLo)}%`}
              y1={`${py(r * xLo)}%`}
              x2={`${px(xLo + (xHi - xLo) * gLine)}%`}
              y2={`${py(r * (xLo + (xHi - xLo) * gLine))}%`}
              stroke={DS.invalid}
              strokeWidth={4}
              strokeLinecap="round"
            />
          </svg>

          {yLabel && (
            <div
              style={{
                position: "absolute",
                left: -14,
                top: "50%",
                transform: "translate(-100%,-50%) rotate(-90deg)",
                fontSize: 24,
                color: DS.muted,
                fontFamily: DS.mono,
                whiteSpace: "nowrap",
              }}
            >
              {yLabel}
            </div>
          )}
          {xLabel && (
            <div
              style={{
                position: "absolute",
                bottom: -40,
                left: "50%",
                transform: "translateX(-50%)",
                fontSize: 24,
                color: DS.muted,
                fontFamily: DS.mono,
              }}
            >
              {xLabel}
            </div>
          )}
        </div>

        <div style={{ flex: 1, opacity: gR, transform: `translateX(${interpolate(gR, [0, 1], [24, 0])}px)` }}>
          <div style={{ fontSize: 26, color: DS.muted, marginBottom: 10 }}>{rLabel ?? "corr"}</div>
          <div style={{ fontSize: 92, fontWeight: 900, fontFamily: DS.mono, color: DS.invalid, letterSpacing: "-0.04em" }}>
            {r > 0 ? "+" : "−"}
            {Math.abs(r).toFixed(3)}
          </div>
        </div>
      </div>
    </ChartFrame>
  );
};
