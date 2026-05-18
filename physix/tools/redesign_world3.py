import re, json, sys

# Replace World 3 levels in scripts/level_generator.gd with gravity-focused designs

path = "scripts/level_generator.gd"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()

# Parse existing LEVELS dict
start = text.find('const LEVELS: Dictionary = {')
if start == -1:
    print("LEVELS not found")
    sys.exit(1)

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

levels = eval(jt)

# ── World 3 Redesign ─────────────────────────────────────────────────────────

W3 = {}

# 3-1 "Lunar Leaps" — Low gravity tutorial
# Design: Wide start, then low-G zone over a gap. Low-G makes jumps floaty.
# Player learns: low gravity = bigger jumps, slower falls, harder steering in air.
W3["3-1"] = {
    "name": "Lunar Leaps",
    "slope": 10,
    "par_time": 38,
    "segments": [
        {"z0": 0,   "z1": -35,  "w": 11, "x": 0},
        {"z0": -35, "z1": -60,  "w": 10, "x": 0, "ramp": 1.5},
        {"z0": -60, "z1": -80,  "w": 10, "x": 0, "jump": True},
        {"z0": -96, "z1": -126, "w": 9,  "x": 0},
        {"z0": -126, "z1": -151, "w": 9, "x": 0, "ramp": 1.5},
        {"z0": -151, "z1": -171, "w": 9, "x": 0, "jump": True},
        {"z0": -187, "z1": -217, "w": 10, "x": 0},
        {"z0": -217, "z1": -242, "w": 10, "x": 0, "ramp": -1},
        {"z0": -242, "z1": -262, "w": 10, "x": 0},
    ],
    "coins": [
        {"z": -20, "x": 0, "y": 2.2},
        {"z": -48, "x": -3, "y": 3.5},
        {"z": -48, "x": 3, "y": 3.5},
        {"z": -70, "x": 0, "y": 4.5},
        {"z": -111, "x": -2.5, "y": 3.5},
        {"z": -111, "x": 2.5, "y": 3.5},
        {"z": -141, "x": 0, "y": 4.5},
        {"z": -204, "x": -3, "y": 2.5},
        {"z": -204, "x": 3, "y": 2.5},
        {"z": -252, "x": 0, "y": 2.2},
    ],
    "checkpoints": [-90, -170],
    "obstacles": [
        {"kind": "checkpoint", "z": -90, "x": 0},
        {"kind": "checkpoint", "z": -170, "x": 0},
        {"kind": "gravity", "z": -70, "x": 0, "type": 1, "multiplier": 3.5, "length": 22},
        {"kind": "gravity", "z": -141, "x": 0, "type": 1, "multiplier": 3.5, "length": 22},
        {"kind": "speed_boost", "z": -15, "x": 0, "strength": 12},
    ],
    "finish_z": -262,
}

# 3-2 "Heavy Metal" — High gravity
# Design: Steep downhill into high-G zone. High-G keeps ball glued to track at insane speed.
# Narrow corridor in high-G where the extra ground control is essential.
# Player learns: high gravity = faster fall, better ground traction, tiny jumps.
W3["3-2"] = {
    "name": "Heavy Metal",
    "slope": 8,
    "par_time": 42,
    "segments": [
        {"z0": 0,   "z1": -30,  "w": 11, "x": 0},
        {"z0": -30, "z1": -60,  "w": 10, "x": 0, "ramp": -2},
        {"z0": -60, "z1": -90,  "w": 8,  "x": 0, "ramp": -2},
        {"z0": -90, "z1": -115, "w": 6,  "x": 0},
        {"z0": -115, "z1": -140, "w": 6, "x": 0, "ramp": 2},
        {"z0": -140, "z1": -160, "w": 7, "x": 0, "jump": True},
        {"z0": -176, "z1": -206, "w": 8, "x": 0},
        {"z0": -206, "z1": -231, "w": 8, "x": 0, "ramp": -1.5},
        {"z0": -231, "z1": -256, "w": 6, "x": 0},
        {"z0": -256, "z1": -276, "w": 7, "x": 0, "ramp": 1.5},
        {"z0": -276, "z1": -296, "w": 8, "x": 0},
    ],
    "coins": [
        {"z": -20, "x": 0, "y": 2.2},
        {"z": -50, "x": -3, "y": 1.5},
        {"z": -50, "x": 3, "y": 1.5},
        {"z": -75, "x": 0, "y": 1.2},
        {"z": -102, "x": -2, "y": 1.5},
        {"z": -102, "x": 2, "y": 1.5},
        {"z": -128, "x": 0, "y": 2.5},
        {"z": -150, "x": -2.5, "y": 1.8},
        {"z": -150, "x": 2.5, "y": 1.8},
        {"z": -218, "x": 0, "y": 1.5},
        {"z": -243, "x": -2, "y": 1.5},
        {"z": -243, "x": 2, "y": 1.5},
        {"z": -286, "x": 0, "y": 2.2},
    ],
    "checkpoints": [-105, -200],
    "obstacles": [
        {"kind": "checkpoint", "z": -105, "x": 0},
        {"kind": "checkpoint", "z": -200, "x": 0},
        {"kind": "gravity", "z": -60, "x": 0, "type": 0, "multiplier": 3.5, "length": 55},
        {"kind": "gravity", "z": -206, "x": 0, "type": 0, "multiplier": 3.5, "length": 55},
        {"kind": "speed_boost", "z": -10, "x": 0, "strength": 14},
        {"kind": "brake_pad", "z": -145, "x": 0},
    ],
    "finish_z": -296,
}

# 3-3 "Drift Zone" — Zero gravity
# Design: Long zero-G corridor. Enter with speed, drift through. No falling, pure momentum.
# Coins placed along drift path at varying heights.
# Player learns: zero-G = no gravity, pure momentum steering. Slow down = stuck floating.
W3["3-3"] = {
    "name": "Drift Zone",
    "slope": 12,
    "par_time": 48,
    "segments": [
        {"z0": 0,   "z1": -30,  "w": 11, "x": 0},
        {"z0": -30, "z1": -55,  "w": 10, "x": 0, "ramp": -1},
        {"z0": -55, "z1": -75,  "w": 10, "x": 0, "jump": True},
        {"z0": -91, "z1": -121, "w": 10, "x": 0},
        {"z0": -121, "z1": -141, "w": 10, "x": 0, "jump": True},
        {"z0": -157, "z1": -187, "w": 10, "x": 0},
        {"z0": -187, "z1": -207, "w": 10, "x": 0, "jump": True},
        {"z0": -223, "z1": -253, "w": 10, "x": 0},
        {"z0": -253, "z1": -273, "w": 10, "x": 0},
    ],
    "coins": [
        {"z": -20, "x": -3, "y": 2.2},
        {"z": -20, "x": 3, "y": 2.2},
        {"z": -65, "x": 0, "y": 3},
        {"z": -106, "x": -3, "y": 3.5},
        {"z": -106, "x": 3, "y": 3.5},
        {"z": -131, "x": 0, "y": 4},
        {"z": -172, "x": -3, "y": 3.5},
        {"z": -172, "x": 3, "y": 3.5},
        {"z": -197, "x": 0, "y": 3},
        {"z": -238, "x": -3, "y": 2.5},
        {"z": -238, "x": 3, "y": 2.5},
        {"z": -263, "x": 0, "y": 2.2},
    ],
    "checkpoints": [-80, -145, -210],
    "obstacles": [
        {"kind": "checkpoint", "z": -80, "x": 0},
        {"kind": "checkpoint", "z": -145, "x": 0},
        {"kind": "checkpoint", "z": -210, "x": 0},
        {"kind": "gravity", "z": -50, "x": 0, "type": 3, "multiplier": 1, "length": 30},
        {"kind": "gravity", "z": -131, "x": 0, "type": 3, "multiplier": 1, "length": 30},
        {"kind": "gravity", "z": -197, "x": 0, "type": 3, "multiplier": 1, "length": 30},
        {"kind": "speed_boost", "z": -10, "x": 0, "strength": 16},
        {"kind": "bumper", "z": -100, "x": -3.5, "force": 18},
        {"kind": "bumper", "z": -100, "x": 3.5, "force": 18},
        {"kind": "bumper", "z": -165, "x": -3.5, "force": 18},
        {"kind": "bumper", "z": -165, "x": 3.5, "force": 18},
    ],
    "finish_z": -273,
}

# 3-4 "Anti-Gravity" — Reverse gravity ceiling run
# Design: Brief reverse gravity sections where the ball falls UP.
# The track has overhead barriers (represented by high walls) so the ball doesn't escape.
# Player learns: reverse gravity is disorienting but can be controlled.
# Actually, reverse gravity without a ceiling track is just "ball flies away."
# So we make it: reverse gravity zone with bumper pads on the ceiling that keep you in.
# Or better: short reverse-G pulses where you do a big arc, then return to normal.
# Let's go with: reverse-G zone that launches you up, then a high platform you land on,
# then normal gravity resumes and you drop down.
W3["3-4"] = {
    "name": "Anti-Gravity",
    "slope": 10,
    "par_time": 50,
    "segments": [
        {"z0": 0,   "z1": -35,  "w": 11, "x": 0},
        {"z0": -35, "z1": -60,  "w": 10, "x": 0, "ramp": 2},
        {"z0": -60, "z1": -85,  "w": 9,  "x": 0, "ramp": 2.5},
        {"z0": -85, "z1": -105, "w": 8,  "x": 0, "jump": True},
        {"z0": -121, "z1": -146, "w": 8, "x": 0, "ramp": -1.5},
        {"z0": -146, "z1": -171, "w": 8, "x": 0, "ramp": 2},
        {"z0": -171, "z1": -191, "w": 8, "x": 0, "jump": True},
        {"z0": -207, "z1": -232, "w": 9, "x": 0, "ramp": -1},
        {"z0": -232, "z1": -252, "w": 9, "x": 0},
        {"z0": -252, "z1": -272, "w": 9, "x": 0, "ramp": 1.5},
        {"z0": -272, "z1": -292, "w": 9, "x": 0},
    ],
    "coins": [
        {"z": -20, "x": 0, "y": 2.2},
        {"z": -48, "x": -3, "y": 4},
        {"z": -48, "x": 3, "y": 4},
        {"z": -72, "x": 0, "y": 5.5},
        {"z": -95, "x": -2, "y": 6},
        {"z": -95, "x": 2, "y": 6},
        {"z": -134, "x": 0, "y": 3.5},
        {"z": -158, "x": -3, "y": 4.5},
        {"z": -158, "x": 3, "y": 4.5},
        {"z": -181, "x": 0, "y": 5.5},
        {"z": -220, "x": -3, "y": 3},
        {"z": -220, "x": 3, "y": 3},
        {"z": -242, "x": 0, "y": 2.5},
        {"z": -282, "x": 0, "y": 3.5},
    ],
    "checkpoints": [-100, -185],
    "obstacles": [
        {"kind": "checkpoint", "z": -100, "x": 0},
        {"kind": "checkpoint", "z": -185, "x": 0},
        {"kind": "gravity", "z": -72, "x": 0, "type": 2, "multiplier": 1, "length": 36},
        {"kind": "gravity", "z": -158, "x": 0, "type": 2, "multiplier": 1, "length": 36},
        {"kind": "speed_boost", "z": -15, "x": 0, "strength": 14},
        {"kind": "hoop", "z": -95, "x": 0, "y": 7, "boost": 2},
        {"kind": "hoop", "z": -181, "x": 0, "y": 6.5, "boost": 2},
    ],
    "finish_z": -292,
}

# 3-5 "Gravity Gauntlet" — Rapidly alternating gravity types
# Design: Short segments, each with a different gravity zone.
# Low-G jump → High-G narrow → Zero-G drift → Normal rest → repeat
# Player must adapt instantly. Checkpoints after every 2 cycles.
W3["3-5"] = {
    "name": "Gravity Gauntlet",
    "slope": 11,
    "par_time": 55,
    "segments": [
        {"z0": 0,   "z1": -25,  "w": 11, "x": 0},
        {"z0": -25, "z1": -45,  "w": 10, "x": 0, "ramp": 1.5},
        {"z0": -45, "z1": -60,  "w": 9,  "x": 0, "jump": True},
        {"z0": -72, "z1": -92,  "w": 8,  "x": 0},
        {"z0": -92, "z1": -107, "w": 6,  "x": 0, "ramp": -1.5},
        {"z0": -107, "z1": -122, "w": 6, "x": 0},
        {"z0": -134, "z1": -154, "w": 9, "x": 0},
        {"z0": -154, "z1": -169, "w": 9, "x": 0, "jump": True},
        {"z0": -181, "z1": -201, "w": 8, "x": 0},
        {"z0": -201, "z1": -216, "w": 6, "x": 0, "ramp": -1.5},
        {"z0": -216, "z1": -231, "w": 6, "x": 0},
        {"z0": -243, "z1": -263, "w": 9, "x": 0},
        {"z0": -263, "z1": -278, "w": 9, "x": 0, "jump": True},
        {"z0": -290, "z1": -310, "w": 8, "x": 0},
        {"z0": -310, "z1": -325, "w": 8, "x": 0, "ramp": 1.5},
        {"z0": -325, "z1": -340, "w": 8, "x": 0},
    ],
    "coins": [
        {"z": -15, "x": 0, "y": 2.2},
        {"z": -35, "x": -3, "y": 3.5},
        {"z": -35, "x": 3, "y": 3.5},
        {"z": -53, "x": 0, "y": 4},
        {"z": -82, "x": -2, "y": 1.5},
        {"z": -82, "x": 2, "y": 1.5},
        {"z": -98, "x": 0, "y": 1.2},
        {"z": -114, "x": -2.5, "y": 3},
        {"z": -114, "x": 2.5, "y": 3},
        {"z": -144, "x": 0, "y": 3.5},
        {"z": -162, "x": -3, "y": 4},
        {"z": -162, "x": 3, "y": 4},
        {"z": -191, "x": -2, "y": 1.5},
        {"z": -191, "x": 2, "y": 1.5},
        {"z": -208, "x": 0, "y": 1.2},
        {"z": -223, "x": -2.5, "y": 3},
        {"z": -223, "x": 2.5, "y": 3},
        {"z": -253, "x": 0, "y": 3.5},
        {"z": -271, "x": -3, "y": 4},
        {"z": -271, "x": 3, "y": 4},
        {"z": -317, "x": -2.5, "y": 3},
        {"z": -317, "x": 2.5, "y": 3},
        {"z": -332, "x": 0, "y": 2.2},
    ],
    "checkpoints": [-65, -170, -280],
    "obstacles": [
        {"kind": "checkpoint", "z": -65, "x": 0},
        {"kind": "checkpoint", "z": -170, "x": 0},
        {"kind": "checkpoint", "z": -280, "x": 0},
        # Cycle 1: low-G jump
        {"kind": "gravity", "z": -35, "x": 0, "type": 1, "multiplier": 3.5, "length": 20},
        # Cycle 1: high-G narrow
        {"kind": "gravity", "z": -82, "x": 0, "type": 0, "multiplier": 3.5, "length": 20},
        # Cycle 1: zero-G drift
        {"kind": "gravity", "z": -114, "x": 0, "type": 3, "multiplier": 1, "length": 20},
        # Cycle 2: low-G jump
        {"kind": "gravity", "z": -162, "x": 0, "type": 1, "multiplier": 3.5, "length": 20},
        # Cycle 2: high-G narrow
        {"kind": "gravity", "z": -191, "x": 0, "type": 0, "multiplier": 3.5, "length": 20},
        # Cycle 2: zero-G drift
        {"kind": "gravity", "z": -223, "x": 0, "type": 3, "multiplier": 1, "length": 20},
        # Cycle 3: low-G jump
        {"kind": "gravity", "z": -271, "x": 0, "type": 1, "multiplier": 3.5, "length": 20},
        {"kind": "speed_boost", "z": -10, "x": 0, "strength": 12},
        {"kind": "brake_pad", "z": -95, "x": 0},
        {"kind": "brake_pad", "z": -205, "x": 0},
    ],
    "finish_z": -340,
}

# 3-6 "Singularity" — Mastery: all gravity types in an epic finale
# Design: Epic low-G super-jump → high-G speed descent → zero-G drift through bumper field
# → low-G precision climb → high-G narrow canyon → zero-G float to finish
# Multiple checkpoints. Longest and hardest World 3 level.
W3["3-6"] = {
    "name": "Singularity",
    "slope": 10,
    "par_time": 62,
    "segments": [
        {"z0": 0,   "z1": -30,  "w": 11, "x": 0},
        {"z0": -30, "z1": -55,  "w": 10, "x": 0, "ramp": 2},
        {"z0": -55, "z1": -75,  "w": 10, "x": 0, "jump": True},
        {"z0": -91, "z1": -116, "w": 9,  "x": 0, "ramp": 2.5},
        {"z0": -116, "z1": -136, "w": 8, "x": 0, "jump": True},
        {"z0": -152, "z1": -177, "w": 8, "x": 0, "ramp": -2},
        {"z0": -177, "z1": -197, "w": 7, "x": 0},
        {"z0": -197, "z1": -217, "w": 7, "x": 0, "jump": True},
        {"z0": -233, "z1": -258, "w": 8, "x": 0},
        {"z0": -258, "z1": -278, "w": 8, "x": 0, "ramp": 1.5},
        {"z0": -278, "z1": -298, "w": 7, "x": 0, "jump": True},
        {"z0": -314, "z1": -339, "w": 8, "x": 0, "ramp": -1.5},
        {"z0": -339, "z1": -359, "w": 7, "x": 0},
        {"z0": -359, "z1": -374, "w": 7, "x": 0, "ramp": 1.5},
        {"z0": -374, "z1": -394, "w": 8, "x": 0},
    ],
    "coins": [
        {"z": -18, "x": 0, "y": 2.2},
        {"z": -42, "x": -3, "y": 4},
        {"z": -42, "x": 3, "y": 4},
        {"z": -65, "x": 0, "y": 5.5},
        {"z": -103, "x": -3, "y": 5},
        {"z": -103, "x": 3, "y": 5},
        {"z": -126, "x": 0, "y": 6},
        {"z": -165, "x": -2.5, "y": 1.5},
        {"z": -165, "x": 2.5, "y": 1.5},
        {"z": -187, "x": 0, "y": 1.2},
        {"z": -207, "x": -3, "y": 3.5},
        {"z": -207, "x": 3, "y": 3.5},
        {"z": -245, "x": 0, "y": 3},
        {"z": -268, "x": -3, "y": 4},
        {"z": -268, "x": 3, "y": 4},
        {"z": -288, "x": 0, "y": 5},
        {"z": -326, "x": -2.5, "y": 2.5},
        {"z": -326, "x": 2.5, "y": 2.5},
        {"z": -349, "x": 0, "y": 2.2},
        {"z": -384, "x": 0, "y": 2.5},
    ],
    "checkpoints": [-80, -155, -230, -305],
    "obstacles": [
        {"kind": "checkpoint", "z": -80, "x": 0},
        {"kind": "checkpoint", "z": -155, "x": 0},
        {"kind": "checkpoint", "z": -230, "x": 0},
        {"kind": "checkpoint", "z": -305, "x": 0},
        # Phase 1: low-G super jump
        {"kind": "gravity", "z": -42, "x": 0, "type": 1, "multiplier": 3.5, "length": 36},
        # Phase 2: high-G speed descent
        {"kind": "gravity", "z": -116, "x": 0, "type": 0, "multiplier": 3.5, "length": 40},
        # Phase 3: zero-G drift through bumper field
        {"kind": "gravity", "z": -165, "x": 0, "type": 3, "multiplier": 1, "length": 45},
        {"kind": "bumper", "z": -175, "x": -3, "force": 16},
        {"kind": "bumper", "z": -175, "x": 3, "force": 16},
        {"kind": "bumper", "z": -190, "x": 0, "force": 16},
        # Phase 4: low-G precision climb
        {"kind": "gravity", "z": -245, "x": 0, "type": 1, "multiplier": 3.5, "length": 36},
        # Phase 5: high-G narrow canyon
        {"kind": "gravity", "z": -326, "x": 0, "type": 0, "multiplier": 3.5, "length": 35},
        {"kind": "speed_boost", "z": -15, "x": 0, "strength": 16},
        {"kind": "brake_pad", "z": -130, "x": 0},
        {"kind": "brake_pad", "z": -340, "x": 0},
    ],
    "finish_z": -394,
}

# Replace World 3 levels
for key in ["3-1", "3-2", "3-3", "3-4", "3-5", "3-6"]:
    levels[key] = W3[key]

# ── Serialize back ───────────────────────────────────────────────────────────

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

remaining = [k for k in sorted(levels.keys()) if not k.startswith(("1-", "2-", "3-"))]
for key in remaining:
    out_lines.append(f'\t\t"{key}": ' + fmt(levels[key], indent=2) + ",")

new_levels_text = "\n".join(out_lines)

new_text = text[:start] + "const LEVELS: Dictionary = {\n" + new_levels_text + "\n\t}"

with open(path, "w", encoding="utf-8") as f:
    f.write(new_text)

print("Wrote redesigned World 3 levels to scripts/level_generator.gd")

# Validate
from collections import defaultdict
issues = []
for key, level in sorted(levels.items()):
    if not key.startswith("3-"):
        continue
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
        gap = abs(z0 - prev_z1)
        y_diff = abs(y - current_y)
        if has_y and gap < 0.5 and y_diff > 0.05:
            issues.append({"level": key, "seg": idx, "type": "remove_explicit_y", "old_y": y, "expected_y": round(current_y, 2)})
            del seg["y"]
            y = current_y
        if has_y and gap > 0.5 and y == 0.0 and abs(current_y) > 0.05 and abs(ramp) < 0.01:
            issues.append({"level": key, "seg": idx, "type": "fix_landing_y0", "old_y": 0, "expected_y": round(current_y, 2)})
            del seg["y"]
            y = current_y
        if abs(ramp) > 0.01:
            current_y = y + ramp
        else:
            current_y = y
        prev_z1 = z1

if issues:
    print(f"\nApplied {len(issues)} auto-fixes:")
    for f in issues:
        print(f"  {f['level']} seg {f['seg']}: {f['type']} y={f['old_y']} -> {f['expected_y']}")
else:
    print("\nValidation: 0 geometry issues")
