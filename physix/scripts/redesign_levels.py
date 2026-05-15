#!/usr/bin/env python3
"""Replace selected level blocks in level_generator.gd with redesigned versions."""

import re

path = r"C:\Users\phili\OneDrive\Desktop\Physix\scripts\level_generator.gd"

with open(path, "r", encoding="utf-8") as f:
    text = f.read()

# Helper to replace a level block by its key
# We match the key line, then greedily capture until the next top-level key (e.g., "1-6":)
def replace_level(src: str, key: str, new_block: str) -> str:
    # Match key line like \t"1-5": {\n then everything until a line that starts with \t}" or \t"X-Y":
    # Actually easier: match from the key line through the closing brace at same indent
    pattern = rf'\t"{key}": \{{[\s\S]*?\n\t\}},\n'
    m = re.search(pattern, src)
    if not m:
        print(f"WARNING: Could not find level {key}")
        return src
    old = m.group(0)
    # Build replacement with exact leading tab
    replacement = f'\t"{key}": {{\n{new_block}\t}},\n'
    src = src.replace(old, replacement, 1)
    print(f"Replaced level {key}")
    return src

# ── 1-5: Switchback Squeeze ────────────────────────────────────────────────
new_1_5 = '''\t\t"name": "Switchback Squeeze",
\t\t"slope": 11.0,
\t\t"par_time": 48.0,
\t\t"segments": [
\t\t\t{"z0": 0,   "z1": -40,  "w": 10, "x": 0,  "y": 0},
\t\t\t{"z0": -40, "z1": -80,  "w": 8,  "x": 3,  "ramp": 2.5},
\t\t\t{"z0": -80, "z1": -120, "w": 6,  "x": 3,  "y": 2.5},
\t\t\t{"z0": -120,"z1": -160, "w": 5,  "x": -3, "ramp": -2.0},
\t\t\t{"z0": -160,"z1": -200, "w": 5,  "x": -3, "y": 0.5},
\t\t\t{"z0": -200,"z1": -240, "w": 6,  "x": 3,  "ramp": 2.0},
\t\t\t{"z0": -240,"z1": -280, "w": 6,  "x": 3,  "y": 2.5},
\t\t\t{"z0": -280,"z1": -320, "w": 5,  "x": -2, "ramp": -2.0},
\t\t\t{"z0": -320,"z1": -360, "w": 5,  "x": -2, "y": 0},
\t\t\t{"z0": -360,"z1": -400, "w": 8,  "x": 0,  "ramp": 1.5},
\t\t\t{"z0": -400,"z1": -440, "w": 8,  "x": 0,  "y": 1.5},
\t\t],
\t\t"coins": [
\t\t\t{"z": -30,  "x": 0,  "y": 2.2},
\t\t\t{"z": -60,  "x": 3,  "y": 4.0},
\t\t\t{"z": -100, "x": 3,  "y": 4.5},
\t\t\t{"z": -140, "x": -3, "y": 3.5},
\t\t\t{"z": -180, "x": -3, "y": 2.5},
\t\t\t{"z": -220, "x": 3,  "y": 4.0},
\t\t\t{"z": -260, "x": 3,  "y": 4.5},
\t\t\t{"z": -300, "x": -2, "y": 3.5},
\t\t\t{"z": -340, "x": -2, "y": 2.2},
\t\t\t{"z": -390, "x": 0,  "y": 3.0},
\t\t],
\t\t"obstacles": [
\t\t\t{"kind": "checkpoint", "z": -140, "x": -3},
\t\t\t{"kind": "checkpoint", "z": -300, "x": -2},
\t\t\t{"kind": "speed_boost", "z": -50, "x": 0, "strength": 14},
\t\t\t{"kind": "brake_pad", "z": -120, "x": 3},
\t\t\t{"kind": "brake_pad", "z": -280, "x": 3},
\t\t],
\t\t"finish_z": -440,
'''

# ── 2-4: Glacier Spiral ────────────────────────────────────────────────────
new_2_4 = '''\t\t"name": "Glacier Spiral",
\t\t"slope": 11.0,
\t\t"par_time": 52.0,
\t\t"segments": [
\t\t\t{"z0": 0,    "z1": -40,  "w": 10, "x": 0,  "y": 0},
\t\t\t{"z0": -40,  "z1": -80,  "w": 9,  "x": 0,  "ramp": 2.0, "ice": true},
\t\t\t{"z0": -80,  "z1": -120, "w": 8,  "x": 2,  "y": 2.0, "ice": true},
\t\t\t{"z0": -120, "z1": -160, "w": 7,  "x": -2, "ramp": -2.0, "ice": true},
\t\t\t{"z0": -160, "z1": -200, "w": 7,  "x": -3, "y": 0, "ice": true},
\t\t\t{"z0": -200, "z1": -240, "w": 6,  "x": 3,  "ramp": 2.0, "ice": true},
\t\t\t{"z0": -240, "z1": -280, "w": 6,  "x": 3,  "y": 2.5, "ice": true},
\t\t\t{"z0": -280, "z1": -320, "w": 7,  "x": -2, "ramp": -2.0, "ice": true},
\t\t\t{"z0": -320, "z1": -360, "w": 8,  "x": 0,  "y": 0.5},
\t\t\t{"z0": -360, "z1": -400, "w": 8,  "x": 0,  "ramp": 1.5},
\t\t\t{"z0": -400, "z1": -440, "w": 8,  "x": 0,  "y": 2.0},
\t\t],
\t\t"coins": [
\t\t\t{"z": -30,  "x": 0,  "y": 2.2},
\t\t\t{"z": -60,  "x": 2,  "y": 4.0},
\t\t\t{"z": -100, "x": 3,  "y": 4.5},
\t\t\t{"z": -140, "x": -3, "y": 3.5},
\t\t\t{"z": -180, "x": -4, "y": 2.5},
\t\t\t{"z": -220, "x": 4,  "y": 4.0},
\t\t\t{"z": -260, "x": 4,  "y": 4.5},
\t\t\t{"z": -300, "x": -3, "y": 3.5},
\t\t\t{"z": -340, "x": 0,  "y": 2.2},
\t\t\t{"z": -380, "x": 0,  "y": 3.0},
\t\t\t{"z": -420, "x": 0,  "y": 3.5},
\t\t],
\t\t"obstacles": [
\t\t\t{"kind": "checkpoint", "z": -150, "x": -2},
\t\t\t{"kind": "checkpoint", "z": -300, "x": -2},
\t\t\t{"kind": "brake_pad", "z": -90, "x": 0},
\t\t\t{"kind": "brake_pad", "z": -210, "x": 3},
\t\t\t{"kind": "speed_boost", "z": -50, "x": 0, "strength": 14},
\t\t],
\t\t"finish_z": -440,
'''

# ── 4-2: Pinball Palace ────────────────────────────────────────────────────
new_4_2 = '''\t\t"name": "Pinball Palace",
\t\t"slope": 8.0,
\t\t"par_time": 52.0,
\t\t"segments": [
\t\t\t{"z0": 0,   "z1": -40,  "w": 10, "x": 0,  "y": 0},
\t\t\t{"z0": -40, "z1": -80,  "w": 12, "x": 0,  "ramp": 2.0},
\t\t\t{"z0": -80, "z1": -160, "w": 14, "x": 0,  "y": 2.0},
\t\t\t{"z0": -160,"z1": -200, "w": 12, "x": 0,  "ramp": -2.0},
\t\t\t{"z0": -200,"z1": -240, "w": 8,  "x": 0,  "y": 0},
\t\t\t{"z0": -240,"z1": -280, "w": 6,  "x": 0,  "ramp": 2.0},
\t\t\t{"z0": -280,"z1": -320, "w": 6,  "x": 0,  "y": 2.5},
\t\t\t{"z0": -320,"z1": -360, "w": 8,  "x": 0,  "ramp": -1.5},
\t\t\t{"z0": -360,"z1": -400, "w": 8,  "x": 0,  "y": 1.0},
\t\t],
\t\t"coins": [
\t\t\t{"z": -30,  "x": 0,  "y": 2.2},
\t\t\t{"z": -70,  "x": 4,  "y": 3.5},
\t\t\t{"z": -70,  "x": -4, "y": 3.5},
\t\t\t{"z": -110, "x": 0,  "y": 3.5},
\t\t\t{"z": -110, "x": 5,  "y": 3.5},
\t\t\t{"z": -110, "x": -5, "y": 3.5},
\t\t\t{"z": -150, "x": 0,  "y": 3.0},
\t\t\t{"z": -150, "x": 4,  "y": 2.5},
\t\t\t{"z": -150, "x": -4, "y": 2.5},
\t\t\t{"z": -220, "x": 0,  "y": 2.2},
\t\t\t{"z": -260, "x": 2,  "y": 3.5},
\t\t\t{"z": -300, "x": -2, "y": 3.5},
\t\t\t{"z": -345, "x": 0,  "y": 2.2},
\t\t\t{"z": -385, "x": 0,  "y": 3.0},
\t\t],
\t\t"obstacles": [
\t\t\t{"kind": "checkpoint", "z": -130, "x": 0},
\t\t\t{"kind": "bumper", "z": -90,  "x": -3, "force": 18},
\t\t\t{"kind": "bumper", "z": -90,  "x": 3,  "force": 18},
\t\t\t{"kind": "bumper", "z": -120, "x": 0,  "force": 20},
\t\t\t{"kind": "bumper", "z": -120, "x": -5, "force": 20},
\t\t\t{"kind": "bumper", "z": -120, "x": 5,  "force": 20},
\t\t\t{"kind": "bumper", "z": -150, "x": -3, "force": 22},
\t\t\t{"kind": "bumper", "z": -150, "x": 3,  "force": 22},
\t\t\t{"kind": "bumper", "z": -150, "x": 0,  "force": 22},
\t\t\t{"kind": "speed_boost", "z": -45, "x": 0, "strength": 16},
\t\t\t{"kind": "moving_platform", "z": -230, "x": 0, "axis": Vector3(1,0,0), "dist": 3, "speed": 2.5},
\t\t\t{"kind": "brake_pad", "z": -260, "x": 0},
\t\t],
\t\t"finish_z": -400,
'''

# ── 4-4: Ricochet Run ──────────────────────────────────────────────────────
new_4_4 = '''\t\t"name": "Ricochet Run",
\t\t"slope": 9.0,
\t\t"par_time": 58.0,
\t\t"segments": [
\t\t\t{"z0": 0,   "z1": -40,  "w": 10, "x": 0,  "y": 0},
\t\t\t{"z0": -40, "z1": -80,  "w": 7,  "x": 0,  "ramp": 2.0},
\t\t\t{"z0": -80, "z1": -120, "w": 6,  "x": 0,  "y": 2.0},
\t\t\t{"z0": -120,"z1": -160, "w": 5,  "x": 2,  "ramp": -1.5},
\t\t\t{"z0": -160,"z1": -200, "w": 5,  "x": 2,  "y": 0.5},
\t\t\t{"z0": -200,"z1": -240, "w": 6,  "x": -2, "ramp": 2.0},
\t\t\t{"z0": -240,"z1": -280, "w": 6,  "x": -2, "y": 2.5},
\t\t\t{"z0": -280,"z1": -320, "w": 5,  "x": 0,  "ramp": -2.0},
\t\t\t{"z0": -320,"z1": -360, "w": 5,  "x": 0,  "y": 0},
\t\t\t{"z0": -360,"z1": -400, "w": 7,  "x": 0,  "ramp": 1.5},
\t\t\t{"z0": -400,"z1": -440, "w": 8,  "x": 0,  "y": 1.5},
\t\t\t{"z0": -440,"z1": -480, "w": 8,  "x": 0,  "ramp": -1.0},
\t\t\t{"z0": -480,"z1": -520, "w": 8,  "x": 0,  "y": 0.5},
\t\t],
\t\t"coins": [
\t\t\t{"z": -30,  "x": 0,  "y": 2.2},
\t\t\t{"z": -60,  "x": 2,  "y": 4.0},
\t\t\t{"z": -100, "x": 0,  "y": 4.5},
\t\t\t{"z": -140, "x": 3,  "y": 3.5},
\t\t\t{"z": -180, "x": 3,  "y": 2.5},
\t\t\t{"z": -220, "x": -3, "y": 4.0},
\t\t\t{"z": -260, "x": -3, "y": 4.5},
\t\t\t{"z": -300, "x": 0,  "y": 3.5},
\t\t\t{"z": -340, "x": 0,  "y": 2.2},
\t\t\t{"z": -380, "x": 0,  "y": 3.0},
\t\t\t{"z": -420, "x": 0,  "y": 3.5},
\t\t\t{"z": -460, "x": 0,  "y": 2.5},
\t\t\t{"z": -500, "x": 0,  "y": 2.2},
\t\t],
\t\t"obstacles": [
\t\t\t{"kind": "checkpoint", "z": -140, "x": 2},
\t\t\t{"kind": "checkpoint", "z": -300, "x": 0},
\t\t\t{"kind": "bumper", "z": -60,  "x": -2, "force": 18},
\t\t\t{"kind": "bumper", "z": -60,  "x": 2,  "force": 18},
\t\t\t{"kind": "bumper", "z": -100, "x": -2, "force": 20},
\t\t\t{"kind": "bumper", "z": -100, "x": 2,  "force": 20},
\t\t\t{"kind": "bumper", "z": -180, "x": -2, "force": 20},
\t\t\t{"kind": "bumper", "z": -180, "x": 2,  "force": 20},
\t\t\t{"kind": "bumper", "z": -260, "x": -2, "force": 22},
\t\t\t{"kind": "bumper", "z": -260, "x": 2,  "force": 22},
\t\t\t{"kind": "speed_boost", "z": -45, "x": 0, "strength": 16},
\t\t\t{"kind": "brake_pad", "z": -340, "x": 0},
\t\t],
\t\t"finish_z": -520,
'''

# ── 5-5: Whirlwind Spiral ──────────────────────────────────────────────────
new_5_5 = '''\t\t"name": "Whirlwind",
\t\t"slope": 9.0,
\t\t"par_time": 58.0,
\t\t"segments": [
\t\t\t{"z0": 0,   "z1": -40,  "w": 10, "x": 0,  "y": 0},
\t\t\t{"z0": -40, "z1": -80,  "w": 8,  "x": 2,  "ramp": 2.5},
\t\t\t{"z0": -80, "z1": -120, "w": 7,  "x": 2,  "y": 2.5},
\t\t\t{"z0": -120,"z1": -160, "w": 6,  "x": -2, "ramp": -2.0},
\t\t\t{"z0": -160,"z1": -200, "w": 6,  "x": -2, "y": 0.5},
\t\t\t{"z0": -200,"z1": -240, "w": 7,  "x": 3,  "ramp": 2.0},
\t\t\t{"z0": -240,"z1": -280, "w": 7,  "x": 3,  "y": 2.5},
\t\t\t{"z0": -280,"z1": -320, "w": 6,  "x": -3, "ramp": -2.0},
\t\t\t{"z0": -320,"z1": -360, "w": 6,  "x": -3, "y": 0.5},
\t\t\t{"z0": -360,"z1": -400, "w": 8,  "x": 0,  "ramp": 1.5},
\t\t\t{"z0": -400,"z1": -440, "w": 8,  "x": 0,  "y": 2.0},
\t\t],
\t\t"coins": [
\t\t\t{"z": -30,  "x": 0,  "y": 2.2},
\t\t\t{"z": -60,  "x": 3,  "y": 4.0},
\t\t\t{"z": -100, "x": 3,  "y": 4.5},
\t\t\t{"z": -140, "x": -3, "y": 3.5},
\t\t\t{"z": -180, "x": -3, "y": 2.5},
\t\t\t{"z": -220, "x": 4,  "y": 4.0},
\t\t\t{"z": -260, "x": 4,  "y": 4.5},
\t\t\t{"z": -300, "x": -4, "y": 3.5},
\t\t\t{"z": -340, "x": -4, "y": 2.5},
\t\t\t{"z": -380, "x": 0,  "y": 3.0},
\t\t\t{"z": -420, "x": 0,  "y": 3.5},
\t\t],
\t\t"obstacles": [
\t\t\t{"kind": "checkpoint", "z": -150, "x": -2},
\t\t\t{"kind": "checkpoint", "z": -300, "x": -3},
\t\t\t{"kind": "wind", "z": -50,  "x": 0, "force": 22, "direction": Vector3(1,0,0), "length": 60},
\t\t\t{"kind": "wind", "z": -130, "x": 0, "force": 22, "direction": Vector3(-1,0,0), "length": 60},
\t\t\t{"kind": "wind", "z": -220, "x": 0, "force": 24, "direction": Vector3(1,0,0), "length": 60},
\t\t\t{"kind": "wind", "z": -300, "x": 0, "force": 24, "direction": Vector3(-1,0,0), "length": 60},
\t\t\t{"kind": "bumper", "z": -100, "x": 1.5, "force": 18},
\t\t\t{"kind": "bumper", "z": -100, "x": -1.5, "force": 18},
\t\t\t{"kind": "speed_boost", "z": -45, "x": 0, "strength": 14},
\t\t\t{"kind": "brake_pad", "z": -260, "x": 0},
\t\t],
\t\t"finish_z": -440,
'''

# ── 6-4: Polarity Switchback ───────────────────────────────────────────────
new_6_4 = '''\t\t"name": "Polarity Shift",
\t\t"slope": 9.0,
\t\t"par_time": 46.0,
\t\t"segments": [
\t\t\t{"z0": 0,   "z1": -40,  "w": 10, "x": 0,  "y": 0},
\t\t\t{"z0": -40, "z1": -80,  "w": 8,  "x": 3,  "ramp": 2.0},
\t\t\t{"z0": -80, "z1": -120, "w": 7,  "x": 3,  "y": 2.0},
\t\t\t{"z0": -120,"z1": -160, "w": 7,  "x": -3, "ramp": -2.0},
\t\t\t{"z0": -160,"z1": -200, "w": 6,  "x": -3, "y": 0},
\t\t\t{"z0": -200,"z1": -240, "w": 7,  "x": 3,  "ramp": 2.0},
\t\t\t{"z0": -240,"z1": -280, "w": 7,  "x": 3,  "y": 2.5},
\t\t\t{"z0": -280,"z1": -320, "w": 6,  "x": -3, "ramp": -2.0},
\t\t\t{"z0": -320,"z1": -360, "w": 6,  "x": -3, "y": 0.5},
\t\t\t{"z0": -360,"z1": -400, "w": 8,  "x": 0,  "ramp": 1.5},
\t\t\t{"z0": -400,"z1": -440, "w": 8,  "x": 0,  "y": 2.0},
\t\t\t{"z0": -440,"z1": -480, "w": 8,  "x": 0,  "ramp": -1.0},
\t\t\t{"z0": -480,"z1": -520, "w": 8,  "x": 0,  "y": 0.5},
\t\t],
\t\t"coins": [
\t\t\t{"z": -30,  "x": 0,  "y": 2.2},
\t\t\t{"z": -60,  "x": 4,  "y": 3.5},
\t\t\t{"z": -100, "x": 4,  "y": 3.5},
\t\t\t{"z": -140, "x": -4, "y": 3.0},
\t\t\t{"z": -180, "x": -4, "y": 2.5},
\t\t\t{"z": -220, "x": 4,  "y": 3.5},
\t\t\t{"z": -260, "x": 4,  "y": 3.5},
\t\t\t{"z": -300, "x": -4, "y": 3.0},
\t\t\t{"z": -340, "x": -4, "y": 2.5},
\t\t\t{"z": -380, "x": 0,  "y": 2.2},
\t\t\t{"z": -420, "x": 0,  "y": 3.0},
\t\t\t{"z": -460, "x": 0,  "y": 3.2},
\t\t\t{"z": -500, "x": 0,  "y": 2.5},
\t\t],
\t\t"obstacles": [
\t\t\t{"kind": "checkpoint", "z": -130, "x": 3},
\t\t\t{"kind": "checkpoint", "z": -290, "x": -3},
\t\t\t{"kind": "magnet", "z": -60,  "x": 0, "type": "attract", "strength": 20, "length": 70},
\t\t\t{"kind": "magnet", "z": -140, "x": 0, "type": "repel", "strength": 22, "length": 60},
\t\t\t{"kind": "magnet", "z": -220, "x": 0, "type": "attract", "strength": 20, "length": 70},
\t\t\t{"kind": "magnet", "z": -300, "x": 0, "type": "repel", "strength": 22, "length": 60},
\t\t\t{"kind": "speed_boost", "z": -50, "x": 0, "strength": 14},
\t\t\t{"kind": "brake_pad", "z": -180, "x": -3},
\t\t\t{"kind": "brake_pad", "z": -340, "x": 0},
\t\t],
\t\t"finish_z": -520,
'''

# Apply replacements
text = replace_level(text, "1-5", new_1_5)
text = replace_level(text, "2-4", new_2_4)
text = replace_level(text, "4-2", new_4_2)
text = replace_level(text, "4-4", new_4_4)
text = replace_level(text, "5-5", new_5_5)
text = replace_level(text, "6-4", new_6_4)

with open(path, "w", encoding="utf-8") as f:
    f.write(text)

print("Done.")
