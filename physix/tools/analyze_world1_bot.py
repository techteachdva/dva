import re, json, sys

# Static analysis of World 1 levels against bot controller logic.
# Parses LEVELS dict from scripts/level_generator.gd and predicts bot behavior.

path = "scripts/level_generator.gd"
with open(path, "r", encoding="utf-8") as f:
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
jt = re.sub(r'Vector3\([^)]+\)', 'None', jt)

try:
    levels = eval(jt)
except Exception as e:
    print(f"Parse error: {e}")
    sys.exit(1)

LOOK_AHEAD = 18.0
GAP_DETECT = 8.0
STEER_GAIN = 0.6

def analyze_level(key, level):
    segments = level.get("segments", [])
    if not segments:
        return {"status": "empty"}

    issues = []
    warnings = []

    # Simulate bot traversal
    current_y = 0.0
    prev_z1 = segments[0].get("z0", 0.0)
    seg_centers = []
    seg_lengths = []
    seg_widths = []
    seg_has_gap = []
    seg_gap_to_next = []
    seg_is_ramp = []
    seg_is_jump = []

    for idx, seg in enumerate(segments):
        z0 = seg.get("z0", 0.0)
        z1 = seg.get("z1", 0.0)
        w = seg.get("w", 8.0)
        ramp = seg.get("ramp", 0.0)
        is_jump = seg.get("jump", False)
        length = abs(z1 - z0)
        cz = (z0 + z1) * 0.5

        seg_centers.append(cz)
        seg_lengths.append(length)
        seg_widths.append(w)
        seg_is_ramp.append(abs(ramp) > 0.01)
        seg_is_jump.append(is_jump)

        # Gap detection
        if idx < len(segments) - 1:
            next_z0 = segments[idx + 1].get("z0", z1)
            gap = abs(z0 - prev_z1) if idx == 0 else abs(next_z0 - z1)
            # More accurate: distance between segment ends
            gap_size = abs(next_z0 - z1)
            seg_gap_to_next.append(gap_size)
            seg_has_gap.append(gap_size > 2.0)
        else:
            seg_gap_to_next.append(0.0)
            seg_has_gap.append(False)

        prev_z1 = z1

    # Simulate bot running through level
    pos_z = 0.0
    pos_x = 0.0
    vel = 10.0  # approximate starting speed
    max_speed = 32.0
    dt = 0.1
    t = 0.0
    jump_triggered = False
    jump_z = None
    off_track_risk = False
    narrow_passages = []
    gap_warnings = []

    while pos_z > seg_centers[-1] - seg_lengths[-1] / 2 and t < 120:
        t += dt

        # Find current segment
        current_seg = -1
        for i, cz in enumerate(seg_centers):
            half = seg_lengths[i] / 2
            if pos_z <= cz + half and pos_z >= cz - half:
                current_seg = i
                break

        if current_seg == -1:
            # Between segments
            current_seg = 0
            for i, cz in enumerate(seg_centers):
                if pos_z > cz + seg_lengths[i] / 2:
                    current_seg = i

        # Simulate forward velocity (simplified physics)
        seg = segments[current_seg] if current_seg < len(segments) else segments[-1]
        ramp = seg.get("ramp", 0.0)
        if ramp > 0:
            vel -= ramp * 0.25 * dt  # uphill slows down
        elif ramp < 0:
            vel += abs(ramp) * 0.3 * dt  # downhill speeds up
        else:
            vel *= 0.995  # slight friction on flat

        # Speed ramp from player script
        vel = min(vel + 0.12 * dt, max_speed)

        # Bot steering: target_x = weighted average of visible segments
        target_x = 0.0
        total_weight = 0.0
        for i, cz in enumerate(seg_centers):
            dz = cz - pos_z
            if dz < -LOOK_AHEAD:
                continue
            weight = 1.0 / (abs(dz) + 1.0)
            w = seg_widths[i]
            if w < 7.0:
                weight *= 1.5
            target_x += segments[i].get("x", 0.0) * weight
            total_weight += weight

        if total_weight > 0:
            target_x /= total_weight

        dx = target_x - pos_x
        effective_gain = STEER_GAIN * min(1.0 + abs(dx) * 0.2, 2.5)
        desired_vel_x = max(-8.0, min(8.0, dx * effective_gain))
        steer = max(-1.0, min(1.0, (desired_vel_x - 0.0) * 0.5))
        pos_x += steer * vel * dt * 0.3

        # Track width check
        if current_seg < len(seg_widths):
            half_w = seg_widths[current_seg] * 0.45
            if abs(pos_x) > half_w:
                off_track_risk = True
                issues.append(f"  Off-track risk at z={pos_z:.1f} (seg {current_seg}, width={seg_widths[current_seg]})")

        if seg_widths[current_seg] < 7.0:
            narrow_passages.append((current_seg, pos_z))

        # Jump prediction
        for i, cz in enumerate(seg_centers):
            dz = cz - pos_z
            if dz < -LOOK_AHEAD:
                continue
            if seg_has_gap[i]:
                gap_z = cz - seg_gap_to_next[i] * 0.5
                dist_to_gap = pos_z - gap_z
                if 0 < dist_to_gap < GAP_DETECT and not jump_triggered:
                    jump_triggered = True
                    jump_z = pos_z
                    break

        if jump_triggered and pos_z < jump_z - 2.0:
            jump_triggered = False  # reset after passing gap

        # Advance position
        pos_z -= vel * dt

    # Summary
    result = {
        "status": "analyzed",
        "time_estimate": t,
        "off_track_risk": off_track_risk,
        "narrow_passages": len(narrow_passages),
        "issues": issues,
        "warnings": warnings,
        "segments": len(segments),
    }
    return result

print("=" * 60)
print("WORLD 1 BOT STATIC ANALYSIS")
print("=" * 60)

total_issues = 0
for key in ["1-1", "1-2", "1-3", "1-4", "1-5", "1-6"]:
    level = levels[key]
    result = analyze_level(key, level)
    print(f"\n{key}: {level.get('name', 'Untitled')}")
    print(f"  Segments: {result['segments']} | Est. time: {result['time_estimate']:.1f}s")
    if result['off_track_risk']:
        print(f"  WARN Off-track risk detected")
        total_issues += 1
    if result['narrow_passages'] > 0:
        print(f"  WARN Narrow passages: {result['narrow_passages']}")
    for issue in result['issues'][:3]:
        print(issue)
    if not result['issues'] and not result['off_track_risk']:
        print("  OK No major issues predicted")

print("\n" + "=" * 60)
print(f"SUMMARY: {total_issues} levels with predicted off-track risk")
print("=" * 60)
