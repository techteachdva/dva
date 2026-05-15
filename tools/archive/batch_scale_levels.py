#!/usr/bin/env python3
"""
Batch-modify all level .tscn files:
  1. Scale z-length of tracks, walls, finish zones, and all node positions.
  2. Narrow track x-width for World 4 (6.0) and World 5 (5.0).
  3. Scale par_time proportionally.
"""
import os, re, pathlib, sys

BASE = pathlib.Path("C:/Users/phili/OneDrive/Desktop/Physix/scenes/levels")

WORLD_SCALE = {
    "world_1": 3.0,
    "world_2": 3.0,
    "world_3": 4.0,
    "world_4": 4.0,
    "world_5": 5.0,
}

WORLD_WIDTH = {
    "world_1": 8.0,
    "world_2": 8.0,
    "world_3": 8.0,
    "world_4": 6.0,
    "world_5": 5.0,
}


def scale_vector3_z(m: re.Match, scale: float) -> str:
    prefix = m.group(1)
    x = float(m.group(2))
    y = float(m.group(3))
    z = float(m.group(4))
    # Only scale z if it looks like a track/wall/gate length (z > 10)
    if z > 10.0:
        z = round(z * scale, 2)
    return f"{prefix}Vector3({x}, {y}, {z})"


def scale_transform_z(m: re.Match, scale: float) -> str:
    vals = [float(v) for v in m.group(1).split(",")]
    # vals = [m00,m01,m02, m10,m11,m12, m20,m21,m22, tx,ty,tz]
    vals[11] = round(vals[11] * scale, 2)
    # Clean up formatting
    inner = ", ".join(str(v) for v in vals)
    return f"Transform3D({inner})"


def adjust_wall_x(m: re.Match, offset: float) -> str:
    """For left walls: add offset (less negative). For right walls: subtract offset (less positive)."""
    node_name = m.group(1)
    rest = m.group(2)
    # Extract x from Transform3D(..., x, y, z)
    transform_match = re.search(r"transform = Transform3D\(([^)]+)\)", rest)
    if not transform_match:
        return m.group(0)
    vals = [float(v) for v in transform_match.group(1).split(",")]
    tx = vals[9]
    if node_name.startswith("WallL") or node_name == "WallLeft":
        tx += offset
    elif node_name.startswith("WallR") or node_name == "WallRight":
        tx -= offset
    else:
        return m.group(0)
    vals[9] = round(tx, 2)
    new_inner = ", ".join(str(v) for v in vals)
    new_rest = rest[:transform_match.start()] + f"transform = Transform3D({new_inner})" + rest[transform_match.end():]
    return f'[node name="{node_name}"{new_rest}'


def adjust_width_subresources(text: str, new_width: float) -> str:
    # Track and gate meshes/shapes that have width 8.0
    def repl(m):
        prefix = m.group(1)
        x = float(m.group(2))
        y = float(m.group(3))
        z = float(m.group(4))
        if abs(x - 8.0) < 0.01:
            x = new_width
        # Also adjust boost pad width (7.5 → proportional)
        elif abs(x - 7.5) < 0.01:
            x = round(new_width - 0.5, 2)
        return f"{prefix}Vector3({x}, {y}, {z})"
    text = re.sub(r"(size\s*=\s*)Vector3\(([-+]?\d+\.?\d*),\s*([-+]?\d+\.?\d*),\s*([-+]?\d+\.?\d*)\)", repl, text)
    return text


def adjust_finish_shape(text: str, new_width: float) -> str:
    # FinishShape size Vector3(8.0, 4.0, 10.0) → Vector3(new_width, 4.0, 10.0)
    def repl(m):
        prefix = m.group(1)
        x = float(m.group(2))
        y = float(m.group(3))
        z = float(m.group(4))
        if abs(x - 8.0) < 0.01 and abs(y - 4.0) < 0.01:
            x = new_width
        return f"{prefix}Vector3({x}, {y}, {z})"
    text = re.sub(r"(size\s*=\s*)Vector3\(([-+]?\d+\.?\d*),\s*([-+]?\d+\.?\d*),\s*([-+]?\d+\.?\d*)\)", repl, text)
    return text


def process_file(path: pathlib.Path, z_scale: float, new_width: float) -> None:
    text = path.read_text(encoding="utf-8")

    # 1. Scale par_time
    def par_repl(m):
        val = float(m.group(1))
        return f"par_time = {round(val * z_scale, 1)}"
    text = re.sub(r"par_time\s*=\s*([\d.]+)", par_repl, text)

    # 2. Scale Transform3D z translation
    def tf_repl(m):
        return scale_transform_z(m, z_scale)
    text = re.sub(r"Transform3D\(([-+]?\d+\.?\d*(?:,\s*[-+]?\d+\.?\d*){11})\)", tf_repl, text)

    # 3. Scale Vector3 z component for large z values (track/wall lengths)
    def vec_repl(m):
        return scale_vector3_z(m, z_scale)
    text = re.sub(r"(size\s*=\s*)Vector3\(([-+]?\d+\.?\d*),\s*([-+]?\d+\.?\d*),\s*([-+]?\d+\.?\d*)\)", vec_repl, text)

    # 4. Narrow track width for world 4 & 5
    if new_width < 8.0:
        offset = round((8.0 - new_width) / 2.0, 2)
        text = adjust_width_subresources(text, new_width)
        text = adjust_finish_shape(text, new_width)
        # Adjust wall node transforms
        def wall_repl(m):
            return adjust_wall_x(m, offset)
        text = re.sub(r'\[node name="(WallL\d+|WallR\d+|WallLeft|WallRight)"([^\]]*)\]', wall_repl, text)

    path.write_text(text, encoding="utf-8")
    print(f"  Updated {path.name}  (z_scale={z_scale}, width={new_width})")


def main():
    for world_dir, z_scale in WORLD_SCALE.items():
        new_width = WORLD_WIDTH[world_dir]
        folder = BASE / world_dir
        if not folder.exists():
            continue
        tscn_files = sorted(folder.glob("*.tscn"))
        print(f"\n{world_dir}: {len(tscn_files)} files")
        for f in tscn_files:
            process_file(f, z_scale, new_width)
    print("\nDone.")


if __name__ == "__main__":
    main()
