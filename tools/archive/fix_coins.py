import os, re, glob, sys

COINS_PER_LEVEL = 6

def get_trackroot_info(content):
    """Find TrackRoot position."""
    m = re.search(r'\[node name="TrackRoot" type="Node3D" parent="[^"]*"\]\s*\ntransform = Transform3D\(([^)]+)\)', content)
    if m:
        parts = m.group(1).split(',')
        if len(parts) >= 12:
            return float(parts[11].strip())
    return 0.0

def get_finish_info(content):
    """Returns (parent, z) or (None, None) if not found."""
    m = re.search(r'\[node name="FinishZone" type="Area3D" parent="([^"]*)"\]\s*\ntransform = Transform3D\(([^)]+)\)', content)
    if m:
        parent = m.group(1)
        parts = m.group(2).split(',')
        z = float(parts[11].strip()) if len(parts) >= 12 else 0.0
        return parent, z
    return None, None

def get_coins_parent(content):
    m = re.search(r'\[node name="Coins" type="Node3D" parent="([^"]*)"\]', content)
    if m:
        parent = m.group(1)
        if parent == ".":
            return "Coins"
        return parent + "/Coins"
    return "TrackRoot/Coins"

def find_track_end(content, trackroot_z):
    """Find the most negative z extent of the track relative to TrackRoot."""
    # Look for Floor (single track)
    m = re.search(r'\[node name="Floor" type="StaticBody3D" parent="TrackRoot"\]\s*\ntransform = Transform3D\(([^)]+)\)', content)
    if m:
        parts = m.group(1).split(',')
        floor_z = float(parts[11].strip()) if len(parts) >= 12 else 0.0
        mm = re.search(r'\[sub_resource type="BoxMesh".*?id="TrackMesh".*?\]\s*size = Vector3\([^,]+,[^,]+,\s*([0-9.]+)\)', content, re.DOTALL)
        if mm:
            length = float(mm.group(1))
            return floor_z - length / 2.0

    # Look for segments (Seg0, Seg1, ... or SegA, SegB, ...)
    segments = re.findall(r'\[node name="Seg(\w+)" type="StaticBody3D" parent="TrackRoot"\]\s*\ntransform = Transform3D\(([^)]+)\)', content)
    if segments:
        min_end = 0.0
        for idx, tfm in segments:
            parts = tfm.split(',')
            seg_z = float(parts[11].strip()) if len(parts) >= 12 else 0.0
            # Find any MeshInstance3D child of this segment
            mesh_match = re.search(r'\[node name="[^\"]*" type="MeshInstance3D" parent="TrackRoot/Seg' + re.escape(idx) + r'"\]\s*\nmesh = SubResource\("([^"]+)"\)', content)
            if mesh_match:
                mesh_id = mesh_match.group(1)
                size_match = re.search(r'\[sub_resource type="BoxMesh".*?id="' + re.escape(mesh_id) + r'".*?\]\s*size = Vector3\([^,]+,[^,]+,\s*([0-9.]+)\)', content, re.DOTALL)
                if size_match:
                    length = float(size_match.group(1))
                    end_z = seg_z - length / 2.0
                    if end_z < min_end:
                        min_end = end_z
        return min_end

    return -400.0

def ensure_subresources(content):
    coin_mesh_block = '''[sub_resource type="CylinderMesh" id="CoinMesh"]
height = 0.08
top_radius = 0.35
bottom_radius = 0.35

'''
    coin_mat_block = '''[sub_resource type="StandardMaterial3D" id="CoinMat"]
albedo_color = Color(1.0, 0.78, 0.05, 1.0)
metallic = 0.85
roughness = 0.25
emission_enabled = true
emission = Color(1.0, 0.65, 0.0, 1.0)
emission_energy_multiplier = 1.5

'''
    coin_shape_block = '''[sub_resource type="SphereShape3D" id="CoinShape"]
radius = 1.2

'''

    insert_pos = content.find("[node name=")
    if insert_pos == -1:
        insert_pos = len(content)

    if 'id="CoinMesh"' not in content and '[sub_resource type="CylinderMesh" id="CoinMesh"]' not in content:
        content = content[:insert_pos] + coin_mesh_block + content[insert_pos:]
        insert_pos = content.find("[node name=")
    if 'id="CoinMat"' not in content and '[sub_resource type="StandardMaterial3D" id="CoinMat"]' not in content:
        content = content[:insert_pos] + coin_mat_block + content[insert_pos:]
        insert_pos = content.find("[node name=")
    if 'id="CoinShape"' not in content and '[sub_resource type="SphereShape3D" id="CoinShape"]' not in content:
        content = content[:insert_pos] + coin_shape_block + content[insert_pos:]

    return content

def remove_coin_nodes(content):
    lines = content.split('\n')
    result = []
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        if stripped.startswith('[node name="Coin') and 'type="Area3D"' in stripped:
            parent_match = re.search(r'parent="([^"]*)"', stripped)
            if parent_match and 'Coins' in parent_match.group(1):
                coin_path = parent_match.group(1) + '/' + re.search(r'name="([^"]*)"', stripped).group(1)
                i += 1
                while i < len(lines):
                    child_stripped = lines[i].strip()
                    if child_stripped.startswith('[node '):
                        child_parent_match = re.search(r'parent="([^"]*)"', child_stripped)
                        if child_parent_match:
                            cp = child_parent_match.group(1)
                            if cp == coin_path or cp.startswith(coin_path + '/'):
                                i += 1
                                continue
                            else:
                                break
                        else:
                            break
                    else:
                        i += 1
                continue
        result.append(line)
        i += 1
    return '\n'.join(result)

def fix_finish_zone(content, finish_parent, finish_z_rel):
    """Add or update the FinishZone transform."""
    pattern = r'\[node name="FinishZone" type="Area3D" parent="([^"]*)"\]'
    m = re.search(pattern, content)
    if not m:
        print("WARNING: No FinishZone found!")
        return content

    parent = m.group(1)
    start = m.start()
    end = m.end()

    next_lines = content[end:end+300]
    has_transform = False
    for ln in next_lines.split('\n')[:3]:
        if ln.strip().startswith('transform = Transform3D('):
            has_transform = True
            break

    if has_transform:
        transform_start = content.find('transform = Transform3D(', end)
        if transform_start != -1:
            transform_end = content.find(')', transform_start) + 1
            new_transform = 'transform = Transform3D(1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 2.0, %.1f)' % finish_z_rel
            content = content[:transform_start] + new_transform + content[transform_end:]
    else:
        new_transform = 'transform = Transform3D(1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 2.0, %.1f)\n' % finish_z_rel
        content = content[:end] + '\n' + new_transform + content[end:]

    return content

def insert_coins(content, coins_parent, finish_z_rel):
    coins_line = f'[node name="Coins" type="Node3D" parent="{coins_parent.replace("/Coins", "")}"]'
    if coins_parent == "Coins":
        coins_line = '[node name="Coins" type="Node3D" parent="."]'

    idx = content.find(coins_line)
    if idx == -1:
        m = re.search(r'\[node name="Coins" type="Node3D" parent="([^"]*)"\]', content)
        if m:
            idx = content.find(m.group(0))
        if idx == -1:
            print("WARNING: Could not find Coins node")
            return content

    line_end = content.find('\n', idx)
    if line_end == -1:
        line_end = len(content)

    start_z = -20.0
    end_z = finish_z_rel * 0.88
    if end_z > -10:
        end_z = -200.0

    x_positions = [-2.5, 2.5, 0.0, -2.5, 2.5, 0.0]
    y_pos = 1.7

    coin_blocks = []
    for i in range(COINS_PER_LEVEL):
        t = (i + 1) / (COINS_PER_LEVEL + 1)
        z = start_z + (end_z - start_z) * t
        x = x_positions[i]
        coin_name = f"Coin{i+1}"
        coin_path = f"{coins_parent}/{coin_name}"

        block = f'''[node name="{coin_name}" type="Area3D" parent="{coins_parent}"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, {x:.1f}, {y_pos:.1f}, {z:.1f})
monitoring = true
[node name="MeshInstance3D" type="MeshInstance3D" parent="{coin_path}"]
transform = Transform3D(1, 0, 0, 0, -4.37114e-08, -1, 0, 1, -4.37114e-08, 0, 0, 0)
mesh = SubResource("CoinMesh")
surface_material_override/0 = SubResource("CoinMat")
[node name="CollisionShape3D" type="CollisionShape3D" parent="{coin_path}"]
shape = SubResource("CoinShape")
[node name="OmniLight3D" type="OmniLight3D" parent="{coin_path}"]
light_color = Color(1.0, 0.75, 0.1, 1.0)
light_energy = 1.5
omni_range = 3.0
'''
        coin_blocks.append(block)

    insert_text = '\n'.join(coin_blocks)
    new_content = content[:line_end+1] + insert_text + content[line_end+1:]
    return new_content

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    filename = os.path.basename(filepath)
    trackroot_z = get_trackroot_info(content)
    coins_parent = get_coins_parent(content)

    finish_parent, finish_z = get_finish_info(content)

    if finish_parent is not None and finish_z < -10:
        if finish_parent == "TrackRoot":
            finish_rel = finish_z
        elif finish_parent == ".":
            finish_rel = finish_z - trackroot_z
        else:
            finish_rel = finish_z
    else:
        track_end = find_track_end(content, trackroot_z)
        finish_rel = track_end + 20.0
        # Write finish in the coordinate space of its current parent
        if finish_parent == ".":
            finish_z_global = finish_rel + trackroot_z
            content = fix_finish_zone(content, finish_parent or ".", finish_z_global)
        else:
            content = fix_finish_zone(content, finish_parent or "TrackRoot", finish_rel)

    content = ensure_subresources(content)
    content = remove_coin_nodes(content)
    content = insert_coins(content, coins_parent, finish_rel)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"Fixed: {filename} (finish_rel={finish_rel:.1f})")

if __name__ == "__main__":
    files = sorted(glob.glob('scenes/levels/world_*/level_*.tscn'))
    for f in files:
        process_file(f)
    print(f"Done. Processed {len(files)} level files.")
