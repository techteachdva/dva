import json, random, sys

sys.path.insert(0, r"C:\Users\phili\OneDrive\Desktop\Physix\scripts")

LAYOUT_CONFIGS = {
    "STRAIGHTAWAY":   {"seg_count": [6,9],   "length_range": [25,45], "width_range": [10,12], "ramp_range": [-0.5,-0.2], "x_shift": 0,  "jump_chance": 0.0},
    "WIDE_TO_SMALL":  {"seg_count": [7,10],  "length_range": [20,35], "width_start": 12, "width_end": 6,  "ramp_range": [-0.5,1.5], "x_shift": 0,  "jump_chance": 0.15},
    "SMALL_TO_WIDE":  {"seg_count": [7,10],  "length_range": [20,35], "width_start": 6,  "width_end": 12, "ramp_range": [-0.5,1.5], "x_shift": 0,  "jump_chance": 0.15},
    "CURVES":         {"seg_count": [8,11],  "length_range": [20,30], "width_range": [8,10],  "ramp_range": [-0.3,0.3],  "x_shift": 3,  "jump_chance": 0.2},
    "HILLS":          {"seg_count": [8,12],  "length_range": [18,28], "width_range": [8,10],  "ramp_range": [-2.5,2.5], "x_shift": 0,  "jump_chance": 0.25},
    "COMBINATION":    {"seg_count": [10,14], "length_range": [15,30], "width_range": [6,12],  "ramp_range": [-2.5,2.5], "x_shift": 3,  "jump_chance": 0.3},
}

OBSTACLE_DR = {
    "magnet": 5, "wind": 4, "spike": 3, "bumper": 2, "gravity": 2,
    "speed_boost": -1, "brake_pad": -1,
}

WORLD_BIAS = {
    0: ["magnet", "wind", "gravity", "bumper", "spike", "speed_boost"],
    1: ["speed_boost", "bumper", "gravity", "spike"],
    2: ["speed_boost", "spike", "bumper"],
    3: ["gravity", "speed_boost", "spike", "bumper"],
    4: ["bumper", "speed_boost", "spike", "wind"],
    5: ["wind", "speed_boost", "spike", "bumper"],
    6: ["magnet", "speed_boost", "spike", "bumper"],
}

HOOP_BOOSTS = [20.0, 24.0, 28.0, 32.0, 36.0, 40.0]
LAYOUT_NAMES = {"STRAIGHTAWAY":"Speedway","WIDE_TO_SMALL":"Funnel","SMALL_TO_WIDE":"Broadway","CURVES":"S-Curve","HILLS":"Roller","COMBINATION":"Gauntlet"}

rng = random.Random(42)

def pick_layout(level):
    if level == 6: return "COMBINATION"
    return rng.choice(["STRAIGHTAWAY","WIDE_TO_SMALL","SMALL_TO_WIDE","CURVES","HILLS"])

def build_segments(layout_type, world, level):
    cfg = LAYOUT_CONFIGS[layout_type]
    count = rng.randint(cfg["seg_count"][0], cfg["seg_count"][1])
    segs, z, current_y, prev_z1 = [], 0.0, 0.0, 0.0
    for i in range(count):
        length = rng.uniform(cfg["length_range"][0], cfg["length_range"][1])
        z0, z1 = z, z - length
        if "width_start" in cfg:
            t = i / max(count - 1, 1)
            w = cfg["width_start"] + (cfg["width_end"] - cfg["width_start"]) * t
        else:
            w = rng.uniform(cfg["width_range"][0], cfg["width_range"][1])
        if cfg["x_shift"] == 0: x = 0.0
        else: x = cfg["x_shift"] * (1.0 if i % 2 == 0 else -1.0) + rng.uniform(-0.5, 0.5)
        ramp = rng.uniform(cfg["ramp_range"][0], cfg["ramp_range"][1])
        if cfg["x_shift"] == 0 and abs(cfg["ramp_range"][0]) > 1.0:
            ramp = abs(ramp) if i % 2 == 0 else -abs(ramp)
        ramp = round(ramp * 10) / 10
        is_jump = False
        if rng.random() < cfg["jump_chance"] and ramp >= 0:
            is_jump, ramp = True, 2.5
        seg_y = current_y
        if abs(z0 - prev_z1) > 0.5: seg_y = current_y
        seg = {"z0": round(z0,1), "z1": round(z1,1), "w": round(w,1), "x": round(x,1), "ramp": ramp}
        if is_jump: seg["jump"] = True
        logic_world = world if world > 0 else 1
        if logic_world == 2 and rng.random() < 0.35: seg["ice"] = True
        if seg_y != 0.0: seg["y"] = round(seg_y,1)
        segs.append(seg)
        current_y = seg_y if is_jump else (seg_y + ramp if ramp != 0.0 else seg_y)
        prev_z1, z = z1, z1
    runway = rng.uniform(15, 25)
    segs.append({"z0": round(z,1), "z1": round(z - runway,1), "w": 10.0, "x": 0.0, "ramp": 0.0})
    return segs

def build_obstacles(segments, world, level):
    logic_world = world if world > 0 else 1
    budget = 5 + (logic_world - 1) * 3 + (level - 1) * 2
    bias = WORLD_BIAS.get(logic_world, WORLD_BIAS[1])
    obstacles, placed_z = [], []
    scored = []
    for seg in segments:
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
        if any(abs(pz - z) < 12.0 for pz in placed_z): continue
        kind = rng.choice(bias) if rng.random() < 0.7 and bias else rng.choice(list(OBSTACLE_DR.keys()))
        dr = OBSTACLE_DR.get(kind, 0)
        if dr > 0 and budget < dr: continue
        obs = make_obstacle(kind, seg, z, world)
        if obs:
            obstacles.append(obs)
            placed_z.append(z)
            budget -= max(dr, 0)
    return obstacles

def make_obstacle(kind, seg, z, world):
    x, w = seg.get("x", 0.0), seg.get("w", 10.0)
    obs = {"kind": kind, "z": round(z,1), "x": round(x,1)}
    if kind == "speed_boost": obs["strength"] = round(rng.uniform(14.0, 20.0), 1)
    elif kind == "brake_pad": obs["strength"], obs["is_brake"] = round(rng.uniform(6.0, 10.0), 1), True
    elif kind == "bumper":
        obs["force"] = round(rng.uniform(18.0, 24.0), 1)
        obs["x"] = round(x + (w * 0.3 if rng.random() > 0.5 else -w * 0.3), 1)
    elif kind == "spike": obs["width"], obs["length"] = round(rng.uniform(4.0, w - 1.0), 1), round(rng.uniform(1.5, 3.0), 1)
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

def build_hoops(segments):
    total_len = sum(abs(seg["z1"] - seg["z0"]) for seg in segments)
    z_positions = [-total_len * ((i + 1) / 7.0) for i in range(6)]
    hoops = []
    for i in range(6):
        z = z_positions[i]
        seg = segment_at_z(segments, z)
        if not seg: continue
        base_x, w = seg.get("x", 0.0), seg.get("w", 10.0)
        has_jump, ramp = seg.get("jump", False), abs(seg.get("ramp", 0.0))
        seg_y = seg.get("y", 0.0)
        if i < 2:
            offset = rng.uniform(-1.5, 1.5)
            clearance = rng.uniform(1.5, 2.0)
        elif i < 4:
            offset = (1.0 if rng.random() > 0.5 else -1.0) * rng.uniform(2.5, 3.5)
            clearance = rng.uniform(2.0, 2.5)
        else:
            offset = (1.0 if rng.random() > 0.5 else -1.0) * rng.uniform(4.0, 5.0)
            clearance = rng.uniform(2.5, 3.5)
        half_w = w * 0.5 - 0.5
        if abs(offset) > half_w: offset = (1 if offset > 0 else -1) * half_w
        if has_jump:
            clearance += rng.uniform(0.5, 1.0)
        elif ramp >= 2.0:
            clearance += rng.uniform(0.3, 0.6)
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

def generate(world, level, logic_world_override=None):
    logic_world = logic_world_override if logic_world_override is not None else (world if world > 0 else 1)
    layout_type = pick_layout(level)
    segments = build_segments(layout_type, world, level)
    obstacles = build_obstacles(segments, logic_world, level)
    hoops = build_hoops(segments)
    finish_z = compute_finish_z(segments)
    par_time = compute_par_time(segments)
    all_obs = list(obstacles)
    for h in hoops:
        all_obs.append({"kind": "hoop", "z": h["z"], "x": h["x"], "y": h["y"]})
    checkpoints = [h["z"] for h in hoops]
    name = f"Secret Gauntlet S-{level}" if world == 0 else f"{LAYOUT_NAMES.get(layout_type, 'Track')} {world}-{level}"
    return {"name": name, "slope": rng.randint(9, 14), "par_time": par_time, "segments": segments, "coins": [], "finish_z": finish_z, "checkpoints": checkpoints, "obstacles": all_obs, "medal_times": medal_times(par_time)}

# Generate S-1 (World 1 logic)
data1 = generate(0, 1)
out_path1 = r"C:\Users\phili\OneDrive\Desktop\Physix\levels\S-1.json"
with open(out_path1, "w") as f:
    json.dump(data1, f, indent=2)
    f.write("\n")
print(f"Generated {out_path1}")
print(f"Segments: {len(data1['segments'])}, Obstacles: {len(data1['obstacles'])}, Checkpoints: {len(data1['checkpoints'])}")

# Generate S-2 (World 2 logic)
rng = random.Random(43)  # Different seed for totally different layout
data2 = generate(0, 2, logic_world_override=2)
out_path2 = r"C:\Users\phili\OneDrive\Desktop\Physix\levels\S-2.json"
with open(out_path2, "w") as f:
    json.dump(data2, f, indent=2)
    f.write("\n")
print(f"Generated {out_path2}")
print(f"Segments: {len(data2['segments'])}, Obstacles: {len(data2['obstacles'])}, Checkpoints: {len(data2['checkpoints'])}")
