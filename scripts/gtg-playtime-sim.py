#!/usr/bin/env python3
"""Estimate Global Tech Gauntlet champion-path playtime at grade-level typing speeds."""
from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "src" / "site" / "scripts"

# ── Game timing constants (from tech-trail-app.js) ──
SCENE_LOADER_MS = 420
ROOM_HOLD_MS = 920
TYPEWRITER_CHAR_MS = 16
TYPEWRITER_MIN_DWELL_MS = 900
CHOICE_COOLDOWN_MS = 1200
CHARACTER_POP_MS = 380
PANEL_FADE_MS = 520
DOOR_SLAM_MS = 280
QUIZ_CORRECT_MS = 380
RHYTHM_COUNT_IN_MS = 520  # × 4 labels per round
RHYTHM_ROUNDS_PER_SESSION = 2
OATH_CELEBRATE_MS = 820
IDENTITY_FORM_SEC = 45  # median estimate for name/class fields
TITLE_SETUP_SEC = 90  # diagnostic + accept mission + settings skim

# 3D campus (tech-trail-world3d.js)
WALK_SPEED = 6.5
MAP_SCALE = 1.15  # map % coords → world units (approx)

# Champion path — optimal golden-rule spine, no recovery branches
CHAMPION_PATH = [
    "start",
    "design_lab",
    "define_win",
    "data_vault",
    "privacy_win",
    "password_temple",
    "password_win",
    "footprint_scene",
    "footprint_win",
    "media_chamber",
    "media_win",
    "final_trial",
    "victory",
]

# Rhythm fires when leaving these mission rooms (choiceFinishesRoom → finishRhythm)
RHYTHM_ROOMS = [
    "design_lab",
    "data_vault",
    "password_temple",
    "footprint_scene",
    "media_chamber",
    "final_trial",
]

# 3D walks between map rooms on champion path
CAMPUS_WALKS = [
    ("start", "design_lab"),
    ("design_lab", "data_vault"),
    ("data_vault", "password_temple"),
    ("password_temple", "footprint_scene"),
    ("footprint_scene", "media_chamber"),
    ("media_chamber", "final_trial"),
]

# Rhythm phrases per room (operative tier) — extracted from tech-trail-rhythm.js
RHYTHM_PHRASES = {
    "design_lab": [
        "Design for people, not just for flash.",
        "Success in class: try, then try again.",
    ],
    "data_vault": [
        "Private data is not a joke to share.",
        "Responsibility: own what you type and share.",
    ],
    "password_temple": [
        "Use unique passwords and two factor authentication, or 2FA.",
        "Responsibility: own what you type and share.",
    ],
    "footprint_scene": [
        "Think before you post. The internet remembers.",
        "Kindness in class: lift others up online too.",
    ],
    "media_chamber": [
        "Decode the headline. Check the source before you share.",
        "Show SPARK: report a mean comment, don't pile on.",
    ],
    "final_trial": [
        "Be a good digital citizen. Pause before you post.",
        "SPARK: Success, Positive Attitude, Responsibility, Kindness.",
    ],
}

DIAGNOSTIC_PHRASE = "Always think carefully before you share online."
TITLE_COMMAND = "ACCEPT MISSION"
OATH_MIN_WORDS = 30
OATH_SAMPLE = (
    "I will design for people and protect private data. I will use unique passwords "
    "and two-factor auth. I will think before I post and check sources before I share. "
    "These Golden Rules guide me online."
)
QUIZ_QUESTIONS = 5


def read(rel: str) -> str:
    return (SITE / rel).read_text(encoding="utf-8")


def strip_html(html: str) -> str:
    text = re.sub(r"<[^>]+>", "", html)
    text = text.replace("&mdash;", "—").replace("&nbsp;", " ")
    return re.sub(r"\s+", " ", text).strip()


def extract_story() -> dict:
    src = read("tech-trail-story.js")
    m = re.search(r"const STORY = (\{)", src)
    if not m:
        raise ValueError("STORY not found")
    start = m.start(1)
    depth = 0
    for i, ch in enumerate(src[start:], start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                body = src[start : i + 1]
                break
    else:
        raise ValueError("unbalanced STORY")

    nodes: dict[str, dict] = {}
    # crude but sufficient: split on `node_id: {`
    for match in re.finditer(r"\n\s{4}([a-z0-9_]+):\s*\{", body):
        node_id = match.group(1)
        # grab narrative field if present
        chunk_start = match.end() - 1
        depth = 0
        chunk = ""
        for j, ch in enumerate(body[chunk_start:], chunk_start):
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    chunk = body[chunk_start : j + 1]
                    break
        narrative_m = re.search(r"narrative:\s*`([^`]*)`", chunk, re.DOTALL)
        enter_m = re.search(r'enter:\s*"([^"]*)"', chunk)
        job_m = re.search(r'job:\s*"([^"]*)"', chunk)
        conflict_m = re.search(r"conflict:\s*\{[^}]*situation:\s*\"([^\"]*)\"", chunk)
        nodes[node_id] = {
            "narrative": narrative_m.group(1) if narrative_m else "",
            "enter": enter_m.group(1) if enter_m else "",
            "job": job_m.group(1) if job_m else "",
            "conflict": conflict_m.group(1) if conflict_m else "",
        }
    return nodes


def load_map_rooms() -> dict[str, tuple[float, float]]:
    src = read("tech-trail-visuals.js")
    rooms: dict[str, tuple[float, float]] = {}
    for m in re.finditer(r"(\w+):\s*\{[^}]*x:\s*(\d+),\s*y:\s*(\d+)", src):
        rooms[m.group(1)] = (float(m.group(2)), float(m.group(3)))
    return rooms


def wpm_to_cpm(wpm: float) -> float:
    """Standard typing: 1 word ≈ 5 characters (incl. spaces)."""
    return wpm * 5


def game_test_and_target_cpm(wpm: float) -> tuple[int, int]:
    """Mirror tech-trail-typing-engine.js diagnostic + 50% target."""
    chars = len(DIAGNOSTIC_PHRASE)
    cpm_real = wpm_to_cpm(wpm)
    duration_ms = (chars / cpm_real) * 60000 if cpm_real else 999999
    min_ms = chars * 320  # MIN_MS_PER_KEY
    effective_ms = max(duration_ms, min_ms)
    raw_test = round(chars / (effective_ms / 60000))
    test_cpm = min(raw_test, 120)  # MAX_TEST_CPM
    target = round(min(95, max(20, test_cpm * 0.5)))
    return test_cpm, target


def typing_seconds(char_count: int, cpm: float) -> float:
    if cpm <= 0:
        return 0
    return (char_count / cpm) * 60


def typewriter_seconds(html: str) -> float:
    text = strip_html(html)
    if not text:
        return 0
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()] or [text]
    total = 0.0
    for para in paragraphs:
        visible_chars = sum(1 for c in para if c.strip())
        reveal = visible_chars * (TYPEWRITER_CHAR_MS / 1000)
        dwell = max(TYPEWRITER_MIN_DWELL_MS / 1000, reveal)
        total += dwell
        if len(paragraphs) > 1:
            total += 1.5  # student clicks Continue between paragraphs
    return total


def room_arrival_seconds() -> float:
    return (DOOR_SLAM_MS + ROOM_HOLD_MS + CHARACTER_POP_MS + PANEL_FADE_MS) / 1000


def campus_walk_seconds(rooms: dict[str, tuple[float, float]], a: str, b: str) -> float:
    ax, ay = rooms.get(a, (50, 50))
    bx, by = rooms.get(b, (50, 50))
    dist = math.hypot(bx - ax, by - ay) * MAP_SCALE
    walk = dist / WALK_SPEED
    return walk + 4.0  # orient, find door, press E


@dataclass
class TimingBreakdown:
    label: str
    seconds: float = 0.0
    detail: str = ""


@dataclass
class SimulationResult:
    wpm: float
    tier: str
    total_min: float
    breakdown: list[TimingBreakdown] = field(default_factory=list)
    within_45: bool = False
    test_cpm: int = 0
    target_cpm: int = 0


def simulate(wpm: float, tier: str = "operative", include_3d: bool = True) -> SimulationResult:
    story = extract_story()
    map_rooms = load_map_rooms()
    cpm = wpm_to_cpm(wpm)
    test_cpm, target_cpm = game_test_and_target_cpm(wpm)
    bd: list[TimingBreakdown] = []

    # Title / diagnostic
    title_sec = TITLE_SETUP_SEC + typing_seconds(len(DIAGNOSTIC_PHRASE), cpm)
    bd.append(TimingBreakdown("Title screen + diagnostic", title_sec))

    # Narrative scenes
    narrative_sec = 0.0
    scene_count = 0
    for node_id in CHAMPION_PATH:
        node = story.get(node_id, {})
        for field in ("enter", "job", "conflict", "narrative"):
            text = node.get(field, "")
            if text:
                narrative_sec += typewriter_seconds(text)
        narrative_sec += room_arrival_seconds()
        scene_count += 1
    narrative_sec += scene_count * (SCENE_LOADER_MS / 1000)
    narrative_sec += (scene_count - 1) * (CHOICE_COOLDOWN_MS / 1000)
    narrative_sec += scene_count * 8  # read conflict card + ponder choices (~8s/scene)
    bd.append(TimingBreakdown(f"Story scenes ({scene_count} nodes)", narrative_sec))

    # Rhythm phrase checks
    rhythm_chars = sum(len(p) for room in RHYTHM_ROOMS for p in RHYTHM_PHRASES[room])
    rhythm_sessions = len(RHYTHM_ROOMS)
    count_in = rhythm_sessions * RHYTHM_ROUNDS_PER_SESSION * 4 * (RHYTHM_COUNT_IN_MS / 1000)
    rhythm_type = typing_seconds(rhythm_chars, cpm)
    rhythm_sec = count_in + rhythm_type + rhythm_sessions * 3  # HUD transitions
    bd.append(
        TimingBreakdown(
            f"Rhythm checks ({rhythm_sessions} sessions, {rhythm_chars} chars)",
            rhythm_sec,
        )
    )

    # Golden Rules quiz (clicks)
    quiz_sec = QUIZ_QUESTIONS * (QUIZ_CORRECT_MS / 1000 + 4)  # ~4s read scenario
    bd.append(TimingBreakdown("Golden Rules quiz (5 scenarios)", quiz_sec))

    # Oath free-write
    oath_words = OATH_MIN_WORDS if tier == "operative" else (15 if tier == "cadet" else 45)
    oath_chars = len(OATH_SAMPLE) if tier != "analyst" else int(len(OATH_SAMPLE) * 1.4)
    oath_sec = typing_seconds(oath_chars, cpm) + 12  # think + edit
    bd.append(TimingBreakdown(f"Digital Citizenship Oath (~{oath_words} words)", oath_sec))

    # Identity gate + victory
    post_sec = (OATH_CELEBRATE_MS / 1000) + IDENTITY_FORM_SEC + 15
    bd.append(TimingBreakdown("Submit + identity form + ending", post_sec))

    # 3D campus walks
    if include_3d:
        walk_sec = sum(campus_walk_seconds(map_rooms, a, b) for a, b in CAMPUS_WALKS)
        bd.append(TimingBreakdown(f"3D campus walks ({len(CAMPUS_WALKS)} hops)", walk_sec))

    total = sum(b.seconds for b in bd)
    return SimulationResult(
        wpm=wpm,
        tier=tier,
        total_min=round(total / 60, 1),
        breakdown=bd,
        within_45=total <= 45 * 60,
        test_cpm=test_cpm,
        target_cpm=target_cpm,
    )


def simulate_realistic_classroom(wpm: float = 30) -> SimulationResult:
    """Champion path + typical classroom friction (one recovery, one side mission, retries)."""
    base = simulate(wpm, tier="operative", include_3d=True)
    extras = [
        TimingBreakdown("Teacher intro / account setup", 120),
        TimingBreakdown("One recovery branch (2 extra scenes)", 240),
        TimingBreakdown("One side mission detour (Simulation Studio)", 480),
        TimingBreakdown("Rhythm retries (~1 per 3 sessions)", 90),
        TimingBreakdown("Slower choice deliberation (+5s/scene)", 65),
        TimingBreakdown("3D campus exploration / map fiddling", 180),
        TimingBreakdown("Glitch popup from one wrong choice", 12),
    ]
    total_sec = sum(b.seconds for b in base.breakdown) + sum(e.seconds for e in extras)
    return SimulationResult(
        wpm=wpm,
        tier="operative+friction",
        total_min=round(total_sec / 60, 1),
        breakdown=base.breakdown + extras,
        within_45=total_sec <= 45 * 60,
        test_cpm=base.test_cpm,
        target_cpm=base.target_cpm,
    )


def main() -> None:
    benchmarks = {
        "typing.com middle school (low)": 20,
        "SC state standard (7th)": 25,
        "Typesy / MI curriculum (7th)": 30,
        "Adams 12 district goal (7th)": 35,
        "Typesy benchmark (7th high)": 35,
        "middle school strong (8th)": 40,
    }

    print("=" * 72)
    print("GLOBAL TECH GAUNTLET — Champion path playtime simulation")
    print("=" * 72)
    print()
    print("RESEARCH: 7th-grade typing speed benchmarks")
    print("-" * 72)
    print("  - Typesy / Michigan standards: 30 WPM @ 95% accuracy (grade 7)")
    print("  - South Carolina DL.4.1: 25 WPM (grade 7 state standard)")
    print("  - Adams 12 Five Star Schools: 35 WPM @ 95% (grade 7)")
    print("  - typing.com: middle school range 20-30 WPM")
    print("  - Typesy K-12 table: grade 7 = 32-35 WPM")
    print()
    print("  -> 30 WPM is a solid middle-ground calibration point:")
    print("    aligns with Typesy grade-7 curriculum, mid typing.com range,")
    print("    and between SC (25) and district goals (35).")
    print()
    print("GAME METRIC: keys/min (CPM) ~= WPM x 5 characters/word")
    print("  Diagnostic caps test at 120 CPM; target = 50% of test (min 20, max 95)")
    print()

    results = []
    for label, wpm in benchmarks.items():
        r = simulate(wpm, tier="operative", include_3d=True)
        results.append((label, r))

    print("CHAMPION PATH TIMELINE (operative tier, includes 3D walks)")
    print("-" * 72)
    print(f"{'Benchmark':<38} {'WPM':>4} {'Test':>5} {'Tgt':>4} {'Time':>7} {'<=45m':>6}")
    print(f"{'':38} {'':>4} {'CPM':>5} {'CPM':>4} {'':>7} {'':>6}")
    for label, r in results:
        flag = "YES" if r.within_45 else "no"
        print(
            f"{label:<38} {r.wpm:>4} {r.test_cpm:>5} {r.target_cpm:>4} "
            f"{r.total_min:>6.1f}m {flag:>6}"
        )

    # Detailed breakdown at 30 WPM
    print()
    print("DETAILED BREAKDOWN @ 30 WPM (operative, champion path)")
    print("-" * 72)
    r30 = simulate(30, tier="operative", include_3d=True)
    print(f"  Game diagnostic: test {r30.test_cpm} CPM, target {r30.target_cpm} CPM")
    print(f"  Student actual speed: {wpm_to_cpm(30):.0f} CPM ({30} WPM)")
    print(f"  Speed gates: student exceeds operative 85% gate ({r30.target_cpm * 0.85:.0f} CPM)")
    print()
    for b in r30.breakdown:
        pct = 100 * b.seconds / sum(x.seconds for x in r30.breakdown)
        print(f"  {b.label:<48} {b.seconds/60:>5.1f}m  ({pct:>4.0f}%)")
    print(f"  {'TOTAL':<48} {r30.total_min:>5.1f}m")
    print(f"  Fits in 45 minutes: {'YES' if r30.within_45 else 'NO'}")

    # Sensitivity: no 3D walks (story-only clicks)
    r30_fast = simulate(30, tier="operative", include_3d=False)
    print()
    print(f"  Without 3D walking (direct scene hops): {r30_fast.total_min:.1f}m")

    # Slower student
    r25 = simulate(25, tier="operative", include_3d=True)
    print(f"  @ 25 WPM (SC standard): {r25.total_min:.1f}m - {'YES' if r25.within_45 else 'NO'}")

    # Cadet tier (shorter phrases)
    r30_cadet = simulate(30, tier="cadet", include_3d=True)
    print(f"  @ 30 WPM cadet tier: {r30_cadet.total_min:.1f}m")

    # Recovery path penalty estimate
    print()
    print("NOT ON CHAMPION PATH (adds time if students detour)")
    print("-" * 72)
    print("  - Recovery branches: +2-4 extra scenes each (~3-5 min)")
    print("  - Side missions (Simulation Studio, deep dives): +5-15 min each")
    print("  - Rhythm retries (max 3): +~30s per retry round")
    print("  - Glitch minigame on bad choices: +5-15s per trigger")

    realistic = simulate_realistic_classroom(30)
    print()
    print("REALISTIC CLASSROOM @ 30 WPM (main quest + typical friction)")
    print("-" * 72)
    for b in realistic.breakdown:
        if b.seconds >= 30:
            print(f"  {b.label:<48} {b.seconds/60:>5.1f}m")
    print(f"  {'TOTAL':<48} {realistic.total_min:>5.1f}m")
    print(f"  Fits in 45 minutes: {'YES' if realistic.within_45 else 'NO'}")

    report = {
        "calibration_wpm": 30,
        "research_summary": {
            "typesy_grade_7": "30 WPM @ 95%",
            "sc_standard": "25 WPM",
            "adams12_grade_7": "35 WPM @ 95%",
            "typing_com_middle": "20-30 WPM",
            "recommendation": "30 WPM is appropriate middle-ground for 7th grade calibration",
        },
        "champion_path_results": [
            {
                "benchmark": label,
                "wpm": r.wpm,
                "test_cpm": r.test_cpm,
                "target_cpm": r.target_cpm,
                "total_minutes": r.total_min,
                "within_45_min": r.within_45,
            }
            for label, r in results
        ],
        "breakdown_30wpm": [
            {"phase": b.label, "minutes": round(b.seconds / 60, 2)} for b in r30.breakdown
        ],
        "realistic_30wpm_minutes": realistic.total_min,
        "realistic_within_45": realistic.within_45,
    }
    out = ROOT / "scripts" / "gtg-playtime-report.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print()
    print(f"Report saved to {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
