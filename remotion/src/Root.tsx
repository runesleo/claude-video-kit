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

/**
 * Metadata is produced by scripts/build-metadata.mjs after TTS + Whisper.
 * Shape:
 * {
 *   title: string;
 *   width: number; height: number; fps: number;
 *   slides: Array<{
 *     type: "cover" | "text" | "code";
 *     durationInFrames: number;
 *     audio?: string;           // relative path inside workspace/
 *     captions?: Array<{ from: number; to: number; text: string }>;
 *     // slide-specific fields:
 *     title?: string; subtitle?: string;      // cover
 *     text?: string;                           // text
 *     language?: string; code?: string;        // code
 *   }>;
 * }
 */
export type SlideMeta = {
  type: "cover" | "text" | "code";
  durationInFrames: number;
  audio?: string;
  captions?: Array<{ from: number; to: number; text: string }>;
  /**
   * Narration text consumed by scripts/tts.py.
   * Separate from on-screen `text` so the voice-over can be more natural
   * than what the slide shows.
   */
  voice_text?: string;
  /** Optional per-slide voice ID override (otherwise uses FISH_AUDIO_VOICE_ID). */
  voice?: string;
  title?: string;
  subtitle?: string;
  text?: string;
  language?: string;
  code?: string;
};

export type Metadata = {
  title: string;
  width: number;
  height: number;
  fps: number;
  slides: SlideMeta[];
};

// Fallback metadata so `remotion studio` works without running the pipeline.
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

/**
 * Main receives the Metadata directly as its props (not wrapped in a
 * `metadata` key), which matches what scripts/build-metadata.mjs writes
 * to <project>/metadata.json. The CLI flag --props=<json> sets the entire
 * props object of this component.
 */
const Main: React.FC<Metadata> = (meta) => {
  let offset = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0b0f" }}>
      {meta.slides.map((slide, i) => {
        const from = offset;
        offset += slide.durationInFrames;
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
      // Placeholders; calculateMetadata reads the real values from props
      // (the entire props object IS the Metadata, set via --props=<json>
      // from scripts/render.sh).
      durationInFrames={1}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={DEFAULT_METADATA}
      calculateMetadata={({ props }) => {
        const meta: Metadata = props.slides ? props : DEFAULT_METADATA;
        return {
          durationInFrames: calcDuration(meta),
          fps: meta.fps,
          width: meta.width,
          height: meta.height,
          props: meta,
        };
      }}
    />
  );
};
