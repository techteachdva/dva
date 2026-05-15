import re, json, sys

with open("scripts/level_generator.gd", "r", encoding="utf-8") as f:
    text = f.read()

start = text.find('const LEVELS: Dictionary = {')
if start == -1:
    print("LEVELS not found")
    sys.exit(1)

# Find matching closing brace
bracket_depth = 0
in_string = False
string_char = None
escape = False
i = start
while i < len(text):
    c = text[i]
    if in_string:
        if escape:
            escape = False
        elif c == '\\':
            escape = True
        elif c == string_char:
            in_string = False
    else:
        if c in ('"', "'"):
            in_string = True
            string_char = c
        elif c == '{':
            bracket_depth += 1
        elif c == '}':
            bracket_depth -= 1
            if bracket_depth == 0:
                break
    i += 1

dict_text = text[start + len('const LEVELS: Dictionary = ') : i + 1]

jt = dict_text
jt = re.sub(r'#.*', '', jt)
jt = jt.replace('true', 'True').replace('false', 'False')
jt = re.sub(r'Vector3\(([^)]+)\)', r'(\1)', jt)

try:
    levels = eval(jt)
except Exception as e:
    print(f"Parse error: {e}")
    sys.exit(1)

fixes = []
for key, level in sorted(levels.items()):
    segments = level.get("segments", [])
    if not segments:
        continue
    current_y = 0.0
    prev_z1 = segments[0].get("z0", 0.0)
    for idx, seg in enumerate(segments):
        z0 = seg.get("z0", 0.0)
        z1 = seg.get("z1", 0.0)
        has_y = "y" in seg
        y = seg.get("y", current_y)
        ramp = seg.get("ramp", 0.0)
        is_jump = seg.get("jump", False)
        gap = abs(z0 - prev_z1)
        y_diff = abs(y - current_y)

        # Fix connected discontinuities: remove explicit y when it doesn't match current_y
        if has_y and gap < 0.5 and y_diff > 0.05:
            fixes.append({
                "level": key,
                "seg": idx,
                "z0": z0,
                "z1": z1,
                "type": "remove_explicit_y",
                "old_y": y,
                "expected_y": round(current_y, 2),
            })
            del seg["y"]
            y = current_y

        # Fix landing platforms after gaps with explicit y=0
        if has_y and gap > 0.5 and y == 0.0 and abs(current_y) > 0.05 and abs(ramp) < 0.01:
            fixes.append({
                "level": key,
                "seg": idx,
                "z0": z0,
                "z1": z1,
                "type": "fix_landing_y0",
                "old_y": 0,
                "expected_y": round(current_y, 2),
            })
            del seg["y"]
            y = current_y

        if abs(ramp) > 0.01:
            current_y = y + ramp
        else:
            current_y = y
        prev_z1 = z1

print(f"Applied {len(fixes)} fixes\n")
from collections import defaultdict
by_level = defaultdict(list)
for f in fixes:
    by_level[f["level"]].append(f)

for lvl in sorted(by_level.keys()):
    print(f"=== {lvl} ({len(by_level[lvl])} fixes) ===")
    for f in by_level[lvl]:
        print(f"  Seg {f['seg']}: z={f['z0']} to {f['z1']} — removed y={f['old_y']}, now uses y={f['expected_y']}")
    print()

# Serialize back to GDScript format using the same fmt function from gen_worlds_1_2.py
def fmt(val, indent=0):
    prefix = "\t" * indent
    if isinstance(val, dict):
        if not val:
            return "{}"
        items = []
        for k, v in val.items():
            items.append(f'{prefix}\t"{k}": {fmt(v, indent+1)}')
        return "{\n" + ",\n".join(items) + f"\n{prefix}}}"
    elif isinstance(val, tuple):
        return "[" + ", ".join(str(v) for v in val) + "]"
    elif isinstance(val, list):
        if not val:
            return "[]"
        items = [fmt(v, indent+1) for v in val]
        if all(not isinstance(v, (dict, list)) for v in val):
            inline = ", ".join(items)
            if len(inline) < 60:
                return f"[{inline}]"
        return "[\n" + ",\n".join(f"{prefix}\t{v}" for v in items) + f"\n{prefix}]"
    elif isinstance(val, bool):
        return "true" if val else "false"
    elif isinstance(val, str):
        return json.dumps(val)
    elif isinstance(val, float):
        if val == int(val):
            return str(int(val))
        return str(val)
    else:
        return str(val)

# Build new LEVELS text
out_lines = []
out_lines.append("\t\t# ═══════════════════════════════════════════════════════════════════════════")
out_lines.append("\t\t# WORLD 1 — Gravity & Motion (green, learn to roll, jump, steer)")
out_lines.append("\t\t# ═══════════════════════════════════════════════════════════════════════════")
for key in ["1-1", "1-2", "1-3", "1-4", "1-5", "1-6"]:
    out_lines.append(f'\t\t"{key}": ' + fmt(levels[key], indent=2) + ",")

out_lines.append("\t\t# ═══════════════════════════════════════════════════════════════════════════")
out_lines.append("\t\t# WORLD 2 — Friction & Ice (blue, ice patches, speed control)")
out_lines.append("\t\t# ═══════════════════════════════════════════════════════════════════════════")
for key in ["2-1", "2-2", "2-3", "2-4", "2-5", "2-6"]:
    out_lines.append(f'\t\t"{key}": ' + fmt(levels[key], indent=2) + ",")

out_lines.append("\t\t# ═══════════════════════════════════════════════════════════════════════════")
out_lines.append("\t\t# WORLD 3 — Variable Gravity (orange/purple, gravity zones)")
out_lines.append("\t\t# ═══════════════════════════════════════════════════════════════════════════")
for key in ["3-1", "3-2", "3-3", "3-4", "3-5", "3-6"]:
    out_lines.append(f'\t\t"{key}": ' + fmt(levels[key], indent=2) + ",")

# Keep all remaining levels (4-1 to 6-6) as-is
remaining = [k for k in sorted(levels.keys()) if not k.startswith(("1-", "2-", "3-"))]
for key in remaining:
    out_lines.append(f'\t\t"{key}": ' + fmt(levels[key], indent=2) + ",")

new_levels_text = "\n".join(out_lines)

# Replace old LEVELS dict with new one
new_text = text[:start] + "const LEVELS: Dictionary = {\n" + new_levels_text + "\n\t}"

with open("scripts/level_generator.gd", "w", encoding="utf-8") as f:
    f.write(new_text)

print("Wrote fixed scripts/level_generator.gd")
