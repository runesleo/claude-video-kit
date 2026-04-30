# Shorts Pipeline · SSOT

> **唯一真相源**：claude-video-kit shorts 视频生产的所有标准。任何 session 处理 shorts 任务前必须读这里。
> Last updated: 2026-04-28（Phase 1 + Phase 1.5 验收 by Leo · ai-resume-bias-truth-shorts 作为参考样例）

Phase 1 of claude-video-kit's video format routing: vertical 9:16 short
videos (≤60s, big text, dense motion) for 抖音 / TikTok / 小红书 / B 站 Shorts.

**YouTube 和 B 站走 API 直发，平行并列，不进网盘交付包**。视频在 X 定稿后：
- YouTube: `~/.config/youtube/upload.py`（OAuth；title / description 在命令里手写）
- B 站:    `~/.config/bilibili/upload.py <project>`（biliup CLI 底层；读 `distribute/bilibili/` metadata；默认 tid=231 科学科普）

网盘交付包**只为抖音 / 小红书**生成（家人代发，封号风险高不做自动化）。

---

## 端到端管线（7 步）

```
1. 写 script.json   →  含 brand + slides (voice_text / caption_text 可选)
2. Modal TTS        →  workspace/NN.wav (A10G fp16, 复用 Leo voice ref)
3. 音频后处理        →  silenceremove + loudnorm（强制，不可省）
4. align.py         →  workspace/captions.json (按 voice_text 一字不差对齐)
5. render + mux     →  remotion render + ffmpeg +faststart
6. 分发包 + 网盘     →  ⚠️ 定稿后强制流程，禁跳
                        ① 3 平台 metadata 全部按定稿文稿同步刷新（B站/抖音/小红书）
                        ② cover.png 重抓（frame ≥1.0s）
                        ③ subtitles-zh.srt 从最新 captions.json 重生
                        ④ 抖音 / 小红书 distribute 文件夹上传百度网盘（家人代发；禁打包 zip）
                           B 站的 distribute/bilibili/ 不进网盘，作 Step 7 的 metadata 来源
7. 平台发布          →  Leo 各一行命令，YouTube + B 站平行 API 直发
                        - YouTube: `python3 ~/.config/youtube/upload.py`
                        - B 站:    `python3 ~/.config/bilibili/upload.py <project>`
                        抖音 / 小红书继续 Step 6 网盘 → 家人代发
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

### 结尾 slide 模板（P0 强制 · 2026-04-30 立）

每个 shorts 必须以两个 slide 结尾：

1. **倒数第二**：内容金句（本期主题相关，可变）
2. **最后**：品牌签名 cover（**固定模板，不可变**）

```jsonc
{
  "type": "cover",
  "title": "@runes_leo · leolabs.me",
  "subtitle": "AI × Crypto 独立构建者",
  "eyebrow": "Learn in public, Build in public",
  "accentColor": "#f59e0b",
  "voice_text": "我是 Leo，做 AI 和加密的独立构建者。在 Polymarket 做量化，用 Claude Code 搭数据和自动化系统。更多在 leolabs.me，下次见。",
  "caption_text": "Polymarket 量化 · Claude Code 搭系统 · leolabs.me"
}
```

参考 `~/Projects/leo-vault/domains/内容创作/_SOP-文章尾部模板.md` 文章版结尾 SSOT。

**禁止**：
- 用最后一帧给外部大佬 / 源头视频引流（流量送给别人）
- 每条视频重新发明结尾文案（品牌识别一致性靠模板）

**外部链接路由**：评论区跟推 + 各平台描述里都可放，不挤进视频帧。

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

**Backend**: Modal serverless A10G fp16 + IndexTTS2 commit `830f6f8`（pinned）。

**禁止**: 本地 Mac MPS fp32（音质差、读字母错、语速不稳）。

**Voice ref**: 通过 `VOICE_REF` 环境变量指向你的 IndexTTS2 cloned voice wav 文件。**永远不要把声纹 wav commit 进 repo** —— 声纹是生物识别信息，git 历史保留即等于公开声纹。

**入口**:
```bash
cd <repo-root>
export VOICE_REF=~/your-voice-ref.wav
modal run scripts/modal_tts_batch.py --project examples/<name>
```

读 `script.json` → 每 slide 的 `voice_text` 走 IndexTTS2 → 写入 `examples/<name>/workspace/NN.wav`（10 条 ~3min）。

### `_good/` wav 复用机制（2026-04-30 立）

IndexTTS2 是非确定性的（sampling temperature）。同样的 voice_text 可能这次念对英文下次念错。**工作流**：

1. 跑 modal_tts → 听一遍
2. 念对的 slide cp 到 `_good/`：`cp workspace/NN.wav workspace/_good/NN.wav`
3. 重跑 modal_tts → 自动跳过 `_good/` 里有的 slide，只重跑念错的
4. 重复直到全部 mark good。从此这条视频再跑 modal cost = 0

`modal_tts_batch.py` 启动时检查 `workspace/_good/<NN>.wav`，存在则直接复用 + 跳过该 slide 的 modal 调用。

### `PRONUNCIATION_FIXES` 字典

`modal_tts_batch.py` 顶部的预处理 dict，在送 IndexTTS2 前替换文本（原 `voice_text` 不动，align/caption 仍用原文）。处理稳定可知的发音问题：

```python
PRONUNCIATION_FIXES = [
    ("leolabs.me", "leolabs点 me"),  # 域名 "." 当中文句号读错节奏
]
```

撞到新发音错的词加一行。**注意**：英文字母组合（如 "AI"）不要加这里——音译"诶艾"/"人工智能"都不自然，靠 `_good/` 多次跑选对的版本。

---

## Step 3 · 音频后处理（P0 强制）

```bash
cd workspace && mkdir -p _orig && cp [0-9]*.wav _orig/
for f in [0-9]*.wav; do
  ffmpeg -y -i _orig/$f \
    -af "areverse,silenceremove=start_periods=1:start_silence=0.3:start_threshold=-40dB,areverse,loudnorm=I=-14:TP=-1.5:LRA=11" \
    -ar 24000 /tmp/out_$f
  mv /tmp/out_$f $f
done
```

**两个滤镜不可省**：

- `areverse → silenceremove start_periods=1 → areverse` — 标准的"只切尾部静音"模式。**不要用 `stop_periods=-1`**（会切所有静音段，吞掉句子之间的自然停顿，2026-04-30 Leo 实测 slide 01 被切 41% 时长）。原理：反转音频让尾部变开头，切第一个静音段，再反转回来。
- `loudnorm=I=-14:TP=-1.5:LRA=11` — 标准化到 -14 LUFS / -1.5 dBTP。YouTube / X / 抖音 / 小红书统一标准。

**常见坑**：
- 不要加 `afade=t=out:d=0.001:duration=0` — invalid syntax，会让 ffmpeg 把整段音频 fade 到 0（mean -78dB ≈ 静音）。
- 不要用 `stop_periods=-1` — 切所有静音段而非只尾部，吞中间停顿。

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
- 数据：`remotion/src/compositions/leoLogoData.ts`（base64 from a working 245KB JPEG，md5 `9ff2eb9c5226d234ae6c5aac19e6dda4`）
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

## Step 5.5 · 审核 stop 门（P0 强制 · 2026-04-30 立）

**Render 后必须 Leo 审视频，禁自动进 Step 6 分发链**。流程：

1. `open <project>/out/full.mp4` 给 Leo 审
2. 等明确"OK / 通过 / 发布"等确认词
3. 通过 → Step 6 分发包 + Step 7 各平台发布
4. 不通过 → 回上游修（script.json / voice_text / slide）→ 重跑

**禁止**：render 完直接调 youtube/upload.py、bilibili/upload.py 或 push X / TG。
**违规事件**：2026-04-30 第一次跑通 #10 视频，render 后直接调 youtube unlisted upload，被 Leo 当场叫停（output 0 byte 没真传）。

---

## 画面素材决策树（按视频类型自动选）

| 视频类型 | 默认画面 | 回避 |
|---------|---------|------|
| **反常识科普 / AI 翻车 demo** | 屏幕录制实际翻车 + 文字卡叠原理（30min 出片） | 纯文字卡（信号低）/ 大佬视频片段（版权 + 剪辑成本） |
| **工具 demo / Build in Public** | 屏幕录制完整流程 + 文字卡叠步骤 | 抽象动画 |
| **观点 / 冷思考** | 文字卡为主 + 必要数据图 | 屏幕录制（无可演示对象） |

## CTA 决策树（按资产可用性自动选）

```
1. 自家 Article / Repo / Skill 已发布 → 链接到自家资产
2. 自家 Article / Repo 已规划但未发布 → "完整版评论区 / 钉推即将更新"
3. 都没有 → 引用源头大佬链接（信用资产，放评论区）+ pin 自己最近相关推
```

视频里**最后一帧**永远是品牌签名 cover（见 Step 1 §结尾 slide 模板），不是任何外部链接。

---

## Step 6 · 分发包 + 网盘上传（定稿后强制）

视频本体定稿（Leo 验收 OK）后**必须立即做**这一步，禁拖延、禁跳：

### 6.1 同步 3 平台 metadata

每个平台在 `distribute/<platform>/` 下有：title / description-or-正文 / tags。**最终视频文稿改了任何措辞，所有 3 个平台的 description 必须同步更新**。

> **YouTube 和 B 站都走 API 直发（Step 7）**，不进网盘。
>
> 网盘交付**只为抖音 / 小红书**（家人代发）。B 站的 `distribute/bilibili/` 文件作为 `~/.config/bilibili/upload.py` 的 metadata 来源使用，本身不上传网盘。

**双文件名约定**（B 站 metadata，build-distribute-pack.mjs 输出 + Leo 手写覆盖）：

| 用途 | 自动生成（stub） | Leo 手写终稿（优先级更高） |
|---|---|---|
| 标题 | `01-title.txt` | `01-标题.txt` |
| 描述 | `02-description.txt` | `02-描述.txt` |
| 章节 | `03-chapters.txt` | `03-章节.txt` |
| 标签 | `04-tags.txt` | `04-标签.txt` |

`upload.py` 优先读中文版（手写更精致），fallback 英文版。

红线：
- ❌ 平台 description 引用了视频删掉的钩子（如 "95%" strawman）
- ❌ 平台 description 数字与视频实际口播对不上
- ❌ 3 平台描述风格不一（小红书 emoji + 共情 / B 站 ➤ 列表 / 抖音极短钩子 + 话题）

平台节奏差异：
| 平台 | 标题长度 | description | 风格特点 |
|---|---|---|---|
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

## Step 7 · 平台发布（YouTube + B 站 API 直发，平行并列 · 2026-04-30 立）

Step 6 完成后，Leo 各跑一行命令完成 YouTube 和 B 站发布。两个平台**平行并列**，没有顺序依赖。

### 7.1 YouTube 直发

```bash
python3 ~/.config/youtube/upload.py
# title / description 在命令里输入
```

依赖：`~/.config/youtube/{client_secret.json, token.json}`（OAuth 已配，token 自动 refresh）

### 7.2 B 站直发

```bash
python3 ~/.config/bilibili/upload.py <project_dir>
# 默认 tid=231 科学科普, copyright=1 自制
# 自动读 distribute/bilibili/ 下 title / desc / tags / chapters
```

依赖：
- `~/.local/bin/biliup` （v0.2.4 binary，aarch64-macos）
- `~/.config/bilibili/cookies.json` （扫码登录生成；过期跑 `cd ~/.config/bilibili/ && ~/.local/bin/biliup login` 重扫）

可选参数：
- `--tid <int>` — 换分区（231=科学科普 / 171=科技数码 / 完整列表查 `https://api.bilibili.com/x/web-interface/zone`）
- `--cover <path>` — 自定义封面（默认查 `cover.png` / `distribute/bilibili/cover.png`，找不到 B 站自动截首帧）
- `--copyright 2 --source <url>` — 转载视频
- `--dry-run` — 只打印参数不上传（首次跑务必 dry-run 验证）

成功输出：BV 号 + aid + 上传线路 + 进入 B 站审核（一般 30min 内过审）。

**首次实测样例**（2026-04-30）：karpathy-9-11-shorts → BV1iw9aBSEpk，14MB / 38s / 0.40 MB/s（bda2 线路）。

### 7.3 抖音 / 小红书

继续走 Step 6 网盘交付链 → 家人手动发布。**不做自动化**：抖音/小红书风控对脚本/cookie 自动化敏感，账号有积累的情况下封号代价 > 自动化收益。

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
| 13 | `silenceremove stop_periods=-1` 切所有静音段（吞中间停顿，slide 01 被切 41%） | 改用 `areverse → silenceremove start_periods=1 start_silence=0.3 → areverse` 只切尾部 |
| 14 | `align.py` 用字符比例分配时间，对 voice_text 含英文专有名词时严重错位 | 新算法 `captions_from_script_whisper_aligned`：whisper word-timestamp 给 timing + voice_text 给文字。`--legacy-char-ratio` 退回旧逻辑 |
| 15 | `split_by_punct` 切 "9.11" / "leolabs.me" 的 `.` → 字幕显示成 "9", "11" | 正则加 lookahead/lookbehind：`(?<![\w\d])\.|\.(?![\w\d])`，前后是字母数字的 `.` 不切 |
| 16 | IndexTTS2 把 "AI" 不稳定读成 "A1"/"I1"，多次跑结果不同 | `_good/<NN>.wav` 复用机制：跑对的 wav cp 到 `_good/`，下次自动跳过 modal。配 `PRONUNCIATION_FIXES` dict 处理域名 `.` 等稳定问题 |
| 17 | 视频结尾用"Karpathy 视频原链接评论区"给外部大佬引流 | P0 强制结尾 cover 模板（@runes_leo / leolabs.me / Polymarket 量化 / Claude Code 搭系统 / Learn in public, Build in public），外部链接一律去评论区跟推 |

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

---

## Roadmap · 视觉模式扩展（v0.2 候选）

当前 shorts 的视觉是「大字标题 + NumberHero + Caption」三件套，简洁但单调。下一轮吸收 X 上几个横屏教学视频的细节装饰模式（典型如 yuanhao 的 yoyo agent 系列），让单条 shorts 的信息密度和视觉节奏更丰富。**只吸收视觉模式，不吸收吉祥物 IP**（IP 资产跟「真人独立构建者」人设冲突）。

### 候选 slide types（按工程难度排）

| 优先级 | 新 slide type | 视觉模式 | 适合内容 |
|-------|--------------|---------|---------|
| P0 | `EyebrowAnchor` | 标题上方加双语小标签锚点（`TODAY'S LESSON` / `THE SHIFT · 转变` / `UNLOCKED · 解锁`），mono caps + 浅色 letter-spacing | 章节切换、阶段性结论 |
| P0 | `DualKeyword` | 单句内同时高亮两个关键词（紫 + 橙双色），扩展现有单色 keyword 高亮 | 反差陈述、对比金句 |
| P1 | `EmojiCard` | emoji icon + 大数字 + 单位（如 📖 + "1,200 页"）边框装饰卡 | 数据点可视化、量级冲击 |
| P1 | `ComparisonCard` | 双卡片左右并列（`CLASSIC AGENTS` vs `NEW WAY`），各带 eyebrow + 主标题 + 注释 | 反常识结论、新旧对比 |
| P2 | `QuoteBlock` | 引用块带 attribution（`— 用户名 · DAY N`），左侧大字号引文 + 右下来源 | 用户反馈、踩坑日记、自我引用 |

### 不做

- 角落角色头像 + SPEAKING 状态条 — 需先建吉祥物 IP，跟真人人设冲突
- 吉祥物 IP 全片贯穿 — 同上
- 横屏 1920×1080 长视频 preset — Phase 3 stub，不在 v0.2 范围

### 验收标准（v0.2 ready）

- 5 个新 slide types 至少落地 3 个（P0 必须，P1 至少 1 个）
- 每个新 type 在 `examples/` 至少有 1 个 demo slide
- `verify-shorts.mjs` 增加新 type 对应的视觉断言（字号 / 占屏比 / 高亮色检查）
- README 更新 "Supported slide types" 列表
