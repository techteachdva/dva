import json

def seg(z0, z1, w, x=0, y=0, ramp=0, jump=False, ice=False, boost=0):
    d = {"z0": z0, "z1": z1, "w": w, "x": x}
    if y: d["y"] = y
    if ramp: d["ramp"] = ramp
    if jump: d["jump"] = True
    if ice: d["ice"] = True
    if boost: d["boost"] = boost
    return d

def coin(z, x=0, y=2.2):
    return {"z": z, "x": x, "y": y}

def obstacle(kind, z, x=0, **kwargs):
    d = {"kind": kind, "z": z, "x": x}
    d.update(kwargs)
    return d

def level(name, slope, par_time, segments, coins, finish_z, checkpoints=None, obstacles=None):
    d = {
        "name": name,
        "slope": slope,
        "par_time": par_time,
        "segments": segments,
        "coins": coins,
        "finish_z": finish_z,
    }
    if checkpoints:
        d["checkpoints"] = checkpoints
    if obstacles:
        d["obstacles"] = obstacles
    return d


# ═══════════════════════════════════════════════════════════════════════════
# WORLD 3 — Variable Gravity (orange/purple/cyan/yellow gravity zones)
# Core principle: Gravity is a TOOL, not just a hazard.
# Each level teaches one gravity type, then 3-6 synthesizes all four.
# ═══════════════════════════════════════════════════════════════════════════

# 3-1 "Low-G Leap" — Cyan zones. Low gravity makes jumps HUGE.
# Teach: In low-G, you jump 4x higher. Reach high platforms, clear wide gaps.
L3_1 = level(
    "Low-G Leap", 10, 38,
    [
        # Highway start, build speed
        seg(0, -40, 11, x=0, y=0, ramp=-0.5),
        # Gentle uphill into first cyan zone
        seg(-40, -60, 10, x=0, y=0, ramp=1.0),
        # Inside cyan zone: flat segment with a GAP
        # Low-G makes the jump easy and floaty
        seg(-60, -75, 10, x=0, y=0, ramp=0),
        seg(-75, -90, 10, x=0, y=0, ramp=0, jump=True),
        # Landing rest
        seg(-104, -134, 10, x=0, y=0, ramp=0),
        # Second cyan zone: HIGH COINS above track
        # Player must jump inside the zone to reach y=6
        seg(-134, -149, 10, x=0, y=0, ramp=0),
        seg(-149, -164, 9, x=0, y=0, ramp=0),
        # High platform section
        seg(-164, -179, 9, x=0, y=0, ramp=1.5),
        seg(-179, -194, 8, x=0, y=1.5, ramp=1.5),
        # Exit cyan zone, normal gravity resumes
        seg(-194, -214, 10, x=0, y=0, ramp=0),
        # Rest to finish
        seg(-214, -244, 10, x=0, y=0, ramp=-0.5),
        seg(-244, -280, 10, x=0, y=0, ramp=0),
    ],
    [
        coin(-20, x=0, y=2.2),
        coin(-50, x=0, y=3.0),       # before cyan zone
        coin(-82, x=0, y=5.0),       # mid-jump in low-G
        coin(-120, x=0, y=2.2),
        coin(-154, x=0, y=6.0),       # high coin, only reachable in low-G
        coin(-172, x=0, y=7.0),        # even higher
        coin(-260, x=0, y=2.2),
    ],
    -280,
    checkpoints=[-120, -204],
    obstacles=[
        obstacle("checkpoint", z=-120, x=0),
        obstacle("checkpoint", z=-204, x=0),
        # Cyan low-G zone spans the first gap area
        obstacle("gravity", z=-82, x=0, type=1, multiplier=3.5, length=45),
        # Second cyan zone around the high platform
        obstacle("gravity", z=-172, x=0, type=1, multiplier=3.5, length=50),
    ],
)

# 3-2 "Heavy Drop" — Orange zones. Heavy gravity + downhill = EXTREME speed.
# Teach: Heavy-G makes downhills terrifyingly fast. Use that speed for big gaps.
L3_2 = level(
    "Heavy Drop", 11, 32,
    [
        # Highway build speed
        seg(0, -40, 11, x=0, y=0, ramp=-0.5),
        # Enter heavy-G zone before steep drop
        seg(-40, -55, 10, x=0, y=0, ramp=0.5),
        # Inside orange zone: STEEP downhill
        seg(-55, -70, 10, x=0, y=0, ramp=-3.0),
        seg(-70, -85, 10, x=0, y=0, ramp=-3.5),
        # BIG gap at bottom of heavy-G drop
        seg(-85, -100, 10, x=0, y=0, ramp=0, jump=True),
        # Landing rest (wide)
        seg(-116, -146, 11, x=0, y=0, ramp=0),
        # Second cycle: uphill build, then heavy-G drop again
        seg(-146, -166, 9, x=0, y=0, ramp=2.0),
        seg(-166, -181, 9, x=0, y=0, ramp=0.5),
        # Heavy-G zone + steep drop
        seg(-181, -196, 9, x=0, y=0, ramp=-3.0),
        seg(-196, -211, 9, x=0, y=0, ramp=-3.5),
        # Gap
        seg(-211, -226, 9, x=0, y=0, ramp=0, jump=True),
        # Rest to finish
        seg(-242, -272, 10, x=0, y=0, ramp=0),
        seg(-272, -300, 10, x=0, y=0, ramp=-0.5),
    ],
    [
        coin(-20, x=0, y=2.2),
        coin(-50, x=0, y=2.5),       # before heavy-G
        coin(-78, x=0, y=3.0),       # on steep drop
        coin(-93, x=0, y=4.5),       # before gap
        coin(-131, x=0, y=2.2),
        coin(-190, x=0, y=3.0),      # second drop
        coin(-264, x=0, y=2.2),
    ],
    -300,
    checkpoints=[-131, -257],
    obstacles=[
        obstacle("checkpoint", z=-131, x=0),
        obstacle("checkpoint", z=-257, x=0),
        # Orange heavy-G zones on the steep drops
        obstacle("gravity", z=-78, x=0, type=0, multiplier=3.5, length=50),
        obstacle("gravity", z=-204, x=0, type=0, multiplier=3.5, length=50),
    ],
)

# 3-3 "Zero-G Drift" — Yellow zones. No gravity = float across gaps.
# Teach: In zero-G, momentum carries you horizontally. Float across impossible gaps.
L3_3 = level(
    "Zero-G Drift", 10, 35,
    [
        # Highway start, build momentum
        seg(0, -40, 11, x=0, y=0, ramp=-0.5),
        # Downhill to build speed BEFORE entering zero-G
        seg(-40, -55, 10, x=0, y=0, ramp=-2.0),
        seg(-55, -70, 10, x=0, y=0, ramp=-2.5),
        # Enter yellow zone right before a MASSIVE gap
        # Inside zone: the gap itself. Ball floats across.
        seg(-70, -85, 10, x=0, y=0, ramp=0),
        seg(-85, -105, 10, x=0, y=0, ramp=0, jump=True),
        # Landing platform (still in zero-G zone, so player drifts to it)
        seg(-119, -134, 10, x=0, y=0, ramp=0),
        # Exit zone, normal gravity
        seg(-134, -154, 10, x=0, y=0, ramp=0),
        # Rest
        seg(-154, -184, 10, x=0, y=0, ramp=-0.5),
        # Second cycle: another zero-G float, this time with coins in the gap
        seg(-184, -199, 9, x=0, y=0, ramp=-2.0),
        seg(-199, -214, 9, x=0, y=0, ramp=-2.5),
        # Enter zero-G
        seg(-214, -229, 9, x=0, y=0, ramp=0),
        # Wide gap with floating coins in the middle
        seg(-229, -254, 9, x=0, y=0, ramp=0, jump=True),
        # Landing
        seg(-268, -283, 9, x=0, y=0, ramp=0),
        # Exit
        seg(-283, -303, 10, x=0, y=0, ramp=0),
        # Rest to finish
        seg(-303, -340, 10, x=0, y=0, ramp=-0.5),
    ],
    [
        coin(-20, x=0, y=2.2),
        coin(-48, x=0, y=2.5),       # before downhill
        coin(-95, x=0, y=3.0),       # floating in first zero-G gap
        coin(-109, x=0, y=4.0),      # floating higher
        coin(-174, x=0, y=2.2),
        coin(-242, x=0, y=3.5),      # floating in second gap
        coin(-256, x=0, y=2.5),      # floating lower
        coin(-322, x=0, y=2.2),
    ],
    -340,
    checkpoints=[-144, -276],
    obstacles=[
        obstacle("checkpoint", z=-144, x=0),
        obstacle("checkpoint", z=-276, x=0),
        # Yellow zero-G zones spanning the gaps
        obstacle("gravity", z=-95, x=0, type=3, multiplier=0.0, length=60),
        obstacle("gravity", z=-242, x=0, type=3, multiplier=0.0, length=70),
    ],
)

# 3-4 "Ceiling Walk" — Purple zones. Reverse gravity = fall UP.
# Teach: In reverse-G, you "fall" upward. The track above catches you.
# The ball enters the zone, gravity flips, and it lands on a higher track segment.
L3_4 = level(
    "Ceiling Walk", 11, 40,
    [
        # Flat start
        seg(0, -40, 11, x=0, y=0, ramp=0),
        # Enter purple reverse-G zone
        # The next segment is at y=+3 — the ball falls UP to it
        seg(-40, -55, 10, x=0, y=0, ramp=0),
        # Higher track segment (the "ceiling")
        seg(-55, -75, 10, x=0, y=3, ramp=0),
        # Walk on the ceiling for a while
        seg(-75, -100, 10, x=0, y=3, ramp=0.5),
        seg(-100, -120, 10, x=2, y=3, ramp=0.5),
        seg(-120, -140, 10, x=2, y=3, ramp=0),
        # Exit reverse-G zone, ball falls back DOWN to normal track
        seg(-140, -155, 10, x=2, y=0, ramp=0),
        # Landing rest
        seg(-169, -199, 10, x=0, y=0, ramp=0),
        # Second reverse-G climb
        seg(-199, -214, 9, x=0, y=0, ramp=0),
        # Fall up to ceiling
        seg(-214, -234, 9, x=0, y=3, ramp=0),
        # Ceiling walk + switchback
        seg(-234, -254, 9, x=3, y=3, ramp=0.5),
        seg(-254, -274, 9, x=-3, y=3, ramp=0.5),
        seg(-274, -294, 9, x=-3, y=3, ramp=0),
        # Drop back down
        seg(-294, -309, 9, x=-3, y=0, ramp=0),
        # Rest to finish
        seg(-323, -353, 10, x=0, y=0, ramp=0),
        seg(-353, -380, 10, x=0, y=0, ramp=-0.5),
    ],
    [
        coin(-20, x=0, y=2.2),
        coin(-48, x=0, y=5.0),       # mid-climb, reverse-G
        coin(-90, x=0, y=5.5),       # on ceiling
        coin(-130, x=2, y=5.5),      # ceiling walk
        coin(-184, x=0, y=2.2),
        coin(-224, x=0, y=5.5),      # second ceiling
        coin(-284, x=-3, y=5.5),     # ceiling switchback
        coin(-368, x=0, y=2.2),
    ],
    -380,
    checkpoints=[-184, -317],
    obstacles=[
        obstacle("checkpoint", z=-184, x=0),
        obstacle("checkpoint", z=-317, x=0),
        # Purple reverse-G zones
        obstacle("gravity", z=-98, x=0, type=2, multiplier=1.0, length=80),
        obstacle("gravity", z=-254, x=0, type=2, multiplier=1.0, length=100),
    ],
)

# 3-5 "Gravity Gauntlet" — All four types in sequence.
# Fast-paced. Each section introduces the next gravity type.
L3_5 = level(
    "Gravity Gauntlet", 12, 45,
    [
        # Start
        seg(0, -35, 11, x=0, y=0, ramp=-0.5),
        # 1. Heavy-G drop (orange)
        seg(-35, -50, 10, x=0, y=0, ramp=0.5),
        seg(-50, -65, 10, x=0, y=0, ramp=-3.0),
        seg(-65, -80, 10, x=0, y=0, ramp=-3.5),
        seg(-80, -95, 10, x=0, y=0, ramp=0, jump=True),
        # Landing rest
        seg(-109, -124, 10, x=0, y=0, ramp=0),
        # 2. Zero-G float (yellow) using the speed from heavy-G
        seg(-124, -139, 9, x=0, y=0, ramp=-1.0),
        seg(-139, -159, 9, x=0, y=0, ramp=0, jump=True),
        # Landing
        seg(-173, -188, 9, x=0, y=0, ramp=0),
        # 3. Low-G jump (cyan) to high platform
        seg(-188, -203, 9, x=0, y=0, ramp=1.0),
        seg(-203, -218, 8, x=0, y=0, ramp=1.5),
        seg(-218, -233, 8, x=0, y=1.5, ramp=1.5),
        # High platform
        seg(-233, -248, 8, x=0, y=3, ramp=0),
        # 4. Reverse-G climb (purple) to ceiling
        seg(-248, -263, 8, x=0, y=3, ramp=0),
        seg(-263, -278, 8, x=0, y=6, ramp=0),
        # Ceiling walk
        seg(-278, -298, 8, x=0, y=6, ramp=0.5),
        seg(-298, -318, 8, x=0, y=6, ramp=0),
        # Drop back down
        seg(-318, -333, 8, x=0, y=0, ramp=0),
        # Rest to finish
        seg(-347, -377, 10, x=0, y=0, ramp=0),
        seg(-377, -420, 10, x=0, y=0, ramp=-0.5),
    ],
    [
        coin(-20, x=0, y=2.2),
        coin(-55, x=0, y=3.0),       # heavy-G drop
        coin(-73, x=0, y=4.5),       # before heavy-G gap
        coin(-149, x=0, y=3.5),      # floating in zero-G
        coin(-212, x=0, y=5.0),      # low-G high jump
        coin(-241, x=0, y=6.5),      # high platform
        coin(-288, x=0, y=7.5),      # ceiling walk
        coin(-392, x=0, y=2.2),
    ],
    -420,
    checkpoints=[-117, -180, -340],
    obstacles=[
        obstacle("checkpoint", z=-117, x=0),
        obstacle("checkpoint", z=-180, x=0),
        obstacle("checkpoint", z=-340, x=0),
        # Heavy-G on first drop
        obstacle("gravity", z=-73, x=0, type=0, multiplier=3.5, length=45),
        # Zero-G on float section
        obstacle("gravity", z=-149, x=0, type=3, multiplier=0.0, length=50),
        # Low-G on high platform section
        obstacle("gravity", z=-226, x=0, type=1, multiplier=3.5, length=50),
        # Reverse-G on ceiling section
        obstacle("gravity", z=-288, x=0, type=2, multiplier=1.0, length=80),
    ],
)

# 3-6 "Gravity Master" — Full synthesis. Complex sequence mixing all types.
# The ultimate gravity playground. Speed, verticality, and mastery.
L3_6 = level(
    "Gravity Master", 13, 50,
    [
        # Start: steep drop to build speed
        seg(0, -30, 11, x=0, y=0, ramp=-1.5),
        seg(-30, -45, 10, x=0, y=0, ramp=-2.5),
        # Heavy-G zone → EXTREME acceleration
        seg(-45, -60, 10, x=0, y=0, ramp=-3.5),
        seg(-60, -75, 10, x=0, y=0, ramp=-3.5),
        # Zero-G float across MASSIVE gap using heavy-G speed
        seg(-75, -90, 10, x=0, y=0, ramp=0, jump=True),
        # Landing on high platform
        seg(-106, -121, 10, x=0, y=2, ramp=0),
        # Reverse-G: fall UP to ceiling track
        seg(-121, -136, 9, x=0, y=2, ramp=0),
        seg(-136, -156, 9, x=0, y=5, ramp=0),
        # Ceiling walk with switchback
        seg(-156, -176, 9, x=3, y=5, ramp=0.5),
        seg(-176, -196, 9, x=-3, y=5, ramp=0.5),
        seg(-196, -216, 9, x=-3, y=5, ramp=0),
        # Drop back down
        seg(-216, -231, 9, x=-3, y=0, ramp=0),
        # Low-G zone: huge jump to finish platform
        seg(-231, -246, 9, x=0, y=0, ramp=1.5),
        seg(-246, -261, 8, x=0, y=1.5, ramp=1.5),
        seg(-261, -276, 8, x=0, y=3, ramp=0),
        # Final zero-G float to finish
        seg(-276, -291, 8, x=0, y=3, ramp=0, jump=True),
        # Landing + finish
        seg(-307, -337, 10, x=0, y=0, ramp=0),
        seg(-337, -380, 10, x=0, y=0, ramp=-0.5),
    ],
    [
        coin(-20, x=0, y=2.2),
        coin(-38, x=0, y=3.0),       # steep start
        coin(-68, x=0, y=4.5),       # heavy-G drop
        coin(-83, x=0, y=5.5),       # zero-G float gap
        coin(-148, x=0, y=7.0),      # reverse-G climb
        coin(-186, x=3, y=7.5),      # ceiling switchback
        coin(-268, x=0, y=6.5),      # low-G high platform
        coin(-288, x=0, y=8.0),      # final float
        coin(-358, x=0, y=2.2),
    ],
    -380,
    checkpoints=[-113, -223, -322],
    obstacles=[
        obstacle("checkpoint", z=-113, x=0),
        obstacle("checkpoint", z=-223, x=0),
        obstacle("checkpoint", z=-322, x=0),
        # Heavy-G on first drop
        obstacle("gravity", z=-60, x=0, type=0, multiplier=3.5, length=40),
        # Zero-G on massive gap
        obstacle("gravity", z=-83, x=0, type=3, multiplier=0.0, length=50),
        # Reverse-G on ceiling climb
        obstacle("gravity", z=-166, x=0, type=2, multiplier=1.0, length=100),
        # Low-G on high platform jump
        obstacle("gravity", z=-254, x=0, type=1, multiplier=3.5, length=50),
        # Final zero-G float
        obstacle("gravity", z=-284, x=0, type=3, multiplier=0.0, length=40),
    ],
)


def fmt(val, indent=0):
    prefix = "\t" * indent
    if isinstance(val, dict):
        if not val:
            return "{}"
        items = []
        for k, v in val.items():
            items.append(f'{prefix}\t"{k}": {fmt(v, indent+1)}')
        return "{\n" + ",\n".join(items) + f"\n{prefix}}}"
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

levels = {
    "3-1": L3_1, "3-2": L3_2, "3-3": L3_3,
    "3-4": L3_4, "3-5": L3_5, "3-6": L3_6,
}

out_lines = []
out_lines.append('\t\t# ═══════════════════════════════════════════════════════════════════════════')
out_lines.append('\t\t# WORLD 3 — Variable Gravity (orange/purple/cyan/yellow gravity zones)')
out_lines.append('\t\t# ═══════════════════════════════════════════════════════════════════════════')
for key in ["3-1", "3-2", "3-3", "3-4", "3-5", "3-6"]:
    out_lines.append(f'\t\t"{key}": ' + fmt(levels[key], indent=2) + ",")

with open("tools/world_3_new.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(out_lines))
    f.write("\n")

print("Wrote tools/world_3_new.txt")
