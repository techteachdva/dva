#!/usr/bin/env python3
"""Write campaign JSON from the Physix curriculum.

The shapes are fixed. A funnel narrows. An S-curve bends once each way.
Coins sit off the racing line. World 1 does not contain spikes.
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "levels"
SCENES = Path(__file__).resolve().parents[1] / "scenes" / "levels"

# length, width, x, ramp, jump, ice
OPEN = [(28.0, 11.0, 0.0, -0.2, False, False), (28.0, 11.0, 0.0, -0.2, False, False)]
CLOSE = [(28.0, 11.0, None, None, False, False), (28.0, 11.0, None, None, False, False)]

MODULES = {
    "highway": [
        (34.0, 11.0, 0.0, -0.3, False, False),
        (32.0, 11.0, 0.0, -0.2, False, False),
        (30.0, 11.0, 0.0, -0.2, False, False),
    ],
    "funnel": [
        (28.0, 12.0, 0.0, -0.2, False, False),
        (24.0, 9.5, 0.0, -0.1, False, False),
        (22.0, 7.0, 0.0, 0.1, False, False),
        (22.0, 6.0, 0.0, 0.0, False, False),
        (24.0, 8.5, 0.0, -0.2, False, False),
    ],
    "flare": [
        (24.0, 6.5, 0.0, -0.2, False, False),
        (24.0, 8.0, 0.0, -0.1, False, False),
        (26.0, 10.0, 0.0, -0.2, False, False),
        (28.0, 12.0, 0.0, -0.1, False, False),
    ],
    "ski_jump": [
        (26.0, 10.0, 0.0, -1.2, False, False),
        (22.0, 10.0, 0.0, 2.0, False, False),
        (16.0, 10.0, 0.0, 2.5, True, False),
        (24.0, 11.0, 0.0, -0.4, False, False),
    ],
    "switchback": [
        (26.0, 9.0, 0.0, -0.2, False, False),
        (24.0, 8.5, 4.0, -0.2, False, False),
        (24.0, 8.5, -4.0, -0.2, False, False),
        (26.0, 9.0, 0.0, -0.1, False, False),
    ],
    "ice_s_curve": [
        (24.0, 9.0, 0.0, -0.2, False, True),
        (22.0, 8.0, 3.5, -0.1, False, True),
        (22.0, 8.0, -3.5, -0.1, False, True),
        (24.0, 9.0, 0.0, -0.2, False, True),
    ],
    "half_pipe": [
        (26.0, 10.0, 0.0, -1.0, False, False),
        (24.0, 9.0, 0.0, 0.2, False, False),
        (26.0, 10.0, 0.0, 1.0, False, False),
        (22.0, 10.0, 0.0, -0.3, False, False),
    ],
    "step_up": [
        (22.0, 9.0, 0.0, 1.0, False, False),
        (22.0, 9.0, 0.0, 1.0, False, False),
        (22.0, 8.5, 0.0, 0.8, False, False),
        (20.0, 9.0, 0.0, -0.4, False, False),
    ],
    "gravity_well": [
        (28.0, 11.0, 0.0, -0.3, False, False),
        (24.0, 10.0, 0.0, -0.8, False, False),
        (26.0, 11.0, 0.0, 0.3, False, False),
    ],
    "wind_tunnel": [
        (24.0, 9.0, 0.0, -0.2, False, False),
        (22.0, 7.0, 0.0, -0.1, False, False),
        (20.0, 6.5, 0.0, 0.2, False, False),
        (24.0, 9.0, 0.0, -0.2, False, False),
    ],
    "bumper_arena": [
        (28.0, 13.0, 0.0, -0.2, False, False),
        (26.0, 13.0, 0.0, -0.1, False, False),
        (28.0, 12.0, 0.0, -0.2, False, False),
    ],
    "corkscrew": [
        (22.0, 9.0, 1.0, -0.8, False, False),
        (20.0, 8.0, 3.5, -1.2, False, False),
        (20.0, 8.0, -3.5, 1.0, False, False),
        (22.0, 9.0, 0.0, -0.3, False, False),
    ],
}

NAMES = {
    "highway": "Speedway",
    "funnel": "Funnel",
    "flare": "Broadway",
    "ski_jump": "Roller",
    "switchback": "S-Curve",
    "ice_s_curve": "Ice Line",
    "half_pipe": "Half Pipe",
    "step_up": "Step Up",
    "gravity_well": "Gravity Well",
    "wind_tunnel": "Wind Tunnel",
    "bumper_arena": "Bumper Hall",
    "corkscrew": "Corkscrew",
}

PLANS = {
    (1, 1): ["highway"],
    (1, 2): ["funnel"],
    (1, 3): ["ski_jump"],
    (1, 4): ["flare"],
    (1, 5): ["switchback"],
    (1, 6): ["funnel", "ski_jump"],
    (2, 1): ["highway"],
    (2, 2): ["ice_s_curve"],
    (2, 3): ["ski_jump"],
    (2, 4): ["funnel"],
    (2, 5): ["ice_s_curve", "highway"],
    (2, 6): ["ice_s_curve", "ski_jump"],
    (3, 1): ["highway"],
    (3, 2): ["gravity_well"],
    (3, 3): ["step_up"],
    (3, 4): ["funnel"],
    (3, 5): ["gravity_well", "ski_jump"],
    (3, 6): ["gravity_well", "step_up"],
    (4, 1): ["bumper_arena"],
    (4, 2): ["switchback"],
    (4, 3): ["bumper_arena", "highway"],
    (4, 4): ["half_pipe"],
    (4, 5): ["switchback", "bumper_arena"],
    (4, 6): ["bumper_arena", "switchback"],
    (5, 1): ["wind_tunnel"],
    (5, 2): ["switchback"],
    (5, 3): ["wind_tunnel", "funnel"],
    (5, 4): ["half_pipe"],
    (5, 5): ["switchback", "wind_tunnel"],
    (5, 6): ["wind_tunnel", "corkscrew"],
    (6, 1): ["half_pipe"],
    (6, 2): ["corkscrew"],
    (6, 3): ["bumper_arena"],
    (6, 4): ["step_up"],
    (6, 5): ["gravity_well"],
    (6, 6): ["corkscrew", "half_pipe"],
}

BONUS = {
    1: ("Bonus: Hexa-Rush", ["highway"]),
    2: ("Bonus: Friction Hex", ["ice_s_curve"]),
    3: ("Bonus: Grav-6", ["gravity_well"]),
    4: ("Bonus: Bumper Hexagon", ["bumper_arena"]),
    5: ("Bonus: Wind Tunnel 6", ["wind_tunnel"]),
    6: ("Bonus: The Ultimate Hex", ["half_pipe", "corkscrew"]),
}


def build_segments(module_names: list[str], ice_patch: bool) -> list[dict]:
    pieces: list[tuple] = list(OPEN)
    for name in module_names:
        pieces.extend(MODULES[name])
    pieces.extend(CLOSE)
    pieces.append((50.0, 10.0, 0.0, 0.0, False, False))

    segs = []
    z = 0.0
    y = 0.0
    body_start = len(OPEN)
    body_end = body_start
    for name in module_names:
        body_end += len(MODULES[name])
    close_start = body_end
    last_x = 0.0
    last_ramp = -0.2
    for index, piece in enumerate(pieces):
        length, width, x, ramp, jump, ice = piece
        if index >= close_start and index < close_start + len(CLOSE):
            t = (index - close_start + 1) / len(CLOSE)
            x = last_x * (1.0 - t)
            ramp = last_ramp * (1.0 - t)
        seg = {
            "z0": round(z, 1),
            "z1": round(z - length, 1),
            "w": width,
            "x": round(x, 1),
            "ramp": round(ramp, 1),
        }
        if y:
            seg["y"] = round(y, 1)
        if jump:
            seg["jump"] = True
        if ice or (ice_patch and body_start <= index < body_start + 2):
            seg["ice"] = True
        segs.append(seg)
        if index == body_end - 1:
            last_x = x
            last_ramp = ramp
        if not jump:
            y += ramp
        z -= length
    return segs


def coins_for(segs: list[dict]) -> list[dict]:
    coins = []
    last = len(segs) - 3
    for seg in segs[2:last]:
        if len(coins) >= 6:
            break
        x = seg["x"]
        side = 1.0 if abs(x) < 1.0 else (1.0 if x > 0 else -1.0)
        coins.append({
            "z": round((seg["z0"] + seg["z1"]) / 2.0, 1),
            "x": round(x + side * 2.6, 1),
            "y": round(seg.get("y", 0.0) + 1.7, 1),
        })
    return coins


def hoops_for(segs: list[dict]) -> list[dict]:
    body = segs[2:-3]
    if not body:
        body = segs[2:-1]
    hoops = []
    boosts = [12.0, 14.0, 16.0, 18.0, 20.0, 22.0]
    for i, boost in enumerate(boosts):
        seg = body[min(len(body) - 1, int((i + 0.5) * len(body) / 6))]
        hoops.append({
            "kind": "hoop",
            "z": round((seg["z0"] + seg["z1"]) / 2.0, 1),
            "x": seg["x"],
            "y": round(seg.get("y", 0.0) + 1.4, 1),
            "boost": boost,
        })
    return hoops


def obstacles_for(world: int, level: int, segs: list[dict], hoops: list[dict]) -> list[dict]:
    body = segs[2:-3]
    if not body:
        return []
    mid = body[len(body) // 2]
    z = round((mid["z0"] + mid["z1"]) / 2.0, 1)
    obs = []
    if world == 1 and level <= 2:
        obs.append({"kind": "pot", "z": z, "x": round(mid["x"] - 2.4, 1), "seg_y": mid.get("y", 0.0), "score_value": 15})
    elif world == 1 and level == 3:
        obs.append({"kind": "bumper", "z": z, "x": round(mid["x"] + 2.8, 1), "seg_y": mid.get("y", 0.0), "force": 18.0})
    elif world == 1:
        obs.append({"kind": "bumper", "z": z, "x": round(mid["x"] + 2.8, 1), "seg_y": mid.get("y", 0.0), "force": 18.0})
        obs.append({"kind": "pot", "z": round(z - 18.0, 1), "x": round(mid["x"] - 2.4, 1), "seg_y": mid.get("y", 0.0), "score_value": 15})
    elif world == 2 and level <= 3:
        obs.append({"kind": "brake_pad", "z": z, "x": mid["x"], "seg_y": mid.get("y", 0.0), "strength": 8.0, "is_brake": True})
    elif world == 3:
        obs.append({"kind": "gravity", "z": z, "x": mid["x"], "seg_y": mid.get("y", 0.0), "type": 0, "multiplier": 2.0, "length": 24.0})
    elif world == 4:
        obs.append({"kind": "bumper", "z": z, "x": round(mid["x"] + 3.0, 1), "seg_y": mid.get("y", 0.0), "force": 20.0})
        if level >= 4:
            obs.append({"kind": "bumper", "z": round(z - 20.0, 1), "x": round(mid["x"] - 3.0, 1), "seg_y": mid.get("y", 0.0), "force": 20.0})
    elif world == 5:
        obs.append({"kind": "wind", "z": z, "x": mid["x"], "seg_y": mid.get("y", 0.0), "force": 18.0, "direction": [1.0, 0.0, 0.0], "length": 28.0})
    elif world == 6:
        obs.append({"kind": "magnet", "z": z, "x": mid["x"], "seg_y": mid.get("y", 0.0), "magnet_type": "attract", "strength": 16.0, "length": 30.0})
    hoop_z = {round(h["z"], 1) for h in hoops}
    for item in obs:
        if round(item["z"], 1) in hoop_z:
            item["z"] = round(item["z"] - 9.0, 1)
    return obs


def par_time(segs: list[dict]) -> float:
    length = sum(abs(seg["z1"] - seg["z0"]) for seg in segs[:-1])
    return round(length / 12.0, 1)


def pack(name: str, segs: list[dict], obstacles: list[dict], hoops: list[dict], slope: int) -> dict:
    par = par_time(segs)
    finish = segs[-2]["z1"]
    return {
        "name": name,
        "slope": slope,
        "par_time": par,
        "segments": segs,
        "coins": coins_for(segs),
        "finish_z": finish,
        "checkpoints": [h["z"] for h in hoops],
        "obstacles": obstacles + hoops,
        "time_tiers": {
            "bronze": round(par * 1.15, 1),
            "silver": round(par * 0.85, 1),
            "gold": round(par * 0.65, 1),
        },
    }


def write_level(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def patch_scene(path: Path, level_name: str, par: float) -> None:
    if not path.exists():
        return
    text = path.read_text(encoding="utf-8")
    lines = []
    for line in text.splitlines():
        if line.startswith("level_name = "):
            lines.append(f'level_name = "{level_name}"')
        elif line.startswith("par_time = "):
            lines.append(f"par_time = {par}")
        else:
            lines.append(line)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    for world in range(1, 7):
        for level in range(1, 7):
            modules = PLANS[(world, level)]
            ice_patch = world == 2 and "ice_s_curve" not in modules
            segs = build_segments(modules, ice_patch)
            hoops = hoops_for(segs)
            name = f"Gauntlet {world}-{level}" if level == 6 else f"{NAMES[modules[0]]} {world}-{level}"
            data = pack(name, segs, obstacles_for(world, level, segs, hoops), hoops, 12 if world == 1 else 11)
            write_level(ROOT / f"{world}-{level}.json", data)
            patch_scene(SCENES / f"world_{world}" / f"level_{world}_{level}.tscn", name, data["par_time"])
        bonus_name, modules = BONUS[world]
        segs = build_segments(modules, world == 2)
        hoops = hoops_for(segs)[:4]
        pots = []
        for seg in segs[2:-3]:
            if len(pots) >= 12:
                break
            pots.append({
                "kind": "pot",
                "z": round((seg["z0"] + seg["z1"]) / 2.0, 1),
                "x": round(seg["x"] - 2.2, 1),
                "seg_y": seg.get("y", 0.0),
                "score_value": 15,
            })
        data = pack(bonus_name, segs, pots, hoops, 11)
        write_level(ROOT / f"B-{world}.json", data)
        patch_scene(SCENES / "bonus" / f"bonus_{world}.tscn", bonus_name, data["par_time"])
    print(f"wrote curriculum levels in {ROOT}")


if __name__ == "__main__":
    main()
