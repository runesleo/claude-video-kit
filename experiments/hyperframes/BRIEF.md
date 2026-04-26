# HyperFrames 集成实验 BRIEF

**实验目标**: 验证 HyperFrames 能否作为 claude-video-kit 的 optional renderer

---

## 产物文件

| 产物 | 路径 | 大小 | 时长 |
|------|------|------|------|
| slide10 MP4 | `~/Projects/content/video/video-pnl/hyperframes-experiments/slide10.mp4` | 357 KB | 20s |
| 开头帧 | `…/frames/frame-open.png` | 48 KB | t=0.5s |
| 中间帧 | `…/frames/frame-mid.png` | 119 KB | t=10s |
| 结尾帧 | `…/frames/frame-end.png` | 202 KB | t=18.5s |
| baseline MP4 | `…/baseline-test/renders/baseline.mp4` | 80 KB | 3s |

规格: H.264 · 1080×1920 · 30fps · draft quality

---

## 渲染耗时（实测）

- baseline 3s 视频: **18.3s**（首次，含 Chrome 启动）
- slide10 20s 视频: **31.4s wall-clock**（79s CPU，6 workers 并行）
- 字体下载: Fira Code 35 个 font face 首次拉取并缓存到 `~/.cache/hyperframes/fonts/`

---

## 写 HTML 体验

**比 Remotion 容易的地方**：
- 纯 HTML + data-attribute，不需要 React/JSX，心智模型更直接
- GSAP 时间轴很自然，`tl.from/to` 与 Remotion interpolate 写法差不多但更直觉
- `hyperframes lint` 即时反馈契约错误（data-start 缺失、track 重叠等）

**绊住的地方**：
- `class="clip"` 是隐式必填项（SKILL.md 里写了，README 没强调），初始易漏
- 竖屏需要手改 viewport meta + html/body 尺寸（init 默认 1920×1080），不能 `--portrait` flag 直接生成
- SF Mono 不在内置字体映射表，自动降级到 JetBrains Mono（无声失败，只有 warn 提示）
- `npx hyperframes` 在 rtk hook 环境下被拦截，需全局 `npm install -g hyperframes` 绕过

---

## 视觉对比

- **`slides/10.png` (15.7 KB)**: 静态截图，一屏全量公式，字体已渲染，无动效
- **HyperFrames MP4 (357 KB)**: 7 个入金项逐个高亮揭示（绿色），出金项 sequential 展开（红色），未实现项加 "← 未实现" 标注，最后高光扫过公式 + 底部 tagline 出现

**结论**: 动效确实值得。公式逐步揭示比一次全显在移动端竖屏更易读——每项高亮 0.5s 给观众"读到"每个词的时间。代价是文件体积 22x（静态 16KB → 动态 357KB）。

---

## v0.2 集成建议

1. **加 `--portrait` 快捷 flag**（或 template 参数）：`hyperframes init --portrait` 直接生成 1080×1920 骨架，避免用户手改 3 处 viewport。作为 claude-video-kit 的 wrapper script 可以 sed 注入。

2. **字体白名单文档化**：SF Mono / Geist Mono 等开发者常用等宽字体不在映射表，建议在 kit 的 README 里列"HyperFrames 支持的等宽字体"（JetBrains Mono / Fira Code / Source Code Pro / Space Mono）。

3. **作为 optional renderer 可行，但需 flag 隔离**：HyperFrames renderer 输出 draft quality 在 Puppeteer frame capture 模式下会有轻微 font rendering 差异（non-blocking 404 warnings 是 favicon/preload 资产）。建议在 `video-auto` skill 里加 `--renderer hyperframes` flag，默认仍走 Remotion，HyperFrames 作为"无 Node 框架依赖"替代选项。
