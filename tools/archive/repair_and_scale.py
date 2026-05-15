#!/usr/bin/env python3
"""
Repair corrupted .tscn files and scale level_1_1.tscn properly.
"""

import re
from pathlib import Path

LEVELS_DIR = Path("C:/Users/phili/OneDrive/Desktop/Physix/scenes/levels")

REPAIR_TARGETS = [
    "world_1/level_1_2.tscn",
    "world_2/level_2_1.tscn",
    "world_2/level_2_2.tscn",
]

SCALE_TARGET = "world_1/level_1_1.tscn"

ROOT_EXCLUDE = {"Player", "HUD", "RespawnTimer"}


def add_missing_closing_parens(text: str) -> str:
    lines = text.splitlines()
    result = []
    for line in lines:
        stripped = line.strip()
        if "size = Vector3(" in stripped and not stripped.endswith(")"):
            line = line + ")"
        if "transform = Transform3D(" in stripped and not stripped.endswith(")"):
            line = line + ")"
        result.append(line)
    return "\n".join(result)


def repair_subresource_prefixes(text: str) -> str:
    lines = text.splitlines()
    result = []
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # Detect TrackMesh line with prefix already present
        if '[sub_resource type="BoxMesh"    id="TrackMesh"]' in stripped and 'size = Vector3(' in stripped:
            # Check if next 3 lines are bare size lines
            if i + 3 < len(lines):
                next_stripped = [lines[i + j].strip() for j in range(1, 4)]
                if all(l.startswith("size = Vector3(") and not l.startswith("[") for l in next_stripped):
                    result.append(line)
                    result.append(f'[sub_resource type="BoxShape3D" id="TrackShape"]  {next_stripped[0]}')
                    result.append(f'[sub_resource type="BoxMesh"    id="WallMesh"]    {next_stripped[1]}')
                    result.append(f'[sub_resource type="BoxShape3D" id="WallShape"]   {next_stripped[2]}')
                    i += 4
                    continue

        result.append(line)
        i += 1
    return "\n".join(result)


def repair_file(filepath: Path) -> bool:
    text = filepath.read_text(encoding="utf-8")
    new_text = add_missing_closing_parens(text)
    new_text = repair_subresource_prefixes(new_text)
    if new_text != text:
        filepath.write_text(new_text, encoding="utf-8")
        return True
    return False


# ── Scaling helpers for level_1_1 (fixed to preserve syntax) ──

def scale_z_in_size(line: str, factor: float = 2.0) -> str:
    m = re.search(r'(size\s*=\s*Vector3\([^,]+,\s*[^,]+,)\s*(-?\d+(?:\.\d+)?)(\))', line)
    if m:
        new_z = float(m.group(2)) * factor
        return f'{m.group(1)} {new_z:.1f}{m.group(3)}'
    return line


def scale_z_in_transform(line: str, factor: float = 2.0) -> str:
    m = re.search(
        r'(transform\s*=\s*Transform3D\([^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,)\s*(-?\d+(?:\.\d+)?)(\))',
        line,
    )
    if m:
        new_z = float(m.group(2)) * factor
        return f'{m.group(1)} {new_z:.1f}{m.group(3)}'
    return line


def find_track_size(lines: list) -> float:
    for i, line in enumerate(lines):
        if 'id="TrackMesh"]' in line:
            for j in range(i, min(i + 2, len(lines))):
                m = re.search(r'size\s*=\s*Vector3\([^,]+,\s*[^,]+,\s*(-?\d+(?:\.\d+)?)\)', lines[j])
                if m:
                    return float(m.group(1))
    return 0.0


def find_trackroot_z(lines: list) -> float:
    for i, line in enumerate(lines):
        if '[node name="TrackRoot" type="Node3D" parent="."]' in line:
            for j in range(i, min(i + 2, len(lines))):
                m = re.search(
                    r'transform\s*=\s*Transform3D\([^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*(-?\d+(?:\.\d+)?)\)',
                    lines[j],
                )
                if m:
                    return float(m.group(1))
    return 0.0


def scale_level(filepath: Path) -> bool:
    text = filepath.read_text(encoding="utf-8")
    lines = text.splitlines()

    track_size = find_track_size(lines)
    if track_size <= 0:
        print(f"    Could not find track size in {filepath.name}")
        return False

    trackroot_z = find_trackroot_z(lines)
    if trackroot_z == 0.0:
        print(f"    Could not find TrackRoot position in {filepath.name}")
        return False

    new_trackroot_z = trackroot_z - track_size / 2.0

    result = []
    under_trackroot = False
    trackroot_depth = 0
    scale_next_root_transform = False

    for i, line in enumerate(lines):
        stripped = line.strip()
        new_line = line

        # Detect TrackRoot declaration
        if '[node name="TrackRoot" type="Node3D" parent="."]' in stripped:
            under_trackroot = True
            trackroot_depth = 0
            if i + 1 < len(lines) and "transform = " in lines[i + 1]:
                m = re.search(
                    r'(transform\s*=\s*Transform3D\([^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,)\s*(-?\d+(?:\.\d+)?)(\))',
                    lines[i + 1],
                )
                if m:
                    lines[i + 1] = f'{m.group(1)} {new_trackroot_z:.1f}{m.group(3)}'

        # Detect TrackRoot hierarchy depth changes
        m_node = re.search(r'\[node name="([^"]+)"[^\]]*parent="([^"]+)"', stripped)
        if m_node:
            name, parent = m_node.groups()
            if parent == "TrackRoot":
                under_trackroot = True
                trackroot_depth = 1
            elif parent.startswith("TrackRoot/"):
                under_trackroot = True
                trackroot_depth = parent.count("/")
            elif under_trackroot and not parent.startswith("TrackRoot"):
                under_trackroot = False
                trackroot_depth = 0
            elif under_trackroot:
                current_depth = parent.count("/")
                if current_depth < trackroot_depth:
                    trackroot_depth = current_depth

        # Scale track/wall mesh/shape sizes (large z only)
        if "size = Vector3(" in stripped:
            m = re.search(r'size\s*=\s*Vector3\([^,]+,\s*[^,]+,\s*(-?\d+(?:\.\d+)?)\)', stripped)
            if m:
                val = float(m.group(1))
                if val > 100:
                    new_line = scale_z_in_size(line, 2.0)

        # Scale transforms under TrackRoot
        if under_trackroot and "transform = " in stripped:
            new_line = scale_z_in_transform(line, 2.0)

        # Detect root-level nodes that need scaling
        if stripped.startswith("[node name=") and 'parent="."' in stripped:
            node_name = re.search(r'\[node name="([^"]+)"', stripped)
            if node_name and node_name.group(1) not in ROOT_EXCLUDE:
                scale_next_root_transform = True
            else:
                scale_next_root_transform = False

        if scale_next_root_transform and "transform = " in stripped:
            new_line = scale_z_in_transform(line, 2.0)
            scale_next_root_transform = False

        result.append(new_line)

    new_text = "\n".join(result)

    # Update par_time
    new_text = re.sub(r'par_time\s*=\s*(\d+(?:\.\d+)?)', lambda m: f'par_time = {float(m.group(1)) * 2.0:.1f}', new_text)

    if new_text != text:
        filepath.write_text(new_text, encoding="utf-8")
        return True
    return False


def main():
    for rel in REPAIR_TARGETS:
        filepath = LEVELS_DIR / rel
        if filepath.exists() and repair_file(filepath):
            print(f"  Repaired {rel}")
        else:
            print(f"  OK or not found: {rel}")

    scale_path = LEVELS_DIR / SCALE_TARGET
    if scale_path.exists() and scale_level(scale_path):
        print(f"  Scaled {SCALE_TARGET}")
    else:
        print(f"  No changes for {SCALE_TARGET}")


if __name__ == "__main__":
    main()
