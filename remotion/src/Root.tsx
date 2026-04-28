import React from "react";
import {
  Composition,
  AbsoluteFill,
  Sequence,
  Audio,
  staticFile,
} from "remotion";
import { CoverSlide } from "./compositions/CoverSlide";
import { TextSlide } from "./compositions/TextSlide";
import { CodeSlide } from "./compositions/CodeSlide";
import { ContentSlide } from "./compositions/ContentSlide";
import { TableSlide, TableCell } from "./compositions/TableSlide";
import { FormulaSlide, FormulaGroup } from "./compositions/FormulaSlide";
import { TransitionSlide } from "./compositions/TransitionSlide";
import { NumberHero } from "./compositions/NumberHero";
import { BrandConfig } from "./compositions/BrandedSlideLayout";
import { Preset, resolvePreset } from "./presets";

/**
 * Metadata is produced by scripts/build-metadata.mjs after TTS + Whisper.
 *
 * Core slide types (minimal, generic):
 *   cover | text | code
 *
 * Rich slide types (branded, animated, built for data-heavy videos):
 *   content    — title + optional badge + bullets or body
 *   table      — title + headers + rows (with number-rolling animation)
 *   formula    — title + groups of colored token pills
 *   transition — big centered title + optional bullets
 *
 * All rich types accept a top-level `brand` prop in Metadata to stamp a
 * consistent watermark + accent color across the whole video.
 */
type SlideMeta = {
  type:
    | "cover"
    | "text"
    | "code"
    | "content"
    | "table"
    | "formula"
    | "transition"
    | "numberHero";
  durationInFrames: number;
  audio?: string;
  captions?: Array<{ from: number; to: number; text: string }>;
  voice_text?: string;
  voice?: string;

  // common
  title?: string;
  subtitle?: string;

  // text
  text?: string;

  // code
  language?: string;
  code?: string;

  // content / transition
  bullets?: string[];
  body?: string;
  badge?: string;
  badgeGradient?: [string, string];

  // table
  tableData?: {
    headers: string[];
    rows: TableCell[][];
    footer?: string;
    animateNumbers?: boolean;
  };

  // formula
  formulaGroups?: FormulaGroup[];
  formulaCaption?: string;
  formulaPrefix?: string;

  // numberHero (shorts data-hook slide)
  heroValue?: string | number;
  heroLabel?: string;
  heroBadge?: string;
  heroPrefix?: string;
  heroSuffix?: string;
  heroAccentColor?: string;
};

type Metadata = {
  title: string;
  width: number;
  height: number;
  fps: number;
  slides: SlideMeta[];
  /** Brand watermark config applied to all branded slide types */
  brand?: BrandConfig;
  /**
   * Optional video format preset. When set, overrides width/height/fps with
   * the preset's canvas; components scale fonts via the preset's fontScale.
   * Without preset, metadata's own width/height/fps are used (legacy mode).
   */
  preset?: Preset;
};

const DEFAULT_METADATA: Metadata = {
  title: "claude-video-kit demo",
  width: 1080,
  height: 1920,
  fps: 30,
  slides: [
    {
      type: "cover",
      durationInFrames: 60,
      title: "claude-video-kit",
      subtitle: "Write a script, get a video.",
    },
    {
      type: "text",
      durationInFrames: 90,
      text: "Your script becomes the video.",
    },
    {
      type: "code",
      durationInFrames: 90,
      language: "ts",
      code: "const video = await kit.render(script);",
    },
  ],
};

const Main: React.FC<Metadata> = (meta) => {
  const total = meta.slides.length;
  const presetCfg = meta.preset
    ? resolvePreset(meta.preset, {
        width: meta.width,
        height: meta.height,
        fps: meta.fps,
      }).config
    : undefined;
  const fontScale = presetCfg?.fontScale ?? 1;
  let offset = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0b0f" }}>
      {meta.slides.map((slide, i) => {
        const from = offset;
        offset += slide.durationInFrames;
        const slideNumber = i + 1;

        return (
          <Sequence
            key={i}
            from={from}
            durationInFrames={slide.durationInFrames}
          >
            {slide.audio ? <Audio src={staticFile(slide.audio)} /> : null}

            {slide.type === "cover" && (
              <CoverSlide title={slide.title ?? ""} subtitle={slide.subtitle} />
            )}
            {slide.type === "text" && (
              <TextSlide text={slide.text ?? ""} captions={slide.captions} />
            )}
            {slide.type === "code" && (
              <CodeSlide
                code={slide.code ?? ""}
                language={slide.language ?? "ts"}
                captions={slide.captions}
              />
            )}
            {slide.type === "content" && (
              <ContentSlide
                slideNumber={slideNumber}
                totalSlides={total}
                durationInFrames={slide.durationInFrames}
                brand={meta.brand}
                title={slide.title ?? ""}
                bullets={slide.bullets}
                body={slide.body}
                badge={slide.badge}
                badgeGradient={slide.badgeGradient}
              />
            )}
            {slide.type === "table" && slide.tableData && (
              <TableSlide
                slideNumber={slideNumber}
                totalSlides={total}
                durationInFrames={slide.durationInFrames}
                brand={meta.brand}
                title={slide.title ?? ""}
                headers={slide.tableData.headers}
                rows={slide.tableData.rows}
                footer={slide.tableData.footer}
                animateNumbers={slide.tableData.animateNumbers}
              />
            )}
            {slide.type === "formula" && slide.formulaGroups && (
              <FormulaSlide
                slideNumber={slideNumber}
                totalSlides={total}
                durationInFrames={slide.durationInFrames}
                brand={meta.brand}
                title={slide.title ?? ""}
                groups={slide.formulaGroups}
                caption={slide.formulaCaption}
                prefix={slide.formulaPrefix}
              />
            )}
            {slide.type === "transition" && (
              <TransitionSlide
                slideNumber={slideNumber}
                totalSlides={total}
                durationInFrames={slide.durationInFrames}
                brand={meta.brand}
                title={slide.title ?? ""}
                bullets={slide.bullets}
              />
            )}
            {slide.type === "numberHero" && slide.heroValue !== undefined && (
              <NumberHero
                value={slide.heroValue}
                label={slide.heroLabel ?? ""}
                badge={slide.heroBadge}
                prefix={slide.heroPrefix}
                suffix={slide.heroSuffix}
                accentColor={slide.heroAccentColor}
                fontScale={fontScale}
              />
            )}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

const calcDuration = (m: Metadata) =>
  m.slides.reduce((acc, s) => acc + s.durationInFrames, 0);

export const Root: React.FC = () => {
  return (
    <Composition
      id="Main"
      component={Main}
      durationInFrames={1}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={DEFAULT_METADATA}
      calculateMetadata={({ props }) => {
        const meta: Metadata = props.slides ? props : DEFAULT_METADATA;
        // Resolve preset → effective canvas. Without preset, use metadata's
        // own width/height/fps so legacy horizontal examples keep working.
        const resolved = resolvePreset(meta.preset, {
          width: meta.width,
          height: meta.height,
          fps: meta.fps,
        });
        return {
          durationInFrames: calcDuration(meta),
          fps: resolved.fps,
          width: resolved.width,
          height: resolved.height,
          props: meta,
        };
      }}
    />
  );
};
