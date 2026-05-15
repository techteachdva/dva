import re, pathlib, math

BASE = pathlib.Path("C:/Users/phili/OneDrive/Desktop/Physix/scenes/levels")
WORLD_HW = {1: 4.0, 2: 4.0, 3: 4.0, 4: 3.0, 5: 2.5}

def extract_transform(line):
    m = re.search(r'Transform3D\(([-+]?\d+\.?\d*(?:,\s*[-+]?\d+\.?\d*){11})\)', line)
    if not m:
        return None
    vals = [float(v) for v in m.group(1).split(",")]
    return vals[9], vals[10], vals[11]

def set_transform(line, x, y, z):
    m = re.search(r'(transform\s*=\s*)Transform3D\(([-+]?\d+\.?\d*(?:,\s*[-+]?\d+\.?\d*){11})\)', line)
    if not m:
        return line
    vals = [float(v) for v in m.group(2).split(",")]
    vals[9] = round(x, 2)
    vals[10] = round(y, 2)
    vals[11] = round(z, 2)
    inner = ", ".join(str(v) for v in vals)
    return line[:m.start()] + f"{m.group(1)}Transform3D({inner})" + line[m.end():]

def find_transform(lines, start_i):
    for j in range(start_i, min(start_i + 4, len(lines))):
        pos = extract_transform(lines[j])
        if pos:
            return j, pos
    return None, None

for world_dir in sorted(BASE.glob("world_*")):
    world = int(world_dir.name.split("_")[1])
    hw = WORLD_HW.get(world, 4.0)
    for f in sorted(world_dir.glob("*.tscn")):
        text = f.read_text(encoding="utf-8")
        lines = text.splitlines()
        coins = []
        obstacles = []
        for i, line in enumerate(lines):
            if '[node name="Coin' in line and 'type="Area3D"' in line:
                ti, pos = find_transform(lines, i)
                if pos:
                    coins.append((ti, pos[0], pos[1], pos[2]))
            if ('Bumper' in line or 'Wind' in line or 'Boost' in line) and 'type="Area3D"' in line:
                ti, pos = find_transform(lines, i)
                if pos:
                    obstacles.append((pos[0], pos[1], pos[2]))
        if not coins:
            print(f"No coins: {f.name}")
            continue
        out = list(lines)
        moved = 0
        for coin_idx, cx, cy, cz in coins:
            nearest = None
            nearest_dist = 9999.0
            for ox, oy, oz in obstacles:
                d = math.sqrt((cx - ox) ** 2 + (cz - oz) ** 2)
                if d < nearest_dist:
                    nearest_dist = d
                    nearest = (ox, oy, oz)
            new_x, new_y, new_z = cx, cy, cz
            if nearest and nearest_dist < 30.0:
                ox, oy, oz = nearest
                dx = ox - cx
                dz = oz - cz
                move_dist = min(math.sqrt(dx * dx + dz * dz) * 0.6, 2.5)
                ang = math.atan2(dz, dx)
                new_x = cx + math.cos(ang) * move_dist
                new_z = cz + math.sin(ang) * move_dist
                if new_y < 1.8:
                    new_y = 1.8
            else:
                edge_x = hw * 0.85
                target_x = edge_x if abs(cx - edge_x) < abs(cx + edge_x) else -edge_x
                new_x = cx + (target_x - cx) * 0.5
            new_x = max(-hw + 0.3, min(hw - 0.3, new_x))
            line = out[coin_idx]
            if extract_transform(line):
                out[coin_idx] = set_transform(line, new_x, new_y, new_z)
                moved += 1
            elif coin_idx + 1 < len(out):
                out[coin_idx + 1] = set_transform(out[coin_idx + 1], new_x, new_y, new_z)
                moved += 1
        f.write_text("\n".join(out) + "\n", encoding="utf-8")
        print(f"Moved {moved}/{len(coins)} coins in {f.name}")
print("Done.")
