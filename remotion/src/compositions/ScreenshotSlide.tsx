import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BrandedSlideLayout, BrandConfig } from "./BrandedSlideLayout";

/**
 * ScreenshotSlide — 真实截图 + 动画高亮标注
 *
 * 为什么存在（Leo 2026-08-01）：
 *   「画面必须得有用。不能是底下已经有了字幕，上面分镜里又显示一遍
 *     跟字幕一模一样的大文字，这有什么用？」
 *   文字类 slide 只是把口播排版了一遍，零信息增量。观众需要看到
 *   「证据长什么样」——官方文档的那一行、面板上的那个数字。
 *
 * 与配图路由 SSOT 一致：真实截图 + 中文标注 > 精致卡片。
 *
 * ⚠️ 素材与坐标的两条铁律（2026-08-01 踩了两版才总结出来）：
 *   1. 截图必须预裁到「显示框比例」再用。显示框 = (width-10%) : (height*0.71)
 *      ≈ 2.25:1。原图若是 4:3，objectFit:contain 会留左右白边，
 *      归一化坐标全部失准。
 *   2. highlights 坐标必须【裁完之后直接量裁后的图】，
 *      不要用「原图坐标 - 裁剪偏移」推算 —— 原图坐标常来自缩放显示的目测，
 *      误差会被裁剪放大（实测偏了 0.1 = 40px，高亮框整体浮到表头上方）。
 *
 * 动画设计：
 *   - 截图整体缓慢推近（Ken Burns），避免死图
 *   - 高亮框按 `at` 逐个弹入（spring），配合口播节奏点出重点
 *   - 可选 focus：镜头推向指定区域，做「拉近看细节」
 */

export interface Highlight {
  /** 相对截图的归一化坐标 0–1 */
  x: number;
  y: number;
  w: number;
  h: number;
  /** 标注文案，显示在框旁边 */
  label?: string;
  /** 出现时机：相对本 slide 的秒数 */
  at?: number;
  color?: "orange" | "green" | "blue" | "red";
  /**
   * 标签相对高亮框的位置。不给则按 x 自动（右半区放下方，否则右侧）。
   *
   * 2026-08-01：自动规则试了三版都不够用——同一行有两个框时左右都没空位（费率面板），
   * 表格行距小时下方会压住下一行数字（DefiLlama 那张五个标签全盖住了下一行）。
   * 「哪里有空」是这张图的事实，组件猜不出来，交给写分镜的人指定。
   */
  labelSide?: "right" | "left" | "below" | "above";
}

export interface ScreenshotSlideProps {
  slideNumber: number;
  totalSlides: number;
  durationInFrames?: number;
  brand?: BrandConfig;

  title?: string;
  /** 截图文件名，相对 public-dir */
  src: string;
  highlights?: Highlight[];
  /** 底部一行说明（数据来源等） */
  caption?: string;
  /** 镜头最终推向的区域（归一化），不给则整图缓慢推近 */
  focus?: { x: number; y: number; w: number; h: number };
  /**
   * 截图的宽高比（宽/高）。给了之后，高亮层会贴着 contain 之后的**实际图片矩形**定位，
   * 截图不必再预裁到显示框比例。
   *
   * 2026-08-01：原设计要求作者把截图裁成显示框比例（≈2.25:1），
   * 结果只要有人调了标题高度或字幕安全区，显示框比例一变，
   * 所有已标好的高亮坐标就集体错位——而且不报错，只是框偏在一边。
   * 把「图片实际画在哪」交给组件算，比让每个作者记住一个会变的数字可靠。
   */
  aspect?: number;
}

const COLORS = {
  orange: "#e8822a",
  green: "#4ade80",
  blue: "#60a5fa",
  red: "#f87171",
} as const;

export const ScreenshotSlide: React.FC<ScreenshotSlideProps> = ({
  slideNumber,
  totalSlides,
  durationInFrames = 150,
  brand,
  title,
  src,
  highlights = [],
  caption,
  focus,
  aspect,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // 截图区：标题占顶部，说明占底部
  //
  // ⚠️ CAPTION_SAFE（2026-08-01 Leo 抽查发现）：字幕层固定在 bottom:220px，
  // 两行中文会顶到 y≈0.70。此前截图区画到 height*0.88，字幕直接压在图上
  // （抵扣率那张的「系统只算九百美元保证金」正好盖住第三行 10% 高亮框）。
  // 画面组件必须为字幕留出这块，不能靠"大概不会撞上"。
  const CAPTION_SAFE = 290;
  const padX = width * 0.05;
  const top = title ? height * 0.15 : height * 0.07;
  const bottom = CAPTION_SAFE + (caption ? 60 : 0);
  const boxW = width - padX * 2;
  const boxH = height - top - bottom;

  // objectFit:contain 之后，图片实际占的矩形（相对 box 左上角）。
  // 没给 aspect 就退回旧行为（假设图片正好填满 box）。
  const boxAR = boxW / boxH;
  const fitW = aspect ? (aspect > boxAR ? boxW : boxH * aspect) : boxW;
  const fitH = aspect ? (aspect > boxAR ? boxW / aspect : boxH) : boxH;
  const offX = (boxW - fitW) / 2;
  const offY = (boxH - fitH) / 2;

  // 整体镜头：无 focus 时缓慢推近；有 focus 时从全景推向该区域
  const t = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateRight: "clamp",
  });
  const eased = 1 - Math.pow(1 - t, 2.2);

  // 缩放原点用像素（相对 box），这样图片层和高亮层能落在同一个坐标系上。
  // focus 是相对**图片**的归一化坐标，先换算到图片矩形内，再加上 contain 的偏移。
  let scale = 1 + 0.06 * eased;
  let originPxX = boxW / 2;
  let originPxY = boxH / 2;
  if (focus) {
    const targetScale = Math.min(2.4, 1 / Math.max(focus.w, focus.h));
    scale = 1 + (targetScale - 1) * eased;
    originPxX = offX + (focus.x + focus.w / 2) * fitW;
    originPxY = offY + (focus.y + focus.h / 2) * fitH;
  }
  const imgOrigin = `${originPxX}px ${originPxY}px`;
  // 高亮层元素本身就是图片矩形，所以原点要减掉 contain 偏移
  const hlOrigin = `${originPxX - offX}px ${originPxY - offY}px`;

  const fadeIn = interpolate(frame, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <BrandedSlideLayout
      slideNumber={slideNumber}
      totalSlides={totalSlides}
      durationInFrames={durationInFrames}
      brand={brand}
    >
      {title ? (
        <div
          style={{
            position: "absolute",
            left: "5%",
            top: "7%",
            fontSize: 52,
            fontWeight: 700,
            color: "#f9fafb",
            letterSpacing: "-0.01em",
            opacity: interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" }),
            transform: `translateY(${interpolate(frame, [0, 14], [14, 0], { extrapolateRight: "clamp" })}px)`,
          }}
        >
          {title}
        </div>
      ) : null}
      <AbsoluteFill>
        <div
          style={{
            position: "absolute",
            left: padX,
            top,
            width: boxW,
            height: boxH,
            borderRadius: 18,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.10)",
            opacity: fadeIn,
            background: "#0a0a0c",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              transform: `scale(${scale})`,
              transformOrigin: imgOrigin,
            }}
          >
            <Img
              src={staticFile(src)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block",
              }}
            />

          </div>
        </div>

        <div
          style={{
            position: "absolute",
            left: padX,
            top,
            width: boxW,
            height: boxH,
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "absolute",
              // 高亮层贴的是 contain 之后的图片矩形，不是整个显示框——
              // 归一化坐标因此始终相对图片本身，显示框比例怎么变都不会错位。
              left: offX,
              top: offY,
              width: fitW,
              height: fitH,
              transform: `scale(${scale})`,
              transformOrigin: hlOrigin,
            }}
          >
            {highlights.map((h, i) => {
              const at = (h.at ?? 0.6 + i * 0.9) * fps;
              const sp = spring({
                frame: frame - at,
                fps,
                config: { damping: 16, stiffness: 140 },
              });
              if (frame < at) return null;
              const c = COLORS[h.color ?? "orange"];
              return (
                <React.Fragment key={i}>
                  <div
                    style={{
                      position: "absolute",
                      left: `${h.x * 100}%`,
                      top: `${h.y * 100}%`,
                      width: `${h.w * 100}%`,
                      height: `${h.h * 100}%`,
                      border: `${3 / scale}px solid ${c}`,
                      borderRadius: 8 / scale,
                      boxShadow: `0 0 0 ${5 / scale}px ${c}26`,
                      transform: `scale(${0.94 + 0.06 * sp})`,
                      opacity: sp,
                    }}
                  />
                  {h.label ? (
                    <div
                      style={{
                        position: "absolute",
                        ...(() => {
                          const side =
                            h.labelSide ?? (h.x + h.w > 0.62 ? "below" : "right");
                          if (side === "left")
                            return {
                              right: `${(1 - h.x) * 100}%`,
                              top: `${h.y * 100}%`,
                              marginRight: 14 / scale,
                            };
                          if (side === "below")
                            return {
                              left: `${h.x * 100}%`,
                              top: `${(h.y + h.h) * 100}%`,
                              marginTop: 10 / scale,
                            };
                          if (side === "above")
                            return {
                              left: `${h.x * 100}%`,
                              bottom: `${(1 - h.y) * 100}%`,
                              marginBottom: 10 / scale,
                            };
                          return {
                            left: `${(h.x + h.w) * 100}%`,
                            top: `${h.y * 100}%`,
                            marginLeft: 14 / scale,
                          };
                        })(),
                        padding: `${8 / scale}px ${14 / scale}px`,
                        background: "rgba(10,10,12,0.94)",
                        border: `${2 / scale}px solid ${c}`,
                        borderRadius: 10 / scale,
                        color: "#fff",
                        fontSize: 26 / scale,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        opacity: sp,
                        transform: `translateX(${(1 - sp) * -12}px)`,
                      }}
                    >
                      {h.label}
                    </div>
                  ) : null}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {caption ? (
          <div
            style={{
              position: "absolute",
              left: padX,
              bottom: CAPTION_SAFE + 8,
              width: boxW,
              color: "#8a8a94",
              fontSize: 24,
              fontFamily: "ui-monospace, Menlo, monospace",
              letterSpacing: "0.04em",
              opacity: fadeIn,
            }}
          >
            {caption}
          </div>
        ) : null}
      </AbsoluteFill>
    </BrandedSlideLayout>
  );
};
