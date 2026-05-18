#!/usr/bin/env python3
"""Generate B-1 … B-6 JSON using the same rules as LevelFactory.generate_bonus."""
from __future__ import annotations

import json
import os
import random

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEVELS = os.path.join(ROOT, "levels")
SEEDS = {1: 201, 2: 202, 3: 203, 4: 204, 5: 205, 6: 206}
OPENING = 2
CLOSING = 2
RUNWAY_LEN = 50.0
HOOP_BOOSTS = [10.0, 12.0, 14.0, 16.0, 18.0, 20.0]
NAMES = {
    1: "Bonus: Hexa-Rush",
    2: "Bonus: Friction Hex",
    3: "Bonus: Grav-6",
    4: "Bonus: Bumper Hexagon",
    5: "Bonus: Wind Tunnel 6",
    6: "Bonus: The Ultimate Hex",
}


def seg(z0, z1, w, x=0.0, ramp=0.0, jump=False, ice=False):
    s = {"z0": round(z0, 1), "z1": round(z1, 1), "w": round(w, 1), "x": round(x, 1), "ramp": round(ramp, 1)}
    if jump:
        s["jump"] = True
    if ice:
        s["ice"] = True
    return s


def build_segments(world: int, rng: random.Random) -> list[dict]:
    segs = []
    z = 0.0
    for _ in range(OPENING):
        length = rng.uniform(25.0, 35.0)
        segs.append(seg(z, z - length, rng.uniform(10.0, 12.0), ramp=rng.uniform(-0.3, 0.0)))
        z -= length
    body_count = rng.randint(8, 11)
    for i in range(body_count):
        length = rng.uniform(22.0, 32.0)
        w = rng.uniform(10.0, 13.0)
        ramp = round(rng.uniform(-2.0, 2.2), 1)
        jump = rng.random() < 0.18 and ramp >= 0
        if jump:
            ramp = 2.5
        if world == 2 and rng.random() < 0.35:
            segs.append(seg(z, z - length, w, ramp=ramp, ice=True, jump=jump))
        else:
            segs.append(seg(z, z - length, w, ramp=ramp, jump=jump))
        z -= length
    last_ramp = segs[-1]["ramp"] if segs else 0.0
    last_x = segs[-1]["x"] if segs else 0.0
    for i in range(CLOSING):
        length = rng.uniform(25.0, 35.0)
        t = (i + 1) / CLOSING
        x = last_x * (1.0 - t)
        ramp = last_ramp * (1.0 - t)
        segs.append(seg(z, z - length, rng.uniform(10.0, 12.0), x=x, ramp=round(ramp, 1)))
        z -= length
    segs.append(seg(z, z - RUNWAY_LEN, 10.0, ramp=0.0))
    return segs


def finish_z(segs: list[dict]) -> float:
    if len(segs) >= 2:
        return segs[-2]["z1"]
    return segs[-1]["z1"]


def place_hoops(segs: list[dict], fz: float, rng: random.Random) -> tuple[list[float], list[dict]]:
    margin = 14.0
    z_min = fz + margin
    z_max = -28.0
    zs = []
    for i in range(6):
        t = (i + 1) / 7.0
        zs.append(z_max + (z_min - z_max) * t)
    zs = [round(z, 1) for z in zs]
    hoops_obs = []
    tiers = [0, 0, 1, 1, 2, 2]
    rng.shuffle(tiers)
    clearances = [(0.0, 0.4), (0.8, 1.5), (2.0, 3.2)]
    for i, z in enumerate(zs):
        tier = tiers[i]
        clearance = rng.uniform(*clearances[tier])
        x = rng.uniform(-1.2, 1.2) if tier == 0 else (rng.choice([-1, 1]) * rng.uniform(1.5, 3.0 if tier == 1 else 4.0))
        y = round(0.7 + clearance, 1)
        hoops_obs.append(
            {"kind": "hoop", "z": z, "x": round(x, 1), "y": y, "boost": HOOP_BOOSTS[i]}
        )
    return zs, hoops_obs


def scatter_pots(segs: list[dict], fz: float, rng: random.Random) -> list[dict]:
    pots = []
    z_play_min = fz + 20.0
    z_play_max = -15.0
    for _ in range(rng.randint(8, 14)):
        z = round(rng.uniform(z_play_max, z_play_min), 1)
        pots.append({"kind": "pot", "z": z, "x": round(rng.uniform(-3.5, 3.5), 1)})
    return pots


def scatter_boosts(fz: float, rng: random.Random) -> list[dict]:
    out = []
    for _ in range(rng.randint(3, 5)):
        z = round(rng.uniform(fz + 22.0, -25.0), 1)
        out.append(
            {
                "kind": "speed_boost",
                "z": z,
                "x": round(rng.uniform(-2.0, 2.0), 1),
                "strength": round(rng.uniform(18.0, 24.0), 1),
            }
        )
    return out


def generate_bonus(world: int, seed: int) -> dict:
    rng = random.Random(seed)
    segs = build_segments(world, rng)
    fz = finish_z(segs)
    total_len = sum(abs(s["z1"] - s["z0"]) for s in segs)
    par = round(total_len / 12.0, 1)
    checkpoints, hoop_obs = place_hoops(segs, fz, rng)
    obstacles = scatter_pots(segs, fz, rng) + scatter_boosts(fz, rng) + hoop_obs
    return {
        "name": NAMES[world],
        "slope": rng.randint(9, 12),
        "par_time": par,
        "segments": segs,
        "coins": [],
        "finish_z": fz,
        "checkpoints": checkpoints,
        "obstacles": obstacles,
        "time_tiers": {
            "bronze": round(par * 1.15, 1),
            "silver": round(par * 0.85, 1),
            "gold": round(par * 0.65, 1),
        },
    }


def main() -> None:
    for w in range(1, 7):
        data = generate_bonus(w, SEEDS[w])
        path = os.path.join(LEVELS, f"B-{w}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
            f.write("\n")
        min_cp = min(data["checkpoints"])
        ok = min_cp >= data["finish_z"] + 10.0
        print(
            f"B-{w}: segs={len(data['segments'])} finish_z={data['finish_z']:.1f} "
            f"min_hoop={min_cp:.1f} ok={ok} par={data['par_time']}"
        )


if __name__ == "__main__":
    main()
