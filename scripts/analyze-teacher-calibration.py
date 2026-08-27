#!/usr/bin/env py
"""Compare teacher grades vs auto scores from WriteFlow CSV export."""
import csv
import json
import math
import re
import statistics
from collections import defaultdict
from pathlib import Path

CSV_PATH = Path(r"C:\Users\phili\Downloads\WriteFlow Studio Backend Data - Submissions (1).csv")
REPORT_PATH = Path(__file__).resolve().parent / "teacher-calibration-report.json"

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
        "mean": round(statistics.mean(values), 2),
        "median": round(statistics.median(values), 2),
        "stdev": round(statistics.stdev(values), 2) if len(values) > 1 else 0,
        "p25": round(pct(values, 0.25), 2),
        "p75": round(pct(values, 0.75), 2),
    }


def parse_analysis(row):
    raw = row.get("analysisJson") or ""
    if not raw.strip():
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def load_rows():
    rows = []
    with CSV_PATH.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    return rows


def main():
    rows = load_rows()
    print(f"Total submissions: {len(rows)}")

    graded = []
    for row in rows:
        tg = row.get("teacherGrade", "").strip()
        if not tg:
            continue
        try:
            teacher_pts = float(tg)
        except ValueError:
            continue
        analysis = parse_analysis(row)
        scores = (analysis.get("scores") or {})
        auto_overall = scores.get("overall")
        if auto_overall is None:
            try:
                auto_overall = float(row.get("overall") or 0)
            except ValueError:
                continue

        aid = row.get("assignmentId", "")
        teacher_100 = teacher_pts
        diff = teacher_100 - auto_overall

        graded.append({
            "id": row.get("id"),
            "name": row.get("name"),
            "classroom": row.get("classroom"),
            "assignmentId": aid,
            "teacherGrade": teacher_pts,
            "teacherOverall100": teacher_100,
            "autoOverall": auto_overall,
            "diff": round(diff, 1),
            "absDiff": round(abs(diff), 1),
            "typing": scores.get("typing"),
            "mechanics": scores.get("mechanics"),
            "story": scores.get("story"),
            "wordCount": analysis.get("wordCount") or row.get("wordCount"),
            "wpm": analysis.get("wpm") or row.get("wpm"),
            "promptFocus": (analysis.get("metricScores") or {}).get("promptFocus"),
            "teacherFeedback": row.get("teacherFeedback", ""),
            "textLen": len(row.get("storyText") or ""),
        })

    print(f"Teacher-graded submissions: {len(graded)}")

    if not graded:
        print("No graded submissions found.")
        return

    diffs = [g["diff"] for g in graded]
    abs_diffs = [g["absDiff"] for g in graded]
    teacher_scores = [g["teacherOverall100"] for g in graded]
    auto_scores = [g["autoOverall"] for g in graded]

    print("\n=== Overall alignment ===")
    print(f"Mean teacher (0-100): {statistics.mean(teacher_scores):.1f}")
    print(f"Mean auto overall:      {statistics.mean(auto_scores):.1f}")
    print(f"Mean diff (teacher-auto): {statistics.mean(diffs):+.1f}")
    print(f"Mean |diff|: {statistics.mean(abs_diffs):.1f}")
    print(f"Median |diff|: {statistics.median(abs_diffs):.1f}")
    within_5 = sum(1 for d in abs_diffs if d <= 5) / len(abs_diffs) * 100
    within_10 = sum(1 for d in abs_diffs if d <= 10) / len(abs_diffs) * 100
    within_15 = sum(1 for d in abs_diffs if d <= 15) / len(abs_diffs) * 100
    print(f"Within 5 pts:  {within_5:.0f}%")
    print(f"Within 10 pts: {within_10:.0f}%")
    print(f"Within 15 pts: {within_15:.0f}%")

    # Correlation
    n = len(graded)
    if n > 2:
        mx, my = statistics.mean(teacher_scores), statistics.mean(auto_scores)
        num = sum((teacher_scores[i] - mx) * (auto_scores[i] - my) for i in range(n))
        den_x = math.sqrt(sum((teacher_scores[i] - mx) ** 2 for i in range(n)))
        den_y = math.sqrt(sum((auto_scores[i] - my) ** 2 for i in range(n)))
        r = num / (den_x * den_y) if den_x and den_y else 0
        print(f"Pearson r: {r:.3f}")

    # By assignment
    print("\n=== By assignment ===")
    by_assign = defaultdict(list)
    for g in graded:
        by_assign[g["assignmentId"]].append(g)
    for aid, items in sorted(by_assign.items(), key=lambda x: -len(x[1])):
        diffs_a = [i["diff"] for i in items]
        abs_a = [i["absDiff"] for i in items]
        print(f"  {aid}: n={len(items)} mean_diff={statistics.mean(diffs_a):+.1f} mean_|diff|={statistics.mean(abs_a):.1f}")

    # Auto over-scores vs under-scores
    over = [g for g in graded if g["diff"] < -10]
    under = [g for g in graded if g["diff"] > 10]
    print(f"\nAuto OVER-scores teacher by 10+ (n={len(over)})")
    print(f"Auto UNDER-scores teacher by 10+ (n={len(under)})")

    # Sub-score analysis: which correlates best with teacher grade?
    print("\n=== Sub-score correlation with teacher grade ===")
    for key in ["typing", "mechanics", "story", "promptFocus", "wordCount", "wpm"]:
        pairs = [(g["teacherOverall100"], g[key]) for g in graded if g.get(key) is not None]
        if len(pairs) < 3:
            continue
        ts = [p[0] for p in pairs]
        xs = [float(p[1]) for p in pairs]
        mx, my = statistics.mean(xs), statistics.mean(ts)
        num = sum((xs[i] - mx) * (ts[i] - my) for i in range(len(pairs)))
        den_x = math.sqrt(sum((xs[i] - mx) ** 2 for i in range(len(pairs))))
        den_y = math.sqrt(sum((ts[i] - my) ** 2 for i in range(len(pairs))))
        r = num / (den_x * den_y) if den_x and den_y else 0
        print(f"  {key:12} r={r:.3f}  mean={statistics.mean(xs):.1f}")

    # Linear regression: teacher ~ auto subscores
    print("\n=== Suggested overall weights (OLS on sub-scores) ===")
    features = ["typing", "mechanics", "story", "promptFocus"]
    valid = [g for g in graded if all(g.get(f) is not None for f in features)]
    if len(valid) >= 10:
        # Simple normalized weights via correlation
        corrs = {}
        for f in features:
            xs = [float(g[f]) for g in valid]
            ts = [g["teacherOverall100"] for g in valid]
            mx, my = statistics.mean(xs), statistics.mean(ts)
            num = sum((xs[i] - mx) * (ts[i] - my) for i in range(len(valid)))
            den_x = math.sqrt(sum((xs[i] - mx) ** 2 for i in range(len(valid))))
            den_y = math.sqrt(sum((ts[i] - my) ** 2 for i in range(len(valid))))
            corrs[f] = max(0, num / (den_x * den_y) if den_x and den_y else 0)
        total = sum(corrs.values()) or 1
        for f, c in sorted(corrs.items(), key=lambda x: -x[1]):
            print(f"  {f}: weight~{c/total:.2f} (r={c:.3f})")

    # Worst mismatches
    print("\n=== Top 15 largest mismatches (|diff|) ===")
    worst = sorted(graded, key=lambda g: -g["absDiff"])[:15]
    for g in worst:
        fb = (g["teacherFeedback"] or "")[:60].replace("\n", " ")
        print(f"  {g['name']:20} teacher={g['teacherOverall100']:5.0f} auto={g['autoOverall']:3.0f} diff={g['diff']:+5.0f}  wc={g['wordCount']} story={g['story']} prompt={g['promptFocus']}  fb={fb!r}")

    # Teacher feedback themes for under-scored
    print("\n=== Common teacher feedback (under-scored, diff>10) ===")
    fb_counts = defaultdict(int)
    for g in under:
        fb = (g["teacherFeedback"] or "").lower()
        if "prompt" in fb or "question" in fb or "answer" in fb:
            fb_counts["didn't answer prompt"] += 1
        if "off topic" in fb or "off-topic" in fb or "topic" in fb:
            fb_counts["off topic"] += 1
        if "short" in fb or "length" in fb or "more" in fb:
            fb_counts["too short / needs more"] += 1
        if "spell" in fb or "grammar" in fb or "capital" in fb or "punctuation" in fb:
            fb_counts["mechanics issues"] += 1
        if "list" in fb or "examples" in fb:
            fb_counts["list without explanation"] += 1
        if "detail" in fb or "explain" in fb or "specific" in fb:
            fb_counts["needs more detail/explanation"] += 1
    for k, v in sorted(fb_counts.items(), key=lambda x: -x[1]):
        print(f"  {k}: {v}")

    # Grade level breakdown
    print("\n=== By grade level ===")
    by_grade = defaultdict(list)
    for g in graded:
        c = g["classroom"] or ""
        m = re.search(r"Tech\s+(\d)-", c) or re.search(r"(\d)th\s+Grade", c)
        grade = m.group(1) if m else "mixed"
        by_grade[grade].append(g)
    for grade, items in sorted(by_grade.items()):
        diffs_g = [i["diff"] for i in items]
        print(f"  Grade {grade}: n={len(items)} mean_diff={statistics.mean(diffs_g):+.1f}")

    report = {
        "totalSubmissions": len(rows),
        "gradedCount": len(graded),
        "alignment": {
            "meanTeacher100": round(statistics.mean(teacher_scores), 2),
            "meanAutoOverall": round(statistics.mean(auto_scores), 2),
            "meanDiff": round(statistics.mean(diffs), 2),
            "meanAbsDiff": round(statistics.mean(abs_diffs), 2),
            "within5Pct": round(within_5, 1),
            "within10Pct": round(within_10, 1),
            "within15Pct": round(within_15, 1),
        },
        "byAssignment": {
            aid: {"n": len(items), "meanDiff": round(statistics.mean([i["diff"] for i in items]), 2)}
            for aid, items in by_assign.items()
        },
        "worstMismatches": worst,
        "overScoredCount": len(over),
        "underScoredCount": len(under),
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"\nWrote {REPORT_PATH}")


if __name__ == "__main__":
    main()
