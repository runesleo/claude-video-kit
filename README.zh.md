# claude-video-kit

[English](./README.md) · **中文**

**Video Explainer Kit** 是 AI Agent 使用的**解说视频制作与质量验收工作流**：从研究资料、脚本或已有 MP4 出发，按现有能力选择直接生成、Agent 组合工具，或回退到本仓库的 TTS + 字幕对齐 + Remotion 管线，最后验收成片。

这是我自己做视频用的管线。第一条发出去之后有人问「这怎么做的」，于是抽出来开源。

**适合谁：** 使用 Claude Code、Codex、Cursor 等 AI Agent 制作研究或技术解说视频，并希望流程可复现、成品可独立验收的人。  
**不适合谁：** 期待托管式视频编辑器、Claude 专属 API 产品，或「输入选题 → 保证产出精美 AI 视频」的一键工厂。本仓库提供本地 Remotion 回退和验收工具，**不内置视频生成模型**。

> **[v0.3.0-rc.1](https://github.com/runesleo/claude-video-kit/releases/tag/v0.3.0-rc.1)（公开候选版）：** 可安装 `video-explainer` Skill。`legacy_remotion` 路线的渲染前审稿必须绑定当前 `script.json`；所有制作路线都需要针对最终 MP4 进行验证和独立审核。Skill 不上传、不发帖。

## 作为插件安装

- **Claude Code**（2.1.275 及以上）：`/plugin install video-explainer-kit --marketplace runesleo/x-reader`
- **Codex**：先 `codex plugin marketplace add runesleo/x-reader`，再 `codex plugin add video-explainer-kit@runesleo`

`runesleo` 插件市场里还有 Leo 的其他工具，见 [runesleo/x-reader](https://github.com/runesleo/x-reader)。

## 最快跑出第一条：Agent Skill

```bash
git clone https://github.com/runesleo/claude-video-kit.git
cd claude-video-kit
npm ci --prefix remotion
npx skills add runesleo/claude-video-kit --skill video-explainer
npm run doctor
npm run demo   # 仅适用于带 macOS say 的免 key 演示；自动创建时间戳输出目录

# npm script 只是薄封装，直接跑底层命令等价：
#   node scripts/video-explainer.mjs demo --output /tmp/video-explainer-first-success
```

免 key 的 `demo` 在 **macOS** 上使用本仓库 Remotion 回退：自带 `say` 配音、按脚本时间生成演示字幕，输出 1080×1920 视频并跑客观检查，不会调用付费 API 或上传。**这不是可直接发布的成片**：演示不会运行独立的最终视频审核。真实项目如选择 `legacy_remotion`，需先准备动态分镜，再 `review`、`render`；十一项渲染前审稿任一 `fix` / `block` / 缺失 / 过期都会阻止渲染。审核者判断内容是否通过，程序仅强制留痕与流程。其他制作策略不强制生成旧管线中间文件，但仍需验收最终 MP4 和发布前门禁。

**横屏 8–15 分钟长视频**（HyperFrames + CosyVoice + 逐镜验收）见 **[docs/LONGFORM_HYPERFRAMES_PIPELINE.md](./docs/LONGFORM_HYPERFRAMES_PIPELINE.md)** — 编排脚本在生产 long-form workspace，本仓库提供 TTS / align / 分发等共用模块。  
→ 2026-05-26：**[可考虑升级](./docs/UPGRADE-NOTE-2026-05-26.md)**（编排已在生产 long-form workflow；kit 侧主要是 TTS/文档/slide-review 同步）。

## 核心能力

- **带质量门禁的 Remotion 回退** — 准备好动态分镜和有效审稿回执后，由 `render` 串联 TTS、字幕、时长和 Remotion；macOS 用户首次测试请用 `npm run demo`
- **帧数从音频算，不靠数** — 每个 slide 的时长由生成的 WAV 文件精确决定，永远不会音画错位
- **三种通用 slide，复制即改** — 封面 / 文字 / 代码展示，看不上随时换
- **配音后端明确选择** — `render.sh` 默认 CosyVoice（需 DashScope 密钥及克隆音色 ID）；Fish Audio 要显式设置 `TTS_BACKEND=fish`；IndexTTS2 需要自行配置本地环境；免密钥演示使用 macOS `say`
- **字幕词级精准** — faster-whisper 产出的时间戳烧进视频不跳字
- **Remotion Studio 热更新** — 改组件直接看效果，像改前端一样改视频

## Remotion 回退管线长这样

```
script.json ──▶ TTS ──▶ *.wav ──▶ Whisper 对齐 ──▶ captions.json
                                                          │
                                 build-metadata ◀─────────┘
                                        │
                                        ▼
                                 Remotion 渲染 ──▶ out/full.mp4
```

### 你写的 script.json 长这样

```json
{
  "title": "我的第一条视频",
  "fps": 30,
  "width": 1080,
  "height": 1920,
  "slides": [
    { "type": "cover", "title": "Hello world", "subtitle": "10 秒说清楚" },
    { "type": "text",  "text": "这是我的第一条 AI 视频",
      "voice_text": "这是我用代码做的第一条视频，全程没有录屏。" },
    { "type": "code",  "language": "ts",
      "code": "const video = await kit.render(script);",
      "voice_text": "一行代码，一个视频文件。" }
  ]
}
```

### 首次运行（macOS，免 key）

```bash
npm run demo
```

### 输出仅供验收管线

`out/video-explainer-demo-*/out/full.mp4` 是 1080×1920 的 demo 视频，**不能直接作为发布版**。`examples/my-first/script.json` 是旧版输入示例；缺少正式动态分镜时，不要直接把 `render.sh` 用作新版首次运行命令。

## 安装

```bash
git clone https://github.com/runesleo/claude-video-kit.git
cd claude-video-kit
cd remotion && npm install && cd ..
pip install -r scripts/requirements.txt
cp .env.example .env   # 可选：只有主动选用对应供应商时才填写
```

**让 AI 帮你制作视频**：先让 Agent 阅读 [Skill](skills/video-explainer/SKILL.md) 和 [当前 Quickstart](docs/quickstart.md)；正式项目需要准备分镜、审稿和最终 MP4 验收，不能直接照旧版单脚本示例跳过门禁。

## 依赖

- Node 20+
- Python 3.10+
- ffmpeg（`brew install ffmpeg`）
- **免 key demo：** 需要 macOS 自带 `say`；`demo` 会主动清空 Fish 配置，因此不适合作为 Linux/Windows 的演示入口。
- **正式 Remotion 配音：** 默认 CosyVoice，需要 `DASHSCOPE_API_KEY`、`COSYVOICE_VOICE_ID` 和 Python `dashscope` 依赖；选择 Fish Audio 时，需要自己的密钥与声音 ID，并在启动前**显式设置**环境变量 `TTS_BACKEND=fish`。
- （可选）CUDA GPU：如果你另外配置了本地 IndexTTS2。

[Fish Audio 注册入口](https://fish.audio/?code=VCG6XOES4XIY2)只适用于主动选择该可选后端的用户，并非本项目必需服务。

就这些。不用视频剪辑软件，不用录音设备，不用时间轴思维。

## Slide 类型

| 类型 | 用途 | 必填字段 | 可选字段 |
|------|------|---------|---------|
| `cover` | 封面 / 结束卡 | `title` | `subtitle` |
| `text` | 文字 + 旁白 | `text`, `voice_text` | `voice`、`textMode`（`"hero"` 大字钩子）、`textReveal`（`"spring"` \| `"typewriter"`）、`accentColor` |
| `code` | 代码展示 + 旁白 | `code`, `language`, `voice_text` | `voice` |
| `numberHero` | 大数字数据钩子（短视频） | `heroValue` | `heroLabel`、`heroBadge`、`heroPrefix`、`heroSuffix`、`heroAccentColor` |

**`voice_text`** 是旁白文案，与屏幕上的 `text` 分离。**`voice`** 是在所选配音后端支持时使用的逐镜声音覆盖（Fish Audio 支持；不要假定所有后端表现一致）。

不够用？在 `remotion/src/compositions/` 扔一个新组件，在 `Root.tsx` 注册一下就能用。详见 `docs/quickstart.md`。

## 短视频管线（竖屏 9:16）

Phase 1 加了竖屏短视频管线：1080×1920 画布，密集运动，大字 — 为 YouTube Shorts / 抖音 / TikTok / 小红书 / B 站 Shorts 而生。metadata 里写 `"preset": "shorts"` 一键切换画布 + 字号；正常渲染后跑 `node scripts/verify-shorts.mjs <out.mp4>` 客观验收（4 道硬卡：画布、≤60s、节奏、首 2s 钩子）。slide 类型 schema、字幕配置、节奏指南详见 [`docs/SHORTS_PIPELINE.md`](docs/SHORTS_PIPELINE.md)。

## 仓库里的两个示例

- **`examples/my-first/`** — 3 个 slide 的旧版 `script.json` 示例，并不是新版可直接生产渲染的完整项目；第一次出片请使用 `npm run demo`。
- **`examples/schoger-demo/`** — [我在 X 上发的第一条 AI 视频](https://x.com/runes_leo)的脚本。当作"真实成品长什么样"的参考留着（不含素材，只有脚本）。

## 历史验证（v0.1）

以下是旧版验证记录，不等于对 v0.3.0-rc.1 的所有制作策略完成了全新机器安装验收。v0.1 在 mac (Apple Silicon) 上端到端跑通了 `examples/my-first`，产出 **1080×1920 @ 30fps，8 秒，442 KB** 的竖屏 mp4 — 旁白用 Fish Audio（没 API key 会降级到 macOS `say`），字幕用 Whisper，渲染用 Remotion。中国大陆首次安装需要挂代理，详见 `docs/quickstart.md`。

## 历史限制（v0.1，部分内容可能已更新）

先说清楚什么**不支持**，免得你装完发现和想象的不一样：

- **`say` 仅适合测试，不代表视频可以发布。** 没填 API key 的时候，TTS 会降级到 macOS 自带的 `say`。这条路够你验证整个管线，但有两个真实痛点：(a) 中文多音字会读错，比如 `一行代码` 的"行"会被读成 háng；(b) Whisper `base` 模型对合成腔的字幕对齐差一拍。换高质量配音并重新审核字幕可以改善，但不能仅靠换 TTS 就保证发音与字幕正确。
- 没有自动封面生成器 — 封面就是 `cover` slide 渲出来的样子
- 没有 B-roll / 视频片段支持 — slide 都是静帧 + 音频 + 字幕
- 一条视频一个声音（schema 留了 per-slide 声音覆盖，但还没大量测试）
- IndexTTS2 后端只是占位 — 脚本写了，CUDA 部分留给你自己接
- 中文是主测语言，其他语言能跑但字幕质量取决于 Whisper 模型大小（`base` → `medium` → `large-v3`）

## 最终成片 Release Gate

`video-release-gate` 已并入本仓库，canonical 实现在
[`scripts/video_release_gate.py`](scripts/video_release_gate.py)，质量门槛在
[`config/video_quality_profile.json`](config/video_quality_profile.json)。

保留原有渲染前 receipt、`review-render` 和 `verify-shorts`。所有封面、字幕、音频修改完成后，
对最终 MP4 执行 `evaluate`：三份 QA 必须绑定最终视频 hash，独立终审必须绑定视频及封面 hash，
制作人与审阅人必须不同；再检查响度、静音窗口、封面尺寸和版本化质量门槛。

`build-distribute-pack` 现在必须提供对应平台的 release receipt，写出分发包前自动 `verify`。
任一文件缺失、变更、证据不完整或检查失败都会阻断。下游上传/排期前还须立即复验；
本仓库不新增自动上传、排期或发布，PASS 也不等于发布授权。

完整命令与失败处理见 [最终成片放行指南](docs/RELEASE_GATE.md)。

## v0.2 新增：成片后管线

v0.1 管线到 `out/full.mp4` 就结束了。v0.2 把"每次做视频都得重做一遍"的那几步
写成了可组合的脚本；进入分发交付前必须经过最终放行检查：

- **`scripts/prepend-cover.sh`** — 把一张封面图作为 N 秒前插片头拼到渲染好的
  视频开头（默认 3 秒）。会先读主视频的宽高和帧率，让前插 clip 完全对齐，
  concat 走无损 copy；编码参数不一致才回退到重编码。
- **`scripts/shift-subtitles.py`** — 把 `.srt` 里每条时间戳整体偏移一个固定秒数。
  配合 `prepend-cover.sh` 用——加了片头之后字幕自动跟着往后挪。
- **`scripts/build-distribute-pack.mjs`** — 从 `metadata.json` 累加每个 slide 的
  时长生成章节时间戳，复验通过后每次生成 B站 / 小红书 / 抖音 中一个平台的标题 /
  简介 / 章节 / 标签。合规化用敏感词黑名单过滤（"博彩 / 赌博 / 下注 / 盈利"
  这类），品牌名保留——把品牌名一起抹了 = 把自己从垂类搜索里拿掉。
- **渲染前审稿闸**（旧版 v0.2 的说明；以当前 [Agent Skill](skills/video-explainer/SKILL.md) 为准）
  —— 最初是人工约定，现在 `legacy_remotion` 路线需要绑定脚本 SHA 的独立审核回执，未通过不能渲染。
  TTS + 渲染一轮大概 30 分钟，5 分钟的审稿通常能免掉 2 小时重跑。

旧版 v0.2 串联示例（不是新版首次运行步骤；现在仍需先通过分镜、审稿与最终发布门禁）：

```bash
# 1. 和 v0.1 一样渲染
./scripts/render.sh examples/my-first

# 2. 加封面片头
./scripts/prepend-cover.sh \
  --cover my-cover.png \
  --video examples/my-first/out/full.mp4 \
  --duration 3 \
  --out examples/my-first/out/full-with-cover.mp4

# 3. 对 full-with-cover.mp4 完成 QA、独立终审与 evaluate（见 docs/RELEASE_GATE.md）
# 4. 复验后生成一个平台的交付包；其他平台使用各自的封面、终审与 receipt
node ./scripts/build-distribute-pack.mjs examples/my-first --intro-offset 3 \
  --platform bilibili --video examples/my-first/out/full-with-cover.mp4 \
  --cover examples/my-first/cover-bilibili.png \
  --release-receipt examples/my-first/VIDEO-RELEASE-GATE-bilibili.json
```

`shift-subtitles.py` 是辅助工具——仅当你在 v0.1 管线之外另外维护了一份 `.srt`
文件时（比如 Whisper 独立导出的字幕叠加用），才用到它。v0.1 管线的字幕是
Remotion 渲染阶段直接烧进画面的，不走 srt，所以大部分用户不需要。

```bash
./scripts/shift-subtitles.py \
  --input path/to/captions.srt \
  --offset-seconds 3 \
  --output path/to/captions-with-intro.srt
```

每个脚本都独立可跑——需要哪个用哪个，别的跳过。

## 后续计划

**管线层**
- [ ] v0.3 — AI 生成 B-roll 片段（用 SDXL / 视频模型做视觉变化）
- [ ] v0.4 — 自动封面生成器（按平台出尺寸）
- [ ] v0.5 — 多人对话（一条脚本多个声音）

**新的 slide 类型**
- [ ] 图表 slide（数据 → 动画 SVG）
- [ ] 对比 slide（before/after 那种 Schoger 风）
- [ ] 流程图 slide（Mermaid → 动画展开）

**工具化**
- [ ] 非程序员也能用的 Web UI
- [ ] `kit init` 脚手架命令 — 不用手动复制 examples

**服务化**（规划中）
- [ ] REST 接口 — POST 一份脚本，返回 MP4 文件

## 关于作者

*关于作者：Leo（[@runes_leo](https://x.com/runes_leo)），AI x Crypto 独立构建者。在 [Polymarket](https://polymarket.com/?r=githuball&via=runes-leo&utm_source=github&utm_content=claude-video-kit) 做量化交易，用 Claude Code 和 Codex 搭建数据分析与自动化交易系统。*

[leolabs.me](https://leolabs.me)：文章 · 社群 · 开源工具 · 独立项目 · 全平台账号

[X 订阅](https://x.com/runes_leo/creator-subscriptions/subscribe)：付费内容周更，或请我喝杯咖啡 😁

*Learn in public, Build in public.*

## 数据与网络访问

整套工具在你自己的电脑上运行。没有遥测，不会把任何数据发给作者的服务器。离线 demo（`node scripts/video-explainer.mjs demo`）用 macOS 自带的 `say` 配音、按脚本时长生成字幕，不调用任何 API。

渲染你自己的视频时，数据只会发往你选用的服务：

| 内容 | 发往哪里 |
|---|---|
| 旁白文本，默认 `cosyvoice` 后端 | 阿里云 DashScope（`wss://dashscope.aliyuncs.com`，或 `DASHSCOPE_WS_URL` 指定的地址），使用你的 `DASHSCOPE_API_KEY` |
| 旁白文本，`fish` 后端 | `api.fish.audio`，仅在你设置了 `FISH_AUDIO_API_KEY` 和 `FISH_AUDIO_VOICE_ID` 时；没设置就退回本机 `say` 命令 |
| 旁白文本，`indextts2` 后端 | 不出本机：调用你本地的 IndexTTS2，并关闭联网下载 |
| 旁白文本和你的声音参考音频，可选的 `scripts/modal_tts_batch.py` | Modal，仅在你自己用 `modal run` 运行时；Modal 镜像会克隆 `github.com/index-tts/index-tts` |
| 逐词字幕对齐 | 在本机用 faster-whisper 运行，首次使用时从 Hugging Face 下载 Whisper 模型 |
| 视频渲染 | 在本机用 Remotion 运行，首次渲染时把 Chrome Headless Shell 下载到 `remotion/node_modules` |

安装时会下载你自己装的依赖：Remotion 及相关包来自 npm registry（`npm ci --prefix remotion`），`scripts/requirements.txt` 里的 Python 包（CosyVoice 另需 `dashscope`）来自 PyPI。

配音后端按各自实现读取进程环境变量；Fish Audio 脚本还会尝试加载 `.env`。仅编辑 `.env` **不会自动为 `render.sh` 设置 `TTS_BACKEND`**。只有显式选中某个供应商才会使用相应凭证；免 key demo 会主动清空 Fish 配置。

只保存在你本机的内容：渲染在项目目录里生成的所有文件（`workspace/` 下的音频和字幕、`metadata.json`、`out/full.mp4`、审稿和 gate 回执），demo 输出（默认在工具目录的 `out/video-explainer-demo-*`，或你用 `--output` 指定的路径），以及模型缓存（Whisper 的 Hugging Face 缓存、`remotion/node_modules` 下的 Chrome Headless Shell）。

## 许可

MIT
