#!/usr/bin/env python3
"""
Fix missing obstacle parent nodes in Physix level .tscn files.

In Godot 4 .tscn, nodes like [node name="BoostMesh1" parent="SpeedBoost1"]
require a [node name="SpeedBoost1" ...] declaration. Many levels are missing
these parent declarations, making obstacles non-functional.

This script:
1. Scans each level for missing parent references (only at root level)
2. Parses level comments for intended obstacle positions
3. Calculates scale factor from actual vs comment positions of checkpoints/finish
4. Inserts missing parent declarations with correct type, script, and position
"""

import re
from pathlib import Path

LEVELS_DIR = Path("C:/Users/phili/OneDrive/Desktop/Physix/scenes/levels")

PARENT_RULES = [
    (re.compile(r"^SpeedBoost\d+$"),       "Area3D",  "BoostScript",  {"monitoring": "true"}),
    (re.compile(r"^Boost\d+$"),           "Area3D",  "BoostScript",  {"monitoring": "true"}),
    (re.compile(r"^FinalBoost$"),         "Area3D",  "BoostScript",  {"monitoring": "true"}),
    (re.compile(r"^BrakePad$"),           "Area3D",  "BoostScript",  {"monitoring": "true"}),
    (re.compile(r"^IcePatch$"),           "StaticBody3D", "IceScript", {"collision_layer": "1"}),
    (re.compile(r"^Ice\d+$"),             "StaticBody3D", "IceScript", {"collision_layer": "1"}),
    (re.compile(r"^IceLong$"),            "StaticBody3D", "IceScript", {"collision_layer": "1"}),
    (re.compile(r"^WindZone$"),           "Area3D",  "WindScript",   {"monitoring": "true"}),
    (re.compile(r"^Wind\d+$"),            "Area3D",  "WindScript",   {"monitoring": "true"}),
    (re.compile(r"^Bumper\d+$"),          "Area3D",  "BumperScript", {"monitoring": "true"}),
]


def find_missing_parents(text: str) -> dict:
    """Find parent names referenced by children at ROOT level but never declared."""
    # Build a set of all valid parent paths in the scene
    valid_paths = {".", ""}
    for line in text.splitlines():
        m = re.search(r'\[node name="([^"]+)" type="[^"]+" parent="([^"]+)"\]', line)
        if m:
            name, parent = m.groups()
            # Full path of this node
            if parent == ".":
                path = name
            else:
                path = f"{parent}/{name}"
            valid_paths.add(path)

    # Now find children whose parent path is NOT valid
    missing = {}
    for line in text.splitlines():
        m = re.search(r'\[node name="([^"]+)" type="[^"]+" parent="([^"]+)"\]', line)
        if m:
            name, parent = m.groups()
            if parent not in valid_paths and parent != ".":
                missing.setdefault(parent, []).append((name, line))
    return missing


def parse_ext_resources(text: str) -> dict:
    """Map script path keywords to ext_resource IDs."""
    mapping = {}
    for line in text.splitlines():
        m = re.search(
            r'\[ext_resource type="Script"\s+path="res://scripts/obstacles/([^"]+)"\s+id="([^"]+)"\]',
            line
        )
        if m:
            script_name, ext_id = m.groups()
            friendly = script_name.replace(".gd", "").replace("_", "")
            mapping[friendly] = ext_id
            mapping[script_name] = ext_id
    return mapping


def find_comment_positions(text: str) -> dict:
    """Parse ; comment lines for obstacle positions."""
    positions = {}
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if not line.strip().startswith(";"):
            continue
        m = re.search(r'Z=(-?\d+(?:\.\d+)?)', line)
        if not m:
            continue
        z_val = float(m.group(1))
        lowered = line.lower()

        # Speed boost detection
        if "speed boost" in lowered or "boost pad" in lowered:
            num_match = re.search(r'#(\d+)|boost\s+(\d+)', lowered)
            if num_match:
                num = num_match.group(1) or num_match.group(2)
                name = f"SpeedBoost{num}"
            else:
                name = "SpeedBoost1"
            _assign_unique(positions, name, z_val, "SpeedBoost")
        elif "boost" in lowered and "speed" not in lowered and "pad" not in lowered:
            num_match = re.search(r'boost\s*(\d+)', lowered)
            if num_match:
                name = f"Boost{num_match.group(1)}"
            else:
                name = "Boost1"
            _assign_unique(positions, name, z_val, "Boost")
        elif "brake" in lowered:
            positions["BrakePad"] = z_val
        elif "ice" in lowered:
            if "long" in lowered:
                positions["IceLong"] = z_val
            else:
                num_match = re.search(r'ice\s*(\d+)', lowered)
                if num_match:
                    name = f"Ice{num_match.group(1)}"
                else:
                    name = "IcePatch"
                _assign_unique(positions, name, z_val, "Ice")
        elif "wind" in lowered:
            num_match = re.search(r'wind\s*(\d+)', lowered)
            if num_match:
                name = f"Wind{num_match.group(1)}"
            else:
                name = "WindZone"
            _assign_unique(positions, name, z_val, "Wind")
        elif "bumper" in lowered:
            num_match = re.search(r'bumper\s*(?:#|pair)?\s*(\d+)', lowered)
            if num_match:
                name = f"Bumper{num_match.group(1)}"
            else:
                name = "Bumper1"
            _assign_unique(positions, name, z_val, "Bumper")
        elif "checkpoint" in lowered:
            positions["Checkpoint1"] = z_val
        elif "finish" in lowered:
            positions["FinishZone"] = z_val
    return positions


def _assign_unique(positions, name, z_val, prefix):
    if name not in positions:
        positions[name] = z_val
    else:
        for n in range(2, 20):
            alt = f"{prefix}{n}"
            if alt not in positions:
                positions[alt] = z_val
                break


def find_actual_positions(text: str) -> dict:
    """Find actual Z positions of declared Checkpoint1 and FinishZone."""
    positions = {}
    lines = text.splitlines()
    current_node = None
    for i, line in enumerate(lines):
        m = re.search(r'\[node name="(Checkpoint1|FinishZone)" type="[^"]+" parent="\."\]', line)
        if m:
            current_node = m.group(1)
        elif current_node:
            m2 = re.search(r'transform\s*=\s*Transform3D\([^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*(-?\d+(?:\.\d+)?)', line)
            if m2:
                positions[current_node] = float(m2.group(1))
                current_node = None
    return positions


def determine_scale_factor(comment_positions: dict, actual_positions: dict) -> float:
    ratios = []
    for key in ("Checkpoint1", "FinishZone"):
        if key in comment_positions and key in actual_positions:
            c = abs(comment_positions[key])
            a = abs(actual_positions[key])
            if c > 0:
                ratios.append(a / c)
    if ratios:
        return sum(ratios) / len(ratios)
    return 3.0


def find_insertion_point(text: str, parent_name: str) -> int:
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if f'parent="{parent_name}"' in line:
            return i
    return len(lines)


def find_finish_z(text: str) -> float:
    lines = text.splitlines()
    current_node = None
    for i, line in enumerate(lines):
        if '[node name="FinishZone"' in line and 'parent="."' in line:
            current_node = "FinishZone"
        elif current_node == "FinishZone":
            m = re.search(r'transform\s*=\s*Transform3D\([^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*(-?\d+(?:\.\d+)?)', line)
            if m:
                return float(m.group(1))
    return -500.0


def fix_level(filepath: Path) -> list:
    text = filepath.read_text(encoding="utf-8")
    missing = find_missing_parents(text)
    if not missing:
        return []

    ext_resources = parse_ext_resources(text)
    comment_positions = find_comment_positions(text)
    actual_positions = find_actual_positions(text)
    scale = determine_scale_factor(comment_positions, actual_positions)

    finish_z = find_finish_z(text)
    abs_finish = abs(finish_z)

    added = []
    lines = text.splitlines()

    for parent_name in sorted(missing.keys()):
        # Only process root-level missing parents (no / in name)
        if "/" in parent_name:
            continue

        node_type = "Area3D"
        script_key = None
        extra_props = {"monitoring": "true"}
        for pattern, nt, sk, ep in PARENT_RULES:
            if pattern.match(parent_name):
                node_type = nt
                script_key = sk
                extra_props = dict(ep)
                break

        # Skip if not a known obstacle type (safety)
        if script_key is None and parent_name not in ["Bumper1", "Bumper2", "Wind1", "Wind2"]:
            continue

        # Determine Z position
        z_pos = None
        if parent_name in comment_positions:
            z_pos = -abs(comment_positions[parent_name] * scale)
        else:
            if parent_name.startswith("SpeedBoost") or parent_name.startswith("Boost"):
                num = int(re.search(r'\d+', parent_name).group()) if re.search(r'\d+', parent_name) else 1
                frac = 0.20 + (num - 1) * 0.25
                z_pos = -abs_finish * frac
            elif parent_name == "BrakePad":
                z_pos = -abs_finish * 0.45
            elif parent_name.startswith("Ice"):
                z_pos = -abs_finish * 0.55
            elif parent_name.startswith("Wind"):
                z_pos = -abs_finish * 0.50
            elif parent_name.startswith("Bumper"):
                num = int(re.search(r'\d+', parent_name).group()) if re.search(r'\d+', parent_name) else 1
                frac = 0.35 + (num - 1) * 0.15
                z_pos = -abs_finish * frac
            elif parent_name == "FinalBoost":
                z_pos = -abs_finish * 0.85
            else:
                z_pos = -abs_finish * 0.5

        if z_pos is None:
            z_pos = -abs_finish * 0.5

        z_pos = round(z_pos, 1)

        # Resolve script ID
        script_id = ""
        if script_key:
            for key, val in ext_resources.items():
                if script_key.lower() in key.lower():
                    script_id = val
                    break

        y_pos = 0.25 if node_type == "Area3D" else 0.0

        decl_lines = [
            f'[node name="{parent_name}" type="{node_type}" parent="."]',
            f'transform = Transform3D(1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0, {y_pos}, {z_pos})',
        ]
        if script_id:
            decl_lines.append(f'script = ExtResource("{script_id}")')
        for k, v in extra_props.items():
            decl_lines.append(f'{k} = {v}')
        decl_lines.append('')

        insert_idx = find_insertion_point(text, parent_name)
        lines = lines[:insert_idx] + decl_lines + lines[insert_idx:]
        text = '\n'.join(lines)

        added.append((parent_name, z_pos))

    if added:
        filepath.write_text(text, encoding="utf-8")

    return added


def main():
    for world_dir in sorted(LEVELS_DIR.glob("world_*")):
        for level_file in sorted(world_dir.glob("level_*.tscn")):
            added = fix_level(level_file)
            if added:
                print(f"  {level_file.name}: added {', '.join(f'{n} (z={z})' for n,z in added)}")
            else:
                print(f"  {level_file.name}: OK")

    bonus_dir = LEVELS_DIR / "bonus"
    if bonus_dir.exists():
        for bonus_file in sorted(bonus_dir.glob("bonus_*.tscn")):
            if bonus_file.name == "bonus_level.tscn":
                continue
            added = fix_level(bonus_file)
            if added:
                print(f"  {bonus_file.name}: added {', '.join(f'{n} (z={z})' for n,z in added)}")
            else:
                print(f"  {bonus_file.name}: OK")


if __name__ == "__main__":
    main()
