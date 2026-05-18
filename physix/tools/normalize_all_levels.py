#!/usr/bin/env python3
"""Stitch segment chains, append end runway, and place exactly six checkpoint hoops."""
from __future__ import annotations

import json
import glob
import os

OPENING_ZONE_SEGS = 2
CLOSING_ZONE_SEGS = 2
TARGET_HOOP_COUNT = 6
HOOP_SPACING_MULTIPLIER = 1.5
RUNWAY_SEGMENT_LENGTH = 50.0
HOOP_BOOSTS = [20.0, 24.0, 28.0, 32.0, 36.0, 40.0]
TIER_CLEARANCE = [(0.0, 0.4), (0.8, 1.5), (2.0, 3.2)]
HOOP_KINDS = {"hoop"}


def stitch_segments(segments: list[dict]) -> list[dict]:
    if not segments:
        return segments
    current_y = 0.0
    prev_z1 = 0.0
    for i, seg in enumerate(segments):
        if i == 0:
            seg["z0"] = 0.0
        else:
            seg["z0"] = prev_z1
        z0 = seg["z0"]
        z1 = seg["z1"]
        ramp = seg.get("ramp", 0.0)
        is_jump = seg.get("jump", False)
        gap = abs(z0 - prev_z1) if i > 0 else 0.0
        seg_y = seg.get("y", current_y)
        if gap < 0.5 and "y" in seg and abs(seg_y - current_y) > 0.05 and abs(ramp) < 0.01 and not is_jump:
            del seg["y"]
            seg_y = current_y
        if is_jump:
            current_y = seg_y
        elif abs(ramp) > 0.01:
            current_y = seg_y + ramp
        else:
            current_y = seg_y
        seg["z0"] = round(seg["z0"], 1)
        seg["z1"] = round(seg["z1"], 1)
        prev_z1 = seg["z1"]
    return segments


def segment_at_z(segments: list[dict], z: float) -> dict:
    for seg in segments:
        z0 = seg["z0"]
        z1 = seg["z1"]
        lo = min(z0, z1)
        hi = max(z0, z1)
        if lo <= z <= hi:
            return seg
    return {}


def body_bounds(segments: list[dict]) -> tuple[int, int, float, float]:
    n = len(segments)
    runway_tail = (
        n > 0
        and abs(segments[-1]["z1"] - segments[-1]["z0"]) >= RUNWAY_SEGMENT_LENGTH * 0.8
        and abs(segments[-1].get("ramp", 0.0)) < 0.01
    )
    body_end = n - 1 if runway_tail else n
    body_start = min(OPENING_ZONE_SEGS, body_end)
    body_end = max(body_start + 1, body_end - CLOSING_ZONE_SEGS)
    z_start = segments[body_start]["z0"]
    z_end = segments[body_end - 1]["z1"]
    return body_start, body_end, z_start, z_end


def min_hoop_spacing(world: int) -> float:
    base = 22.0 if world == 1 else 18.0
    return base * HOOP_SPACING_MULTIPLIER


def tier_list(world: int) -> list[int]:
    table = {
        1: [0, 0, 1, 1, 2, 2],
        2: [0, 1, 1, 1, 2, 2],
        3: [0, 1, 1, 2, 2, 2],
        4: [0, 1, 2, 2, 2, 2],
        5: [1, 1, 2, 2, 2, 2],
        6: [1, 2, 2, 2, 2, 2],
    }
    return table.get(world, [0, 0, 1, 1, 2, 2])


def build_hoops(segments: list[dict], world: int) -> list[dict]:
    body_start, body_end, z_start, z_end = body_bounds(segments)
    spacing = min_hoop_spacing(world if world > 0 else 1)
    hoop_zs: list[float] = []
    for i in range(TARGET_HOOP_COUNT):
        t = (i + 1) / (TARGET_HOOP_COUNT + 1)
        hoop_zs.append(z_start + (z_end - z_start) * t)
    hoop_zs.sort(reverse=True)
    for i in range(1, len(hoop_zs)):
        if hoop_zs[i - 1] - hoop_zs[i] < spacing:
            hoop_zs[i] = hoop_zs[i - 1] - spacing
    tiers = tier_list(world if world > 0 else 1)
    hoops: list[dict] = []
    for i, z in enumerate(hoop_zs):
        seg = segment_at_z(segments, z)
        if not seg:
            seg = segments[min(body_start, len(segments) - 1)]
        base_x = seg.get("x", 0.0)
        w = seg.get("w", 10.0)
        seg_y = seg.get("y", 0.0)
        tier = tiers[i]
        if tier == 0:
            offset = 0.0
        elif tier == 1:
            offset = (1.0 if i % 2 == 0 else -1.0) * 2.0
        else:
            offset = (1.0 if i % 2 == 0 else -1.0) * 3.0
        half_w = w * 0.5 - 0.5
        if abs(offset) > half_w:
            offset = (1.0 if offset >= 0 else -1.0) * half_w
        clearance = (TIER_CLEARANCE[tier][0] + TIER_CLEARANCE[tier][1]) * 0.5
        y = seg_y + 0.7 + clearance
        hoops.append(
            {
                "kind": "hoop",
                "z": round(z, 1),
                "x": round(base_x + offset, 1),
                "y": round(y, 1),
                "boost": HOOP_BOOSTS[i],
            }
        )
    return hoops


def compute_finish_z(segments: list[dict]) -> float:
    if not segments:
        return -200.0
    if len(segments) >= 2:
        last = segments[-1]
        span = abs(last["z1"] - last["z0"])
        if span >= RUNWAY_SEGMENT_LENGTH * 0.8 and abs(last.get("ramp", 0.0)) < 0.01:
            return segments[-2]["z1"]
    return segments[-1]["z1"]


def ensure_end_runway(segments: list[dict]) -> None:
    if not segments:
        return
    last = segments[-1]
    span = abs(last["z1"] - last["z0"])
    if span >= RUNWAY_SEGMENT_LENGTH * 0.8 and abs(last.get("ramp", 0.0)) < 0.01:
        return
    z0 = last["z1"]
    runway = {
        "z0": round(z0, 1),
        "z1": round(z0 - RUNWAY_SEGMENT_LENGTH, 1),
        "w": last.get("w", 10.0),
        "x": last.get("x", 0.0),
        "ramp": 0.0,
    }
    if "y" in last:
        runway["y"] = last["y"]
    segments.append(runway)


def parse_world_level(path: str) -> tuple[int, int]:
    name = os.path.splitext(os.path.basename(path))[0]
    if name.startswith("B-"):
        return int(name[2:]), 0
    if name.startswith("S-"):
        return 0, int(name[2:])
    world_s, level_s = name.split("-", 1)
    return int(world_s), int(level_s)


def normalize_level(data: dict, world: int, level: int) -> dict:
    segments = [dict(s) for s in data.get("segments", [])]
    if not segments:
        return data
    segments = stitch_segments(segments)
    ensure_end_runway(segments)
    data["segments"] = segments
    data["finish_z"] = compute_finish_z(segments)
    obstacles = [
        dict(o)
        for o in data.get("obstacles", [])
        if str(o.get("kind", "")) not in HOOP_KINDS
    ]
    hoops = build_hoops(segments, world)
    obstacles.extend(hoops)
    data["obstacles"] = obstacles
    data["checkpoints"] = [h["z"] for h in hoops]
    return data


def main() -> None:
    root = os.path.join(os.path.dirname(__file__), "..", "levels")
    paths = sorted(glob.glob(os.path.join(root, "*.json")))
    updated = 0
    for path in paths:
        if "_backups" in path.replace("\\", "/"):
            continue
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        world, level = parse_world_level(path)
        new_data = normalize_level(data, world, level)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(new_data, f, indent=2)
            f.write("\n")
        updated += 1
        hoops = sum(1 for o in new_data.get("obstacles", []) if o.get("kind") == "hoop")
        print(f"{os.path.basename(path)}: {hoops} hoops, finish_z={new_data.get('finish_z')}")
    print(f"Normalized {updated} level files.")


if __name__ == "__main__":
    main()
