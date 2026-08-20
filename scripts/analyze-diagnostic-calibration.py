#!/usr/bin/env py
"""Analyze diagnostic writing submissions for rubric calibration."""
import argparse
import json
import re
import statistics
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "_submissions_snapshot.json"
REPORT = ROOT / "calibration-report.json"

MIXED_GRADE_CLASSES = {
    "Tech: Media Arts",
    "Tech: Game Design",
    "Tech: Video Production",
}

EXEMPLAR_NAME_PATTERN = re.compile(r"cecel", re.I)

GRADE_CLASS_PATTERNS = {
    6: re.compile(r"6th|(?:^|\s|[-:])6(?:\s|[-]|$)", re.I),
    7: re.compile(r"7th|(?:^|\s|[-:])7(?:\s|[-]|$)", re.I),
    8: re.compile(r"8th|(?:^|\s|[-:])8(?:\s|[-]|$)", re.I),
}

METRICS = ["wordCount", "wpm", "typing", "mechanics", "story", "overall"]


def classroom_grade(classroom: str):
    c = classroom or ""
    for grade, pat in GRADE_CLASS_PATTERNS.items():
        if pat.search(c):
            return grade
    return None


def resolve_story_score(analysis):
    s = (analysis or {}).get("scores") or {}
    if isinstance(s.get("story"), (int, float)):
        return s["story"]
    legacy = [s.get("narrative"), s.get("voice"), s.get("creativity")]
    legacy = [x for x in legacy if isinstance(x, (int, float))]
    if legacy:
        return round(sum(legacy) / len(legacy))
    return None


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


def summarize(values):
    if not values:
        return None
    return {
        "n": len(values),
        "mean": round(statistics.mean(values), 1),
        "median": round(statistics.median(values), 1),
        "p75": round(pct(values, 0.75), 1),
        "p90": round(pct(values, 0.90), 1),
        "max": round(max(values), 1),
        "min": round(min(values), 1),
    }


def metric_stats(rows, key):
    vals = [r[key] for r in rows if isinstance(r.get(key), (int, float))]
    return summarize(vals)


def build_row(sub):
    a = sub.get("analysis") or {}
    sc = a.get("scores") or {}
    return {
        "name": sub.get("name"),
        "classroom": sub.get("classroom"),
        "wordCount": a.get("wordCount"),
        "wpm": a.get("wpm"),
        "typing": sc.get("typing"),
        "mechanics": sc.get("mechanics"),
        "story": resolve_story_score(a),
        "overall": sc.get("overall"),
        "typingLevel": a.get("typingLevel"),
        "sensory": a.get("sensoryCount"),
        "voice": a.get("voiceCount"),
        "transitions": a.get("transitionCount"),
    }


def build_suggested_norms(by_grade, advanced_by_grade):
    """Build GRADE_NORMS / GRADE_ADVANCED_P90-shaped objects from live data."""
    norms = {}
    advanced = {}
    for grade in sorted(by_grade):
        rows = by_grade[grade]
        adv = advanced_by_grade.get(grade, [])
        g = {}
        a = {}
        for key in ["typing", "mechanics", "story", "overall", "wordCount", "wpm"]:
            med = metric_stats(rows, key)
            p90 = metric_stats(adv, key) if adv else None
            if med and med.get("median") is not None:
                g[key] = int(round(med["median"]))
            if p90 and p90.get("p90") is not None:
                a[key] = int(round(p90["p90"]))
        norms[str(grade)] = g
        advanced[str(grade)] = a
    return norms, advanced


def analyze_submissions(subs):
    lounge = [s for s in subs if (s.get("classroom") or "").strip().lower() == "teacher's lounge"]
    exemplar = next((s for s in lounge if EXEMPLAR_NAME_PATTERN.search(s.get("name") or "")), None)

    by_grade = defaultdict(list)
    advanced_by_grade = defaultdict(list)

    for s in subs:
        cls = s.get("classroom") or "Unknown"
        if cls.lower() == "teacher's lounge" or cls in MIXED_GRADE_CLASSES:
            continue
        grade = classroom_grade(cls)
        if grade is None:
            continue
        row = build_row(s)
        by_grade[grade].append(row)
        if s.get("analysis", {}).get("typingLevel") == "advanced" or (row.get("overall") or 0) >= 75:
            advanced_by_grade[grade].append(row)

    grade_stats = {}
    for grade in sorted(by_grade):
        grade_stats[str(grade)] = {
            "n": len(by_grade[grade]),
            "metrics": {k: metric_stats(by_grade[grade], k) for k in METRICS},
            "advancedN": len(advanced_by_grade.get(grade, [])),
            "advancedMetrics": {k: metric_stats(advanced_by_grade[grade], k) for k in METRICS},
        }

    lounge_stats = {}
    for key in METRICS:
        vals = []
        for s in lounge:
            row = build_row(s)
            v = row.get(key)
            if isinstance(v, (int, float)):
                vals.append(v)
        lounge_stats[key] = summarize(vals)

    suggested_norms, suggested_advanced = build_suggested_norms(by_grade, advanced_by_grade)

    exemplar_row = None
    if exemplar:
        er = build_row(exemplar)
        exemplar_row = {
            "name": er["name"],
            "targets": {"typing": 100, "mechanics": 100, "story": 100, "overall": 100},
            "observed": {
                "wordCount": er.get("wordCount"),
                "wpm": er.get("wpm"),
                "typing": er.get("typing"),
                "mechanics": er.get("mechanics"),
                "story": er.get("story"),
                "overall": er.get("overall"),
            },
        }

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "submissionCount": len(subs),
        "exemplar": exemplar_row,
        "loungeCount": len(lounge),
        "loungeStats": lounge_stats,
        "gradeStats": grade_stats,
        "suggestedGradeNorms": suggested_norms,
        "suggestedAdvancedP90": suggested_advanced,
        "mixedGradeClassesExcluded": sorted(MIXED_GRADE_CLASSES),
        "nextSteps": [
            "Compare suggestedGradeNorms to src/site/scripts/diagnostic-writing-calibration.js",
            "Adjust VOLUME_BREAKPOINTS / WPM_BREAKPOINTS so exemplar observed values → ~100",
            "Run: py scripts/simulate-calibrated-scoring.py",
            "Deploy and Re-analyze all on Teacher dashboard",
        ],
    }


def print_report(report):
    print(f"Total submissions: {report['submissionCount']}")
    if report.get("exemplar"):
        ex = report["exemplar"]
        print(f"Exemplar: {ex['name']} observed={ex['observed']}")
    print(f"Teacher's Lounge: {report['loungeCount']}")

    for grade, gs in report["gradeStats"].items():
        print(f"\nGrade {grade} (n={gs['n']})")
        for key in METRICS:
            sm = gs["metrics"].get(key)
            if sm:
                print(f"  {key:10} med={sm['median']:5} p90={sm['p90']:5} max={sm['max']:5}")

    print("\n=== Suggested GRADE_NORMS (median - paste into calibration.js) ===")
    print(json.dumps(report["suggestedGradeNorms"], indent=2))
    print("\n=== Suggested GRADE_ADVANCED_P90 ===")
    print(json.dumps(report["suggestedAdvancedP90"], indent=2))


def main():
    parser = argparse.ArgumentParser(description="Analyze diagnostic writing submissions for calibration")
    parser.add_argument("--json", action="store_true", help=f"Write {REPORT.name}")
    parser.add_argument("--input", type=Path, default=DATA, help="Submissions snapshot path")
    args = parser.parse_args()

    if not args.input.exists():
        raise SystemExit(
            f"Missing {args.input}. Export first:\n"
            '  curl.exe -s "https://dva-nu.vercel.app/api/diagnostic-writing-submissions?password=..." '
            f"-o {args.input}"
        )

    data = json.loads(args.input.read_text(encoding="utf-8"))
    subs = data.get("submissions") or []
    report = analyze_submissions(subs)
    print_report(report)

    if args.json:
        REPORT.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(f"\nWrote {REPORT}")


if __name__ == "__main__":
    main()
