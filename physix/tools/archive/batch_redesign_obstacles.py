#!/usr/bin/env python3
"""
Redesign obstacle placement into recurring patterns across all levels.
Removes existing obstacles and places new ones in recognizable formations.
"""
import re, pathlib, math, random

BASE = pathlib.Path("C:/Users/phili/OneDrive/Desktop/Physix/scenes/levels")

# ── Pattern definitions ───────────────────────────────────────────────────────

def snake_bumpers(z_start, z_end, count, hw, force=20):
    """Alternating left/right bumpers forcing weave."""
    nodes = []
    spacing = (z_end - z_start) / max(count - 1, 1)
    for i in range(count):
        z = z_start + spacing * i
        side = -1 if i % 2 == 0 else 1
        x = side * (hw * 0.55)
        nodes.append(("bumper", x, 1.2, z, {"bump_force": force}))
    return nodes

def gauntlet_bumpers(z_start, z_end, count, hw, force=22):
    """Rapid-fire bumper sequence with tiny gaps."""
    nodes = []
    spacing = (z_end - z_start) / max(count - 1, 1)
    for i in range(count):
        z = z_start + spacing * i
        x = random.choice([-hw * 0.35, hw * 0.35, 0.0])
        nodes.append(("bumper", x, 1.2, z, {"bump_force": force}))
    return nodes

def wind_tunnel(z, hw, force=18, length=10):
    """Wind zones on both sides creating narrow safe corridor."""
    nodes = []
    nodes.append(("wind", -hw * 0.45, 1.5, z, {"wind_force": force, "wind_dir": "right", "gust": True}))
    nodes.append(("wind", hw * 0.45, 1.5, z + length * 0.3, {"wind_force": force, "wind_dir": "left", "gust": True}))
    return nodes

def slalom_ice_bumpers(z_start, z_end, count, hw):
    """Ice patches between alternating bumpers."""
    nodes = []
    spacing = (z_end - z_start) / max(count - 1, 1)
    for i in range(count):
        z = z_start + spacing * i
        side = -1 if i % 2 == 0 else 1
        x = side * (hw * 0.5)
        nodes.append(("bumper", x, 1.2, z, {"bump_force": 18}))
        if i < count - 1:
            nodes.append(("ice", 0.0, 0.02, z + spacing * 0.5, {}))
    return nodes

def bumper_wall(z, hw, count=3, force=22):
    """Row of bumpers blocking path with small gaps."""
    nodes = []
    if count == 1:
        nodes.append(("bumper", 0.0, 1.2, z, {"bump_force": force}))
    else:
        step = (hw * 1.4) / (count - 1)
        for i in range(count):
            x = -hw * 0.7 + step * i
            nodes.append(("bumper", x, 1.2, z, {"bump_force": force}))
    return nodes

def gravity_field(z, hw, gtype="reduce"):
    """Gravity zone spanning track width."""
    zone_types = {"boost": 0, "reduce": 1, "reverse": 2, "zero": 3}
    t = zone_types.get(gtype, 1)
    return [("gravity", 0.0, 1.75, z, {"zone_type": t})]

def wind_corridor(z, hw, force=16, dir="right"):
    """Single long wind zone pushing across track."""
    x = -hw * 0.3 if dir == "right" else hw * 0.3
    return [("wind", x, 1.5, z, {"wind_force": force, "wind_dir": dir, "gust": True})]

def boost_then_bumper(z, hw, boost_str=22, bump_force=24):
    """Speed boost followed immediately by bumper — requires quick reaction."""
    return [
        ("boost", 0.0, 0.25, z, {"boost_strength": boost_str}),
        ("bumper", 0.0, 1.2, z - 15, {"bump_force": bump_force}),
    ]

def brake_check(z, hw):
    """Brake pad in the middle of the track."""
    return [("brake", 0.0, 0.25, z, {})]

# ── Level pattern assignments ────────────────────────────────────────────────

def get_patterns(world, level, track_len, hw):
    """Return list of (pattern_name, kwargs) for each level."""
    # Track starts at z=0 and goes to z=-track_len (finish at ~-track_len + 10)
    z0 = -30
    z1 = -track_len * 0.25
    z2 = -track_len * 0.5
    z3 = -track_len * 0.75
    z4 = -track_len + 20

    patterns = []

    if world == 1:
        if level == 1:
            patterns = []  # Tutorial: no obstacles
        elif level == 2:
            patterns = [("bumper_wall", {"z": z1, "hw": hw, "count": 2, "force": 16})]
        elif level == 3:
            patterns = [("wind_corridor", {"z": z1, "hw": hw, "force": 12, "dir": "right"})]
        elif level == 4:
            patterns = [
                ("bumper_wall", {"z": z1, "hw": hw, "count": 2, "force": 16}),
                ("wind_corridor", {"z": z2, "hw": hw, "force": 14, "dir": "left"}),
                ("boost_then_bumper", {"z": z3, "hw": hw}),
            ]

    elif world == 2:
        if level == 1:
            patterns = [
                ("ice", {"z": z0 - 20, "hw": hw}),
                ("bumper_wall", {"z": z1, "hw": hw, "count": 2}),
                ("ice", {"z": z2, "hw": hw}),
            ]
        elif level == 2:
            patterns = [
                ("slalom_ice_bumpers", {"z_start": z0 - 30, "z_end": z2, "count": 4, "hw": hw}),
                ("brake_check", {"z": z3, "hw": hw}),
            ]
        elif level == 3:
            patterns = [
                ("bumper_wall", {"z": z1, "hw": hw, "count": 3}),
                ("ice", {"z": z1 - 25, "hw": hw}),
                ("bumper_wall", {"z": z2, "hw": hw, "count": 3}),
                ("ice", {"z": z2 - 25, "hw": hw}),
                ("wind_corridor", {"z": z3, "hw": hw, "force": 18}),
            ]
        elif level == 4:
            patterns = [
                ("boost_then_bumper", {"z": z0 - 30, "hw": hw}),
                ("brake_check", {"z": z1, "hw": hw}),
                ("boost_then_bumper", {"z": z2, "hw": hw}),
                ("brake_check", {"z": z3, "hw": hw}),
            ]

    elif world == 3:
        if level == 1:
            patterns = [
                ("gravity_field", {"z": z1, "hw": hw, "gtype": "reduce"}),
                ("bumper_wall", {"z": z1 - 15, "hw": hw, "count": 2}),
                ("gravity_field", {"z": z2, "hw": hw, "gtype": "boost"}),
            ]
        elif level == 2:
            patterns = [
                ("gravity_field", {"z": z0 - 20, "hw": hw, "gtype": "zero"}),
                ("bumper_wall", {"z": z1, "hw": hw, "count": 3}),
                ("gravity_field", {"z": z2, "hw": hw, "gtype": "reverse"}),
            ]
        elif level == 3:
            patterns = [
                ("gravity_field", {"z": z0 - 20, "hw": hw, "gtype": "boost"}),
                ("wind_corridor", {"z": z1, "hw": hw, "force": 20}),
                ("gravity_field", {"z": z2, "hw": hw, "gtype": "reduce"}),
                ("bumper_wall", {"z": z3, "hw": hw, "count": 3}),
            ]
        elif level == 4:
            patterns = [
                ("snake_bumpers", {"z_start": z0 - 30, "z_end": z2, "count": 5, "hw": hw}),
                ("gravity_field", {"z": z3, "hw": hw, "gtype": "zero"}),
                ("gauntlet_bumpers", {"z_start": z3 - 30, "z_end": z4, "count": 4, "hw": hw}),
            ]

    elif world == 4:
        if level == 1:
            patterns = [
                ("snake_bumpers", {"z_start": z0 - 30, "z_end": z2, "count": 5, "hw": hw}),
                ("wind_tunnel", {"z": z3, "hw": hw}),
            ]
        elif level == 2:
            patterns = [
                ("gauntlet_bumpers", {"z_start": z0 - 30, "z_end": z1, "count": 5, "hw": hw}),
                ("wind_tunnel", {"z": z2, "hw": hw}),
                ("gauntlet_bumpers", {"z_start": z2 - 40, "z_end": z4, "count": 5, "hw": hw}),
            ]
        elif level == 3:
            patterns = [
                ("bumper_wall", {"z": z1, "hw": hw, "count": 3, "force": 24}),
                ("wind_tunnel", {"z": z1 - 25, "hw": hw}),
                ("bumper_wall", {"z": z2, "hw": hw, "count": 4, "force": 24}),
                ("wind_tunnel", {"z": z2 - 25, "hw": hw}),
                ("bumper_wall", {"z": z3, "hw": hw, "count": 3, "force": 24}),
            ]
        elif level == 4:
            patterns = [
                ("gauntlet_bumpers", {"z_start": z0 - 30, "z_end": z1, "count": 6, "hw": hw}),
                ("gauntlet_bumpers", {"z_start": z2, "z_end": z3, "count": 6, "hw": hw}),
                ("wind_tunnel", {"z": z3 - 30, "hw": hw}),
                ("bumper_wall", {"z": z4, "hw": hw, "count": 4, "force": 26}),
            ]

    elif world == 5:
        if level == 1:
            patterns = [
                ("wind_corridor", {"z": z0 - 20, "hw": hw, "force": 20}),
                ("gravity_field", {"z": z1, "hw": hw, "gtype": "reverse"}),
                ("snake_bumpers", {"z_start": z1 - 30, "z_end": z3, "count": 5, "hw": hw}),
                ("boost_then_bumper", {"z": z4, "hw": hw}),
            ]
        elif level == 2:
            patterns = [
                ("boost_then_bumper", {"z": z0 - 30, "hw": hw}),
                ("wind_tunnel", {"z": z1, "hw": hw}),
                ("gravity_field", {"z": z2, "hw": hw, "gtype": "zero"}),
                ("gauntlet_bumpers", {"z_start": z2 - 30, "z_end": z4, "count": 6, "hw": hw}),
            ]
        elif level == 3:
            patterns = [
                ("wind_tunnel", {"z": z0 - 20, "hw": hw}),
                ("gravity_field", {"z": z1, "hw": hw, "gtype": "boost"}),
                ("gauntlet_bumpers", {"z_start": z1 - 30, "z_end": z2, "count": 5, "hw": hw}),
                ("wind_tunnel", {"z": z2 - 20, "hw": hw}),
                ("bumper_wall", {"z": z3, "hw": hw, "count": 4, "force": 28}),
                ("gravity_field", {"z": z4, "hw": hw, "gtype": "reverse"}),
            ]

    return patterns


def generate_obstacles(world, level, track_len, hw):
    """Generate flat list of obstacle nodes from patterns."""
    patterns = get_patterns(world, level, track_len, hw)
    nodes = []
    for name, kwargs in patterns:
        if name == "snake_bumpers":
            nodes.extend(snake_bumpers(**kwargs))
        elif name == "gauntlet_bumpers":
            nodes.extend(gauntlet_bumpers(**kwargs))
        elif name == "wind_tunnel":
            nodes.extend(wind_tunnel(**kwargs))
        elif name == "slalom_ice_bumpers":
            nodes.extend(slalom_ice_bumpers(**kwargs))
        elif name == "bumper_wall":
            nodes.extend(bumper_wall(**kwargs))
        elif name == "gravity_field":
            nodes.extend(gravity_field(**kwargs))
        elif name == "wind_corridor":
            nodes.extend(wind_corridor(**kwargs))
        elif name == "boost_then_bumper":
            nodes.extend(boost_then_bumper(**kwargs))
        elif name == "brake_check":
            nodes.extend(brake_check(**kwargs))
        elif name == "ice":
            z = kwargs["z"]
            nodes.append(("ice", 0.0, 0.02, z, {}))
    return nodes


def get_track_info(text: str) -> tuple[float, float]:
    """Extract (total_length, half_width) by summing all track segment sizes."""
    total_length = 0.0
    width = 8.0
    # Sum all track-related sub-resource sizes
    for m in re.finditer(r'(TrackMesh|TrackShape|SegA|SegB|Seg\d+|FloorMesh|FloorShape)[^\n]*size\s*=\s*Vector3\(([-+]?\d+\.?\d*),\s*([-+]?\d+\.?\d*),\s*([-+]?\d+\.?\d*)\)', text):
        w = float(m.group(2))
        z = float(m.group(4))
        if z > 10.0:
            total_length += z
            width = w
    if total_length > 0:
        return total_length, width / 2.0
    # Fallback
    return 300.0, 4.0


def remove_obstacle_nodes(lines: list[str]) -> list[str]:
    """Remove obstacle instance and inline nodes."""
    out = []
    skip_until_next_node = False
    i = 0
    while i < len(lines):
        line = lines[i]
        # Detect obstacle node starts
        is_obstacle = False
        if '[node name=' in line:
            if 'parent="."' in line or 'parent="TrackRoot"' in line:
                if any(x in line for x in ['Bumper', 'Wind', 'Boost', 'Brake', 'Gravity', 'Ice']):
                    if 'type="Area3D"' in line or 'type="StaticBody3D"' in line or 'instance=ExtResource' in line:
                        is_obstacle = True

        if is_obstacle:
            skip_until_next_node = True
            i += 1
            continue

        if skip_until_next_node:
            if line.strip().startswith('[') and '[node name=' in line:
                skip_until_next_node = False
                out.append(line)
            elif line.strip().startswith(';'):
                skip_until_next_node = False
                out.append(line)
            # else skip
            i += 1
            continue

        out.append(line)
        i += 1
    return out


OBSTACLE_SCENES = {
    "bumper": "res://scenes/obstacles/bumper.tscn",
    "wind": "res://scenes/obstacles/wind_zone.tscn",
    "boost": "res://scenes/obstacles/speed_boost.tscn",
    "brake": "res://scenes/obstacles/brake_pad.tscn",
    "gravity": "res://scenes/obstacles/gravity_zone.tscn",
    "ice": "res://scenes/obstacles/ice_patch.tscn",
}


def build_obstacle_nodes(obstacles: list, ext_ids: dict) -> list[str]:
    """Build .tscn node lines for obstacles."""
    lines = []
    idx = 1
    for otype, x, y, z, props in obstacles:
        name = f"{otype.capitalize()}{idx}"
        res_path = OBSTACLE_SCENES[otype]
        # Find or assign ext_resource id
        res_id = None
        for eid, path in ext_ids.items():
            if path == res_path:
                res_id = eid
                break
        if res_id is None:
            # Assign next available number
            used_nums = set()
            for eid in ext_ids:
                m = re.match(r'(\d+)', eid)
                if m:
                    used_nums.add(int(m.group(1)))
            next_num = max(used_nums, default=0) + 1
            res_id = f"{next_num}"
            ext_ids[res_id] = res_path

        lines.append(f'[node name="{name}" parent="." instance=ExtResource("{res_id}")]')
        tf = f"transform = Transform3D(1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, {round(x, 2)}, {round(y, 2)}, {round(z, 2)})"
        lines.append(tf)

        # Add property overrides
        if otype == "bumper" and "bump_force" in props:
            lines.append(f"bump_force = {props['bump_force']}")
        if otype == "wind":
            if "wind_force" in props:
                lines.append(f"wind_force = {props['wind_force']}")
            if "wind_dir" in props:
                if props["wind_dir"] == "right":
                    lines.append('wind_direction = Vector3(1.0, 0.0, 0.0)')
                else:
                    lines.append('wind_direction = Vector3(-1.0, 0.0, 0.0)')
            if props.get("gust"):
                lines.append("gust_enabled = true")
        if otype == "boost" and "boost_strength" in props:
            lines.append(f"boost_strength = {props['boost_strength']}")
        if otype == "gravity" and "zone_type" in props:
            lines.append(f"zone_type = {props['zone_type']}")

        lines.append("")
        idx += 1
    return lines


def process_level(path: pathlib.Path, world: int, level: int) -> None:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()

    track_len, hw = get_track_info(text)
    print(f"  {path.name}: track={track_len:.0f}m, hw={hw:.1f}")

    # Parse existing ext_resources
    ext_ids = {}
    for line in lines:
        m = re.match(r'\[ext_resource type="\w+" path="([^"]+)" id="(\w+)"\]', line)
        if m:
            ext_ids[m.group(2)] = m.group(1)

    # Remove obstacle nodes
    lines = remove_obstacle_nodes(lines)

    # Generate new obstacles
    obstacles = generate_obstacles(world, level, track_len, hw)
    if not obstacles:
        print(f"    No obstacles for W{world}L{level}")
        path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        return

    # Build new obstacle node lines
    obs_lines = build_obstacle_nodes(obstacles, ext_ids)

    # Insert ext_resources that are new
    new_exts = []
    for eid, path_res in ext_ids.items():
        found = False
        for line in lines:
            if f'id="{eid}"' in line:
                found = True
                break
        if not found:
            new_exts.append(f'[ext_resource type="PackedScene" path="{path_res}" id="{eid}"]')

    # Find insertion point: after existing ext_resources but before sub_resources
    insert_idx = 0
    for i, line in enumerate(lines):
        if line.strip().startswith("[sub_resource"):
            insert_idx = i
            break

    if new_exts:
        lines = lines[:insert_idx] + new_exts + lines[insert_idx:]

    # Find insertion point for obstacle nodes: before RespawnTimer or HUD
    node_insert_idx = len(lines)
    for i, line in enumerate(lines):
        if '[node name="RespawnTimer"' in line or '[node name="HUD"' in line:
            node_insert_idx = i
            break

    lines = lines[:node_insert_idx] + obs_lines + lines[node_insert_idx:]

    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"    Placed {len(obstacles)} obstacles")


# Process all levels
for world_dir in sorted(BASE.glob("world_*")):
    world = int(world_dir.name.split("_")[1])
    for f in sorted(world_dir.glob("*.tscn")):
        m = re.match(r'level_(\d+)_(\d+)\.tscn', f.name)
        if m:
            w, l = int(m.group(1)), int(m.group(2))
            process_level(f, w, l)

print("Done.")
