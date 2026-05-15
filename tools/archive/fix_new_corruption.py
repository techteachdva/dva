#!/usr/bin/env python3
"""Repair sub-resource prefix corruption in newly scaled files."""

import re
from pathlib import Path

LEVELS_DIR = Path("C:/Users/phili/OneDrive/Desktop/Physix/scenes/levels")

REPAIRS = {
    "world_3/level_3_1.tscn": {
        "track_size": 1360.0,
        "grav_size": 240.0,
        "has_lg": True,
        "has_hg": False,
    },
    "world_3/level_3_2.tscn": {
        "track_size": 1600.0,
        "grav_size": None,
        "has_lg": False,
        "has_hg": False,
    },
    "world_4/level_4_1.tscn": {
        "track_size": 1440.0,
        "grav_size": None,
        "has_lg": False,
        "has_hg": False,
    },
}


def repair_file(filepath: Path, info: dict) -> bool:
    text = filepath.read_text(encoding="utf-8")
    lines = text.splitlines()
    result = []
    i = 0
    changed = False

    track_size = info["track_size"]
    grav_size = info["grav_size"]

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # Detect 4-line bare track/wall pattern
        if stripped.startswith("size = Vector3(") and not stripped.startswith("["):
            # Check if this is the start of the track/wall block
            if i + 3 < len(lines):
                next_stripped = [lines[i + j].strip() for j in range(4)]
                if all(l.startswith("size = Vector3(") and not l.startswith("[") for l in next_stripped):
                    # Determine the 4th line: could be WallShape or another track/wall line
                    v0 = re.search(r'size = Vector3\(([^,]+),\s*([^,]+),\s*([^)]+)\)', next_stripped[0])
                    if v0 and float(v0.group(3)) == track_size:
                        # This is the 4-line track/wall block
                        result.append(f'[sub_resource type="BoxMesh"    id="TrackMesh"]  size = Vector3({v0.group(1)}, {v0.group(2)}, {track_size:.1f})')
                        v1 = re.search(r'size = Vector3\(([^,]+),\s*([^,]+),\s*([^)]+)\)', next_stripped[1])
                        result.append(f'[sub_resource type="BoxShape3D" id="TrackShape"] size = Vector3({v1.group(1)}, {v1.group(2)}, {track_size:.1f})')
                        v2 = re.search(r'size = Vector3\(([^,]+),\s*([^,]+),\s*([^)]+)\)', next_stripped[2])
                        result.append(f'[sub_resource type="BoxMesh"    id="WallMesh"]   size = Vector3({v2.group(1)}, {v2.group(2)}, {track_size:.1f})')
                        v3 = re.search(r'size = Vector3\(([^,]+),\s*([^,]+),\s*([^)]+)\)', next_stripped[3])
                        result.append(f'[sub_resource type="BoxShape3D" id="WallShape"]  size = Vector3({v3.group(1)}, {v3.group(2)}, {track_size:.1f})')
                        i += 4
                        changed = True
                        continue

            # Check for 2-line LG pattern (level_3_1)
            if grav_size and i + 1 < len(lines):
                next_stripped = [lines[i + j].strip() for j in range(2)]
                if all(l.startswith("size = Vector3(") and not l.startswith("[") for l in next_stripped):
                    v0 = re.search(r'size = Vector3\(([^,]+),\s*([^,]+),\s*([^)]+)\)', next_stripped[0])
                    v1 = re.search(r'size = Vector3\(([^,]+),\s*([^,]+),\s*([^)]+)\)', next_stripped[1])
                    if v0 and v1 and float(v0.group(3)) == grav_size and float(v1.group(3)) == grav_size:
                        result.append(f'[sub_resource type="BoxMesh"    id="LGMesh"]     size = Vector3({v0.group(1)}, {v0.group(2)}, {grav_size:.1f})')
                        result.append(f'[sub_resource type="BoxShape3D" id="LGShp"]      size = Vector3({v1.group(1)}, {v1.group(2)}, {grav_size:.1f})')
                        i += 2
                        changed = True
                        continue

        # Fix WallShp typo
        if 'SubResource("WallShp")' in line:
            line = line.replace('SubResource("WallShp")', 'SubResource("WallShape")')
            changed = True

        result.append(line)
        i += 1

    new_text = "\n".join(result)
    if changed:
        filepath.write_text(new_text, encoding="utf-8")
    return changed


def main():
    for rel, info in REPAIRS.items():
        filepath = LEVELS_DIR / rel
        if filepath.exists() and repair_file(filepath, info):
            print(f"  Repaired {rel}")
        else:
            print(f"  No change: {rel}")


if __name__ == "__main__":
    main()
