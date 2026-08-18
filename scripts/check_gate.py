#!/usr/bin/env python3
"""check_gate.py — turn PREPRODUCTION-GATE.md claims into assertions against script.json.

Why this exists (2026-08-18): a deck's gate said "~70% real data visualisation,
text-only cards < 30%". The render QA dutifully counted and reported "3/17 = 18%,
well under the 50% red line" — by counting text-laid-out tables as non-text. The
deck shipped with zero charts. The gate was prose, the QA was a judgement call,
and nothing compared the two.

This runs before render and fails loudly when the deck does not match its gate.

Usage:
    python3 check_gate.py <project_dir>            # exit 2 on violation
    python3 check_gate.py <project_dir> --warn     # report only, always exit 0
"""
import json
import re
import sys
from pathlib import Path

# Types that put real, data-driven graphics on screen.
CHART_TYPES = {"barCompare", "rangeSpan", "scatter", "dualColumn", "thresholdGrid"}
# 结构镜：开场、结尾、转场。每条片子必有，不是"本可用图表却用了文字"。
# 把它们计入纯文字卡会让任何片子都超标 —— 一条 15 镜的片子光开场+结尾+转场就占 20%。
STRUCTURAL_TYPES = {"cover", "transition"}
# 纯文字卡：承载论点、本可以数据可视化、却只用了文字排版的镜。
TEXT_TYPES = {"content", "text", "code"}
# Tables sit in between: real numbers, but laid out as text.
TABLE_TYPES = {"table", "formula"}


def parse_gate(gate_path: Path) -> dict:
    """把 gate 的承诺解析成可断言的约束。缺失 → 无约束。

    优先识别**清单式**判据（2026-08-18 起的推荐写法）：gate 用一张表逐项列出
    必须出现的画面及其 slide type，检查器逐个确认 script.json 里真有那个 type。
    百分比判据仍兼容，但不推荐 —— 它随片长漂移，且给了"重新分类蒙混过关"的空间：
    一份要求 70% 数据可视化的片子曾以 0% 出厂，QA 把文字排版的 table 算成了非文字卡，
    报出"18%，红线以内"。清单没有这个空间。
    """
    if not gate_path.exists():
        return {}
    text = gate_path.read_text()
    out = {}

    # 清单式：表格行里带反引号包住的 slide type
    required = re.findall(r"\|\s*[①-⑩\d]+\s*\|[^|]*\|\s*`([A-Za-z]+)`\s*\|", text)
    if required:
        out["required_types"] = required

    m = re.search(r"(?:约\s*)?(\d+)\s*%\s*(?:的\s*)?真实数据可视化", text)
    if m:
        out["min_chart_pct"] = int(m.group(1))
    m = re.search(r"纯文字卡\s*[<＜]\s*(\d+)\s*%", text)
    if m:
        out["max_text_pct"] = int(m.group(1))
    return out


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    project = Path(sys.argv[1])
    warn_only = "--warn" in sys.argv

    script_path = project / "script.json"
    if not script_path.exists():
        print(f"script.json not found: {script_path}", file=sys.stderr)
        return 1

    slides = json.loads(script_path.read_text()).get("slides", [])
    n = len(slides) or 1
    charts = [s for s in slides if s.get("type") in CHART_TYPES]
    texts = [s for s in slides if s.get("type") in TEXT_TYPES]
    tables = [s for s in slides if s.get("type") in TABLE_TYPES]
    structural = [s for s in slides if s.get("type") in STRUCTURAL_TYPES]

    chart_pct = len(charts) / n * 100
    text_pct = len(texts) / n * 100

    gate = parse_gate(project / "PREPRODUCTION-GATE.md")

    print(f"镜数 {n} · 图表 {len(charts)} ({chart_pct:.0f}%) · "
          f"表格/公式 {len(tables)} ({len(tables)/n*100:.0f}%) · "
          f"纯文字 {len(texts)} ({text_pct:.0f}%) · "
          f"结构镜 {len(structural)}（开场/结尾/转场，不计入纯文字卡）")
    if not gate:
        print("PREPRODUCTION-GATE.md 未声明画面构成 → 无约束可检")
        return 0

    violations = []

    # 清单判据优先：逐项确认，缺哪项报哪项
    if "required_types" in gate:
        present = {s.get("type") for s in slides}
        missing = [t for t in gate["required_types"] if t not in present]
        print(f"gate 清单：{len(gate['required_types'])} 项必需画面 · "
              f"已实现 {len(gate['required_types']) - len(missing)} 项")
        for t in gate["required_types"]:
            print(f"   {'✅' if t in present else '❌'} {t}")
        if missing:
            violations.append(f"gate 清单缺 {len(missing)} 项：{', '.join(missing)}")
        # 清单已给出确定判据时，百分比不再作为独立约束
        gate.pop("min_chart_pct", None)

    if "min_chart_pct" in gate and chart_pct < gate["min_chart_pct"]:
        violations.append(
            f"gate 要求真实数据可视化 ≥{gate['min_chart_pct']}%，实际 {chart_pct:.0f}%"
            f"（{len(charts)}/{n} 镜）。"
            f"表格与公式不计入 —— 它们是文字排版的数字，不是数据可视化。"
        )
    if "max_text_pct" in gate and text_pct > gate["max_text_pct"]:
        violations.append(
            f"gate 要求纯文字卡 <{gate['max_text_pct']}%，实际 {text_pct:.0f}%"
            f"（{len(texts)}/{n} 镜）"
        )

    if not violations:
        print("✅ 与 PREPRODUCTION-GATE 声明一致")
        return 0

    print("\n❌ 与 PREPRODUCTION-GATE 声明不符：", file=sys.stderr)
    for v in violations:
        print(f"   · {v}", file=sys.stderr)
    print(f"\n   可用图表类型：{', '.join(sorted(CHART_TYPES))}"
          f"（用法见 remotion/src/compositions/charts/*.tsx 顶部注释）", file=sys.stderr)
    if warn_only:
        print("   (--warn：仅报告，不阻断)", file=sys.stderr)
        return 0
    return 2


if __name__ == "__main__":
    sys.exit(main())
