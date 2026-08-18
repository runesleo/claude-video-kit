#!/usr/bin/env python3
"""
gen_video_cover.py — Generate dedicated video cover images (not mp4 frame extract).

Inputs:
  <project>/script.json (reads _meta.cover_hook / _meta.cover_sub / cover.title fallback)

Outputs:
  <project>/out/cover-9x16.png    (1080×1920, 主封面 · Shorts/抖音/小红书/B站竖屏)
  <project>/out/cover-1x1.png     (1080×1080, X thumbnail / IG)
  <project>/out/cover-16x9.png    (1920×1080, B 站横屏 / YouTube 缩略图)

Visual system: public defaults with environment overrides.
  - VIDEO_COVER_ACCENT (default #E67E22)
  - VIDEO_COVER_BG_DARK (default #0d1117)
  - VIDEO_COVER_WATERMARK (default @runes_leo · leolabs.me)
  - VIDEO_COVER_FONT_PATH (optional font file)

Templates (script._meta.cover_template):
  - "data_contrast"   #1 数据反差（默认）— giant hook 数字 + 副标题
  - "counter_intuit"  #5 反直觉断言     — "X 说，反了" 风格
  - "rhetorical_q"    #9 反问钩         — "你的 X 是什么？"
  - "single_punch"    #9 单点宣告       — 单句大字
"""
import json
import os
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ACCENT = os.environ.get("VIDEO_COVER_ACCENT", "#E67E22")
BG_DARK = os.environ.get("VIDEO_COVER_BG_DARK", "#0d1117")
PRIMARY = os.environ.get("VIDEO_COVER_PRIMARY", "#F6F7F9")
TEXT_ON_DARK = os.environ.get("VIDEO_COVER_TEXT_ON_DARK", PRIMARY)
TEXT_WEAK = os.environ.get("VIDEO_COVER_TEXT_WEAK", "#9BA3AF")
WATERMARK = os.environ.get("VIDEO_COVER_WATERMARK", "@runes_leo · leolabs.me")


def resolve_font_path() -> str:
    env_path = os.environ.get("VIDEO_COVER_FONT_PATH", "").strip()
    if env_path and Path(env_path).expanduser().exists():
        return str(Path(env_path).expanduser())
    for candidate in (
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/Library/Fonts/Arial Unicode.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        if Path(candidate).exists():
            return candidate
    return ""


FONT_PATH = resolve_font_path()

# === Specs ===
SPECS = {
    "9x16": (1080, 1920),
    "1x1":  (1080, 1080),
    "16x9": (1920, 1080),
}


def make_font(size: int) -> ImageFont.FreeTypeFont:
    if FONT_PATH:
        return ImageFont.truetype(FONT_PATH, size)
    return ImageFont.load_default()


def fit_text(draw: ImageDraw.ImageDraw, text: str, max_w: int, sizes: list[int], font_path: str = FONT_PATH):
    """Find the largest font size where text fits within max_w."""
    for s in sizes:
        f = make_font(s)
        bbox = draw.textbbox((0, 0), text, font=f)
        if (bbox[2] - bbox[0]) <= max_w:
            return f, bbox[2] - bbox[0], bbox[3] - bbox[1], s
    f = make_font(sizes[-1])
    bbox = draw.textbbox((0, 0), text, font=f)
    return f, bbox[2] - bbox[0], bbox[3] - bbox[1], sizes[-1]


def shrink_to_fit(draw, text, max_w, size_max, *, floor_ratio=0.35, label=""):
    """按宽度算出真正装得下的字号，而不是试几档就放弃。

    2026-08-11：原来写成 `for size in [max, .9x, .8x, .7x]: if fits: break`，
    循环跑完没命中也照样往下画 —— 于是 OKXAI 示例封面的 `incomplete`
    在 9:16 上被画出画布，左右各截掉一截，屏幕上剩 `comple`。
    截断不只是难看：`incomplete`(对不上) 被截成看起来像 `complete`(通过)，
    **封面把整条片子的结论说反了**，而生成器一声不吭。

    版式当初是给 `+128%` `95%` 这种短数字设计的，英文单词一进来就漏。
    字宽随字号近似线性，所以先量一次再按比例缩，一步到位；
    收窄到 floor_ratio 以下说明这个词根本不该放这个位置，出声警告。
    """
    lo, hi = int(size_max * floor_ratio), size_max
    best = lo
    while lo <= hi:                      # 二分，字宽对字号单调
        mid = (lo + hi) // 2
        bbox = draw.textbbox((0, 0), text, font=make_font(mid))
        if (bbox[2] - bbox[0]) <= max_w:
            best, lo = mid, mid + 1
        else:
            hi = mid - 1

    f = make_font(best)
    bbox = draw.textbbox((0, 0), text, font=f)
    w = bbox[2] - bbox[0]
    if w > max_w:
        # 到了地板还是超宽 —— 只有这时才可能溢出，必须让人看见
        print(f"  ⚠️  封面{label}「{text}」到最小字号 {best}px 仍超宽 "
              f"({w} > {max_w})，会被裁。换更短的词。", flush=True)
    elif best < size_max * 0.6:
        print(f"  ⚠️  封面{label}「{text}」被压到 {best}px "
              f"（上限 {size_max}px 的 {best/size_max:.0%}），视觉冲击已经没了。", flush=True)
    return f, w, bbox[3] - bbox[1]


def _render_data_contrast(img, draw, W, H, data, accent_h):
    """Plan A 数字反差版式 — Leo article 招牌:
    layout (9x16 1080×1920):
       [顶条]
       top_label  (TEXT_WEAK 中字)
       TOP_NUM    (灰色超大字 ~360px, 占屏 19%)
       ─── punch ───   (橙色中字 + 横线)
       BOTTOM_NUM (橙色超大字 ~440px, 占屏 23%)
       bottom_label (TEXT_ON_DARK 中字)
       tail       (TEXT_WEAK 弱小字)
       leolabs.me ...
       [底条]
    """
    side_pad = int(W * 0.06)
    max_w = W - side_pad * 2

    top_label = data.get("top_label", "")
    top_num = data.get("top_num", "")
    punch = data.get("punch", "")
    bottom_num = data.get("bottom_num", "")
    bottom_label = data.get("bottom_label", "")
    tail = data.get("tail", "")
    tag = data.get("tag", "leolabs.me · AI × Crypto")

    # 上方留 ~12% 空间用于装饰条 + 顶部 label
    y_cursor = int(H * 0.10)

    # === top_label（小字）===
    if top_label:
        f = make_font(int(H * 0.024))  # ≈46px
        bbox = draw.textbbox((0, 0), top_label, font=f)
        lw = bbox[2] - bbox[0]
        draw.text(((W - lw) // 2, y_cursor), top_label, fill=TEXT_WEAK, font=f)
        y_cursor += int(H * 0.034)

    # === TOP_NUM (灰色超大字 - "被抢的") ===
    # 自适应字号 - 按 H 缩放（9:16 H=1920 → ~360, 16:9 H=1080 → ~200）
    top_size_max = int(H * 0.19)
    f_top, lw, th = shrink_to_fit(draw, top_num, max_w, top_size_max, label="top_num")
    draw.text(((W - lw) // 2, y_cursor), top_num, fill="#3a3f47", font=f_top)
    y_cursor += int(th + H * 0.018)

    # === punch line + 横分隔（橙色反共识）===
    if punch:
        # 装饰横线两边
        f_p = make_font(int(H * 0.04))  # ≈77px
        bbox = draw.textbbox((0, 0), punch, font=f_p)
        pw = bbox[2] - bbox[0]
        line_gap = 28
        line_w = (W - pw - line_gap * 4) // 2
        line_y = y_cursor + int(H * 0.025)
        # left line
        draw.rectangle([(side_pad, line_y - 3), (side_pad + line_w, line_y + 3)], fill=ACCENT)
        # right line
        draw.rectangle([(W - side_pad - line_w, line_y - 3), (W - side_pad, line_y + 3)], fill=ACCENT)
        # punch text
        draw.text(((W - pw) // 2, y_cursor), punch, fill=ACCENT, font=f_p)
        y_cursor += int(H * 0.072)

    # === BOTTOM_NUM (橙色超大字 - "你留的") - 按 H 缩放 ===
    bot_size_max = int(H * 0.23)
    f_bot, lw, th = shrink_to_fit(draw, bottom_num, max_w, bot_size_max, label="bottom_num")
    draw.text(((W - lw) // 2, y_cursor), bottom_num, fill=ACCENT, font=f_bot)
    y_cursor += int(th + H * 0.02)

    # === bottom_label ===
    if bottom_label:
        f = make_font(int(H * 0.032))  # ≈61px
        bbox = draw.textbbox((0, 0), bottom_label, font=f)
        lw = bbox[2] - bbox[0]
        draw.text(((W - lw) // 2, y_cursor), bottom_label, fill=TEXT_ON_DARK, font=f)
        y_cursor += int(H * 0.04)

    # === tail (弱小字 · 副信息：出处/Dario) ===
    if tail:
        f = make_font(int(H * 0.022))  # ≈42px
        for line in _wrap_lines(tail, 22):
            bbox = draw.textbbox((0, 0), line, font=f)
            lw = bbox[2] - bbox[0]
            draw.text(((W - lw) // 2, y_cursor), line, fill=TEXT_WEAK, font=f)
            y_cursor += int(H * 0.026)

    # === 底部 tag + watermark ===
    tag_size = max(22, int(H * 0.022))
    f_tag = make_font(tag_size)
    bbox = draw.textbbox((0, 0), tag, font=f_tag)
    tw = bbox[2] - bbox[0]
    draw.text(((W - tw) // 2, H - tag_size * 3 - accent_h), tag, fill=TEXT_WEAK, font=f_tag)

    wm_size = max(20, int(H * 0.018))
    f_wm = make_font(wm_size)
    bbox = draw.textbbox((0, 0), WATERMARK, font=f_wm)
    ww = bbox[2] - bbox[0]
    draw.text((W - ww - side_pad // 2, H - wm_size * 2 - accent_h), WATERMARK, fill="#666666", font=f_wm)

    return img


def render_cover(spec_name: str, hook: str, sub: str, tag: str, template: str = "data_contrast", data: dict = None) -> Image.Image:
    """Render one cover. spec_name: '9x16' / '1x1' / '16x9'.

    template:
      - data_contrast / counter_intuit (default 数据反差 + 反共识) — 数字上下层次 + 中间反转 punch
      - rhetorical_q (反问钩) — 巨大反问句
      - single_punch (单点宣告) — 一句大字
    data: dict 可选，data_contrast 用：
      {top_num: "95%", top_label: "被 AI 抢的", punch: "反了。", bottom_num: "5%", bottom_label: "你留下的判断", tail: "Dario · 产出反而 × 20"}
    """
    W, H = SPECS[spec_name]
    img = Image.new("RGB", (W, H), BG_DARK)
    draw = ImageDraw.Draw(img)

    # Subtle gradient overlay (top darker)
    for y in range(H):
        a = int(40 * (1 - y / H))
        draw.line([(0, y), (W, y)], fill=(a, a, a))

    # Accent bar top
    accent_h = max(4, H // 240)
    draw.rectangle([(0, 0), (W, accent_h)], fill=ACCENT)
    # Accent bar bottom
    draw.rectangle([(0, H - accent_h), (W, H)], fill=ACCENT)

    # === data_contrast 专用版式（Leo article 招牌风格 · 数字反差 + 视觉锚 + 层次）===
    if template in ("data_contrast", "counter_intuit") and data and data.get("top_num") and data.get("bottom_num"):
        return _render_data_contrast(img, draw, W, H, data, accent_h)

    # Hook (giant, ACCENT)
    is_portrait = H > W
    side_pad = int(W * 0.08)
    max_w_hook = W - side_pad * 2

    # 多行 hook（用 \n 拆）
    hook_lines = hook.split("\n")
    if is_portrait:
        # 竖屏：每行字号根据长度自适应，最多 3 行
        hook_sizes = [220, 200, 180, 160, 140, 120, 100]
    else:
        # 1:1 / 16:9 用稍小
        hook_sizes = [180, 160, 140, 120, 100, 90, 80]

    # 计算每行字号（取最严苛行决定，统一）
    chosen_size = hook_sizes[-1]
    for s in hook_sizes:
        f = make_font(s)
        if all(draw.textbbox((0, 0), line, font=f)[2] <= max_w_hook for line in hook_lines):
            chosen_size = s
            break
    f_hook = make_font(chosen_size)
    line_h = int(chosen_size * 1.18)
    total_hook_h = line_h * len(hook_lines)

    # 副标题 sub（淡灰，约 hook 字号的 25-30%）
    sub_sizes_factor = 0.26 if is_portrait else 0.3
    sub_size = int(chosen_size * sub_sizes_factor)
    sub_size = max(28, min(sub_size, 72))
    # 自动换行 sub（每行 ~18 中文字符或自然换行）
    sub_lines = sub.split("\n") if "\n" in sub else _wrap_lines(sub, 18 if is_portrait else 26)
    f_sub = make_font(sub_size)
    sub_line_h = int(sub_size * 1.4)
    total_sub_h = sub_line_h * len(sub_lines)

    # 计算整组（hook + 间距 + sub）的 y 起点（视觉重心略上 5%）
    gap = int(H * 0.04)
    group_h = total_hook_h + gap + total_sub_h
    y_start = (H - group_h) // 2 - int(H * 0.05)

    # 画 hook
    for i, line in enumerate(hook_lines):
        bbox = draw.textbbox((0, 0), line, font=f_hook)
        lw = bbox[2] - bbox[0]
        draw.text(((W - lw) // 2, y_start + i * line_h), line, fill=ACCENT, font=f_hook)

    # 画 sub
    y_sub = y_start + total_hook_h + gap
    for i, line in enumerate(sub_lines):
        bbox = draw.textbbox((0, 0), line, font=f_sub)
        lw = bbox[2] - bbox[0]
        draw.text(((W - lw) // 2, y_sub + i * sub_line_h), line, fill=TEXT_ON_DARK, font=f_sub)

    # Bottom tag
    tag_size = max(22, int(H * 0.022))
    f_tag = make_font(tag_size)
    bbox = draw.textbbox((0, 0), tag, font=f_tag)
    tw = bbox[2] - bbox[0]
    draw.text(((W - tw) // 2, H - tag_size * 3), tag, fill=TEXT_WEAK, font=f_tag)

    # Watermark right-bottom
    wm_size = max(20, int(H * 0.018))
    f_wm = make_font(wm_size)
    bbox = draw.textbbox((0, 0), WATERMARK, font=f_wm)
    ww = bbox[2] - bbox[0]
    draw.text((W - ww - side_pad // 2, H - wm_size * 2 - accent_h), WATERMARK, fill="#666666", font=f_wm)

    return img


def _wrap_lines(text: str, max_chars: int) -> list[str]:
    """Simple CJK-friendly wrap: cut at max_chars boundary, prefer break at space/comma."""
    if len(text) <= max_chars:
        return [text]
    out = []
    i = 0
    while i < len(text):
        end = min(i + max_chars, len(text))
        if end < len(text):
            # 找最近的标点/空格回退
            for off in range(0, min(6, end - i)):
                c = text[end - off - 1]
                if c in "，。、 ·":
                    end = end - off
                    break
        chunk = text[i:end].strip("，。 ")
        if chunk:
            out.append(chunk)
        i = end
    return out


def main():
    if len(sys.argv) < 2:
        print("usage: gen_video_cover.py <project_dir>", file=sys.stderr)
        return 1
    project = Path(sys.argv[1]).resolve()
    sj = project / "script.json"
    if not sj.exists():
        print(f"missing {sj}", file=sys.stderr)
        return 1
    script = json.loads(sj.read_text())
    meta = script.get("_meta", {}) or {}

    # Inputs (priority: _meta.cover_hook > cover.title)
    hook = meta.get("cover_hook")
    if not hook:
        cover_slide = next((s for s in script.get("slides", []) if s.get("type") == "cover"), None)
        hook = (cover_slide or {}).get("title", script.get("title", "标题")) if cover_slide else script.get("title", "标题")
    sub = meta.get("cover_sub", "")
    if not sub:
        cover_slide = next((s for s in script.get("slides", []) if s.get("type") == "cover"), None)
        sub = (cover_slide or {}).get("subtitle", "") if cover_slide else ""
    tag = meta.get("cover_tag", "leolabs.me · AI × Crypto")
    template = meta.get("cover_template", "data_contrast")
    cover_data = meta.get("cover_data") or {}
    cover_data.setdefault("tag", tag)

    out_dir = project / "out"
    out_dir.mkdir(exist_ok=True)

    # 2026-05-15 Leo 训：各平台封面尺寸不一样必须分发：
    #   - 9:16（1080×1920）→ 抖音 / 小红书（feed 竖屏流）
    #   - 16:9（1920×1080）→ B 站 / YouTube（即使竖屏视频，平台 thumbnail 都是 16:9 卡片）
    # 默认生成两套，distribute 阶段按平台 link 正确尺寸
    extra_sizes = meta.get("cover_extra_sizes", []) or []
    specs_to_render = ["9x16", "16x9"] + [s for s in extra_sizes if s in SPECS and s not in ("9x16", "16x9")]

    print(f"[gen_video_cover] hook={hook!r}", flush=True)
    print(f"[gen_video_cover] sub={sub!r}", flush=True)
    print(f"[gen_video_cover] template={template}", flush=True)
    print(f"[gen_video_cover] specs={specs_to_render}", flush=True)

    for spec in specs_to_render:
        img = render_cover(spec, hook, sub, tag, template, cover_data)
        path = out_dir / f"cover-{spec}.png"
        img.save(str(path), "PNG", quality=95)
        print(f"  -> {path} ({SPECS[spec][0]}×{SPECS[spec][1]})", flush=True)

    # 兼容：copy 9x16 到 project root cover.png（distribute 期望）
    import shutil
    shutil.copy(out_dir / "cover-9x16.png", project / "cover.png")
    print(f"  -> {project / 'cover.png'} (alias 9x16)", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
