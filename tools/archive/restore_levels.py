#!/usr/bin/env python3
"""
Restore level .tscn files by removing fake root-level nodes that were
incorrectly inserted by an earlier script.

The bad insertions have names containing "/" or starting with "./"
and parent=".", e.g.:
  [node name="HUD/CompletePanel" type="Area3D" parent="."]
  [node name="./FinishZone" type="Area3D" parent="."]
  [node name="TrackRoot/Coins" type="Area3D" parent="."]

Removing these allows the original children to reattach to their real parents.
"""

import re
from pathlib import Path

LEVELS_DIR = Path("C:/Users/phili/OneDrive/Desktop/Physix/scenes/levels")


def is_fake_node(line: str) -> bool:
    m = re.search(r'\[node name="([^"]+)" type="[^"]+" parent="\."\]', line)
    if not m:
        return False
    name = m.group(1)
    return "/" in name or name.startswith("./")


def restore_file(filepath: Path):
    text = filepath.read_text(encoding="utf-8")
    lines = text.splitlines()
    result = []
    skip_until_next_node = False

    for line in lines:
        stripped = line.strip()
        if is_fake_node(stripped):
            skip_until_next_node = True
            continue

        if skip_until_next_node:
            if stripped.startswith("[node name=") or stripped.startswith("[sub_resource") or stripped.startswith("[ext_resource"):
                skip_until_next_node = False
            elif stripped == "":
                skip_until_next_node = False
                continue
            else:
                continue

        result.append(line)

    # Clean up multiple consecutive blank lines
    cleaned = []
    prev_blank = False
    for line in result:
        is_blank = line.strip() == ""
        if is_blank and prev_blank:
            continue
        cleaned.append(line)
        prev_blank = is_blank

    new_text = "\n".join(cleaned)
    if new_text != text:
        filepath.write_text(new_text, encoding="utf-8")
        return True
    return False


def main():
    fixed = 0
    for world_dir in sorted(LEVELS_DIR.glob("world_*")):
        for level_file in sorted(world_dir.glob("level_*.tscn")):
            if restore_file(level_file):
                print(f"  Restored {level_file.name}")
                fixed += 1
    bonus_dir = LEVELS_DIR / "bonus"
    if bonus_dir.exists():
        for bonus_file in sorted(bonus_dir.glob("bonus_*.tscn")):
            if bonus_file.name == "bonus_level.tscn":
                continue
            if restore_file(bonus_file):
                print(f"  Restored {bonus_file.name}")
                fixed += 1
    print(f"Done. Restored {fixed} files.")


if __name__ == "__main__":
    main()
