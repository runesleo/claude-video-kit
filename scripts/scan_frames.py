#!/usr/bin/env python3
"""scan_frames.py — 逐帧扫描内容是否跑出画布安全区。

⚠️ 能力边界（2026-08-18 用阳性对照标定，**读完再决定要不要信它**）：
    本脚本只能发现「元素跑到画布外」，**不能**发现「元素互相重叠」。
    而实测中真正出现的三处布局缺陷 —— badge 文字压住标题、倍数标签压住轨道、
    字幕盖住柱形 —— 全部属于后者：它们都**在安全区之内**，只是彼此叠了。

    阳性对照（作废旧片，含 3 处已知 badge 溢出）：
      thresh=26 → 35 帧报警，逐帧核对全为背景光晕误报，真问题检出 0
      thresh=70 → 4 帧报警（开场动画），3 处已知溢出**全部漏检**
    低阈值全是噪声，高阈值直接失聪，中间不存在可用区间 —— 因为判据本身对不上问题类型。

    因此本脚本**不接入 render.sh，不作为发布门**。
    要真正拦住重叠与裁切，正确做法是渲染期的 DOM 断言
    （scrollWidth > clientWidth 判裁切；元素 bbox 相交判重叠），
    Remotion 渲染时可拿到真实 DOM 尺寸，既准确又零误报 —— 尚未实现。

    留着它的唯一理由：出血（内容真跑到画布外）它确实能抓，而那类问题肉眼反而容易忽略。

原始说明：

为什么存在（2026-08-18）：
成片自检此前靠抽几帧人眼看。抽样能发现的问题，取决于恰好抽到哪一帧 ——
而动画是有时间维度的：spring 早期元素是缩小的，count-up 中途数字宽度在变，
溢出往往只发生在某个瞬间。一条 4 分钟片子里，实测有三处布局问题
（数值被右缘裁断、倍数标签压住轨道、字幕盖住柱形）全部是靠肉眼偶然撞见的。

本脚本按固定间隔取帧（默认每 0.5 秒），对每帧求非背景像素的包围盒，
与设计系统的安全区比对。它查的是"有没有东西跑到不该在的地方"，
不判断好不好看 —— 后者仍需人眼，见 --sheet 产出的审片表。

用法：
    python3 scan_frames.py <video.mp4>                 # 扫描并报告
    python3 scan_frames.py <video.mp4> --every 0.25    # 加密采样
    python3 scan_frames.py <video.mp4> --sheet <dir>   # 另外导出每镜 3 帧供人眼审
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("需要 Pillow：pip install Pillow", file=sys.stderr)
    raise SystemExit(1)

KIT = Path(__file__).resolve().parent.parent
DS = json.loads((KIT / "config" / "design-system.json").read_text())
SAFE_X = DS["layout"]["safeAreaX"]
SAFE_Y = DS["layout"]["safeAreaY"]
# 顶部品牌渐变条横贯全宽，是设计元素不是溢出。不排除它，包围盒永远满幅：
# 首次运行 263 帧报 169 帧越界，全部源于此。
BRAND_BAR = DS["layout"].get("brandBarHeight", 0)
# 允许触到安全区边界本身，只有越过才算问题；再放 8px 容差吸收抗锯齿。
TOL = 8


def probe_duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True,
    ).stdout.strip()
    return float(out or 0)


def bbox_of(img: Image.Image, bg, thresh: int = 70, skip_top: int = 0):
    """高对比元素（文字/图形）的包围盒。

    thresh 必须高到能忽略背景装饰：本设计系统用大面积柔和径向光晕，
    低阈值会把光晕算成内容，于是包围盒常年满幅 —— 2026-08-18 实测 thresh=26
    时 263 帧报 35 帧越界，逐帧看全是光晕，无一真实溢出。
    阈值以作废旧片作阳性对照标定：该片有 3 处已知 badge 溢出，
    调高后仍须能检出，否则就是把探测器调聋了。
    """
    small = img.convert("RGB")
    w, h = small.size
    px = small.load()
    step = 2  # 半采样，够用且快一倍
    minx, miny, maxx, maxy = w, h, -1, -1
    for y in range(skip_top, h, step):
        for x in range(0, w, step):
            r, g, b = px[x, y]
            if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) > thresh:
                if x < minx: minx = x
                if x > maxx: maxx = x
                if y < miny: miny = y
                if y > maxy: maxy = y
    if maxx < 0:
        return None
    return (minx, miny, maxx, maxy)


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    video = Path(sys.argv[1])
    if not video.exists():
        print(f"找不到 {video}", file=sys.stderr)
        return 1
    every = 0.5
    if "--every" in sys.argv:
        every = float(sys.argv[sys.argv.index("--every") + 1])

    dur = probe_duration(video)
    n = int(dur / every)
    print(f"{video.name} · {dur:.1f}s · 每 {every}s 取一帧 → {n} 帧")
    print(f"安全区：左右 {SAFE_X}px 上下 {SAFE_Y}px（容差 {TOL}px）\n")

    violations = []
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td) / "f.png"
        for i in range(n):
            t = i * every
            subprocess.run(
                ["ffmpeg", "-y", "-ss", str(t), "-i", str(video), "-frames:v", "1",
                 "-vf", "scale=960:-1", str(tmp), "-loglevel", "error"],
                check=False,
            )
            if not tmp.exists():
                continue
            im = Image.open(tmp)
            scale = im.width / DS["layout"]["width"]
            bg = im.convert("RGB").getpixel((3, max(4, int(BRAND_BAR * scale) + 2)))
            if not isinstance(bg, tuple) or len(bg) < 3:
                continue                      # 非 RGB 帧（极少见）直接跳过，不猜
            bb = bbox_of(im, bg, skip_top=max(2, int(BRAND_BAR * scale) + 1))
            if not bb:
                continue
            # 换算回 1920 坐标系
            x0, y0, x1, y1 = [v / scale for v in bb]
            over = []
            if x0 < SAFE_X - TOL: over.append(f"左 {SAFE_X - x0:.0f}px")
            if x1 > DS["layout"]["width"] - SAFE_X + TOL:
                over.append(f"右 {x1 - (DS['layout']['width'] - SAFE_X):.0f}px")
            if y0 < SAFE_Y - TOL: over.append(f"上 {SAFE_Y - y0:.0f}px")
            if y1 > DS["layout"]["height"] - SAFE_Y + TOL:
                over.append(f"下 {y1 - (DS['layout']['height'] - SAFE_Y):.0f}px")
            if over:
                violations.append((t, over))

    if not violations:
        print("✅ 全部采样帧内容均在安全区内")
        return 0

    # 连续帧合并成区间，避免同一处问题刷屏
    merged = []
    for t, over in violations:
        if merged and t - merged[-1][1] <= every * 1.5 and merged[-1][2] == over:
            merged[-1][1] = t
        else:
            merged.append([t, t, over])

    print(f"⚠️ {len(violations)} 帧越界，合并为 {len(merged)} 处：")
    for a, b, over in merged:
        span = f"{a:.1f}s" if a == b else f"{a:.1f}–{b:.1f}s"
        print(f"   · {span:>16}  超出：{', '.join(over)}")
    print("\n注：越界不等于一定有问题（满幅背景、贴边设计会误报），"
          "但每一处都该看一眼对应帧再放行。")
    return 2


if __name__ == "__main__":
    sys.exit(main())
