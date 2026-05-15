import re, json, sys

# Read level_generator.gd
with open("scripts/level_generator.gd", "r", encoding="utf-8") as f:
    text = f.read()

# Extract LEVELS dictionary using regex
# Find the start of LEVELS
start = text.find('const LEVELS: Dictionary = {')
if start == -1:
    print("LEVELS not found")
    sys.exit(1)

# Find the matching closing brace — naive but works for our well-formed dict
# We'll use bracket counting
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

# Convert GDScript dict syntax to JSON for easier parsing
# This is a best-effort conversion
jt = dict_text
# Remove comments
jt = re.sub(r'#.*', '', jt)
# Convert true/false
jt = jt.replace('true', 'True').replace('false', 'False')
# Strip Vector3 calls (in obstacles)
jt = re.sub(r'Vector3\([^)]+\)', 'None', jt)
# Convert GDScript dict to Python eval-compatible
try:
    levels = eval(jt)
except Exception as e:
    print(f"Parse error: {e}")
    # Fallback: just print the problematic area
    print(jt[:500])
    sys.exit(1)

print(f"Found {len(levels)} levels\n")

issues = []
for key, level in sorted(levels.items()):
    segments = level.get("segments", [])
    if not segments:
        continue
    current_y = 0.0
    prev_z1 = segments[0].get("z0", 0.0)
    for idx, seg in enumerate(segments):
        z0 = seg.get("z0", 0.0)
        z1 = seg.get("z1", 0.0)
        y = seg.get("y", current_y)
        ramp = seg.get("ramp", 0.0)

        gap = abs(z0 - prev_z1)
        y_diff = abs(y - current_y)

        # Check for discontinuity on connected segments (no gap or tiny gap)
        if gap < 0.5 and y_diff > 0.05:
            issues.append({
                "level": key,
                "seg": idx,
                "z0": z0,
                "z1": z1,
                "type": "connected_y_discontinuity",
                "expected_y": round(current_y, 2),
                "actual_y": y,
                "diff": round(y_diff, 2),
                "ramp": ramp,
            })

        # Check for suspicious y=0 on landing after gap
        if gap > 1.0 and y == 0.0 and abs(current_y) > 0.05 and abs(ramp) < 0.01:
            issues.append({
                "level": key,
                "seg": idx,
                "z0": z0,
                "z1": z1,
                "type": "suspicious_landing_y0",
                "expected_y": round(current_y, 2),
                "actual_y": y,
                "gap": round(gap, 1),
            })

        # Update current_y
        if abs(ramp) > 0.01:
            current_y = y + ramp
        else:
            current_y = y
        prev_z1 = z1

# Group by level
from collections import defaultdict
by_level = defaultdict(list)
for iss in issues:
    by_level[iss["level"]].append(iss)

for lvl in sorted(by_level.keys()):
    print(f"=== {lvl} ({len(by_level[lvl])} issues) ===")
    for iss in by_level[lvl]:
        if iss["type"] == "connected_y_discontinuity":
            print(f"  Seg {iss['seg']}: z={iss['z0']} to {iss['z1']} — Y step {iss['diff']} (expected {iss['expected_y']}, got {iss['actual_y']}, ramp={iss['ramp']})")
        else:
            print(f"  Seg {iss['seg']}: z={iss['z0']} to {iss['z1']} — Landing y=0 after gap={iss['gap']}, expected y={iss['expected_y']}")
    print()

print(f"\nTotal issues: {len(issues)}")
