#!/usr/bin/env python3
"""
Remove inline duplicate nodes that were incorrectly added by an earlier script.
If a node name exists both as:
  [node name="X" type="..." parent="."]       (inline)
and:
  [node name="X" parent="." instance=...]    (packed scene)
This script removes the inline version and all its children.
"""

import re
from pathlib import Path

LEVELS_DIR = Path("C:/Users/phili\OneDrive\Desktop\Physix\scenes\levels")


def extract_name(line: str) -> str:
    m = re.search(r'\[node name="([^"]+)"', line)
    if m:
        return m.group(1)
    return ""


def extract_parent(line: str) -> str:
    m = re.search(r'\[node name="[^"]+"[^\]]*parent="([^"]+)"', line)
    if m:
        return m.group(1)
    return ""


def get_parent_path(full_parent: str, child_name: str) -> str:
    if full_parent == ".":
        return child_name
    return f"{full_parent}/{child_name}"


def remove_inline_duplicate(filepath: Path):
    text = filepath.read_text(encoding="utf-8")
    lines = text.splitlines()

    # Pass 1: find all node declarations and build
    declared = {}  # full path -> line
    for i, line in enumerate(lines):
        if line.strip().startswith("[node "):
            name = extract_name(line)
            parent = extract_parent(line)
            if name and parent:
                path = get_parent_path(parent, name)
                declared[path] = i

    # Pass 2: find inline vs instance duplicates
    duplicate_names = set()
    inline_paths = {}  # name -> line index
    instance_paths = {}

    for i, line in enumerate(lines):
        if line.strip().startswith("[node "):
            name = extract_name(line)
            parent = extract_parent(line)
            path = get_parent_path(parent, name)

            if "instance=" in line and "type=" not in line:
                instance_paths[name] = i
            elif "type=" in line:
                inline_paths[name] = i

    for name in inline_paths:
        if name in instance_paths:
            # This is a duplicate! Remove inline version and all children
            duplicate_names.add(name)

    if not duplicate_names:
        return False

    # Find all lines to remove (inline root + all children)
    to_remove = set()
    for name in duplicate_names:
        inline_line = inline_paths[name]
        to_remove.add(inline_line)

        # Find all children of this inline node
        target_parent = f"{name}"  # relative to root
        for i, line in enumerate(lines):
            if i in to_remove:
                continue
            if line.strip().startswith("[node "):
                parent = extract_parent(line)
                # Direct child of target_parent, or deeper
                if parent.startswith(target_parent + "/") or parent == target_parent:
                    # Wait, children of the inline version could share the same name with children of the instance
                    # We only remove children that are actually under the inline version
                    # But all children under target_parent were originally under the inline version
                    to_remove.add(i)

    # Also remove property lines that follow removed node declarations
    final_to_remove = set()
    for idx in sorted(to_remove):
        if idx >= len(lines):
            continue
        final_to_remove.add(idx)
        # remove following blank lines and property lines until next node
        j = idx + 1
        while j < len(lines):
            stripped = lines[j].strip()
            if stripped == "":
                final_to_remove.add(j)
                j += 1
            elif stripped.startswith("["):
                break
            else:
                final_to_remove.add(j)
                j += 1

    new_lines = [lines[i] for i in range(len(lines)) if i not in final_to_remove]

    # clean multiple blank lines
    cleaned = []
    prev_blank = False
    for line in new_lines:
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
            if remove_inline_duplicate(level_file):
                print(f"  Restored {level_file.name}")
                fixed += 1
    print(f"Done. Restored {fixed} files.")


if __name__ == "__main__":
    main()
