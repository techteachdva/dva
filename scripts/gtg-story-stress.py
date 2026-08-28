"""Global Tech Gauntlet story + unlock stress test (Python — no Node required)."""
from __future__ import annotations

import os
import random
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "src" / "site"
errors: list[str] = []
warnings: list[str] = []


def fail(msg: str) -> None:
    errors.append(msg)


def warn(msg: str) -> None:
    warnings.append(msg)


def read(rel: str) -> str:
    return (SITE / rel).read_text(encoding="utf-8")


def extract_object_literal(src: str, const_name: str) -> str:
    m = re.search(rf"const {re.escape(const_name)} = \{{", src)
    if not m:
        raise ValueError(f"Could not find const {const_name}")
    start = m.end() - 1
    depth = 0
    for i, ch in enumerate(src[start:], start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return src[start : i + 1]
    raise ValueError(f"Unbalanced braces for {const_name}")


def split_top_level_props(obj_src: str) -> dict[str, str]:
    """Split `{ key: value, key2: { ... } }` into name -> raw value strings."""
    body = obj_src.strip()
    if body.startswith("{"):
        body = body[1:-1]
    props: dict[str, str] = {}
    i = 0
    n = len(body)
    while i < n:
        while i < n and body[i] in " \t\r\n,":
            i += 1
        if i >= n:
            break
        key_m = re.match(r'(?:([A-Za-z0-9_]+)|"([^"]+)"|\'([^\']+)\')\s*:', body[i:])
        if not key_m:
            break
        key = key_m.group(1) or key_m.group(2) or key_m.group(3)
        i += key_m.end()
        while i < n and body[i] in " \t\n":
            i += 1
        start = i
        depth_brace = depth_brack = depth_paren = 0
        in_str = None
        escape = False
        while i < n:
            ch = body[i]
            if in_str:
                if escape:
                    escape = False
                elif ch == "\\":
                    escape = True
                elif ch == in_str:
                    in_str = None
            else:
                if ch in ('"', "'", "`"):
                    in_str = ch
                elif ch == "{":
                    depth_brace += 1
                elif ch == "}":
                    if depth_brace == 0 and depth_brack == 0 and depth_paren == 0:
                        break
                    depth_brace -= 1
                elif ch == "[":
                    depth_brack += 1
                elif ch == "]":
                    depth_brack -= 1
                elif ch == "(":
                    depth_paren += 1
                elif ch == ")":
                    depth_paren -= 1
                elif ch == "," and depth_brace == 0 and depth_brack == 0 and depth_paren == 0:
                    break
            i += 1
        props[key] = body[start:i].strip()
        if i < n and body[i] == ",":
            i += 1
    return props


def parse_string(raw: str) -> str | None:
    raw = raw.strip()
    if raw.startswith("`") and raw.endswith("`"):
        return raw[1:-1]
    if (raw.startswith('"') and raw.endswith('"')) or (raw.startswith("'") and raw.endswith("'")):
        return raw[1:-1]
    return None


def parse_number(raw: str) -> float | None:
    try:
        return float(raw.strip())
    except ValueError:
        return None


def parse_bool(raw: str) -> bool | None:
    s = raw.strip()
    if s == "true":
        return True
    if s == "false":
        return False
    return None


def parse_choices(raw: str) -> list[dict]:
    raw = raw.strip()
    if not raw.startswith("["):
        return []
    inner = raw[1:-1].strip()
    if not inner:
        return []
    items = []
    depth = 0
    start = 0
    for i, ch in enumerate(inner):
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                items.append(split_top_level_props(inner[start : i + 1]))
    choices = []
    for item in items:
        choice = {}
        for k, v in item.items():
            s = parse_string(v)
            if s is not None:
                choice[k] = s
            else:
                num = parse_number(v)
                if num is not None:
                    choice[k] = int(num) if num.is_integer() else num
                else:
                    b = parse_bool(v)
                    if b is not None:
                        choice[k] = b
                    else:
                        choice[k] = v.strip()
        choices.append(choice)
    return choices


def parse_node(raw: str) -> dict:
    props = split_top_level_props(raw)
    node: dict = {"raw_props": props}
    for key in ("location", "character", "narrative", "enter", "badge", "lesson", "choicePrefix", "dynamicChoices", "endingType"):
        if key in props:
            val = parse_string(props[key])
            if val is not None:
                node[key] = val
    if "goldenRule" in props:
        num = parse_number(props["goldenRule"])
        if num is not None:
            node["goldenRule"] = int(num)
    if "ending" in props:
        node["ending"] = parse_bool(props["ending"]) is True
    if "choices" in props:
        node["choices"] = parse_choices(props["choices"])
    else:
        node["choices"] = []
    if "typingChallenge" in props:
        tc = split_top_level_props(props["typingChallenge"])
        node["typingChallenge"] = {
            "next": parse_string(tc.get("next", "")) or "",
            "prompt": parse_string(tc.get("prompt", "")) or "",
            "minWords": int(parse_number(tc.get("minWords", "0")) or 0),
        }
    if "rngBadge" in props:
        rb = split_top_level_props(props["rngBadge"])
        node["rngBadge"] = {"badge": parse_string(rb.get("badge", "")) or ""}
    return node


def parse_named_object_map(src: str, const_name: str) -> dict[str, dict]:
    obj = extract_object_literal(src, const_name)
    props = split_top_level_props(obj)
    return {k: split_top_level_props(v) if v.strip().startswith("{") else {"_raw": v} for k, v in props.items()}


def parse_string_map(obj_props: dict[str, dict], field: str) -> dict[str, str]:
    out = {}
    for key, props in obj_props.items():
        if field in props:
            val = parse_string(props[field])
            if val is not None:
                out[key] = val
            else:
                # template literals like `${BASE}/heroes/...` — keep raw
                out[key] = props[field].strip()
    return out


story_src = read("scripts/tech-trail-story.js")
visual_src = read("scripts/tech-trail-visuals.js")
typing_src = read("scripts/tech-trail-typing-engine.js")
audio_src = read("scripts/tech-trail-audio.js")
index_src = read("tech-trail/index.njk")

characters = parse_named_object_map(story_src, "CHARACTERS")
story_props = split_top_level_props(extract_object_literal(story_src, "STORY"))
STORY = {k: parse_node(v) for k, v in story_props.items()}

spine_raw = extract_object_literal(story_src, "GOLDEN_SPINE").replace("const GOLDEN_SPINE = ", "", 1) if False else None
# GOLDEN_SPINE is an array
spine_m = re.search(r"const GOLDEN_SPINE = \[", story_src)
if not spine_m:
    fail("GOLDEN_SPINE missing")
    GOLDEN_SPINE = []
else:
    start = spine_m.end() - 1
    depth = 0
    end = start
    for i, ch in enumerate(story_src[start:], start):
        if ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    GOLDEN_SPINE = parse_choices(story_src[start:end])

missions_m = re.search(r"const START_MISSIONS = \[", story_src)
start = missions_m.end() - 1
depth = 0
end = start
for i, ch in enumerate(story_src[start:], start):
    if ch == "[":
        depth += 1
    elif ch == "]":
        depth -= 1
        if depth == 0:
            end = i + 1
            break
START_MISSIONS = parse_choices(story_src[start:end])

visuals_portraits_raw = extract_object_literal(visual_src, "PORTRAITS")
portrait_props = split_top_level_props(visuals_portraits_raw)
PORTRAITS = {k: v.strip() for k, v in portrait_props.items()}

zones_obj = parse_named_object_map(visual_src, "ZONES")
ZONES = {}
for k, props in zones_obj.items():
    ZONES[k] = {"bg": props.get("bg", "").strip(), "mood": parse_string(props.get("mood", ""))}

node_zone_props = split_top_level_props(extract_object_literal(visual_src, "NODE_ZONE"))
NODE_ZONE = {k: parse_string(v) for k, v in node_zone_props.items()}

BADGES = set(parse_named_object_map(visual_src, "BADGES").keys())
LESSONS = set(parse_named_object_map(visual_src, "LESSONS").keys())

guide_name = parse_string(characters.get("guide", {}).get("name", ""))
if guide_name != "Mr. Phil":
    fail(f'Host name is "{guide_name}", expected Mr. Phil')
if "hero-phil.png" not in PORTRAITS.get("guide", ""):
    fail(f"Guide portrait is {PORTRAITS.get('guide')}")

node_ids = list(STORY)
outgoing = []
for nid, node in STORY.items():
    if not node.get("location"):
        warn(f"{nid}: missing location")
    if not node.get("narrative"):
        fail(f"{nid}: missing narrative")
    if not node.get("character"):
        fail(f"{nid}: missing character")
    elif node["character"] not in characters:
        fail(f"{nid}: unknown character \"{node['character']}\"")
    if node.get("badge") and node["badge"] not in BADGES:
        fail(f"{nid}: unknown badge \"{node['badge']}\"")
    if node.get("lesson") and node["lesson"] not in LESSONS:
        fail(f"{nid}: unknown lesson \"{node['lesson']}\"")
    if node.get("rngBadge", {}).get("badge") and node["rngBadge"]["badge"] not in BADGES:
        fail(f"{nid}: unknown rng badge \"{node['rngBadge']['badge']}\"")
    if node.get("goldenRule") and not (1 <= node["goldenRule"] <= 5):
        fail(f"{nid}: goldenRule {node['goldenRule']} out of range")
    if (
        not node.get("ending")
        and not node.get("choices")
        and not node.get("typingChallenge", {}).get("next")
        and node.get("dynamicChoices") != "start"
    ):
        fail(f"{nid}: dead end with no choices, typing next, or dynamic start board")
    type_texts = [
        str(c.get("typeText") or c.get("label") or "").strip().lower()
        for c in node.get("choices") or []
        if str(c.get("typeText") or c.get("label") or "").strip()
    ]
    for i, a in enumerate(type_texts):
        for b in type_texts[i + 1 :]:
            if a == b:
                fail(f'{nid}: duplicate typeText "{a}"')
            elif a.startswith(b) or b.startswith(a):
                warn(f'{nid}: overlapping typeText "{a}" / "{b}"')
    for c in node.get("choices") or []:
        if c.get("next"):
            outgoing.append((nid, c["next"], f"choice:{c.get('typeText') or c.get('label')}"))
    if node.get("typingChallenge", {}).get("next"):
        outgoing.append((nid, node["typingChallenge"]["next"], "typingChallenge"))

for src_id, dest, via in outgoing:
    if dest not in STORY:
        fail(f'{src_id} → missing node "{dest}" ({via})')

for mission in START_MISSIONS:
    if mission.get("next") not in STORY:
        fail(f'START_MISSIONS → missing "{mission.get("next")}"')
for spine in GOLDEN_SPINE:
    if spine.get("next") not in STORY:
        fail(f'GOLDEN_SPINE → missing "{spine.get("next")}"')

golden_sources: dict[int, list[str]] = defaultdict(list)
for nid, node in STORY.items():
    if node.get("goldenRule"):
        golden_sources[node["goldenRule"]].append(nid)
for n in range(1, 6):
    if not golden_sources[n]:
        fail(f"Golden Rule {n} is never awarded")

DIFFICULTY = {
    "cadet": {"startChoicesMin": 3, "startChoicesMax": 3},
    "operative": {"startChoicesMin": 3, "startChoicesMax": 4},
    "analyst": {"startChoicesMin": 4, "startChoicesMax": 5},
}


def next_spine(golden: set[int]):
    for s in GOLDEN_SPINE:
        if s.get("rule") not in golden:
            return s
    return None


def build_start_choices(golden: set[int], rng: random.Random, tier: str):
    cfg = DIFFICULTY[tier]
    count = cfg["startChoicesMin"] + rng.randrange(cfg["startChoicesMax"] - cfg["startChoicesMin"] + 1)
    missing = [s for s in GOLDEN_SPINE if s.get("rule") not in golden]
    rng.shuffle(missing)
    guaranteed = [{"next": s["next"], "typeText": s.get("typeText")} for s in missing[: min(2, len(missing))]]
    used = {g["next"] for g in guaranteed}
    extras = [m for m in START_MISSIONS if m.get("next") not in used]
    rng.shuffle(extras)
    extras = extras[: max(0, count - len(guaranteed))]
    board = guaranteed + extras
    rng.shuffle(board)
    return board


def enhance_choices(node: dict, node_id: str, golden: set[int]):
    lst = [dict(c) for c in node.get("choices") or []]
    if not lst or node.get("dynamicChoices") == "start" or node_id == "start":
        return lst
    spine = next_spine(golden)
    too_early = len(golden) < 3
    mapped = []
    for c in lst:
        if c.get("next") in ("final_trial", "mentor_ending") and too_early and spine:
            mapped.append({**c, "next": spine["next"], "typeText": spine.get("typeText")})
        else:
            mapped.append(c)
    is_win = bool(node.get("badge") or node.get("goldenRule"))
    if is_win and spine and not any(c.get("next") in (spine["next"], "final_trial") for c in mapped):
        mapped.insert(0, {"next": spine["next"], "typeText": spine.get("typeText"), "label": spine.get("label")})
    return mapped


reachable: set[str] = set()


def playthrough(seed: int, tier: str):
    rng = random.Random(seed)
    golden: set[int] = set()
    visited = []
    node_id = "start"
    integrity = 100
    for step in range(120):
        node = STORY.get(node_id)
        if not node:
            return {"ok": False, "reason": f"missing {node_id}", "visited": visited, "golden": golden}
        visited.append(node_id)
        reachable.add(node_id)
        if node.get("goldenRule"):
            golden.add(node["goldenRule"])
        if node.get("ending"):
            return {
                "ok": True,
                "ending": node.get("endingType") or "ending",
                "steps": step + 1,
                "visited": visited,
                "golden": golden,
                "integrity": integrity,
            }
        if node.get("typingChallenge", {}).get("next"):
            node_id = node["typingChallenge"]["next"]
            continue
        if node.get("dynamicChoices") == "start":
            choices = build_start_choices(golden, rng, tier)
        else:
            choices = enhance_choices(node, node_id, golden)
        if not choices:
            return {"ok": False, "reason": f"dead end at {node_id}", "visited": visited, "golden": golden}
        pick = choices[rng.randrange(len(choices))]
        if isinstance(pick.get("integrity"), (int, float)):
            integrity = max(0, min(100, integrity + pick["integrity"]))
        if not pick.get("next"):
            return {"ok": False, "reason": f"choice with no next at {node_id}", "visited": visited, "golden": golden}
        node_id = pick["next"]
    return {"ok": False, "reason": f"run exceeded 120 steps at {node_id}", "visited": visited, "golden": golden}


RUNS = 1500
endings: dict[str, int] = defaultdict(int)
golden_hist = defaultdict(int)
failures = 0
fail_samples = []
tiers = ["cadet", "operative", "analyst"]

for i in range(RUNS):
    tier = tiers[i % 3]
    result = playthrough(1000 + i * 97, tier)
    if not result["ok"]:
        failures += 1
        if len(fail_samples) < 8:
            trail = " → ".join(result["visited"][-6:])
            fail_samples.append(f"{tier}: {result['reason']} via {trail}")
        continue
    endings[result["ending"]] += 1
    golden_hist[len(result["golden"])] += 1

if failures:
    fail(f"{failures}/{RUNS} playthroughs failed. Samples: {' | '.join(fail_samples)}")

unreached = [nid for nid in node_ids if nid not in reachable and nid != "mentor_ending"]
if unreached:
    warn(f"Unreached in {RUNS} random runs: {', '.join(unreached)}")


def resolve_asset(raw: str) -> str | None:
    raw = raw.strip().rstrip(",")
    m = re.search(r"\$\{BASE\}(/[^\"'`]+)", raw)
    if m:
        return "/tech-trail/images" + m.group(1)
    m = re.search(r"(/tech-trail/[^\"'`]+)", raw)
    return m.group(0) if m else None


for key, raw in PORTRAITS.items():
    url = resolve_asset(raw)
    if not url:
        fail(f"Could not resolve portrait for {key}: {raw}")
        continue
    rel = url.lstrip("/").replace("/", os.sep)
    if not (SITE / rel).exists():
        fail(f"Missing portrait file for {key}: {url}")

for key, zone in ZONES.items():
    url = resolve_asset(zone["bg"])
    if not url:
        fail(f"Could not resolve zone art for {key}: {zone['bg']}")
        continue
    rel = url.lstrip("/").replace("/", os.sep)
    if not (SITE / rel).exists():
        fail(f"Missing zone art for {key}: {url}")

for nid in STORY:
    if nid not in NODE_ZONE:
        warn(f"{nid}: no NODE_ZONE mapping (falls back to acme)")

music = SITE / "tech-trail" / "audio" / "the-complex.mp3"
if not music.exists():
    fail("Missing soundtrack src/site/tech-trail/audio/the-complex.mp3")
elif music.stat().st_size < 100_000:
    fail("Soundtrack file is suspiciously small")

if "The Complex" not in audio_src:
    fail("tech-trail-audio.js is missing The Complex attribution")
if "Kevin MacLeod" not in audio_src:
    fail("tech-trail-audio.js is missing Kevin MacLeod credit")
if "creativecommons.org/licenses/by/4.0" not in audio_src:
    fail("tech-trail-audio.js is missing CC BY 4.0 URL")
if "The Complex" not in index_src:
    fail("Title screen is missing soundtrack attribution")
if "highContrastToggle" not in index_src:
    fail("Title screen is missing high contrast toggle")
if "tt-high-contrast" not in read("styles/write-platform.scss"):
    fail("High contrast styles missing")
if ".tt-title-screen__bg" not in read("styles/write-platform.scss") or "tt-high-contrast .tt-title-screen__bg" not in read(
    "styles/write-platform.scss"
):
    fail("High contrast does not cover the title screen background")

ratio_m = re.search(r"RECOMMENDED_SPEED_RATIO = ([0-9.]+)", typing_src)
if not ratio_m or float(ratio_m.group(1)) != 0.5:
    fail(f"Recommended speed ratio is {ratio_m.group(1) if ratio_m else 'missing'}, expected 0.5")


def evaluate_challenge_unlock(**cfg):
    words = max(0, cfg.get("words") or 0)
    min_words = max(1, cfg.get("minWords") or 20)
    live_cpm = max(0, cfg.get("liveCpm") or 0)
    target_cpm = max(0, cfg.get("targetCpm") or 0)
    accuracy = min(1, max(0, cfg.get("accuracy") or 0))
    speed_gate = cfg.get("speedGate", 0.85)
    accuracy_min = cfg.get("accuracyMin", 0.68)
    min_words_floor = cfg.get("minWordsFloor", 4)
    speed_ratio = live_cpm / target_cpm if target_cpm > 0 else 1
    speed_ok = speed_ratio >= speed_gate
    accuracy_ok = accuracy >= accuracy_min
    enough_floor = words >= min_words_floor
    word_soft = min(1, words / min_words)
    score = min(1, max(0, speed_ratio)) * 0.62 + accuracy * 0.28 + word_soft * 0.1
    unlocked = enough_floor and accuracy_ok and (speed_ok or (word_soft >= 0.5 and score >= 0.58))
    return unlocked


if not evaluate_challenge_unlock(
    words=4, minWords=20, liveCpm=40, targetCpm=50, accuracy=0.6, speedGate=0.7, accuracyMin=0.5, minWordsFloor=3
):
    fail("Cadet should unlock at ~80% of target with decent accuracy and a few real words")
if evaluate_challenge_unlock(
    words=2, minWords=20, liveCpm=10, targetCpm=50, accuracy=0.3, speedGate=0.85, accuracyMin=0.68, minWordsFloor=4
):
    fail("Operative should not unlock on slow + inaccurate + tiny word count")

print(f"Nodes: {len(node_ids)}")
print(f"Playthroughs: {RUNS - failures}/{RUNS} ok")
print("Endings:", dict(endings))
print("Golden rules collected:", dict(sorted(golden_hist.items())))
print(f"Reachable: {len(reachable)}/{len(node_ids)}")
if warnings:
    print(f"\nWarnings ({len(warnings)}):")
    for w in warnings:
        print("  -", w)
if errors:
    print(f"\nFAILED ({len(errors)}):", file=sys.stderr)
    for e in errors:
        print("  -", e, file=sys.stderr)
    sys.exit(1)
print("\nGTG stress test passed.")
