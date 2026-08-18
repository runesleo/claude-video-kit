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
# Types that are words on a background, however nicely arranged.
TEXT_TYPES = {"content", "text", "transition", "cover", "code"}
# Tables sit in between: real numbers, but laid out as text.
TABLE_TYPES = {"table", "formula"}


def parse_gate(gate_path: Path) -> dict:
    """Pull the numeric promises out of the gate prose. Absent → no constraint."""
    if not gate_path.exists():
        return {}
    text = gate_path.read_text()
    out = {}
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

    chart_pct = len(charts) / n * 100
    text_pct = len(texts) / n * 100

    gate = parse_gate(project / "PREPRODUCTION-GATE.md")

    print(f"镜数 {n} · 图表 {len(charts)} ({chart_pct:.0f}%) · "
          f"表格/公式 {len(tables)} ({len(tables)/n*100:.0f}%) · "
          f"纯文字 {len(texts)} ({text_pct:.0f}%)")
    if not gate:
        print("PREPRODUCTION-GATE.md 未声明画面构成 → 无约束可检")
        return 0

    violations = []
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
