import json, random, os

SEEDS = {1: 201, 2: 202, 3: 203, 4: 204, 5: 205, 6: 206}
BASE = r"C:\Users\phili\OneDrive\Desktop\Physix"

def generate_bonus(world, seed_):
    rng = random.Random(seed_)
    # Bonus levels: shorter, faster, wider, with pots
    seg_count = rng.randint(5, 8)
    segs, z, current_y = [], 0.0, 0.0
    for i in range(seg_count):
        length = rng.uniform(20.0, 35.0)
        z0, z1 = z, z - length
        w = rng.uniform(10.0, 14.0)
        x = 0.0
        ramp = round(rng.uniform(-1.5, 2.0) * 10) / 10
        is_jump = rng.random() < 0.25 and ramp >= 0
        if is_jump:
            ramp = 2.5
        seg = {"z0": round(z0,1), "z1": round(z1,1), "w": round(w,1), "x": round(x,1), "ramp": ramp}
        if is_jump:
            seg["jump"] = True
        segs.append(seg)
        z = z1
    runway = rng.uniform(15.0, 25.0)
    segs.append({"z0": round(z,1), "z1": round(z - runway,1), "w": 12.0, "x": 0.0, "ramp": 0.0})

    total_len = sum(abs(seg["z1"] - seg["z0"]) for seg in segs)

    # Place pots along the track
    pot_count = rng.randint(6, 10)
    obstacles = []
    for _ in range(pot_count):
        pz = -rng.uniform(5.0, total_len - 10.0)
        px = rng.uniform(-3.5, 3.5)
        obstacles.append({"kind": "pot", "z": round(pz,1), "x": round(px,1)})

    # A few speed boosts for fun
    for _ in range(rng.randint(2, 4)):
        bz = -rng.uniform(10.0, total_len - 15.0)
        bx = rng.uniform(-2.0, 2.0)
        obstacles.append({"kind": "speed_boost", "z": round(bz,1), "x": round(bx,1), "strength": round(rng.uniform(18.0, 24.0),1)})

    # Hoop checkpoints
    z_positions = [-total_len * ((i + 1) / 7.0) for i in range(6)]
    checkpoints = []
    for i, hz in enumerate(z_positions):
        hx = rng.uniform(-1.5, 1.5) if i < 2 else (rng.choice([-1,1]) * rng.uniform(2.0, 3.5))
        hy = 1.5 + rng.uniform(1.0, 2.0)
        obstacles.append({"kind": "hoop_checkpoint", "z": round(hz,1), "x": round(hx,1), "y": round(hy,1)})
        checkpoints.append(round(hz,1))

    par_time = round(total_len / 12.0 * 10) / 10
    bonus_names = {
        1: "Bonus: Hexa-Rush",
        2: "Bonus: Friction Hex",
        3: "Bonus: Grav-6",
        4: "Bonus: Bumper Hexagon",
        5: "Bonus: Wind Tunnel 6",
        6: "Bonus: The Ultimate Hex",
    }
    name = bonus_names.get(world, f"Bonus: World {world}")
    return {
        "name": name,
        "slope": rng.randint(9, 12),
        "par_time": par_time,
        "segments": segs,
        "coins": [],
        "finish_z": segs[-1]["z1"],
        "checkpoints": checkpoints,
        "obstacles": obstacles,
        "medal_times": {
            "bronze": round(par_time * 1.15 * 10) / 10,
            "silver": round(par_time * 0.85 * 10) / 10,
            "gold": round(par_time * 0.65 * 10) / 10,
        }
    }

for world in range(1, 7):
    data = generate_bonus(world, SEEDS[world])
    path = os.path.join(BASE, "levels", f"B-{world}.json")
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
    print(f"Generated B-{world}.json | pots={sum(1 for o in data['obstacles'] if o['kind']=='pot')} | boosts={sum(1 for o in data['obstacles'] if o['kind']=='speed_boost')} | hoops={len(data['checkpoints'])}")

print("\nDone! Bonus levels regenerated with breakable pots.")
