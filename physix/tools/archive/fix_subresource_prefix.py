#!/usr/bin/env python3
"""
Fix sub-resource declarations that were corrupted by the scaling script.
Lines that should be:
  [sub_resource type="BoxMesh"    id="TrackMesh"]   size = Vector3(...)
were reduced to just:
  size = Vector3(...)

This script restores the proper prefix for known sub-resource IDs.
"""

import re
from pathlib import Path

LEVELS_DIR = Path("C:/Users/phili/OneDrive/Desktop/Physix/scenes/levels")

# Known sub-resource IDs that got corrupted
KNOWN_IDS = {
    "TrackMesh": ("BoxMesh", "   "),
    "TrackShape": ("BoxShape3D", "  "),
    "WallMesh": ("BoxMesh", "    "),
    "WallShape": ("BoxShape3D", " "),
}


def fix_file(filepath: Path):
    text = filepath.read_text(encoding="utf-8")
    lines = text.splitlines()
    result = []
    pending_id = None

    for i, line in enumerate(lines):
        stripped = line.strip()

        # If we see a bare size = Vector3 without [sub_resource prefix
        if stripped.startswith("size = Vector3(") and not stripped.startswith("["):
            # Try to infer which sub-resource this belongs to by looking ahead/behind
            # Actually, we can't reliably infer. Better approach: check if this
            # line appears right after ext_resource lines or before other sub_resources.
            # A simpler fix: insert a generic [sub_resource] line before it.
            pass

        result.append(line)

    # Better approach: for each corrupted file, we know the expected structure.
    # Let's just replace the known patterns.
    new_text = text

    # Replace bare size lines that follow ext_resource patterns
    # For level_1_2, level_2_1, level_2_2, the corrupted lines are the first 4 size lines
    # after ext_resources and before the rest of sub_resources.

    # We can't blindly add prefixes without knowing the correct order.
    # Let's use a context-aware approach.

    lines = text.splitlines()
    result = []
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if stripped.startswith("size = Vector3(") and not stripped.startswith("["):
            # This is a corrupted line. Try to find which sub-resource it should be.
            # Check the surrounding context for clues.
            # Also look for a previous line that might have had the [sub_resource prefix
            if i > 0:
                prev = lines[i - 1].strip()
                # Check if previous line is an ext_resource
                if prev.startswith("[ext_resource"):
                    # This size line is likely TrackMesh (first one after ext_resources)
                    result.append(f'[sub_resource type="BoxMesh"    id="TrackMesh"]   {stripped}')
                    i += 1
                    continue

            # Generic fallback: if we see 4 consecutive bare size lines in a known pattern
            if i + 3 < len(lines):
                next_lines = [lines[i+j].strip() for j in range(4)]
                if all(l.startswith("size = Vector3(") for l in next_lines):
                    # This is the 4-line corruption pattern: TrackMesh, TrackShape, WallMesh, WallShape
                    result.append(f'[sub_resource type="BoxMesh"    id="TrackMesh"]   {next_lines[0]}')
                    result.append(f'[sub_resource type="BoxShape3D" id="TrackShape"]  {next_lines[1]}')
                    result.append(f'[sub_resource type="BoxMesh"    id="WallMesh"]    {next_lines[2]}')
                    result.append(f'[sub_resource type="BoxShape3D" id="WallShape"]   {next_lines[3]}')
                    i += 4
                    continue

        result.append(line)
        i += 1

    new_text = "\n".join(result)
    if new_text != text:
        filepath.write_text(new_text, encoding="utf-8")
        return True
    return False


def main():
    targets = [
        "world_1/level_1_2.tscn",
        "world_2/level_2_1.tscn",
        "world_2/level_2_2.tscn",
    ]
    for rel in targets:
        filepath = LEVELS_DIR / rel
        if filepath.exists() and fix_file(filepath):
            print(f"  Fixed {rel}")
        else:
            print(f"  OK or not found: {rel}")


if __name__ == "__main__":
    main()
