import json, random, os, re

# Deterministic seeds for each World 1 level (reproducible builds)
SEEDS_W1 = {1: 101, 2: 102, 3: 103, 4: 104, 5: 105, 6: 106}
SEEDS_W2 = {1: 201, 2: 202, 3: 203, 4: 204, 5: 205, 6: 206}
SEEDS_W3 = {1: 301, 2: 302, 3: 303, 4: 304, 5: 305, 6: 306}

LAYOUT_CONFIGS = {
    # seg_count includes body segments only; opening (2) + closing (2) + runway (1) are added automatically
    "STRAIGHTAWAY":   {"seg_count": [10,13], "length_range": [25,45], "width_range": [10,12], "ramp_range": [-0.5,-0.2], "x_shift": 0,  "jump_chance": 0.0},
    "WIDE_TO_SMALL":  {"seg_count": [11,14], "length_range": [20,35], "width_start": 12, "width_end": 6,  "ramp_range": [-0.5,1.5], "x_shift": 0,  "jump_chance": 0.15},
    "SMALL_TO_WIDE":  {"seg_count": [11,14], "length_range": [20,35], "width_start": 6,  "width_end": 12, "ramp_range": [-0.5,1.5], "x_shift": 0,  "jump_chance": 0.15},
    "CURVES":         {"seg_count": [12,15], "length_range": [20,30], "width_range": [8,10],  "ramp_range": [-0.3,0.3],  "x_shift": 3,  "jump_chance": 0.2},
    "HILLS":          {"seg_count": [12,16], "length_range": [18,28], "width_range": [8,10],  "ramp_range": [-2.5,2.5], "x_shift": 0,  "jump_chance": 0.25},
    "COMBINATION":    {"seg_count": [14,18], "length_range": [15,30], "width_range": [6,12],  "ramp_range": [-2.5,2.5], "x_shift": 3,  "jump_chance": 0.3},
}

OBSTACLE_DR = {
    "magnet": 5, "wind": 4, "spike": 3, "bumper": 2, "gravity": 2,
    "pot": 1,
    "brake_pad": -1,
}

WORLD_BIAS = {
    1: ["bumper", "spike", "pot"],
    2: ["spike", "bumper", "pot"],
    3: ["gravity", "spike", "bumper", "pot"],
    4: ["bumper", "spike", "wind", "pot"],
    5: ["wind", "spike", "bumper", "pot"],
    6: ["magnet", "spike", "bumper", "pot"],
}

def fallback_pool(world):
    base = ["brake_pad", "bumper", "spike", "pot"]
    if world >= 3:
        base.append("gravity")
    if world >= 4:
        base.append("wind")
    if world >= 6:
        base.append("magnet")
    return base

HOOP_BOOSTS = [20.0, 24.0, 28.0, 32.0, 36.0, 40.0]
LAYOUT_NAMES = {"STRAIGHTAWAY":"Speedway","WIDE_TO_SMALL":"Funnel","SMALL_TO_WIDE":"Broadway","CURVES":"S-Curve","HILLS":"Roller","COMBINATION":"Gauntlet"}

# Zone constants — every level starts with an opening straightaway (acclimation)
# and ends with a closing straightaway (predictable landing). The body is the
# layout-specific excitement in between. Obstacles are never placed in zones.
OPENING_ZONE_SEGS = 2
CLOSING_ZONE_SEGS = 2

def pick_layout(world, level, rng):
    if level == 6: return "COMBINATION"
    if world == 1:
        if level == 1: return "STRAIGHTAWAY"
        if level == 2: return "WIDE_TO_SMALL"
        if level == 3: return "HILLS"
        if level == 4: return rng.choice(["SMALL_TO_WIDE", "STRAIGHTAWAY"])
        if level == 5: return rng.choice(["HILLS", "WIDE_TO_SMALL", "SMALL_TO_WIDE"])
    if level == 3:
        hard_choices = ["HILLS", "WIDE_TO_SMALL", "SMALL_TO_WIDE"]
        if world != 1:
            hard_choices.append("CURVES")
        return rng.choice(hard_choices)
    choices = ["STRAIGHTAWAY","WIDE_TO_SMALL","SMALL_TO_WIDE","HILLS"]
    if world != 1:
        choices.append("CURVES")
    return rng.choice(choices)

def build_segments(layout_type, world, level, rng):
    cfg = LAYOUT_CONFIGS[layout_type]
    count = rng.randint(cfg["seg_count"][0], cfg["seg_count"][1])
    if world == 1 and layout_type == "COMBINATION":
        count = rng.randint(12, 15)
    segs, z, current_y, prev_z1 = [], 0.0, 0.0, 0.0

    # ── OPENING STRAIGHTAWAY: Acclimation / Takeoff ─────────────────────────
    for i in range(OPENING_ZONE_SEGS):
        length = rng.uniform(25.0, 35.0)
        z0, z1 = z, z - length
        w = rng.uniform(10.0, 12.0)
        if world == 1:
            w = max(w, 8.0)
        ramp = rng.uniform(-0.3, 0.0)
        ramp = round(ramp * 10) / 10
        seg = {"z0": round(z0,1), "z1": round(z1,1), "w": round(w,1), "x": 0.0, "ramp": ramp}
        if current_y != 0.0:
            seg["y"] = round(current_y, 1)
        segs.append(seg)
        current_y += ramp
        prev_z1, z = z1, z1

    # ── BODY: Layout-specific excitement ────────────────────────────────────
    body_count = max(count - OPENING_ZONE_SEGS - CLOSING_ZONE_SEGS, 3)
    for i in range(body_count):
        length = rng.uniform(cfg["length_range"][0], cfg["length_range"][1])
        z0, z1 = z, z - length
        if "width_start" in cfg:
            t = i / max(body_count - 1, 1)
            w = cfg["width_start"] + (cfg["width_end"] - cfg["width_start"]) * t
        else:
            w = rng.uniform(cfg["width_range"][0], cfg["width_range"][1])
        if world == 1:
            w = max(w, 7.0)
        if cfg["x_shift"] == 0:
            x = 0.0
        else:
            x = cfg["x_shift"] * (1.0 if i % 2 == 0 else -1.0) + rng.uniform(-0.5, 0.5)
        # Smooth transition from opening (x=0)
        if i == 0:
            x *= 0.3
        # Smooth transition toward closing (x=0)
        elif i == body_count - 1 and cfg["x_shift"] != 0:
            x *= 0.3

        ramp = rng.uniform(cfg["ramp_range"][0], cfg["ramp_range"][1])
        if cfg["x_shift"] == 0 and abs(cfg["ramp_range"][0]) > 1.0:
            ramp = abs(ramp) if i % 2 == 0 else -abs(ramp)
        # World 1: gentler ramps
        if world == 1:
            ramp = max(min(ramp, 1.5), -1.5)
            if layout_type == "COMBINATION":
                ramp = max(min(ramp, 1.5), -1.5)
        ramp = round(ramp * 10) / 10

        # First body segment: ease ramp from opening
        if i == 0:
            opening_ramp = segs[-1].get("ramp", 0.0)
            ramp = opening_ramp + (ramp - opening_ramp) * 0.6
            ramp = round(ramp * 10) / 10

        # Last body segment: ease ramp toward 0 for closing
        if i == body_count - 1:
            ramp = ramp * 0.5
            ramp = round(ramp * 10) / 10

        # Verticity bumps: replace flat segments with small launch ramps for fun
        if abs(ramp) < 0.2 and rng.random() < 0.25:
            ramp = round(rng.uniform(0.5, 1.0), 1)

        is_jump = False
        jump_chance = cfg["jump_chance"]
        if world == 1 and layout_type == "COMBINATION":
            jump_chance = 0.08
        if rng.random() < jump_chance and ramp >= 0:
            is_jump, ramp = True, 2.5
        seg_y = current_y
        seg = {"z0": round(z0,1), "z1": round(z1,1), "w": round(w,1), "x": round(x,1), "ramp": ramp}
        if is_jump: seg["jump"] = True
        logic_world = world if world > 0 else 1
        if logic_world == 2 and rng.random() < 0.35: seg["ice"] = True
        if seg_y != 0.0: seg["y"] = round(seg_y,1)
        segs.append(seg)
        current_y = seg_y if is_jump else (seg_y + ramp if ramp != 0.0 else seg_y)
        prev_z1, z = z1, z1

    # ── CLOSING STRAIGHTAWAY: Predictable landing ───────────────────────────
    last_body_x = segs[-1].get("x", 0.0) if segs else 0.0
    last_body_ramp = segs[-1].get("ramp", 0.0) if segs else 0.0
    for i in range(CLOSING_ZONE_SEGS):
        length = rng.uniform(25.0, 35.0)
        z0, z1 = z, z - length
        w = rng.uniform(10.0, 12.0)
        if world == 1:
            w = max(w, 8.0)
        t = (i + 1) / CLOSING_ZONE_SEGS
        x = last_body_x + (0.0 - last_body_x) * t
        ramp = last_body_ramp + (0.0 - last_body_ramp) * t
        ramp = round(ramp * 10) / 10
        seg_y = current_y
        seg = {"z0": round(z0,1), "z1": round(z1,1), "w": round(w,1), "x": round(x,1), "ramp": ramp}
        if seg_y != 0.0: seg["y"] = round(seg_y,1)
        segs.append(seg)
        current_y = seg_y + ramp
        prev_z1, z = z1, z1

    runway = rng.uniform(15, 25)
    segs.append({"z0": round(z,1), "z1": round(z - runway,1), "w": 10.0, "x": 0.0, "ramp": 0.0})
    if current_y != 0.0:
        segs[-1]["y"] = round(current_y, 1)
    segs = ensure_gap_speed_setup(segs)
    return segs

def ensure_gap_speed_setup(segs):
    for i in range(1, len(segs) - 1):
        if segs[i].get("jump", False):
            prev_ramp = segs[i - 1].get("ramp", 0.0)
            if prev_ramp >= -0.5:
                segs[i - 1]["ramp"] = -1.0
                segs[i - 1]["w"] = max(segs[i - 1].get("w", 8.0), 9.0)
    return segs

def build_obstacles(segments, world, level):
    logic_world = world if world > 0 else 1
    budget = 5 + (logic_world - 1) * 3 + (level - 1) * 2
    if level == 3:
        budget += 2
    if logic_world == 1:
        if level <= 2:
            budget = max(budget - 3, 3)
        elif level <= 4:
            budget = max(budget - 1, 4)
    bias = WORLD_BIAS.get(logic_world, WORLD_BIAS[1])
    obstacles = []
    placed_obs = []  # [{z, half_len}]
    min_spacing = 16.0 if logic_world == 1 else 12.0
    ground_only = {"brake_pad", "bumper", "spike", "pot"}
    scored = []
    for i, seg in enumerate(segments):
        # Skip opening zone, closing zone, and runway finish segment
        skip_end = CLOSING_ZONE_SEGS + 1  # closing + runway
        if i < OPENING_ZONE_SEGS or i >= len(segments) - skip_end:
            continue
        score = 0.0
        if seg.get("jump", False): score += 40.0
        if abs(seg.get("ramp", 0.0)) >= 2.0: score += 20.0
        elif abs(seg.get("ramp", 0.0)) >= 1.0: score += 10.0
        w = seg.get("w", 10.0)
        if w <= 7.0: score += 15.0
        elif w <= 8.0: score += 8.0
        if abs(seg.get("x", 0.0)) >= 2.0: score += 10.0
        scored.append({"seg": seg, "score": score, "z": (seg["z0"] + seg["z1"]) * 0.5})
    scored.sort(key=lambda e: e["score"], reverse=True)
    for entry in scored:
        if budget <= 0: break
        seg, z = entry["seg"], entry["z"]
        is_jump = seg.get("jump", False)
        if rng.random() < 0.75 and bias:
            kind = rng.choice(bias)
        else:
            kind = rng.choice(fallback_pool(logic_world))
        # Ground obstacles need solid track -- skip jumps
        if is_jump and kind in ground_only:
            continue
        dr = OBSTACLE_DR.get(kind, 0)
        if dr > 0 and budget < dr: continue
        obs = make_obstacle(kind, seg, z, world)
        if not obs:
            continue
        # Size-aware spacing
        obs_half_len = obs.get("length", 4.0) * 0.5
        too_close = False
        for po in placed_obs:
            required = po["half_len"] + obs_half_len + min_spacing * 0.5
            if abs(po["z"] - z) < required:
                too_close = True
                break
        if too_close:
            continue
        obstacles.append(obs)
        placed_obs.append({"z": z, "half_len": obs_half_len})
        budget -= max(dr, 0)
    return obstacles

def make_obstacle(kind, seg, z, world):
    x, w = seg.get("x", 0.0), seg.get("w", 10.0)
    seg_y = seg.get("y", 0.0)
    obs = {"kind": kind, "z": round(z,1), "x": round(x,1), "seg_y": round(seg_y,1)}
    if kind == "brake_pad": obs["strength"], obs["is_brake"] = round(rng.uniform(6.0, 10.0), 1), True
    elif kind == "bumper":
        obs["force"] = round(rng.uniform(18.0, 24.0), 1)
        obs["x"] = round(x + (w * 0.3 if rng.random() > 0.5 else -w * 0.3), 1)
    elif kind == "spike":
        obs["width"] = round(max(2.0, min(rng.uniform(4.0, w - 1.0), w - 1.0)), 1)
        obs["length"] = round(rng.uniform(1.5, 3.0), 1)
    elif kind == "wind":
        obs["force"] = round(rng.uniform(16.0, 26.0), 1)
        obs["direction"] = [1.0 if rng.random() > 0.5 else -1.0, 0.0, 0.0]
        obs["length"] = round(rng.uniform(20.0, 40.0), 1)
    elif kind == "gravity":
        obs["type"] = rng.randint(0, 3)
        obs["multiplier"] = round(rng.uniform(1.5, 3.5), 1)
        obs["length"] = round(rng.uniform(20.0, 40.0), 1)
    elif kind == "magnet":
        obs["type"] = "attract" if rng.random() > 0.3 else "repel"
        obs["strength"] = round(rng.uniform(14.0, 22.0), 1)
        obs["length"] = round(rng.uniform(40.0, 70.0), 1)
    elif kind == "pot":
        max_offset = max(0.0, w * 0.5 - 2.3)
        obs["x"] = round(x + max(-max_offset, min(max_offset, rng.uniform(-w * 0.35, w * 0.35))), 1)
        obs["score_value"] = 15
    else: return None
    return obs

def segment_at_z(segments, z):
    for seg in segments:
        z0, z1 = seg["z0"], seg["z1"]
        if z0 > z1:
            if z1 <= z <= z0: return seg
        else:
            if z0 <= z <= z1: return seg
    return None

def build_hoops(segments, world):
    body_start = OPENING_ZONE_SEGS
    body_end = len(segments) - CLOSING_ZONE_SEGS - 1  # exclude runway
    if body_end <= body_start:
        return _build_hoops_legacy(segments, world)

    # ── 1. Score every body segment as a checkpoint candidate ────────────────
    candidates = []
    for i in range(body_start, body_end):
        seg = segments[i]
        score = 0.0
        z = (seg["z0"] + seg["z1"]) * 0.5
        ramp = seg.get("ramp", 0.0)
        w = seg.get("w", 10.0)
        x = seg.get("x", 0.0)
        has_jump = seg.get("jump", False)

        # Rest-zone scoring: flat/wide segments are ideal checkpoint habitats
        if abs(ramp) <= 0.3:
            score += 50.0
        elif abs(ramp) <= 0.8:
            score += 20.0
        else:
            score -= 30.0

        if w >= 9.0:
            score += 30.0
        elif w >= 7.0:
            score += 10.0
        else:
            score -= 40.0

        # Reward: checkpoint after a hard section (jump or steep downhill)
        if i > body_start:
            prev_ramp = segments[i - 1].get("ramp", 0.0)
            prev_jump = segments[i - 1].get("jump", False)
            if prev_jump or prev_ramp < -1.0:
                score += 20.0

        # Reward: checkpoint before upcoming build-up (uphill ahead)
        if i < body_end - 1:
            next_ramp = segments[i + 1].get("ramp", 0.0)
            if next_ramp > 0.5:
                score += 10.0

        # Penalty: never place hoop on a jump segment
        if has_jump:
            score -= 100.0

        # Penalty: avoid x discontinuities (player can't see hoop around sharp corners)
        if i > body_start:
            prev_x = segments[i - 1].get("x", 0.0)
            if abs(x - prev_x) > 2.0:
                score -= 20.0

        candidates.append({"seg": seg, "score": score, "z": z, "idx": i})

    candidates.sort(key=lambda e: e["score"], reverse=True)

    # ── 2. Greedily select up to 6 hoops with minimum spacing ─────────────────
    selected = []
    selected_z = []
    min_hoop_spacing = 22.0 if world == 1 else 16.0

    for cand in candidates:
        if len(selected) >= 6:
            break
        cz = cand["z"]
        too_close = False
        for sz in selected_z:
            if abs(sz - cz) < min_hoop_spacing:
                too_close = True
                break
        if too_close:
            continue
        selected.append(cand)
        selected_z.append(cz)

    # Sort front-to-back so boost progression matches level flow
    selected.sort(key=lambda e: e["z"], reverse=True)

    # ── 3. Assign height tiers (ground / mid / high) ──────────────────────────
    # Every level has at least 1 of each tier. Remaining 3 vary by world.
    if world == 1:
        tiers = [0, 0, 1, 1, 2, 2]
    elif world == 2:
        tiers = [0, 1, 1, 1, 2, 2]
    elif world == 3:
        tiers = [0, 1, 1, 2, 2, 2]
    elif world == 4:
        tiers = [0, 1, 2, 2, 2, 2]
    elif world == 5:
        tiers = [1, 1, 2, 2, 2, 2]
    elif world == 6:
        tiers = [1, 2, 2, 2, 2, 2]
    else:
        tiers = [0, 0, 1, 1, 2, 2]

    rng.shuffle(tiers)

    TIER_CLEARANCE = [[0.0, 0.4], [0.8, 1.5], [2.0, 3.2]]

    # ── 4. Build hoop geometry ─────────────────────────────────────────────
    hoops = []
    for i, cand in enumerate(selected):
        seg = cand["seg"]
        z = cand["z"]
        base_x = seg.get("x", 0.0)
        w = seg.get("w", 10.0)
        seg_y = seg.get("y", 0.0)
        has_jump = seg.get("jump", False)
        ramp = abs(seg.get("ramp", 0.0))
        tier = tiers[i]

        # Offset scales with tier: ground = centered, mid = moderate, high = wild
        if tier == 0:
            offset = rng.uniform(-1.2, 1.2)
        elif tier == 1:
            offset = (1.0 if rng.random() > 0.5 else -1.0) * rng.uniform(1.5, 2.5)
        else:
            offset = (1.0 if rng.random() > 0.5 else -1.0) * rng.uniform(2.5, 4.0)

        half_w = w * 0.5 - 0.5
        if abs(offset) > half_w:
            offset = (1 if offset > 0 else -1) * half_w

        clearance_range = TIER_CLEARANCE[tier]
        clearance = rng.uniform(clearance_range[0], clearance_range[1])

        if has_jump:
            clearance += rng.uniform(0.5, 1.0)
        elif ramp >= 2.0:
            clearance += rng.uniform(0.3, 0.6)
        y = seg_y + 0.7 + clearance
        hoops.append({"z": round(z,1), "x": round(base_x + offset,1), "y": round(y,1), "boost": HOOP_BOOSTS[i]})
    return hoops

def _build_hoops_legacy(segments, world):
    total_len = sum(abs(seg["z1"] - seg["z0"]) for seg in segments)
    z_positions = []
    for i in range(6):
        t = 0.18 + i * 0.11 if world == 1 else (i + 1) / 7.0
        z_positions.append(-total_len * t)

    if world == 1:
        tiers = [0, 0, 1, 1, 2, 2]
    elif world == 2:
        tiers = [0, 1, 1, 1, 2, 2]
    elif world == 3:
        tiers = [0, 1, 1, 2, 2, 2]
    elif world == 4:
        tiers = [0, 1, 2, 2, 2, 2]
    elif world == 5:
        tiers = [1, 1, 2, 2, 2, 2]
    elif world == 6:
        tiers = [1, 2, 2, 2, 2, 2]
    else:
        tiers = [0, 0, 1, 1, 2, 2]
    rng.shuffle(tiers)

    TIER_CLEARANCE = [[0.0, 0.4], [0.8, 1.5], [2.0, 3.2]]

    hoops = []
    for i in range(6):
        z = z_positions[i]
        seg = segment_at_z(segments, z)
        if not seg:
            continue
        base_x = seg.get("x", 0.0)
        w = seg.get("w", 10.0)
        seg_y = seg.get("y", 0.0)
        tier = tiers[i]

        if tier == 0:
            offset = rng.uniform(-1.2, 1.2)
        elif tier == 1:
            offset = (1.0 if rng.random() > 0.5 else -1.0) * rng.uniform(1.5, 2.5)
        else:
            offset = (1.0 if rng.random() > 0.5 else -1.0) * rng.uniform(2.5, 4.0)

        half_w = w * 0.5 - 0.5
        if abs(offset) > half_w:
            offset = (1 if offset > 0 else -1) * half_w
        clearance_range = TIER_CLEARANCE[tier]
        clearance = rng.uniform(clearance_range[0], clearance_range[1])
        y = seg_y + 0.7 + clearance
        hoops.append({"z": round(z,1), "x": round(base_x + offset,1), "y": round(y,1), "boost": HOOP_BOOSTS[i]})
    return hoops

def compute_finish_z(segments): return segments[-1]["z1"] if segments else -200.0

def compute_par_time(segments):
    total_len = sum(abs(seg["z1"] - seg["z0"]) for seg in segments)
    total_ramp = sum(seg.get("ramp", 0.0) for seg in segments)
    base = total_len / 12.0
    if total_ramp > 0: base += total_ramp * 1.5
    if total_ramp < 0: base += total_ramp * 0.5
    return round(base * 10) / 10

def medal_times(par): return {"bronze": round(par * 1.15 * 10) / 10, "silver": round(par * 0.85 * 10) / 10, "gold": round(par * 0.65 * 10) / 10}

def generate(world, level, seed_):
    global rng
    rng = random.Random(seed_)
    logic_world = world if world > 0 else 1
    layout_type = pick_layout(world, level, rng)
    segments = build_segments(layout_type, world, level, rng)
    obstacles = build_obstacles(segments, logic_world, level)
    hoops = build_hoops(segments, world)
    finish_z = compute_finish_z(segments)
    par_time = compute_par_time(segments)
    all_obs = list(obstacles)
    for h in hoops:
        all_obs.append({"kind": "hoop", "z": h["z"], "x": h["x"], "y": h["y"]})
    checkpoints = [h["z"] for h in hoops]
    name = f"Secret Gauntlet S-{level}" if world == 0 else f"{LAYOUT_NAMES.get(layout_type, 'Track')} {world}-{level}"
    return {"name": name, "slope": rng.randint(9, 14), "par_time": par_time, "segments": segments, "coins": [], "finish_z": finish_z, "checkpoints": checkpoints, "obstacles": all_obs, "medal_times": medal_times(par_time)}

# ── TSCN cleaner ────────────────────────────────────────────────────────────────

def clean_tscn(path, new_name, new_par_time):
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    output = []
    skip_current = False
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("["):
            skip_current = False
            if stripped.startswith('[node name="'):
                # Determine if this node is under TrackRoot
                if 'parent="TrackRoot"' in stripped or 'parent="TrackRoot/' in stripped:
                    skip_current = True
                elif 'name="TrackRoot"' in stripped:
                    skip_current = False
            if not skip_current:
                output.append(line)
        elif not skip_current:
            output.append(line)
    content = "".join(output)
    # Update level_name and par_time in the root node block
    content = re.sub(r'level_name\s*=\s*"[^"]*"', f'level_name = "{new_name}"', content)
    if not re.search(r'par_time\s*=\s*[\d.]+', content):
        # Insert par_time after level_name line
        content = re.sub(r'(level_name\s*=\s*"[^"]*"\n)', rf'\1par_time = {new_par_time}\n', content)
    else:
        content = re.sub(r'par_time\s*=\s*[\d.]+', f'par_time = {new_par_time}', content)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  Cleaned {path}")

# ── Main ───────────────────────────────────────────────────────────────────────

BASE = r"C:\Users\phili\OneDrive\Desktop\Physix"

def regenerate_world(world_num, seeds):
    for level in range(1, 7):
        seed_ = seeds[level]
        data = generate(world_num, level, seed_)
        json_path = os.path.join(BASE, "levels", f"{world_num}-{level}.json")
        with open(json_path, "w") as f:
            json.dump(data, f, indent=2)
            f.write("\n")
        print(f"Generated {world_num}-{level}.json | layout={data['name']} | par={data['par_time']} | segs={len(data['segments'])} | obs={len(data['obstacles'])} | hoops={len(data['checkpoints'])}")
        tscn_path = os.path.join(BASE, "scenes", "levels", f"world_{world_num}", f"level_{world_num}_{level}.tscn")
        if os.path.isfile(tscn_path):
            clean_tscn(tscn_path, data["name"], data["par_time"])

regenerate_world(1, SEEDS_W1)
regenerate_world(2, SEEDS_W2)
regenerate_world(3, SEEDS_W3)

print("\nDone! Worlds 1, 2 & 3 regenerated.")
