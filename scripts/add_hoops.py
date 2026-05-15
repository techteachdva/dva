#!/usr/bin/env python3
"""Add hoop obstacles to selected levels in level_generator.gd."""

import re

path = r"C:\Users\phili\OneDrive\Desktop\Physix\scripts\level_generator.gd"

with open(path, "r", encoding="utf-8") as f:
    text = f.read()

def add_hoops_to_level(src: str, key: str, hoops: list[str]) -> str:
    lines = src.split("\n")
    in_level = False
    for i, line in enumerate(lines):
        if f'"{key}"' in line and "{" in line:
            in_level = True
        if in_level and '"obstacles":' in line:
            for j in range(i+1, len(lines)):
                if lines[j].strip() == "],":
                    indent = "\t\t\t"
                    for hoop in reversed(hoops):
                        lines.insert(j, f"{indent}{hoop},")
                    print(f"Added {len(hoops)} hoops to level {key}")
                    return "\n".join(lines)
            break
    print(f"WARNING: Could not add hoops to level {key}")
    return src

levels_to_update = {
    "1-3": [
        '{"kind": "hoop_bonus", "z": -100, "x": 0, "y": 5.0, "boost": 18}',
        '{"kind": "hoop_bonus", "z": -205, "x": 2, "y": 4.5, "boost": 18}',
        '{"kind": "hoop_checkpoint", "z": -240, "x": 2, "y": 3.0}',
    ],
    "1-4": [
        '{"kind": "hoop_checkpoint", "z": -150, "x": 4, "y": 3.5}',
        '{"kind": "hoop_bonus", "z": -70, "x": 0, "y": 3.5, "boost": 16}',
    ],
    "1-5": [
        '{"kind": "hoop_checkpoint", "z": -140, "x": -3, "y": 4.0}',
        '{"kind": "hoop_bonus", "z": -60, "x": 3, "y": 4.0, "boost": 16}',
    ],
    "2-3": [
        '{"kind": "hoop_bonus", "z": -100, "x": 0, "y": 5.5, "boost": 18}',
        '{"kind": "hoop_checkpoint", "z": -180, "x": 0, "y": 2.0}',
    ],
    "2-4": [
        '{"kind": "hoop_checkpoint", "z": -220, "x": 4, "y": 4.0}',
        '{"kind": "hoop_bonus", "z": -100, "x": 3, "y": 4.5, "boost": 16}',
    ],
    "2-6": [
        '{"kind": "hoop_checkpoint", "z": -115, "x": 0, "y": 3.5}',
        '{"kind": "hoop_bonus", "z": -185, "x": 0, "y": 4.0, "boost": 18}',
    ],
    "3-2": [
        '{"kind": "hoop_bonus", "z": -270, "x": 2, "y": 5.0, "boost": 18}',
        '{"kind": "hoop_checkpoint", "z": -160, "x": 0, "y": 2.0}',
    ],
    "3-5": [
        '{"kind": "hoop_checkpoint", "z": -80, "x": 0, "y": 3.5}',
        '{"kind": "hoop_bonus", "z": -180, "x": 0, "y": 3.5, "boost": 18}',
    ],
    "4-3": [
        '{"kind": "hoop_bonus", "z": -100, "x": 0, "y": 5.5, "boost": 18}',
        '{"kind": "hoop_checkpoint", "z": -135, "x": 0, "y": 3.5}',
    ],
    "4-5": [
        '{"kind": "hoop_checkpoint", "z": -130, "x": 0, "y": 3.5}',
        '{"kind": "hoop_bonus", "z": -100, "x": 0, "y": 3.5, "boost": 18}',
    ],
    "5-3": [
        '{"kind": "hoop_checkpoint", "z": -150, "x": 0, "y": 3.5}',
        '{"kind": "hoop_bonus", "z": -275, "x": 0, "y": 5.0, "boost": 18}',
    ],
    "5-6": [
        '{"kind": "hoop_checkpoint", "z": -150, "x": -2, "y": 3.5}',
        '{"kind": "hoop_bonus", "z": -100, "x": 0, "y": 4.0, "boost": 16}',
    ],
    "6-3": [
        '{"kind": "hoop_checkpoint", "z": -130, "x": 3, "y": 3.5}',
        '{"kind": "hoop_bonus", "z": -60, "x": 0, "y": 3.5, "boost": 16}',
    ],
    "6-5": [
        '{"kind": "hoop_checkpoint", "z": -80, "x": 0, "y": 3.5}',
        '{"kind": "hoop_bonus", "z": -130, "x": 0, "y": 3.5, "boost": 18}',
    ],
    "6-6": [
        '{"kind": "hoop_checkpoint", "z": -150, "x": -3, "y": 3.5}',
        '{"kind": "hoop_bonus", "z": -270, "x": 4, "y": 5.0, "boost": 18}',
    ],
}

for key, hoops in levels_to_update.items():
    text = add_hoops_to_level(text, key, hoops)

with open(path, "w", encoding="utf-8") as f:
    f.write(text)

print("Done adding hoops.")
