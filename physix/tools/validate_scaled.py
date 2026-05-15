#!/usr/bin/env python3
"""Validate scaled level files for common corruption issues."""

import re
from pathlib import Path

LEVELS_DIR = Path("C:/Users/phili/OneDrive/Desktop/Physix/scenes/levels")

TARGETS = [
    "world_1/level_1_1.tscn",
    "world_1/level_1_2.tscn",
    "world_2/level_2_1.tscn",
    "world_2/level_2_2.tscn",
    "world_3/level_3_1.tscn",
    "world_3/level_3_2.tscn",
    "world_4/level_4_1.tscn",
]


def validate(filepath: Path):
    text = filepath.read_text(encoding="utf-8")
    lines = text.splitlines()
    issues = []

    # Fake nodes
    for i, line in enumerate(lines, 1):
        if 'parent="."' in line:
            node_part = line.split(']')[0] if ']' in line else line
            if '/' in node_part or './' in node_part:
                issues.append(f"  FAKE NODE line {i}: {line.strip()[:80]}")

    # Duplicate nodes
    node_counts = {}
    for i, line in enumerate(lines, 1):
        m = re.search(r'\[node name="([^"]+)"', line)
        if m:
            name = m.group(1)
            node_counts[name] = node_counts.get(name, 0) + 1
    for name, count in node_counts.items():
        if count > 1:
            issues.append(f"  DUPLICATE NODE: {name} ({count} times)")

    # Bare sub-resource size lines
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if stripped.startswith("size = Vector3(") and not stripped.startswith("["):
            # Check if previous line is a sub-resource declaration (then it's legitimate)
            if i > 1 and '[sub_resource' not in lines[i-2]:
                issues.append(f"  BARE SIZE line {i}: {stripped[:80]}")

    # Missing closing paren on Vector3/Transform3D
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if ("size = Vector3(" in stripped or "transform = Transform3D(" in stripped) and not stripped.endswith(")"):
            issues.append(f"  UNCLOSED PAREN line {i}: {stripped[:80]}")

    # WallShp references without declaration
    wallshp_refs = [i for i, line in enumerate(lines, 1) if 'SubResource("WallShp")' in line]
    wallshp_decls = [i for i, line in enumerate(lines, 1) if 'id="WallShp"' in line]
    if wallshp_refs and not wallshp_decls:
        issues.append(f"  MISSING WallShp declaration ({len(wallshp_refs)} refs)")

    # TrackRoot z consistency
    track_size = 0.0
    for line in lines:
        if 'id="TrackMesh"]' in line:
            m = re.search(r'size\s*=\s*Vector3\([^,]+,\s*[^,]+,\s*(-?\d+(?:\.\d+)?)\)', line)
            if m:
                track_size = float(m.group(1))
                break

    expected_trackroot_z = -track_size / 2.0 if track_size else None
    for i, line in enumerate(lines, 1):
        if '[node name="TrackRoot" type="Node3D" parent="."]' in line and i < len(lines):
            m = re.search(r'transform\s*=\s*Transform3D\([^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*(-?\d+(?:\.\d+)?)\)', lines[i])
            if m and expected_trackroot_z is not None:
                actual = float(m.group(1))
                if abs(actual - expected_trackroot_z) > 0.1:
                    issues.append(f"  BAD TrackRoot z: {actual} (expected {expected_trackroot_z:.1f})")

    if issues:
        print(f"{filepath.name}:")
        for issue in issues:
            print(issue)
    else:
        print(f"  OK: {filepath.name}")


def main():
    for rel in TARGETS:
        filepath = LEVELS_DIR / rel
        if filepath.exists():
            validate(filepath)
        else:
            print(f"  MISSING: {rel}")


if __name__ == "__main__":
    main()
