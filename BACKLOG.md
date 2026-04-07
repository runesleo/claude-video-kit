# claude-video-kit Backlog

> v2 优化项，做第二条视频时一并落地。

## 来自 2026-04-07 首发推文反馈

### 1. 音频拼接 fade（来源：@yangyi）
**问题**：相邻 TTS 段首尾直接拼接，前段尾部未自然衰减就接下一段 → 爆破音 / pop。
**修法**：每段音频导出时 5-10ms fade-out + fade-in，或段间插入 30-50ms 静音。
**位置**：scripts/ 里音频拼接逻辑。

### 2. AI 自动切句分页（来源：@liyonghelpme8）
**问题**：长段文案需要手动拆成多页 config。
**修法**：根据标点 + 字数阈值（如 ≤40 字/页）自动拆段，每段一页。
**位置**：可做成 scripts/split-text.mjs 预处理脚本。

### 3. BGM + ducking（来源：@liyonghelpme8）
**问题**：纯旁白偏单调。
**修法**：支持 config 里指定 bgm 文件，旁白时自动压低（ducking，-12dB），旁白结束恢复。
**注意**：BGM 版权来源（推荐 YouTube Audio Library / Pixabay）。

---

*下次出第二条视频时一并优化。*
