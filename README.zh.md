# claude-video-kit

[English](./README.md) · **中文**

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

- 没有自动封面生成器 — 封面就是 `cover` slide 渲出来的样子
- 没有 B-roll / 视频片段支持 — slide 都是静帧 + 音频 + 字幕
- 一条视频一个声音（schema 留了 per-slide 声音覆盖，但还没大量测试）
- IndexTTS2 后端只是占位 — 脚本写了，但具体 CUDA 环境差异太大没法通用，留给你自己接
- 中文是主测语言，其他语言能跑但字幕质量取决于 Whisper 模型大小

## 后续计划

**管线层**
- [ ] v0.2 — AI 生成 B-roll 片段（用 SDXL / 视频模型做视觉变化）
- [ ] v0.3 — 自动封面生成器（按平台出尺寸）
- [ ] v0.4 — 多人对话（一条脚本多个声音）

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

Leo（[@runes_leo](https://x.com/runes_leo)）— AI × Crypto 独立构建者。

我用 Claude Code 做两件事：

- **预测市场量化交易** — 在 [Polymarket](https://polymarket.com/?via=runes-leo&r=runesleo&utm_source=github&utm_content=claude-video-kit) 做量化策略和做市。相关工具开源在 [claude-prediction-toolkit](https://github.com/runesleo/claude-prediction-toolkit)
- **内容自动化** — 比如这个 repo。一个人能跑出团队的输出节奏，靠的是把重复环节全部代码化

更多实战分享：[leolabs.me](https://leolabs.me)

## 许可

MIT
