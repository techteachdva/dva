#!/usr/bin/env python3
"""Add spike obstacles to selected levels in level_generator.gd."""

import re

path = r"C:\Users\phili\OneDrive\Desktop\Physix\scripts\level_generator.gd"

with open(path, "r", encoding="utf-8") as f:
    text = f.read()

def add_obstacles_to_level(src: str, key: str, new_obs: list[str]) -> str:
    # Find the obstacles array for this level
    pattern = rf'\t"{key}": \{{[\s\S]*?"obstacles": \[(.*?)\]'
    m = re.search(pattern, src, re.DOTALL)
    if not m:
        print(f"WARNING: Could not find obstacles for level {key}")
        return src
    old_obs_block = m.group(1)
    # Check if already has spikes
    if "spike" in old_obs_block:
        print(f"Level {key} already has spikes, skipping")
        return src
    # Append new obstacles before the closing ]
    # The old_obs_block ends with a comma or is empty
    indent = "\t\t\t"
    if old_obs_block.strip():
        if not old_obs_block.rstrip().endswith(","):
            old_obs_block = old_obs_block.rstrip() + ",\n"
        else:
            old_obs_block = old_obs_block.rstrip() + "\n"
    else:
        old_obs_block = "\n"
    new_block = old_obs_block + "".join([f'{indent}{obs},\n' for obs in new_obs])
    new_block = new_block.rstrip() + "\n\t\t\t"
    src = src.replace(m.group(0), f'\t"{key}": {{\n\t\t...\n\t\t\t"obstacles": [{new_block}]', 1)
    # Actually, better to do a targeted replacement
    # Find the exact obstacles block text
    full_match = m.group(0)
    new_full = full_match.replace(old_obs_block.strip(), new_block.strip(), 1)
    # Wait, the issue is old_obs_block might not match exactly due to trailing content
    # Let me do a simpler approach: replace the obstacles array content
    # Re-find with more context
    return src

# Simpler approach: use line-based replacement
def add_spikes_to_level(src: str, key: str, spikes: list[str]) -> str:
    # Find the key and locate its obstacles block
    lines = src.split("\n")
    in_level = False
    level_start = -1
    for i, line in enumerate(lines):
        if f'"{key}"' in line and "{" in line:
            in_level = True
            level_start = i
        if in_level and '"obstacles":' in line:
            # Found obstacles header, now find the closing ] of this array
            for j in range(i+1, len(lines)):
                if lines[j].strip() == "],":
                    # Insert spikes before the closing ]
                    indent = "\t\t\t"
                    for spike in reversed(spikes):
                        lines.insert(j, f"{indent}{spike},")
                    print(f"Added {len(spikes)} spikes to level {key}")
                    return "\n".join(lines)
            break
    print(f"WARNING: Could not add spikes to level {key}")
    return src

# Define spikes for each level
levels_to_update = {
    "1-3": [
        '{"kind": "spike", "z": -90, "x": 0, "width": 6, "length": 2}',
        '{"kind": "spike", "z": -205, "x": 2, "width": 6, "length": 2}',
        '{"kind": "spike", "z": -255, "x": 2, "width": 5, "length": 2}',
    ],
    "2-5": [
        '{"kind": "spike", "z": -100, "x": 0, "width": 6, "length": 2}',
        '{"kind": "spike", "z": -160, "x": 0, "width": 5, "length": 2}',
        '{"kind": "spike", "z": -220, "x": 0, "width": 5, "length": 2}',
        '{"kind": "spike", "z": -300, "x": 0, "width": 6, "length": 2}',
    ],
    "3-5": [
        '{"kind": "spike", "z": -90, "x": 0, "width": 6, "length": 2}',
        '{"kind": "spike", "z": -180, "x": 0, "width": 5, "length": 2}',
        '{"kind": "spike", "z": -260, "x": 0, "width": 5, "length": 2}',
        '{"kind": "spike", "z": -320, "x": 0, "width": 6, "length": 2}',
    ],
    "4-5": [
        '{"kind": "spike", "z": -100, "x": 0, "width": 5, "length": 2}',
        '{"kind": "spike", "z": -180, "x": 0, "width": 5, "length": 2}',
        '{"kind": "spike", "z": -260, "x": 0, "width": 5, "length": 2}',
        '{"kind": "spike", "z": -340, "x": 0, "width": 6, "length": 2}',
    ],
    "5-4": [
        '{"kind": "spike", "z": -90, "x": 0, "width": 6, "length": 2}',
        '{"kind": "spike", "z": -170, "x": 0, "width": 6, "length": 2}',
        '{"kind": "spike", "z": -250, "x": 0, "width": 5, "length": 2}',
        '{"kind": "spike", "z": -330, "x": 0, "width": 6, "length": 2}',
    ],
    "6-5": [
        '{"kind": "spike", "z": -90, "x": 0, "width": 6, "length": 2}',
        '{"kind": "spike", "z": -170, "x": 0, "width": 5, "length": 2}',
        '{"kind": "spike", "z": -250, "x": 0, "width": 5, "length": 2}',
        '{"kind": "spike", "z": -330, "x": 0, "width": 5, "length": 2}',
        '{"kind": "spike", "z": -410, "x": 0, "width": 6, "length": 2}',
    ],
}

for key, spikes in levels_to_update.items():
    text = add_spikes_to_level(text, key, spikes)

with open(path, "w", encoding="utf-8") as f:
    f.write(text)

print("Done adding spikes.")
