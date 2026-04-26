# claude-video-kit

[English](./README.md) · **简体中文（README.zh-CN.md）**

写一份 JSON，产出一条竖屏短视频。没有录屏、没有剪辑、没有时间轴 — 只有代码。

这是我自己做视频用的管线。第一条视频发出去之后，评论区有人问"这怎么做的"，于是我把它抽出来开源了。

## 核心能力

- **一条命令跑完整个管线** — TTS、字幕对齐、帧数计算、Remotion 渲染全自动串联
- **帧数从音频算，不靠数** — 每个 slide 的时长由生成的 WAV 文件精确决定，永远不会音画错位
- **三种通用 slide，复制即改** — 封面 / 文字 / 代码展示，看不上随时换
- **中文语音克隆用 Fish Audio** — 默认声音质量直接可用，本地跑 IndexTTS2 也行（需要 GPU）
- **字幕词级精准** — faster-whisper 产出的时间戳烧进视频不跳字
- **Remotion Studio 热更新** — 改组件直接看效果，像改前端一样改视频

## 管线长这样

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

### 跑一条命令

```bash
./scripts/render.sh examples/my-first
```

### 出来的就是成品

`examples/my-first/out/full.mp4` — 1080×1920 竖屏，音画对齐，字幕烧录好。可以直接发抖音、小红书、B站、YouTube Shorts。

## 安装

```bash
git clone https://github.com/runesleo/claude-video-kit.git
cd claude-video-kit
cd remotion && npm install && cd ..
pip install -r scripts/requirements.txt
cp .env.example .env   # 填 FISH_AUDIO_API_KEY, FISH_AUDIO_VOICE_ID
```

**让 AI 帮你写脚本**：把 `docs/quickstart.md` 和 `examples/schoger-demo/` 丢给你的 AI agent（Claude Code / Cursor / 别的都行），让它照着改。整个管线就四个脚本，任何 agent 读一遍就会用。

## 依赖

- Node 20+
- Python 3.10+
- ffmpeg（`brew install ffmpeg`）
- Fish Audio API key（默认 TTS）— 没有也能跑，会降级到 macOS 的 `say` 命令
- （可选）CUDA GPU，如果你想跑本地 IndexTTS2

没用过 Fish Audio？[这里注册](https://fish.audio/?code=VCG6XOES4XIY2)。中文声音克隆业内最强之一，API 用起来很傻瓜。

就这些。不用视频剪辑软件，不用录音设备，不用时间轴思维。

## 三种 slide 类型

| 类型 | 用途 | 必填字段 | 可选字段 |
|------|------|---------|---------|
| `cover` | 封面 / 结束卡 | `title` | `subtitle` |
| `text` | 文字 + 旁白 | `text`, `voice_text` | `voice` |
| `code` | 代码展示 + 旁白 | `code`, `language`, `voice_text` | `voice` |

**`voice_text`** 是旁白文案 — 和屏幕上的 `text` 字段分开，这样旁白可以比屏幕显示的更自然口语化。**`voice`** 是这一条 slide 单独覆盖的 Fish Audio 声音 ID（不写就用全局默认的）。

不够用？在 `remotion/src/compositions/` 扔一个新组件，在 `Root.tsx` 注册一下就能用。详见 `docs/quickstart.md`。

## 仓库里的两个示例

- **`examples/my-first/`** — 3 个 slide 的极简起手模板。复制这个文件夹，改 `script.json`，渲染，搞定。最快出第一条视频的路径。
- **`examples/schoger-demo/`** — [我在 X 上发的第一条 AI 视频](https://x.com/runes_leo)的脚本。当作"真实成品长什么样"的参考留着（不含素材，只有脚本）。

## 验证过的

v0.1 在 mac (Apple Silicon) 上端到端跑通了 `examples/my-first`，产出 **1080×1920 @ 30fps，8 秒，442 KB** 的竖屏 mp4 — 旁白用 Fish Audio（没 API key 会降级到 macOS `say`），字幕用 Whisper，渲染用 Remotion。中国大陆首次安装需要挂代理，详见 `docs/quickstart.md`。

## v0.1 的局限

先说清楚什么**不支持**，免得你装完发现和想象的不一样：

- **`say` 兜底只用于"管线能跑通"，要发的视频请上 Fish Audio。** 没填 API key 的时候，TTS 会降级到 macOS 自带的 `say`。这条路够你验证整个管线，但有两个真实痛点：(a) 中文多音字会读错，比如 `一行代码` 的"行"会被读成 háng；(b) Whisper `base` 模型对合成腔的字幕对齐差一拍。换成 Fish Audio 的真人声音，两个问题都消失。
- 没有自动封面生成器 — 封面就是 `cover` slide 渲出来的样子
- 没有 B-roll / 视频片段支持 — slide 都是静帧 + 音频 + 字幕
- 一条视频一个声音（schema 留了 per-slide 声音覆盖，但还没大量测试）
- IndexTTS2 后端只是占位 — 脚本写了，CUDA 部分留给你自己接
- 中文是主测语言，其他语言能跑但字幕质量取决于 Whisper 模型大小（`base` → `medium` → `large-v3`）

## v0.2 新增：成片后管线

v0.1 管线到 `out/full.mp4` 就结束了。v0.2 把"每次做视频都得重做一遍"的那几步
写成了独立脚本，用不用随你：

- **`scripts/prepend-cover.sh`** — 把一张封面图作为 N 秒前插片头拼到渲染好的
  视频开头（默认 3 秒）。会先读主视频的宽高和帧率，让前插 clip 完全对齐，
  concat 走无损 copy；编码参数不一致才回退到重编码。
- **`scripts/shift-subtitles.py`** — 把 `.srt` 里每条时间戳整体偏移一个固定秒数。
  配合 `prepend-cover.sh` 用——加了片头之后字幕自动跟着往后挪。
- **`scripts/build-distribute-pack.mjs`** — 从 `metadata.json` 累加每个 slide 的
  时长生成章节时间戳，一次出齐 B站 / YouTube / 小红书 / 抖音 四平台的标题 /
  简介 / 章节 / 标签。合规化用敏感词黑名单过滤（"博彩 / 赌博 / 下注 / 盈利"
  这类），品牌名保留——把品牌名一起抹了 = 把自己从垂类搜索里拿掉。
- **渲染前审稿闸**（见 [`docs/pre-render-review.md`](docs/pre-render-review.md)）
  —— 一个约定，不是代码：文稿进 TTS + 渲染之前，让另一个模型读一遍。
  TTS + 渲染一轮大概 30 分钟，5 分钟的审稿通常能免掉 2 小时重跑。

典型串联用法：

```bash
# 1. 和 v0.1 一样渲染
./scripts/render.sh examples/my-first

# 2. 加封面片头
./scripts/prepend-cover.sh \
  --cover my-cover.png \
  --video examples/my-first/out/full.mp4 \
  --duration 3 \
  --out examples/my-first/out/full-with-cover.mp4

# 3. 生成四平台分发包（章节自动跟着片头偏移）
node ./scripts/build-distribute-pack.mjs examples/my-first --intro-offset 3
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

## 许可

MIT
