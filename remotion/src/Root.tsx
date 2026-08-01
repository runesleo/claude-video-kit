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
import { ScreenshotSlide, Highlight } from "./compositions/ScreenshotSlide";
import { FlowDiagram, FlowNode, FlowEdge } from "./compositions/FlowDiagram";
import { CaptionsLayer, CaptionPosition } from "./compositions/CaptionsLayer";
import { BrandConfig } from "./compositions/BrandedSlideLayout";
import { Preset, resolvePreset } from "./presets";
import { UiKitDemo } from "./ui-kit/UiKitDemo";
import { OkxAspDemo, defaultOkxAspDemoProps, type OkxAspDemoProps } from "./ui-kit/OkxAspDemo";

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
    | "numberHero"
    | "screenshot"
    | "flow";
  durationInFrames: number;
  audio?: string;
  captions?: Array<{ from: number; to: number; text: string }>;
  voice_text?: string;
  voice?: string;

  // common
  title?: string;
  subtitle?: string;

  // cover
  eyebrow?: string;
  endCard?: boolean;
  endCardCTAs?: { label: string; value: string }[];
  showWatermark?: boolean;
  watermarkHandle?: string;
  watermarkUrl?: string;
  logoSrc?: string;

  // text
  text?: string;
  /** TextSlide mode: "default" balanced, "hero" big-font hook moment. */
  textMode?: "default" | "hero";
  /** TextSlide hero reveal style: "spring" or "typewriter". */
  textReveal?: "spring" | "typewriter";
  /** Accent color for TextSlide hero glow / NumberHero. */
  accentColor?: string;

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

  // flow — 机制示意图，节点/连线逐步演出
  nodes?: FlowNode[];
  edges?: FlowEdge[];
  verdict?: string;
  verdictAt?: number;
  verdictColor?: "orange" | "green" | "blue" | "red";

  // screenshot — 真实截图 + 动画高亮标注
  src?: string;
  highlights?: Highlight[];
  caption?: string;
  focus?: { x: number; y: number; w: number; h: number };

  // numberHero (shorts data-hook slide)
  heroValue?: string | number;
  heroLabel?: string;
  heroBadge?: string;
  heroPrefix?: string;
  heroSuffix?: string;
  heroAccentColor?: string;

  // captions overlay (rendered by CaptionsLayer at slide level, all types)
  captionHighlight?: string[];
  captionPosition?: CaptionPosition;
  captionMaxCharsPerLine?: number;

  /** screenshot: 截图宽高比，高亮层据此贴合 contain 后的真实图片矩形 */
  aspect?: number;
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
              <CoverSlide
                title={slide.title ?? ""}
                subtitle={slide.subtitle}
                fontScale={fontScale}
                eyebrow={slide.eyebrow}
                accentColor={slide.accentColor ?? meta.brand?.accentColor}
                showWatermark={slide.showWatermark ?? true}
                watermarkHandle={slide.watermarkHandle ?? meta.brand?.handle}
                watermarkUrl={slide.watermarkUrl ?? meta.brand?.url}
                logoSrc={slide.logoSrc ?? meta.brand?.logoSrc}
                endCard={slide.endCard}
                endCardCTAs={slide.endCardCTAs}
              />
            )}
            {slide.type === "text" && (
              <TextSlide
                text={slide.text ?? ""}
                captions={slide.captions}
                mode={slide.textMode}
                reveal={slide.textReveal}
                accentColor={slide.accentColor}
                fontScale={fontScale}
              />
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
                fontScale={fontScale}
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
            {slide.type === "flow" && slide.nodes && (
              <FlowDiagram
                slideNumber={slideNumber}
                totalSlides={total}
                durationInFrames={slide.durationInFrames}
                brand={meta.brand}
                title={slide.title}
                nodes={slide.nodes}
                edges={slide.edges}
                verdict={slide.verdict}
                verdictAt={slide.verdictAt}
                verdictColor={slide.verdictColor}
              />
            )}
            {slide.type === "screenshot" && slide.src && (
              <ScreenshotSlide
                slideNumber={slideNumber}
                totalSlides={total}
                durationInFrames={slide.durationInFrames}
                brand={meta.brand}
                title={slide.title}
                src={slide.src}
                highlights={slide.highlights}
                caption={slide.caption}
                focus={slide.focus}
                aspect={slide.aspect}
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
                accentColor={slide.heroAccentColor ?? slide.accentColor}
                fontScale={fontScale}
              />
            )}

            {/* Captions overlay — rendered above all slide types when present */}
            <CaptionsLayer
              captions={slide.captions}
              fontScale={fontScale}
              position={slide.captionPosition}
              highlight={slide.captionHighlight}
              accentColor={slide.accentColor}
              maxCharsPerLine={slide.captionMaxCharsPerLine}
            />
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
    <>
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
    <Composition
      id="UiKitDemo"
      component={UiKitDemo}
      durationInFrames={720}
      fps={24}
      width={1920}
      height={1080}
    />
    <Composition
      id="OkxAspDemo"
      component={OkxAspDemo}
      durationInFrames={defaultOkxAspDemoProps.totalFrames ?? 1890}
      fps={24}
      width={1920}
      height={1080}
      defaultProps={defaultOkxAspDemoProps}
      calculateMetadata={({ props }) => {
        const p = props as OkxAspDemoProps;
        const total =
          p.totalFrames ??
          p.scenes?.reduce((a, s) => a + s.durationInFrames, 0) ??
          1890;
        return {
          durationInFrames: total,
          fps: p.fps ?? 24,
          props: p,
        };
      }}
    />
    </>
  );
};
