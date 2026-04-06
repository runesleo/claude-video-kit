# claude-video-kit

> 代码驱动的竖屏短视频管线。写一个 JSON 脚本 → 一条命令出成品。
> **TTS**（Fish Audio / IndexTTS2）+ **字幕对齐**（Whisper）+ **视频即代码**（Remotion）。

[English](./README.md) · [快速上手](./docs/quickstart.md) · [示例](./examples/schoger-demo/)

作者 **[@runes_leo](https://x.com/runes_leo)**，AI × Crypto 独立构建者。这是我每天在用的管线，也是[我第一条 AI 生成短视频](https://x.com/runes_leo)背后的全部代码。

---

## 为什么做这个

竖屏短视频（抖音 / 小红书 / B站 / YouTube Shorts）是当下传播杠杆最高的内容形式，但制作成本太重：录音、拍素材、剪辑、加字幕、导出。大部分创作者第一条之后就放弃了。

这个工具把视频制作变成**"写 JSON 脚本 → 跑一条命令"**。你的内容就是代码 — 可 diff、可版本化、可迭代。如果你本来就住在终端里，这个管线会非常顺手。

```
script.json  ──▶  TTS  ──▶  *.wav  ──▶  Whisper 对齐  ──▶  captions.json
                                                                    │
                                       build-metadata ◀─────────────┘
                                              │
                                              ▼
                                       Remotion 渲染
                                              │
                                              ▼
                                         out/full.mp4
```

## 技术栈

| 层 | 工具 | 为什么选它 |
|---|---|---|
| TTS（默认） | **[Fish Audio](https://fish.audio/?code=VCG6XOES4XIY2)** | 中文声音克隆最强，API 极简。我的邀请链接 — 你我都得积分。 |
| TTS（进阶） | **IndexTTS2**（本地） | 离线免费，需要 GPU。见 `docs/indextts2.md`。 |
| 字幕对齐 | **Whisper**（`whisper.cpp` 或 `faster-whisper`） | 词级时间戳，字幕烧录不跳字。 |
| 视频引擎 | **[Remotion](https://remotion.dev)** | 用 React 写视频。热更新、TypeScript、git 友好。 |

## 安装

```bash
git clone https://github.com/runesleo/claude-video-kit.git
cd claude-video-kit

# Remotion
cd remotion && npm install && cd ..

# Python
pip install -r scripts/requirements.txt

# 环境变量
cp .env.example .env  # 填入 FISH_AUDIO_API_KEY
```

## 快速上手

```bash
# 1. 写脚本
$EDITOR examples/my-first/script.json

# 2. 一条命令走完 TTS + 对齐 + 渲染
./scripts/render.sh examples/my-first

# 3. 成品在 out/full.mp4
```

完整说明见 [`docs/quickstart.md`](./docs/quickstart.md)。

## 脚本格式

```json
{
  "title": "我的第一条视频",
  "width": 1080,
  "height": 1920,
  "fps": 30,
  "slides": [
    { "type": "cover", "title": "核心观点", "subtitle": "30 秒讲清楚" },
    { "type": "text",  "text": "第一点",    "voice": "steady-male" },
    { "type": "code",  "language": "ts", "code": "const x = 1;", "voice": "steady-male" }
  ]
}
```

每个 slide 的时长 **从生成的 WAV 自动计算** — 不需要手动数帧。

## 状态

`v0.1` · 每天在用，但有毛边。关注更新请 Star。

## 路线图

- [ ] v0.2 — AI 生成 B-roll 片段（告别手动录屏）
- [ ] v0.3 — 自动封面生成
- [ ] v0.4 — 多人对话声音
- [ ] v1.0 — 非程序员也能用的 Web UI

## 致谢与邀请链接披露

这个项目默认用 **[Fish Audio](https://fish.audio/?code=VCG6XOES4XIY2)** 做 TTS，链接是邀请码 — 你通过它注册我会拿到积分，对你不额外收费。你也可以用本地 IndexTTS2 绕开它。

另外：如果你对预测市场感兴趣，我在 **[Polymarket](https://polymarket.com/?via=runesleo)**（也是邀请链接）做量化，相关工具开源在 [claude-prediction-toolkit](https://github.com/runesleo/claude-prediction-toolkit)。

## 许可

MIT © Leo ([@runes_leo](https://x.com/runes_leo))

---

<sub>用 [Claude Code](https://claude.com/claude-code) 构建。如果你用这个 kit 做出了东西，欢迎 at 我。</sub>
