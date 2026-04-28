# Shorts Pipeline · SSOT

> **唯一真相源**：claude-video-kit shorts 视频生产的所有标准。任何 session 处理 shorts 任务前必须读这里。
> Last updated: 2026-04-28（Phase 1 + Phase 1.5 验收 by Leo · ai-resume-bias-truth-shorts 作为参考样例）

Phase 1 of claude-video-kit's video format routing: vertical 9:16 short
videos (≤60s, big text, dense motion) for YouTube Shorts / 抖音 / TikTok /
小红书 / B 站 Shorts.

---

## 端到端管线（6 步）

```
1. 写 script.json   →  含 brand + slides (voice_text / caption_text 可选)
2. Modal TTS        →  workspace/NN.wav (A10G fp16, 复用 Leo voice ref)
3. 音频后处理        →  silenceremove + loudnorm（强制，不可省）
4. align.py         →  workspace/captions.json (按 voice_text 一字不差对齐)
5. render + mux     →  remotion render + ffmpeg +faststart
6. 分发包 + 网盘     →  ⚠️ 定稿后强制流程，禁跳
                        ① 4 平台 metadata 全部按定稿文稿同步刷新
                        ② cover.png 重抓（frame ≥1.0s）
                        ③ subtitles-zh.srt 从最新 captions.json 重生
                        ④ 整个 distribute/ 文件夹形式上传百度网盘（禁打包 zip）
```

每步标准在下文。

---

## Step 1 · `script.json` 标准

### Top-level

```jsonc
{
  "title": "...",
  "preset": "shorts",                    // 必填，用 preset 不直接写 width/height
  "fps": 30,
  "brand": {
    "handle": "@runes_leo",
    "url": "leolabs.me",
    "logoSrc": "leo-labs-logo.jpeg",     // 触发水印渲染（实际图源走 inline data URL）
    "accentColor": "#f59e0b"
  },
  "slides": [ ... ]
}
```

### Slide 通用字段

```jsonc
{
  "type": "cover|numberHero|text|content|...",
  "voice_text": "...",        // 实际念稿，IndexTTS2 输入；字幕也基于此
  "caption_text": "..."        // 可选；只有当字幕想简化时才用，默认字幕=voice_text
}
```

### voice_text 写作准则（P0 强制）

1. **逻辑自洽**：不引用前文没出现的数字。视频文稿"裸读"也要从头到尾结构清晰。
   - ❌ 反例："别迷信 95% 那种数字"（前文从未提过 95%）
2. **AI 字母上下文**：单独的 "AI" 在短句易被 IndexTTS2 读成 "A1"。给上下文。
   - ❌ "我是 Leo，AI 实战派"（短句 → 读 A1）
   - ✅ "我是 Leo，专注 AI 和加密领域的实战分享"（上下文给够 → 读对）
3. **长度均匀**：每条 voice_text 字符数尽量均匀，避免某条特别短（<4s）触发语速漂移。
4. **数据 verify**：所有数字必须来自一手论文/工具/数据源，禁凭印象。引用前必须 grep 历史研究记录（违反 P0 `pattern_recall_leo_history_before_content`）。

---

## Step 2 · TTS（Modal A10G）

**Backend**: Modal serverless A10G fp16 + IndexTTS2 commit `830f6f8`（PnL v7 同管线）。

**禁止**: 本地 Mac MPS fp32（音质差、读字母错、语速不稳）。

**Voice ref**: `~/Projects/content/voice-clone/leo_indextts_ref.wav`（Leo cloned voice）

**入口**:
```bash
cd ~/Projects/claude-video-kit
modal run scripts/modal_tts_batch.py --project examples/<name>
```

读 `script.json` → 每 slide 的 `voice_text` 走 IndexTTS2 → 写入 `examples/<name>/workspace/NN.wav`（10 条 ~3min）。

**注**: 脚本不支持 skip-if-exists，单条改动也要全跑。要省时间可改 `voice_text` 后只跑变动条目（手动管理 wav 文件名）。

---

## Step 3 · 音频后处理（P0 强制）

```bash
cd workspace && mkdir -p _orig && cp [0-9]*.wav _orig/
for f in [0-9]*.wav; do
  ffmpeg -y -i _orig/$f \
    -af "silenceremove=stop_periods=-1:stop_duration=0.2:stop_threshold=-40dB,loudnorm=I=-14:TP=-1.5:LRA=11" \
    -ar 24000 $f
done
```

**两个滤镜不可省**：

- `silenceremove=stop_periods=-1:stop_duration=0.2:stop_threshold=-40dB` — 切**尾部** silence/noise tail。否则 IndexTTS2 末尾的低电平 "shhh" 噪音会被 loudnorm 放大听得见。
- `loudnorm=I=-14:TP=-1.5:LRA=11` — 标准化到 -14 LUFS / -1.5 dBTP。这是 YouTube / X / 抖音 / 小红书统一标准。直接用 IndexTTS2 原始输出 mean ~-35 dB 太小，手机外放听不清。

**常见坑**：不要加 `afade=t=out:d=0.001:duration=0` — 这是 invalid syntax，会让 ffmpeg 把整段音频 fade 到 0（mean -78dB ≈ 静音）。

**验证**：
```bash
ffmpeg -i workspace/04.wav -af volumedetect -f null - 2>&1 | grep -E "mean|max"
# 期望: mean ≈ -13 dB, max ≈ -1.5 dB
```

---

## Step 4 · 字幕对齐（align.py）

```bash
python3 scripts/align.py examples/<name>
```

**字幕来源优先级**：`voice_text` > `caption_text` > Whisper transcribe（fallback）。

**默认行为**：字幕跟语音**一字不差**。这是底线——读者就算不开声音也能从字幕看懂。

**caption_text 用途**：仅当 slide 大字（如 numberHero label）已显示完整内容、不需要重复字幕时使用。**慎用**——字幕和语音不一致会让观众困惑。

**输出**: `workspace/captions.json` — 按 wav 真时长 + voice_text 字符比例分配 caption from/to 帧。

---

## Step 5 · Render + faststart mux

```bash
cd ~/Projects/claude-video-kit
node scripts/build-metadata.mjs examples/<name>          # 合并 script + captions → metadata.json

cp examples/<name>/workspace/[0-9]*.wav remotion/public/  # public-dir 配置见下
cp examples/<name>/workspace/captions.json remotion/public/

cd remotion
./node_modules/.bin/remotion render Main /tmp/raw.mp4 \
  --props=$PWD/../examples/<name>/metadata.json

ffmpeg -y -i /tmp/raw.mp4 -c copy -movflags +faststart \
  examples/<name>/out/shorts.mp4
```

**faststart 不可省**：直接用 Remotion 输出的 mp4，moov atom 在文件尾，QuickTime / X 网页 / 抖音播放到中段会卡。`-movflags +faststart` 把 moov atom 移到文件头，保证流式播放。

**Remotion 版本锁**：`4.0.433`（不是 4.0.444 — 后者 staticFile 路径有 regression）。包必须 4 个全锁版本：
```
remotion / @remotion/bundler / @remotion/cli / @remotion/renderer === 4.0.433
```

---

## 视觉标准（shorts preset）

### Preset 系统

```
preset: "shorts"  →  1080×1920 / 30fps / fontScale=1.3 / max 60s
preset: "mid"     →  1920×1080 / 30fps / fontScale=1.0 / max 1200s（Phase 2 stub）
preset: "long"    →  1920×1080 / 30fps / fontScale=0.9 / max 7200s（Phase 3 stub）
```

`fontScale=1.3` 是 Leo 4/28 验收后的最终值（之前 1.6 太大）。

### 字号矩阵（fontScale=1.3 实际像素）

| 元素 | base | 实际 | 占屏宽 |
|---|---|---|---|
| NumberHero 大数字 | 180 | **234pt** | ~30% |
| NumberHero label | 56 | 73pt | 多行换行 |
| NumberHero badge | 32 | 42pt | ~10% |
| Cover title | 80 | **104pt** | ~50% |
| Cover endCard title | 92 | 120pt | ~50% |
| Cover subtitle | 40 | 52pt | ~25% |
| Cover eyebrow | 22 | 29pt | ~14%（Geist Mono uppercase）|
| Caption（字幕）| 38 | **49pt** | ~70% 多行 |

### 字幕（CaptionsLayer）规范

- **字体**：`STHeiti, 'PingFang SC', sans-serif`（Leo 4/28 选定，Mac 系统自带）
- **入场**：spring `damping=8 / stiffness=180 / mass=0.4`，scale `0.55→1`、translateY `50→0`、opacity `0→1`（"蹦"效果，比 fade 更显眼）
- **wrap**：智能自适应
  - ≤12 字符 → 单行不切
  - 否则 `targetLines = min(3, ceil(len/maxChars))`，按 `targetPerLine = ceil(len/targetLines) + 2` 分行
  - **强制 cap 3 行**：超过 3 行的尾行 merge 回第 3 行
- **outline**：4px 黑色描边 + radial blur shadow（保证任何背景可读）
- **位置**：默认 bottom（lower-third，离底部 220px）

### 封面（CoverSlide）规范

- **frame 0 立即可见**：title 和 eyebrow 在 frame 0 就 100% opacity（不靠 spring fade）。否则视频缩略图抓到的是黑屏。
- 仅微 scale entrance（0.96 → 1）
- subtitle / watermark / endCardCTA 仍然 spring fade-in

### Logo / 水印实现

**坑**：Remotion `<Img src={staticFile("xxx.jpeg")}>` 在 4.0.444 上常报 `EncodingError`。即便文件正常 JPEG。

**解法**：base64 inline data URL。
- 数据：`remotion/src/compositions/leoLogoData.ts`（base64 from PnL v7 working 245KB JPEG，md5 `9ff2eb9c5226d234ae6c5aac19e6dda4`）
- 调用：`<Img src={LEO_LOGO_DATA_URL}>`
- BrandedSlideLayout 兼容：传入的 `brand.logoSrc` 若为 raw filename，自动 fallback 到 inline data URL

**位置**：bottom-right，`bottom: 50, right: 50, gap: 14`。Logo 64×64px（fontScale 1），accent border `2px solid ${accentColor}`，圆角 12px。Handle 在 logo 右侧（accent color），URL 在 handle 下方（#9ca3af）。

---

## Slide 类型

### `cover` — 开场 / 收尾

```jsonc
{
  "type": "cover",
  "title": "AI 帮你改简历\n真有用吗？",
  "subtitle": "三个反常识结论",
  "eyebrow": "AAAI 2025 论文解读",      // 可选，Geist Mono uppercase
  "accentColor": "#f59e0b",
  "endCard": false,                       // true 时切到收尾模式
  "endCardCTAs": [                        // endCard=true 时显示
    { "label": "X", "value": "@runes_leo" },
    { "label": "WEB", "value": "leolabs.me" },
    { "label": "TG", "value": "@runesgangalpha" }
  ]
}
```

### `numberHero` — 数据钩子

```jsonc
{
  "type": "numberHero",
  "heroValue": "67-82%",                  // 接受 "67%" / 67 / "67-82%"
  "heroLabel": "AI 偏好 AI 改写过的简历",
  "heroBadge": "真相一",
  "heroAccentColor": "#10b981"
}
```

### `text` with `textMode: "hero"`

```jsonc
{
  "type": "text",
  "textMode": "hero",
  "textReveal": "spring",                 // 或 "typewriter"
  "text": "马里兰 + 俄亥俄州立\nAAAI 2025",
  "accentColor": "#a78bfa"
}
```

### `content` — 列表 / 行动建议

```jsonc
{
  "type": "content",
  "title": "怎么用",
  "bullets": ["用主流 AI 改一遍", "金融/销售/会计 重点", "再试几款不同模型"],
  "badge": "Tip",
  "badgeGradient": ["#f59e0b", "#d97706"]
}
```

---

## Step 6 · 分发包 + 网盘上传（定稿后强制）

视频本体定稿（Leo 验收 OK）后**必须立即做**这一步，禁拖延、禁跳：

### 6.1 同步 4 平台 metadata

每个平台在 `distribute/<platform>/` 下有：title / description-or-正文 / tags。**最终视频文稿改了任何措辞，所有 4 个平台的 description 必须同步更新**。

红线：
- ❌ 平台 description 引用了视频删掉的钩子（如 "95%" strawman）
- ❌ 平台 description 数字与视频实际口播对不上
- ❌ 4 平台描述风格不一（小红书 emoji + 共情 / B 站 ➤ 列表 / YouTube ▸ 列表 + 英文 hashtag / 抖音极短钩子 + 话题）

平台节奏差异：
| 平台 | 标题长度 | description | 风格特点 |
|---|---|---|---|
| YouTube | 中（80 字内）| 长（500-800 字）| ▸ 列表 / 论文链接 / 英文 hashtag |
| Bilibili | 中（80 字内）| 中（300-500 字）| ➤ 列表 / 知识区氛围 / 简洁 |
| 抖音 | 短（50 字内含 hashtag）| 仅话题 | 极致钩子前置 |
| 小红书 | 短（30 字内 emoji）| 中（300 字）| ✅ 列表 / emoji / 共情口吻 |

### 6.2 重生 cover.png + subtitles-zh.srt

```bash
# Cover（frame 1.0s 抓帧，避开 spring 入场动画）
ffmpeg -y -ss 1.0 -i out/shorts.mp4 -vframes 1 -q:v 2 distribute/cover.png

# SRT（基于最新 captions.json）
python3 _build_srt.py
```

### 6.3 网盘上传（文件夹形式，禁 zip）

Leo 在手机上打不开 zip。必须以**文件夹**形式上传：

```bash
# 用 BaiduPCS-Go（已配 Leo 账号）
BaiduPCS-Go upload distribute/ /claude-video-kit/<slug>/distribute/
BaiduPCS-Go upload out/shorts.mp4 /claude-video-kit/<slug>/

# 拿分享链接
BaiduPCS-Go share set /claude-video-kit/<slug>/
```

输出 share URL 给 Leo。

---

## Verification gates

`scripts/verify-shorts.mjs` 4 hard gates：

1. Canvas = 1080×1920
2. Duration ≤ 60s
3. Average scene change ≤ 3.0s
4. ≥1 scene change in first 2s（hook entrance）

```bash
node scripts/verify-shorts.mjs out/shorts.mp4
```

---

## 节奏指南

Shorts viral norm：

- Median scene change: 1.5-2.5s（TikTok / 抖音 dense end）
- YouTube Shorts: 2-4s（slightly slower）
- Hook（first 2s）: big number / reversal / visual surprise — never static
- Subtitle font: 8-12% of canvas height
- Per-slide duration: 1.5-3s, max ~5s for explanation slides

---

## 已知坑（按发生顺序）

| # | 坑 | 修复 |
|---|---|---|
| 1 | local Mac MPS fp32 TTS 把 "AI" 读成 "A1" | 切 Modal A10G fp16 |
| 2 | Whisper 转录中文短语错误率高 | align.py 用 voice_text 直接对齐 |
| 3 | Remotion 4.0.444 `staticFile` EncodingError | 锁 4.0.433 + logo 用 inline data URL |
| 4 | BrandedSlideLayout 用 raw `brand.logoSrc` → 404 | normalize：data:/http: 透传，否则 fallback inline |
| 5 | 视频中段卡 | 强制 ffmpeg `+faststart` mux |
| 6 | wav 末尾 "shhh" 噪音 | silenceremove `stop_periods=-1` |
| 7 | silenceremove + bad afade `duration=0` 把音频 fade 到 0 | 不用 afade，只 silenceremove + loudnorm |
| 8 | 字幕等于 caption_text 跟语音对不上 | align.py 优先 voice_text |
| 9 | Cover frame 0 全透明 → 缩略图黑屏 | title/eyebrow opacity=1 from frame 0 |
| 10 | 字幕被强制切 4 行 | wrap `targetPerLine + 2` + 强制 merge 第 4 行回第 3 行 |
| 11 | 文稿提"95%"前文没出现 → 观众一脸懵 | voice_text 准则：逻辑自洽，裸读能懂 |
| 12 | 没 verify 引用就让 Leo 返工 | 写内容前先 grep 历史研究记录（P0 `pattern_recall_leo_history_before_content`）|

---

## 相关 SSOT

- 全局轻量索引: `~/.claude/memory/video-pipeline-cheatsheet.md`
- TTS 配置参考: `~/.claude/memory/reference_claude_video_kit_tts.md`
- Leo 设计系统: `~/.claude/design-system.md`
- 参考样例: `examples/ai-resume-bias-truth-shorts/`（10 slides / 46s / 8.4MB）

---

## What's not in Phase 1

- Whisper word-level timecode → auto-cut sub-shots from single wav
- Pexels / Pixabay B-roll auto-fetch
- Mid-video / long-video presets and slide types
- LLM script generation from topic → metadata.json
- Font-height-ratio OCR check (verify-shorts soft gate phase 2)
- BGM 自动选配（当前手动 / 留空）
- 字幕语速漂移补偿（IndexTTS2 不同 slide 语速 3.2-5.6 char/s 差异，目前接受）
