# claude-video-kit 初版发布 plan

## 目标
把 schoger-remotion 的一次性结构抽成通用 pipeline，开源到 GitHub，
同时建私有分发 skill 服务于 Leo 自己的多平台分发。

## 范围
- 🌍 公开：`claude-video-kit` repo (IndexTTS2 / Fish Audio + Whisper + Remotion)
- 🔒 私有：`~/.claude/skills/video-distribute/` (4 平台素材包生成)
- ⏭ 第一条视频分发素材包（家人手动上传）

## 路径
- repo: `~/Projects/claude-video-kit/`
- skill (公开): `~/.claude/skills/video-auto/` (引用 repo)
- skill (私有): `~/.claude/skills/video-distribute/`

## 关键决策
1. 仓库名 `claude-video-kit`（与 prediction-toolkit 同构，日常用 + 公开同源）
2. TTS 双轨：默认 Fish Audio (affiliate VCG6XOES4XIY2)，进阶 IndexTTS2
3. 不带 schoger 素材，只放代码 + 占位脚本 + 链回 Leo 的 X 发布
4. 4 平台分发：B站 / YouTube / 小红书 / 抖音，素材包人类可读命名

## 文件清单（新建）
**Repo (~16 files)**:
- README.md / README.zh.md
- LICENSE (MIT)
- .gitignore
- package.json (root)
- scripts/tts.py (Fish Audio 调用)
- scripts/tts_indextts2.py (本地占位)
- scripts/align.py (Whisper 字幕对齐)
- scripts/build-metadata.mjs (wav 时长 → metadata.json)
- scripts/render.sh
- remotion/Root.tsx (按 metadata 动态拼)
- remotion/compositions/{TextSlide,CodeSlide,CoverSlide}.tsx
- remotion/package.json
- remotion/remotion.config.ts
- examples/schoger-demo/script.json
- examples/schoger-demo/README.md
- docs/quickstart.md

**Skill 公开 (~2 files)**:
- ~/.claude/skills/video-auto/SKILL.md
- ~/.claude/skills/video-auto/README.md

**Skill 私有 (~3 files)**:
- ~/.claude/skills/video-distribute/SKILL.md
- ~/.claude/skills/video-distribute/templates/{bilibili,youtube,xiaohongshu,douyin}.md

**第一条视频分发包**:
- ~/Projects/content/video/schoger-remotion/distribute/{bilibili,youtube,xiaohongshu,douyin}/
  - 01-标题.txt / 02-简介.txt / 03-标签.txt / 04-视频.mp4 (符号链接)

## 验收
- [ ] repo 本地能 `npm install && npm run render` 出样片（用占位 wav）
- [ ] README 双语，含 Fish Audio + PM affiliate
- [ ] 安全扫描通过（无外发 URL / base64 / eval）
- [ ] skill `/video new <topic>` 能克隆模板
- [ ] 第一条视频 4 平台素材包齐全
- [ ] git init + 首次 commit + push（待 Leo 确认 push 时机）

## 不做
- 真人出镜（管线会断）
- 自动发布（家人手动）
- IndexTTS2 实际集成（占位脚本 + 文档）
- AI 视频片段生成 (v2)
