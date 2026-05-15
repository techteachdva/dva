#!/usr/bin/env python3
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

def parse_gd_array(text):
    text = clean_jsonish(text)
    text = re.sub(r'([a-zA-Z_][a-zA-Z0-9_]*):', r'"\1":', text)
    text = text.replace("true", "True").replace("false", "False")
    text = re.sub(r'Vector3\(([^)]+)\)', r'[\1]', text)
    text = text.replace("null", "None")
    return eval(text, {"__builtins__": {}}, {})

start_marker = '"3-2":'
start_idx = text.find(start_marker)
brace_open = text.find("{", start_idx)
brace_count = 0
end_idx = brace_open
for i in range(brace_open, len(text)):
    if text[i] == "{":
        brace_count += 1
    elif text[i] == "}":
        brace_count -= 1
        if brace_count == 0:
            end_idx = i + 1
            break
level_block = text[start_idx:end_idx]

seg_match = re.search(r'"segments":\s*(\[[\s\S]*?\]),', level_block)
segments = parse_gd_array(seg_match.group(1))

print("Segments for 3-2:")
current_y = 0.0
for seg in segments:
    z0 = seg.get("z0", 0.0)
    z1 = seg.get("z1", -100.0)
    ramp = seg.get("ramp", 0.0)
    if seg.get("jump", False):
        ramp = 2.5
    seg_y = seg.get("y", current_y)
    print(f"  z0={z0} z1={z1} seg_y={seg_y} ramp={ramp} (current_y={current_y})")
    if abs(ramp) > 0.01:
        current_y = seg_y + ramp
    else:
        current_y = seg_y

z = -160.0
for seg in segments:
    z0 = seg.get("z0", 0.0)
    z1 = seg.get("z1", -100.0)
    if z0 < z1:
        in_seg = z0 <= z <= z1
    else:
        in_seg = z1 <= z <= z0
    if in_seg:
        seg_y = seg.get("y", 0.0)
        ramp = seg.get("ramp", 0.0)
        if seg.get("jump", False):
            ramp = 2.5
        length = abs(z1 - z0)
        t = (z - z0) / length if length != 0 else 0.0
        track_y = seg_y + ramp * t
        print(f"z=-160 is in segment z0={z0} z1={z1}: t={t} track_y={track_y}")
        break
