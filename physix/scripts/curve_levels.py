import os, re, math

base = "C:/Users/phili/OneDrive/Desktop/Physix/scenes/levels"
skip_levels = {"level_1_1.tscn", "level_1_2.tscn", "level_1_3.tscn", "level_1_4.tscn",
               "bonus_1.tscn", "bonus_2.tscn", "bonus_3.tscn", "bonus_4.tscn", "bonus_5.tscn"}

def winding_x(z, amplitude, freq):
    return amplitude * math.sin(freq * z)

def fix_level(path):
    with open(path, "r", encoding="utf-8") as fh:
        text = fh.read()
    orig = text
    fname = os.path.basename(path)

    m = re.search(r'\[sub_resource type="BoxMesh"\s+id="TrackMesh"\]\s*size = Vector3\(([^)]+)\)', text)
    if m:
        size_parts = [float(x.strip()) for x in m.group(1).split(",")]
        track_width, track_height, track_length = size_parts
        n_segments = max(6, int(track_length / 25))
        seg_len = track_length / n_segments
        half_len = track_length / 2.0
        amplitude = 2.5 + (track_length / 200.0)
        freq = (2.0 * math.pi / track_length) * 1.2

        floor_blocks = []
        wall_left_blocks = []
        wall_right_blocks = []
        for i in range(n_segments):
            z_center = -half_len + (i + 0.5) * seg_len
            x_center = winding_x(z_center, amplitude, freq)
            floor_blocks.append(
                f'[node name="Seg{i}" type="StaticBody3D" parent="TrackRoot"]\n'
                f'transform = Transform3D(1,0,0, 0,1,0, 0,0,1, {x_center:.2f},0,{z_center:.2f})\n'
                f'[node name="SegMesh{i}" type="MeshInstance3D" parent="TrackRoot/Seg{i}"]\n'
                f'mesh = SubResource("TrackMesh")\n'
                f'metadata/mat_type = "track"\n'
                f'[node name="SegShape{i}" type="CollisionShape3D" parent="TrackRoot/Seg{i}"]\n'
                f'shape = SubResource("TrackShape")\n'
            )
            wall_left_blocks.append(
                f'[node name="WallL{i}" type="StaticBody3D" parent="TrackRoot"]\n'
                f'transform = Transform3D(1,0,0, 0,1,0, 0,0,1, {x_center - 4.15:.2f},0.95,{z_center:.2f})\n'
                f'[node name="WallLMesh{i}" type="MeshInstance3D" parent="TrackRoot/WallL{i}"]\n'
                f'mesh = SubResource("WallMesh")\n'
                f'metadata/mat_type = "wall"\n'
                f'[node name="WallLShape{i}" type="CollisionShape3D" parent="TrackRoot/WallL{i}"]\n'
                f'shape = SubResource("WallShape")\n'
            )
            wall_right_blocks.append(
                f'[node name="WallR{i}" type="StaticBody3D" parent="TrackRoot"]\n'
                f'transform = Transform3D(1,0,0, 0,1,0, 0,0,1, {x_center + 4.15:.2f},0.95,{z_center:.2f})\n'
                f'[node name="WallRMesh{i}" type="MeshInstance3D" parent="TrackRoot/WallR{i}"]\n'
                f'mesh = SubResource("WallMesh")\n'
                f'metadata/mat_type = "wall"\n'
                f'[node name="WallRShape{i}" type="CollisionShape3D" parent="TrackRoot/WallR{i}"]\n'
                f'shape = SubResource("WallShape")\n'
            )

        old_floor = (
            r'\[node name="Floor" type="StaticBody3D" parent="TrackRoot"\]\n'
            r'(?:[^\n]*\n)*?'
            r'\[node name="FloorMesh" type="MeshInstance3D" parent="TrackRoot/Floor"\]\n'
            r'(?:[^\n]*\n)*?'
            r'\[node name="FloorShape" type="CollisionShape3D" parent="TrackRoot/Floor"\]\n'
            r'(?:[^\n]*\n)*?'
        )
        text = re.sub(old_floor, '', text)

        old_wall_l = (
            r'\[node name="WallLeft" type="StaticBody3D" parent="TrackRoot"\]\n'
            r'(?:[^\n]*\n)*?'
            r'\[node name="WallLeftMesh" type="MeshInstance3D" parent="TrackRoot/WallLeft"\]\n'
            r'(?:[^\n]*\n)*?'
            r'\[node name="WallLeftShape" type="CollisionShape3D" parent="TrackRoot/WallLeft"\]\n'
            r'(?:[^\n]*\n)*?'
        )
        text = re.sub(old_wall_l, '', text)

        old_wall_r = (
            r'\[node name="WallRight" type="StaticBody3D" parent="TrackRoot"\]\n'
            r'(?:[^\n]*\n)*?'
            r'\[node name="WallRightMesh" type="MeshInstance3D" parent="TrackRoot/WallRight"\]\n'
            r'(?:[^\n]*\n)*?'
            r'\[node name="WallRightShape" type="CollisionShape3D" parent="TrackRoot/WallRight"\]\n'
            r'(?:[^\n]*\n)*?'
        )
        text = re.sub(old_wall_r, '', text)

        insert_marker = 'script = ExtResource("TrackBuilder")\n'
        if insert_marker in text:
            all_blocks = '\n'.join(floor_blocks + wall_left_blocks + wall_right_blocks) + '\n'
            text = text.replace(insert_marker, insert_marker + '\n' + all_blocks)
        else:
            print(f"WARN: no TrackBuilder script marker in {fname}")
            return False

        def adjust_coin(m):
            full = m.group(0)
            tm = re.search(r'transform = Transform3D\(([^)]+)\)', full)
            if not tm:
                return full
            parts = tm.group(1).split(",")
            if len(parts) >= 12:
                x = float(parts[9].strip())
                y = float(parts[10].strip())
                z = float(parts[11].strip())
                track_x = winding_x(z, amplitude, freq)
                new_x = track_x + x
                new_x = max(-3.5, min(3.5, new_x))
                parts[9] = f" {new_x:.2f}"
                new_t = ','.join(parts)
                return full.replace(tm.group(1), new_t)
            return full

        text = re.sub(
            r'\[node name="Coin\d+" type="Area3D" parent="TrackRoot/Coins"\]\n'
            r'(?:[^\n]*\n)*?'
            r'transform = Transform3D\(([^)]+)\)\n',
            adjust_coin,
            text
        )

        if text != orig:
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(text)
            print(f"Curved {fname} ({n_segments} segs, len={track_length})")
            return True
        return False
    else:
        # Multi-segment: offset existing segments
        seg_pattern = r'\[node name="(Seg\w+)" type="StaticBody3D" parent="TrackRoot"\]\n\s*transform = Transform3D\(([^)]+)\)'
        segs = list(re.finditer(seg_pattern, text))
        if not segs:
            print(f"SKIP {fname}: no recognizable segments")
            return False
        zs = []
        for seg in segs:
            parts = seg.group(2).split(",")
            if len(parts) >= 12:
                zs.append(float(parts[11].strip()))
        if not zs:
            print(f"SKIP {fname}: could not parse segment positions")
            return False
        min_z, max_z = min(zs), max(zs)
        total_len = max_z - min_z
        if total_len < 20:
            print(f"SKIP {fname}: track too short")
            return False
        amplitude = 2.0 + (total_len / 250.0)
        freq = (2.0 * math.pi / total_len) * 1.0

        def offset_seg(m):
            full = m.group(0)
            parts = m.group(2).split(",")
            if len(parts) >= 12:
                z = float(parts[11].strip())
                x = float(parts[9].strip()) if len(parts) > 9 else 0.0
                parts[9] = f" {x + winding_x(z, amplitude, freq):.2f}"
                new_t = ','.join(parts)
                return full.replace(m.group(2), new_t)
            return full

        text = re.sub(seg_pattern, offset_seg, text)

        wall_pattern = r'\[node name="Wall\w+" type="StaticBody3D" parent="TrackRoot"\]\n\s*transform = Transform3D\(([^)]+)\)'
        def offset_wall(m):
            full = m.group(0)
            parts = m.group(1).split(",")
            if len(parts) >= 12:
                z = float(parts[11].strip())
                x = float(parts[9].strip()) if len(parts) > 9 else 0.0
                parts[9] = f" {x + winding_x(z, amplitude, freq):.2f}"
                new_t = ','.join(parts)
                return full.replace(m.group(1), new_t)
            return full
        text = re.sub(wall_pattern, offset_wall, text)

        def adjust_coin2(m):
            full = m.group(0)
            tm = re.search(r'transform = Transform3D\(([^)]+)\)', full)
            if not tm:
                return full
            parts = tm.group(1).split(",")
            if len(parts) >= 12:
                z = float(parts[11].strip())
                x = float(parts[9].strip()) if len(parts) > 9 else 0.0
                new_x = winding_x(z, amplitude, freq) + x
                new_x = max(-3.5, min(3.5, new_x))
                parts[9] = f" {new_x:.2f}"
                new_t = ','.join(parts)
                return full.replace(tm.group(1), new_t)
            return full

        text = re.sub(
            r'\[node name="Coin\d+" type="Area3D" parent="TrackRoot/Coins"\]\n'
            r'(?:[^\n]*\n)*?'
            r'transform = Transform3D\(([^)]+)\)\n',
            adjust_coin2,
            text
        )

        if text != orig:
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(text)
            print(f"Winding {fname} ({len(segs)} segs)")
            return True
        return False

for root, dirs, files in os.walk(base):
    for f in sorted(files):
        if not f.endswith(".tscn"):
            continue
        if f in skip_levels or f.startswith("bonus"):
            print(f"SKIP {f}")
            continue
        path = os.path.join(root, f)
        try:
            fix_level(path)
        except Exception as e:
            print(f"ERROR {f}: {e}")
