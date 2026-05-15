import os
import math

OUT_DIR = "scenes/level_editor"
os.makedirs(OUT_DIR, exist_ok=True)

def make_transform(rot_x=0.0, pos=(0,0,0)):
    """Return Godot Transform3D text for a rotation around X and a translation."""
    cx, sx = math.cos(rot_x), math.sin(rot_x)
    x, y, z = pos
    return f"Transform3D(1, 0, 0, 0, {cx:.4f}, {-sx:.4f}, 0, {sx:.4f}, {cx:.4f}, {x}, {y}, {z})"

def make_seg_tscn(name, length, width=10.0, ramp=0.0, ice=False, y_offset=0.0):
    """Generate a segment .tscn string."""
    rot = math.atan(ramp / length) if abs(ramp) > 0.001 else 0.0
    center_y = y_offset + (ramp * 0.5 if abs(ramp) > 0.001 else 0.0)
    wh = 1.5  # wall height

    res_id_track = f"BoxMesh_{name}T"
    res_id_shape = f"BoxShape3D_{name}T"
    res_id_wmesh = f"BoxMesh_{name}W"
    res_id_wshape = f"BoxShape3D_{name}W"

    lines = [
        "[gd_scene format=3]",
        "",
        f'[node name="{name}" type="StaticBody3D"]',
    ]
    if ice:
        lines.append('physics_material_override = SubResource("PhysicsMaterial_ice")')
    lines.append(f'transform = {make_transform(rot, (0, center_y, 0))}')
    lines.append("")
    lines.append(f'[node name="SegMesh" type="MeshInstance3D" parent="."]')
    lines.append(f'mesh = SubResource("{res_id_track}")')
    mat_type = "ice" if ice else "track"
    lines.append(f'metadata/mat_type = "{mat_type}"')
    lines.append("")
    lines.append(f'[node name="SegShape" type="CollisionShape3D" parent="."]')
    lines.append(f'shape = SubResource("{res_id_shape}")')
    lines.append("")

    for side, suffix in [(-1, "L"), (1, "R")]:
        wx = side * (width * 0.5 + 0.15)
        wy = wh * 0.5 + 0.2
        lines.append(f'[node name="Wall_{suffix}" type="StaticBody3D" parent="."]')
        lines.append(f'transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, {wx}, {wy}, 0)')
        lines.append("")
        lines.append(f'[node name="WallMesh" type="MeshInstance3D" parent="Wall_{suffix}"]')
        lines.append(f'mesh = SubResource("{res_id_wmesh}")')
        lines.append('metadata/mat_type = "wall"')
        lines.append("")
        lines.append(f'[node name="WallShape" type="CollisionShape3D" parent="Wall_{suffix}"]')
        lines.append(f'shape = SubResource("{res_id_wshape}")')
        lines.append("")

    lines.append(f'[sub_resource type="BoxMesh" id="{res_id_track}"]')
    lines.append(f'size = Vector3({width}, 0.4, {length})')
    lines.append("")
    lines.append(f'[sub_resource type="BoxShape3D" id="{res_id_shape}"]')
    lines.append(f'size = Vector3({width}, 0.4, {length})')
    lines.append("")
    lines.append(f'[sub_resource type="BoxMesh" id="{res_id_wmesh}"]')
    lines.append(f'size = Vector3(0.3, {wh}, {length})')
    lines.append("")
    lines.append(f'[sub_resource type="BoxShape3D" id="{res_id_wshape}"]')
    lines.append(f'size = Vector3(0.3, {wh}, {length})')

    if ice:
        lines.append("")
        lines.append('[sub_resource type="PhysicsMaterial" id="PhysicsMaterial_ice"]')
        lines.append('friction = 0.005')
        lines.append('bounce = 0.05')

    return "\n".join(lines)

def make_coin_tscn():
    return """[gd_scene format=3]

[node name="Coin" type="Area3D"]
monitoring = true

[node name="Mesh" type="MeshInstance3D" parent="."]
transform = Transform3D(1, 0, 0, 0, -4.3711e-08, -1, 0, 1, -4.3711e-08, 0, 0, 0)
mesh = SubResource("CylinderMesh_coin")

[node name="Shape" type="CollisionShape3D" parent="."]
shape = SubResource("SphereShape3D_coin")

[sub_resource type="CylinderMesh" id="CylinderMesh_coin"]
top_radius = 0.35
bottom_radius = 0.35
height = 0.08

[sub_resource type="SphereShape3D" id="SphereShape3D_coin"]
radius = 0.6
"""

def make_finish_tscn():
    return """[gd_scene format=3]

[node name="FinishZone" type="Area3D"]

[node name="Shape" type="CollisionShape3D" parent="."]
shape = SubResource("BoxShape3D_finish")

[node name="Mesh" type="MeshInstance3D" parent="."]
mesh = SubResource("BoxMesh_finish")
metadata/mat_type = "finish"

[sub_resource type="BoxShape3D" id="BoxShape3D_finish"]
size = Vector3(12, 4, 10)

[sub_resource type="BoxMesh" id="BoxMesh_finish"]
size = Vector3(12, 4, 0.1)
"""

def make_checkpoint_tscn():
    return """[gd_scene format=3]

[node name="Checkpoint" type="Area3D"]

[node name="Shape" type="CollisionShape3D" parent="."]
shape = SubResource("BoxShape3D_cp")

[node name="Mesh" type="MeshInstance3D" parent="."]
mesh = SubResource("BoxMesh_cp")
metadata/mat_type = "checkpoint"

[sub_resource type="BoxShape3D" id="BoxShape3D_cp"]
size = Vector3(10, 3, 2)

[sub_resource type="BoxMesh" id="BoxMesh_cp"]
size = Vector3(10, 3, 0.2)
"""

def make_speed_boost_tscn():
    return """[gd_scene format=3]

[node name="SpeedBoost" type="Area3D"]

[node name="Shape" type="CollisionShape3D" parent="."]
shape = SubResource("BoxShape3D_boost")

[node name="Mesh" type="MeshInstance3D" parent="."]
mesh = SubResource("BoxMesh_boost")
metadata/mat_type = "boost"

[sub_resource type="BoxShape3D" id="BoxShape3D_boost"]
size = Vector3(6, 0.5, 3)

[sub_resource type="BoxMesh" id="BoxMesh_boost"]
size = Vector3(6, 0.05, 3)
"""

# ── Generate all prefabs ─────────────────────────────────────────────────────

prefabs = {
    "seg_straight_20": make_seg_tscn("Seg_Straight20", 20.0, 10.0),
    "seg_straight_30": make_seg_tscn("Seg_Straight30", 30.0, 10.0),
    "seg_straight_40": make_seg_tscn("Seg_Straight40", 40.0, 10.0),
    "seg_narrow_20":   make_seg_tscn("Seg_Narrow20",   20.0,  6.0),
    "seg_wide_30":     make_seg_tscn("Seg_Wide30",     30.0, 12.0),
    "seg_ramp_up_20":  make_seg_tscn("Seg_RampUp20",   20.0, 10.0, ramp=2.5),
    "seg_ramp_down_20":make_seg_tscn("Seg_RampDown20", 20.0, 10.0, ramp=-2.5),
    "seg_jump_15":     make_seg_tscn("Seg_Jump15",     15.0, 10.0, ramp=2.5),
    "seg_ice_25":      make_seg_tscn("Seg_Ice25",      25.0, 10.0, ice=True),
    "seg_ice_narrow_20":make_seg_tscn("Seg_IceNarrow20",20.0,  6.0, ice=True),
    "seg_ramp_up_narrow_20": make_seg_tscn("Seg_RampUpNarrow20", 20.0, 6.0, ramp=2.5),
    "coin":            make_coin_tscn(),
    "finish_zone":     make_finish_tscn(),
    "checkpoint":      make_checkpoint_tscn(),
    "speed_boost":     make_speed_boost_tscn(),
}

for name, content in prefabs.items():
    path = os.path.join(OUT_DIR, f"{name}.tscn")
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Created {path}")

print(f"\nDone! {len(prefabs)} prefabs in {OUT_DIR}/")
print("Drag any .tscn from the FileSystem dock into a level's TrackRoot.")
