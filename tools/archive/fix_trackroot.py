#!/usr/bin/env python3
"""Fix double-scaled TrackRoot z-positions."""

import re
from pathlib import Path

LEVELS_DIR = Path("C:/Users/phili/OneDrive/Desktop/Physix/scenes/levels")

FIXES = {
    "world_1/level_1_1.tscn": -450.0,
    "world_1/level_1_2.tscn": -540.0,
    "world_2/level_2_1.tscn": -510.0,
    "world_2/level_2_2.tscn": -570.0,
}


def fix_trackroot(filepath: Path, target_z: float):
    text = filepath.read_text(encoding="utf-8")
    lines = text.splitlines()
    result = []
    for i, line in enumerate(lines):
        if '[node name="TrackRoot" type="Node3D" parent="."]' in line and i + 1 < len(lines):
            next_line = lines[i + 1]
            m = re.search(
                r'(transform\s*=\s*Transform3D\([^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,)\s*(-?\d+(?:\.\d+)?)(\))',
                next_line,
            )
            if m:
                lines[i + 1] = f'{m.group(1)} {target_z:.1f}{m.group(3)}'
        result.append(lines[i])
    new_text = "\n".join(result)
    if new_text != text:
        filepath.write_text(new_text, encoding="utf-8")
        return True
    return False


def main():
    for rel, z in FIXES.items():
        filepath = LEVELS_DIR / rel
        if filepath.exists() and fix_trackroot(filepath, z):
            print(f"  Fixed TrackRoot z in {rel}")
        else:
            print(f"  No change: {rel}")


if __name__ == "__main__":
    main()
