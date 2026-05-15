#!/usr/bin/env python3
"""Recalculate hoop Y so they float above the track surface but remain jump-reachable."""

import re

path = r"C:\Users\phili\OneDrive\Desktop\Physix\scripts\level_generator.gd"

with open(path, "r", encoding="utf-8") as f:
    text = f.read()

def clean_jsonish(s):
    lines = s.split("\n")
    cleaned = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("#"):
            continue
        if "#" in stripped:
            stripped = stripped.split("#")[0].rstrip()
        cleaned.append(stripped)
    s = "\n".join(cleaned)
    s = re.sub(r',\s*\]', ']', s)
    s = re.sub(r',\s*\}', '}', s)
    return s

def get_track_y(segments, z):
    for seg in segments:
        z0 = seg.get("z0", 0.0)
        z1 = seg.get("z1", -100.0)
        # Determine if z is within this segment
        if z0 < z1:
            if not (z0 <= z <= z1):
                continue
        else:
            if not (z1 <= z <= z0):
                continue
        seg_y = seg.get("y", 0.0)
        ramp = seg.get("ramp", 0.0)
        if seg.get("jump", False):
            ramp = 2.5
        if abs(ramp) > 0.01:
            # Interpolate from z0 to z1
            length = abs(z1 - z0)
            t = (z - z0) / length if length != 0 else 0.0
            return seg_y + ramp * t
        else:
            return seg_y
    return None

def parse_segments_jsonish(seg_text):
    seg_text = clean_jsonish(seg_text)
    seg_text = re.sub(r'([a-zA-Z_][a-zA-Z0-9_]*):', r'"\1":', seg_text)
    seg_text = seg_text.replace("true", "True").replace("false", "False")
    seg_text = re.sub(r'Vector3\(([^)]+)\)', r'[\1]', seg_text)
    seg_text = seg_text.replace("null", "None")
    try:
        return eval(seg_text, {"__builtins__": {}}, {})
    except Exception as e:
        print("Parse error:", e)
        return []

def fix_hoops_in_level(src, key):
    start_marker = f'"{key}":'
    start_idx = src.find(start_marker)
    if start_idx == -1:
        return src
    brace_open = src.find("{", start_idx)
    brace_count = 0
    end_idx = brace_open
    for i in range(brace_open, len(src)):
        if src[i] == "{":
            brace_count += 1
        elif src[i] == "}":
            brace_count -= 1
            if brace_count == 0:
                end_idx = i + 1
                break
    level_block = src[start_idx:end_idx]

    if '"hoop_' not in level_block:
        return src

    seg_match = re.search(r'"segments":\s*(\[[\s\S]*?\]),', level_block)
    if not seg_match:
        print(f"WARNING: no segments for {key}")
        return src
    seg_text = seg_match.group(1)
    segments = parse_segments_jsonish(seg_text)

    hoop_pattern = re.compile(r'\{"kind": "hoop_\w+",\s*"z":\s*([-\d.]+),\s*"x":\s*([-\d.]+),\s*"y":\s*([-\d.]+)(.*?)\}')
    changes = []
    for hm in hoop_pattern.finditer(level_block):
        z = float(hm.group(1))
        old_y = float(hm.group(3))
        track_y = get_track_y(segments, z)
        if track_y is None:
            nearest_y = 0.0
            best_dist = float('inf')
            for seg in segments:
                cz = (seg.get("z0", 0) + seg.get("z1", 0)) / 2
                dist = abs(cz - z)
                if dist < best_dist:
                    best_dist = dist
                    nearest_y = seg.get("y", 0.0)
            track_y = nearest_y
        new_y = round(track_y + 2.8, 1)
        if new_y < track_y + 1.5:
            new_y = track_y + 1.5
        if abs(new_y - old_y) > 0.1:
            changes.append((z, old_y, new_y))
            old_str = f'"z": {hm.group(1)}, "x": {hm.group(2)}, "y": {hm.group(3)}'
            new_str = f'"z": {hm.group(1)}, "x": {hm.group(2)}, "y": {new_y}'
            level_block = level_block.replace(old_str, new_str, 1)

    if changes:
        print(f"Level {key}: fixed {len(changes)} hoops")
        for z, old_y, new_y in changes:
            print(f"  z={z}: y {old_y} -> {new_y}")
        src = src[:start_idx] + level_block + src[end_idx:]
    return src

for m in re.finditer(r'"(\d+-\d+)":', text):
    key = m.group(1)
    text = fix_hoops_in_level(text, key)

with open(path, "w", encoding="utf-8") as f:
    f.write(text)

print("Done fixing hoop heights.")
