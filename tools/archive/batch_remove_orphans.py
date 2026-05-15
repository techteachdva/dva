#!/usr/bin/env python3
"""Remove orphaned property lines (transform, mesh, shape, etc.) that have no parent node."""
import pathlib, re

BASE = pathlib.Path("C:/Users/phili/OneDrive/Desktop/Physix/scenes/levels")
CHILD_PROPS = [
    "transform = Transform3D",
    "mesh = SubResource",
    "shape = SubResource",
    "light_color = Color",
    "light_energy =",
    "omni_range =",
    "surface_material_override/0 = SubResource",
]

def is_node_line(line: str) -> bool:
    return line.strip().startswith("[node name=")

def is_child_prop(line: str) -> bool:
    return any(line.strip().startswith(p) for p in CHILD_PROPS)

for world_dir in sorted(BASE.glob("world_*")):
    for f in sorted(world_dir.glob("*.tscn")):
        lines = f.read_text(encoding="utf-8").splitlines()
        out = []
        i = 0
        while i < len(lines):
            line = lines[i]
            if is_child_prop(line):
                # Check previous non-empty line
                prev_node = None
                for j in range(len(out) - 1, -1, -1):
                    if out[j].strip():
                        prev_node = out[j]
                        break
                if prev_node and not is_node_line(prev_node):
                    # Orphan! Skip this and subsequent child props until blank or node line
                    while i < len(lines) and (lines[i].strip() == "" or is_child_prop(lines[i])):
                        i += 1
                    continue
            out.append(line)
            i += 1
        f.write_text("\n".join(out) + "\n", encoding="utf-8")

print("Orphan cleanup done.")
