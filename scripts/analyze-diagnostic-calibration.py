#!/usr/bin/env py
"""Analyze diagnostic writing submissions for rubric calibration."""
import json
import re
import statistics
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "_submissions_snapshot.json"

MIXED_GRADE_CLASSES = {
    "Tech: Media Arts",
    "Tech: Game Design",
    "Tech: Video Production",
}

GRADE_CLASS_PATTERNS = {
    6: re.compile(r"6th|(?:^|\s|[-:])6(?:\s|[-]|$)", re.I),
    7: re.compile(r"7th|(?:^|\s|[-:])7(?:\s|[-]|$)", re.I),
    8: re.compile(r"8th|(?:^|\s|[-:])8(?:\s|[-]|$)", re.I),
}


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


def main():
    data = json.loads(DATA.read_text(encoding="utf-8"))
    subs = data.get("submissions") or []
    print(f"Total submissions: {len(subs)}")

    lounge = [s for s in subs if (s.get("classroom") or "").strip().lower() == "teacher's lounge"]
    cecilia = [s for s in lounge if re.search(r"cecilia", s.get("name") or "", re.I)]
    print(f"Teacher's Lounge: {len(lounge)} | Cecilia matches: {len(cecilia)}")
    for s in cecilia:
        a = s.get("analysis") or {}
        sc = a.get("scores") or {}
        print("  Cecilia:", s.get("name"), {
            "words": a.get("wordCount"), "wpm": a.get("wpm"),
            "typing": sc.get("typing"), "mech": sc.get("mechanics"),
            "story": resolve_story_score(a), "overall": sc.get("overall"),
        })

    by_grade = defaultdict(list)
    by_class = defaultdict(list)
    advanced_by_grade = defaultdict(list)

    for s in subs:
        cls = s.get("classroom") or "Unknown"
        a = s.get("analysis") or {}
        sc = a.get("scores") or {}
        if cls.lower() == "teacher's lounge":
            continue
        if cls in MIXED_GRADE_CLASSES:
            continue
        grade = classroom_grade(cls)
        if grade is None:
            continue
        row = {
            "name": s.get("name"),
            "classroom": cls,
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
        by_grade[grade].append(row)
        by_class[cls].append(row)
        if a.get("typingLevel") == "advanced" or (sc.get("overall") or 0) >= 75:
            advanced_by_grade[grade].append(row)

    print("\n=== By grade (excluding mixed tech + lounge) ===")
    for grade in sorted(by_grade):
        rows = by_grade[grade]
        print(f"\nGrade {grade} (n={len(rows)})")
        for key in ["wordCount", "wpm", "typing", "mechanics", "story", "overall"]:
            vals = [r[key] for r in rows if isinstance(r.get(key), (int, float))]
            sm = summarize(vals)
            if sm:
                print(f"  {key:10} mean={sm['mean']:5} med={sm['median']:5} p75={sm['p75']:5} p90={sm['p90']:5} max={sm['max']:5}")

    print("\n=== Advanced/top performers by grade (typingLevel=advanced OR overall>=75) ===")
    for grade in sorted(advanced_by_grade):
        rows = advanced_by_grade[grade]
        print(f"\nGrade {grade} advanced pool (n={len(rows)})")
        for key in ["wordCount", "wpm", "typing", "mechanics", "story", "overall"]:
            vals = [r[key] for r in rows if isinstance(r.get(key), (int, float))]
            sm = summarize(vals)
            if sm:
                print(f"  {key:10} mean={sm['mean']:5} med={sm['median']:5} p90={sm['p90']:5} max={sm['max']:5}")

    print("\n=== Teacher's Lounge (exemplar pool) ===")
    for key in ["wordCount", "wpm", "typing", "mechanics", "story", "overall"]:
        vals = []
        for s in lounge:
            a = s.get("analysis") or {}
            sc = a.get("scores") or {}
            v = a.get(key) if key in ("wordCount", "wpm") else sc.get(key if key != "story" else None)
            if key == "story":
                v = resolve_story_score(a)
            vals.append(v)
        vals = [v for v in vals if isinstance(v, (int, float))]
        sm = summarize(vals)
        if sm:
            print(f"  {key:10} {sm}")

    print("\n=== Top 5 overall by grade ===")
    for grade in sorted(by_grade):
        top = sorted(by_grade[grade], key=lambda r: r.get("overall") or 0, reverse=True)[:5]
        print(f"Grade {grade}:")
        for r in top:
            print(f"  {r['overall']:3} {r['name'][:20]:20} {r['classroom'][:28]:28} w={r['wordCount']} wpm={r['wpm']}")

    print("\n=== Current score distribution (all student grades) ===")
    all_student = [r for g in by_grade for r in by_grade[g]]
    for key in ["typing", "mechanics", "story", "overall"]:
        vals = [r[key] for r in all_student if isinstance(r.get(key), (int, float))]
        sm = summarize(vals)
        under50 = sum(1 for v in vals if v < 50)
        under65 = sum(1 for v in vals if v < 65)
        print(f"  {key}: mean={sm['mean']} med={sm['median']} <50: {under50}/{sm['n']} <65: {under65}/{sm['n']}")


if __name__ == "__main__":
    main()
