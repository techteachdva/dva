#!/usr/bin/env py
"""Validate teacher calibration improvements against graded submissions."""
import csv
import json
import re
import statistics
from pathlib import Path

CSV_PATH = Path(r"C:\Users\phili\Downloads\WriteFlow Studio Backend Data - Submissions (1).csv")

OFF_TOPIC = re.compile(
    r"\b(went to|valley fair|my mom|boyfriend|girlfriend|last summer|one day i went|do not now wut to rit|by{4,})\b", re.I
)
DICTATION = re.compile(
    r"\b(this is a little|write out exactly|what i am saying|what i'm saying|try to wright|try to write out exactly|want to see if you can focus|want to see if you can typ|random words)\b", re.I
)
TECH_CONTRAST = re.compile(
    r"\b(not technology|isn't technology|isnt technology|not tech|non.?tech|man.?made|natural(?:ly)?|electronic|digital|human.?made)\b", re.I
)
EXAMPLE_NOUN = re.compile(
    r"\b(trees?|grass|rocks?|water|animals?|birds?|dogs?|cats?|food|humans?|people|brick|paper|pencils?|chairs?|tables?|sun|moon|air|wind|plants?|flowers?|bugs?|insects?|fish|shoes?|books?|clothes|houses?|buildings?|leaves?|dirt|sand|sky|clouds?|rivers?|lakes?|mountains?|snow|ice|wood|metal|glass|plastic|fabric|cotton|wool|meat|fruit|vegetables?)\b", re.I
)

TC = {
    "reflectionOverall": {"mechanics": 0.35, "story": 0.65},
    "reasoningBonus": {"because": 12, "techContrast": 8},
    "exampleBonus": {"perExample": 4, "maxBonus": 16, "minExamples": 3},
    "exampleAttemptFloor": {"minExamples": 2, "base": 78, "perExample": 4, "maxBonus": 20},
    "offTopicCap": 15,
    "dictationTypingWeight": 0.5,
    "dictationMechanicsWeight": 0.1,
    "dictationMaxScore": 12,
    "strongAttemptBonus": {"minMechanics": 80, "minExamples": 2, "bonus": 10},
}


def clamp(n, lo=0, hi=100):
    return max(lo, min(hi, n))


def detect_response_type(text, example_count, has_tech_contrast):
    if DICTATION.search(text):
        return "dictation"
    if OFF_TOPIC.search(text) and not has_tech_contrast and example_count < 2:
        return "off_topic"
    return "normal"


def calibrated_overall(g, text):
    """Simulate new calibration on stored sub-scores."""
    typing = g["typing"]
    mechanics = g["mechanics"]
    story = g["story"]
    prompt = g["prompt"]

    example_count = len(EXAMPLE_NOUN.findall(text))
    has_tech = bool(TECH_CONTRAST.search(text))
    has_because = bool(re.search(r"\bbecause\b", text, re.I))
    response_type = detect_response_type(text, example_count, has_tech)

    if response_type == "off_topic":
        return min(g["auto"], TC["offTopicCap"])

    if response_type == "dictation":
        raw = typing * TC["dictationTypingWeight"] + mechanics * TC["dictationMechanicsWeight"]
        return clamp(min(round(raw), TC["dictationMaxScore"]))

    # Enhanced prompt score
    prompt_adj = prompt
    if has_because:
        prompt_adj = min(100, prompt_adj + TC["reasoningBonus"]["because"])
    if has_tech:
        prompt_adj = min(100, prompt_adj + TC["reasoningBonus"]["techContrast"])
    ex = TC["exampleBonus"]
    if example_count >= ex["minExamples"]:
        prompt_adj = min(100, prompt_adj + min((example_count - 2) * ex["perExample"], ex["maxBonus"]))

    # Recompute story with adjusted prompt (prompt is 40% of story when present)
    story_adj = clamp(round(story * 0.6 + prompt_adj * 0.4))

    w = TC["reflectionOverall"]
    overall = round(mechanics * w["mechanics"] + story_adj * w["story"])

    floor_rule = TC["exampleAttemptFloor"]
    if example_count >= floor_rule["minExamples"] and response_type == "normal":
        qualifies = prompt_adj >= 40 or has_tech or has_because or (prompt_adj >= 25 and example_count >= 4)
        if qualifies:
            floor = floor_rule["base"] + min(example_count, 5) * floor_rule["perExample"]
            overall = max(overall, min(100, floor))

    sb = TC["strongAttemptBonus"]
    if mechanics >= sb["minMechanics"] and example_count >= sb["minExamples"]:
        if has_tech or has_because or prompt_adj >= 35:
            overall = min(100, overall + sb["bonus"])

    return clamp(overall)


def main():
    rows = []
    with CSV_PATH.open(encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))

    graded = []
    for r in rows:
        if not r.get("teacherGrade", "").strip():
            continue
        a = json.loads(r["analysisJson"])
        ms = a.get("metricScores", {})
        graded.append({
            "teacher": float(r["teacherGrade"]),
            "auto": a["scores"]["overall"],
            "typing": a["scores"]["typing"],
            "mechanics": a["scores"]["mechanics"],
            "story": a["scores"]["story"],
            "prompt": ms.get("promptFocus") or 0,
            "text": r.get("storyText", ""),
            "assign": r.get("assignmentId", ""),
        })

    old_errors = [abs(g["teacher"] - g["auto"]) for g in graded]
    new_scores = [calibrated_overall(g, g["text"]) for g in graded]
    new_errors = [abs(g["teacher"] - ns) for g, ns in zip(graded, new_scores)]

    print(f"Graded submissions: {len(graded)}")
    print(f"\nBEFORE calibration:")
    print(f"  MAE: {statistics.mean(old_errors):.1f}")
    print(f"  Within 10: {sum(1 for e in old_errors if e <= 10) / len(old_errors) * 100:.0f}%")
    print(f"  Within 15: {sum(1 for e in old_errors if e <= 15) / len(old_errors) * 100:.0f}%")

    print(f"\nAFTER calibration:")
    print(f"  MAE: {statistics.mean(new_errors):.1f}")
    print(f"  Within 10: {sum(1 for e in new_errors if e <= 10) / len(new_errors) * 100:.0f}%")
    print(f"  Within 15: {sum(1 for e in new_errors if e <= 15) / len(new_errors) * 100:.0f}%")

    mx, my = statistics.mean(new_scores), statistics.mean(g["teacher"] for g in graded)
    num = sum((new_scores[i] - mx) * (graded[i]["teacher"] - my) for i in range(len(graded)))
    den = (sum((s - mx) ** 2 for s in new_scores) * sum((g["teacher"] - my) ** 2 for g in graded)) ** 0.5
    print(f"  Pearson r: {num / den:.3f}" if den else "")

    print("\n=== Worst remaining mismatches ===")
    pairs = sorted(zip(graded, new_scores), key=lambda x: -abs(x[0]["teacher"] - x[1]))[:10]
    for g, ns in pairs:
        print(f"  {g['teacher']:5.0f} vs {ns:3.0f} (was {g['auto']:3.0f}) | {g['assign'][:30]}")


if __name__ == "__main__":
    main()
