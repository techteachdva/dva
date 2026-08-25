#!/usr/bin/env py
"""Analyze WriteFlow CSV export for grade-relative typing calibration."""
import argparse
import csv
import json
import re
import statistics
from collections import defaultdict
from pathlib import Path

MIXED = {
    "Tech: Media Arts",
    "Tech: Game Design",
    "Tech: Video Production",
}


def grade_from_classroom(classroom: str):
    c = (classroom or "").strip()
    if c in MIXED or c.lower() == "teacher's lounge":
        return None
    m = re.search(r"Tech\s+(\d)-", c, re.I)
    if m:
        return int(m.group(1))
    m = re.search(r"(\d)th\s+Grade", c, re.I)
    if m:
        return int(m.group(1))
    return None


def parse_analysis(row):
    try:
        return json.loads(row.get("analysisJson") or "{}")
    except json.JSONDecodeError:
        return {}


def typing_composite(wpm, grammar, syntax):
    conventions = (grammar + syntax) / 2
    return wpm * 0.55 + conventions * 0.45


def grade_relative_score(composite, floor_composite, ceil_composite):
    span = max(ceil_composite - floor_composite, 1)
    t = (composite - floor_composite) / span
    return max(10, min(100, round(10 + t * 90)))


def pct(values, p):
    if not values:
        return None
    s = sorted(values)
    i = (len(s) - 1) * p
    lo = int(i)
    hi = min(lo + 1, len(s) - 1)
    if lo == hi:
        return s[lo]
    return s[lo] + (s[hi] - s[lo]) * (i - lo)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "csv_path",
        nargs="?",
        default=str(Path.home() / "Downloads" / "WriteFlow Studio Backend Data - Submissions.csv"),
    )
    args = parser.parse_args()
    path = Path(args.csv_path)
    if not path.exists():
        raise SystemExit(f"Missing {path}")

    rows = []
    with path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            grade = grade_from_classroom(row.get("classroom"))
            if grade is None:
                continue
            analysis = parse_analysis(row)
            grammar = analysis.get("grammar", {}).get("score") or 0
            syntax = analysis.get("syntax", {}).get("score") or 0
            wpm = float(row.get("wpm") or analysis.get("wpm") or 0)
            scores = analysis.get("scores") or {}
            rows.append(
                {
                    "grade": grade,
                    "name": row.get("name"),
                    "classroom": row.get("classroom"),
                    "wpm": wpm,
                    "wordCount": int(row.get("wordCount") or analysis.get("wordCount") or 0),
                    "grammar": grammar,
                    "syntax": syntax,
                    "composite": typing_composite(wpm, grammar, syntax),
                    "typing": scores.get("typing"),
                    "mechanics": scores.get("mechanics"),
                    "story": scores.get("story"),
                    "overall": scores.get("overall"),
                }
            )

    by_grade = defaultdict(list)
    for r in rows:
        by_grade[r["grade"]].append(r)

    print(f"Analyzed {len(rows)} submissions across grades {sorted(by_grade)}")
    suggested_p90 = {}
    suggested_norms = {}

    floor_wpm = 7
    floor_composite = floor_wpm * 0.55 + 45 * 0.45

    for grade in sorted(by_grade):
        lst = by_grade[grade]
        best = max(lst, key=lambda x: x["composite"])
        worst = min(lst, key=lambda x: x["composite"])
        ceil_composite = best["composite"]
        wpms = [x["wpm"] for x in lst]
        overalls = [x["overall"] for x in lst if x["overall"] is not None]

        rel_scores = [
            grade_relative_score(x["composite"], floor_composite, ceil_composite) for x in lst
        ]

        print(f"\nGrade {grade} (n={len(lst)})")
        print(
            f"  wpm median={statistics.median(wpms):.1f} p90={pct(wpms, 0.9):.1f} max={max(wpms):.1f}"
        )
        print(
            f"  overall median={statistics.median(overalls):.0f} min={min(overalls)} max={max(overalls)}"
        )
        print(
            f"  BEST: {best['name']} ({best['classroom']}) wpm={best['wpm']:.1f} "
            f"g={best['grammar']} syn={best['syntax']} comp={best['composite']:.1f}"
        )
        print(
            f"  WORST: {worst['name']} ({worst['classroom']}) wpm={worst['wpm']:.1f} "
            f"g={worst['grammar']} syn={worst['syntax']} comp={worst['composite']:.1f}"
        )
        print(
            f"  grade-relative typing: best->{max(rel_scores)} worst->{min(rel_scores)} "
            f"median->{statistics.median(rel_scores):.0f}"
        )

        suggested_p90[grade] = {
            "wpm": int(round(best["wpm"])),
            "wordCount": int(round(best["wordCount"])),
            "typing": int(round(best["typing"] or 0)),
            "mechanics": int(round(best["mechanics"] or 0)),
            "story": int(round(best["story"] or 0)),
            "overall": int(round(best["overall"] or 0)),
        }
        suggested_norms[grade] = {
            "wpm": int(round(statistics.median(wpms))),
            "wordCount": int(round(statistics.median([x["wordCount"] for x in lst]))),
            "typing": int(round(statistics.median([x["typing"] for x in lst if x["typing"] is not None]))),
            "mechanics": int(round(statistics.median([x["mechanics"] for x in lst if x["mechanics"] is not None]))),
            "story": int(round(statistics.median([x["story"] for x in lst if x["story"] is not None]))),
            "overall": int(round(statistics.median(overalls))),
        }

    print("\n=== Suggested GRADE_ADVANCED_P90 (best-in-grade ceiling) ===")
    print(json.dumps(suggested_p90, indent=2))
    print("\n=== Suggested GRADE_NORMS (medians) ===")
    print(json.dumps(suggested_norms, indent=2))


if __name__ == "__main__":
    main()
