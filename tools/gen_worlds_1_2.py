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
# WORLD 1 — Gravity & Motion (green, learn to roll, jump, steer)
# ═══════════════════════════════════════════════════════════════════════════

# 1-1: The Highway → Funnel → Ski Jump tutorial. One big obvious gap.
L1_1 = level(
    "First Roll", 9, 30,
    [
        # Rest: wide flat start, player gets oriented
        seg(0, -50, 11, x=0, y=0, ramp=0),
        # Build-up: gentle uphill, starts storing tension
        seg(-50, -80, 10, x=0, y=0, ramp=1.5),
        # Release: downhill into first gap
        seg(-80, -100, 10, x=0, y=1.5, ramp=-2.5, jump=True),
        # Landing / rest zone (wide, flat)
        seg(-114, -154, 10, x=0, y=0, ramp=0),
        # Build-up: gentle uphill again
        seg(-154, -184, 9, x=0, y=0, ramp=1.5),
        # Release: downhill into second gap (bigger)
        seg(-184, -204, 9, x=0, y=1.5, ramp=-2.5, jump=True),
        # Landing / rest
        seg(-218, -248, 10, x=0, y=0, ramp=0),
        # Final gentle slope to finish
        seg(-248, -280, 10, x=0, y=0, ramp=-0.5),
    ],
    [
        coin(-25, x=0, y=2.2),      # center, easy
        coin(-65, x=0, y=3.0),      # on uphill
        coin(-95, x=0, y=4.0),      # before first gap
        coin(-134, x=0, y=2.2),    # landing rest zone
        coin(-194, x=0, y=3.0),    # before second gap
        coin(-264, x=0, y=2.2),    # final stretch
    ],
    -280,
    checkpoints=[-134],
    obstacles=[
        obstacle("checkpoint", z=-134, x=0),
        obstacle("speed_boost", z=-70, x=0, strength=12),
    ],
)

# 1-2: The Funnel → Gap. Teaches centering before jump.
L1_2 = level(
    "Funnel Run", 10, 35,
    [
        # Highway start
        seg(0, -40, 11, x=0, y=0, ramp=0),
        # Funnel: wide → narrow → wide
        seg(-40, -65, 10, x=0, y=0, ramp=0),
        seg(-65, -85, 7, x=0, y=0, ramp=1.0),
        seg(-85, -100, 6, x=0, y=0, ramp=1.5),
        # Release: downhill out of funnel into gap
        seg(-100, -115, 6, x=0, y=1.5, ramp=-2.0, jump=True),
        # Landing rest
        seg(-129, -164, 10, x=0, y=0, ramp=0),
        # Second funnel + gap
        seg(-164, -184, 9, x=0, y=0, ramp=0.5),
        seg(-184, -199, 7, x=0, y=0, ramp=1.0),
        seg(-199, -214, 6, x=0, y=0, ramp=1.5),
        seg(-214, -229, 6, x=0, y=1.5, ramp=-2.0, jump=True),
        # Landing rest to finish
        seg(-243, -280, 10, x=0, y=0, ramp=-0.5),
    ],
    [
        coin(-20, x=0, y=2.2),
        coin(-75, x=3.0, y=2.5),    # risk: outer edge of funnel
        coin(-108, x=0, y=3.5),     # before gap
        coin(-146, x=0, y=2.2),
        coin(-207, x=-3.0, y=2.5),  # risk: other side
        coin(-264, x=0, y=2.2),
    ],
    -280,
    checkpoints=[-146],
    obstacles=[
        obstacle("checkpoint", z=-146, x=0),
        obstacle("speed_boost", z=-55, x=0, strength=14),
    ],
)

# 1-3: Downhill → Gap. Teaches that speed makes jumps longer.
L1_3 = level(
    "Hill Drop", 11, 32,
    [
        # Rest start
        seg(0, -40, 11, x=0, y=0, ramp=0),
        # Build-up: uphill
        seg(-40, -70, 10, x=0, y=0, ramp=2.0),
        # Release: STEEP downhill → big gap
        seg(-70, -90, 10, x=0, y=2.0, ramp=-3.5, jump=True),
        # Landing rest
        seg(-106, -146, 10, x=0, y=0, ramp=0),
        # Second cycle: uphill → downhill → gap
        seg(-146, -176, 9, x=0, y=0, ramp=2.0),
        seg(-176, -196, 9, x=0, y=2.0, ramp=-3.5, jump=True),
        # Landing rest to finish
        seg(-212, -252, 10, x=0, y=0, ramp=0),
        seg(-252, -290, 10, x=0, y=0, ramp=-0.5),
    ],
    [
        coin(-20, x=0, y=2.2),
        coin(-55, x=0, y=3.0),      # on uphill
        coin(-83, x=0, y=4.5),      # at crest before gap
        coin(-126, x=0, y=2.2),
        coin(-188, x=0, y=4.5),     # at crest
        coin(-271, x=0, y=2.2),
    ],
    -290,
    checkpoints=[-126, -232],
    obstacles=[
        obstacle("checkpoint", z=-126, x=0),
        obstacle("checkpoint", z=-232, x=0),
    ],
)

# 1-4: Switchback. Sharp x-shifts with gaps at inflection points.
L1_4 = level(
    "Switchback", 10, 38,
    [
        # Rest start
        seg(0, -40, 11, x=0, y=0, ramp=0),
        # Build-up: shift right
        seg(-40, -70, 9, x=0, y=0, ramp=1.0),
        seg(-70, -90, 8, x=2, y=0, ramp=1.5),
        # Release: downhill gap at inflection
        seg(-90, -105, 8, x=2, y=1.5, ramp=-2.0, jump=True),
        # Landing rest
        seg(-119, -149, 9, x=2, y=0, ramp=0),
        # Build-up: shift left
        seg(-149, -179, 8, x=2, y=0, ramp=1.0),
        seg(-179, -199, 7, x=-2, y=0, ramp=1.5),
        # Release: downhill gap at inflection
        seg(-199, -214, 7, x=-2, y=1.5, ramp=-2.0, jump=True),
        # Landing rest to finish
        seg(-228, -258, 9, x=-2, y=0, ramp=0),
        seg(-258, -290, 9, x=0, y=0, ramp=-0.5),
    ],
    [
        coin(-20, x=0, y=2.2),
        coin(-80, x=2, y=3.0),
        coin(-100, x=3.5, y=2.5),   # risk: outer edge before gap
        coin(-134, x=2, y=2.2),
        coin(-209, x=-3.5, y=2.5),  # risk: other outer edge
        coin(-274, x=0, y=2.2),
    ],
    -290,
    checkpoints=[-134, -243],
    obstacles=[
        obstacle("checkpoint", z=-134, x=2),
        obstacle("checkpoint", z=-243, x=-2),
    ],
)

# 1-5: Step-Up. Each segment is higher. Momentum staircase.
L1_5 = level(
    "Stair Climb", 12, 40,
    [
        # Rest start
        seg(0, -40, 11, x=0, y=0, ramp=0),
        # Step-up sequence: each segment +1.0y higher
        seg(-40, -65, 9, x=0, y=0, ramp=2.0),
        seg(-65, -85, 8, x=0, y=1.0, ramp=2.0),
        seg(-85, -105, 8, x=0, y=2.0, ramp=2.0),
        # Release: downhill from top
        seg(-105, -125, 8, x=0, y=3.0, ramp=-3.0, jump=True),
        # Landing rest
        seg(-141, -171, 10, x=0, y=0, ramp=0),
        # Second step-up (shorter)
        seg(-171, -191, 9, x=0, y=0, ramp=2.0),
        seg(-191, -211, 8, x=0, y=1.0, ramp=2.0),
        seg(-211, -226, 8, x=0, y=2.0, ramp=2.0),
        # Release: downhill gap
        seg(-226, -241, 8, x=0, y=3.0, ramp=-3.0, jump=True),
        # Rest to finish
        seg(-257, -290, 10, x=0, y=0, ramp=-0.5),
    ],
    [
        coin(-20, x=0, y=2.2),
        coin(-55, x=0, y=2.5),
        coin(-95, x=0, y=3.5),      # high on staircase
        coin(-118, x=0, y=4.5),     # at crest
        coin(-206, x=0, y=3.5),     # second staircase
        coin(-274, x=0, y=2.2),
    ],
    -290,
    checkpoints=[-156, -248],
    obstacles=[
        obstacle("checkpoint", z=-156, x=0),
        obstacle("checkpoint", z=-248, x=0),
    ],
)

# 1-6: Mastery. Highway → Funnel → Step-Up → Ski Jump synthesis.
L1_6 = level(
    "The Gauntlet", 12, 45,
    [
        # Highway start (fast feel)
        seg(0, -50, 11, x=0, y=0, ramp=-0.5),
        # Funnel
        seg(-50, -75, 10, x=0, y=0, ramp=0.5),
        seg(-75, -95, 7, x=0, y=0, ramp=1.0),
        seg(-95, -110, 6, x=0, y=0, ramp=1.5),
        # Gap out of funnel
        seg(-110, -125, 6, x=0, y=1.5, ramp=-2.0, jump=True),
        # Landing rest
        seg(-139, -169, 10, x=0, y=0, ramp=0),
        # Step-up
        seg(-169, -189, 9, x=0, y=0, ramp=2.0),
        seg(-189, -209, 8, x=0, y=1.0, ramp=2.0),
        seg(-209, -224, 8, x=0, y=2.0, ramp=2.0),
        # Big downhill gap from top
        seg(-224, -239, 8, x=0, y=3.0, ramp=-3.5, jump=True),
        # Landing rest + switchback
        seg(-255, -280, 9, x=0, y=0, ramp=0),
        seg(-280, -295, 8, x=3, y=0, ramp=1.0),
        seg(-295, -310, 7, x=3, y=0, ramp=1.5),
        # Final gap
        seg(-310, -325, 7, x=3, y=1.5, ramp=-2.0, jump=True),
        # Rest to finish
        seg(-341, -380, 10, x=0, y=0, ramp=-0.5),
    ],
    [
        coin(-25, x=0, y=2.2),
        coin(-85, x=3.0, y=2.5),    # risk: outer funnel
        coin(-118, x=0, y=3.5),
        coin(-200, x=0, y=3.5),     # on step-up
        coin(-233, x=0, y=4.5),     # at crest
        coin(-360, x=0, y=2.2),
    ],
    -380,
    checkpoints=[-154, -247, -333],
    obstacles=[
        obstacle("checkpoint", z=-154, x=0),
        obstacle("checkpoint", z=-247, x=0),
        obstacle("checkpoint", z=-333, x=0),
    ],
)


# ═══════════════════════════════════════════════════════════════════════════
# WORLD 2 — Friction & Ice (blue, ice patches, speed control)
# Faster feel: more downhill, bigger gaps, ice lets ball slide
# ═══════════════════════════════════════════════════════════════════════════

# 2-1: Ice S-Curve introduction. Gentle ice, wide track, learn to slide.
L2_1 = level(
    "Icebreaker", 10, 32,
    [
        # Highway start
        seg(0, -45, 11, x=0, y=0, ramp=-0.5),
        # Gentle ice curve (wide, safe)
        seg(-45, -75, 10, x=0, y=0, ramp=0.5, ice=True),
        seg(-75, -100, 10, x=2, y=0, ramp=0.5, ice=True),
        seg(-100, -125, 10, x=2, y=0, ramp=0.5, ice=True),
        # Rest off ice
        seg(-125, -155, 10, x=0, y=0, ramp=0),
        # Second ice section + downhill gap
        seg(-155, -175, 9, x=0, y=0, ramp=1.0),
        seg(-175, -190, 9, x=0, y=0, ramp=1.5, ice=True),
        seg(-190, -205, 9, x=0, y=0, ramp=-2.0, ice=True, jump=True),
        # Landing rest
        seg(-219, -249, 10, x=0, y=0, ramp=0),
        # Finish
        seg(-249, -290, 10, x=0, y=0, ramp=-0.5),
    ],
    [
        coin(-22, x=0, y=2.2),
        coin(-60, x=2, y=2.2),       # on ice
        coin(-90, x=3.5, y=2.2),     # risk: outer ice edge
        coin(-140, x=0, y=2.2),
        coin(-198, x=0, y=3.0),      # before ice gap
        coin(-270, x=0, y=2.2),
    ],
    -290,
    checkpoints=[-140, -234],
    obstacles=[
        obstacle("checkpoint", z=-140, x=0),
        obstacle("checkpoint", z=-234, x=0),
    ],
)

# 2-2: Funnel on ice. Precision steering on low friction.
L2_2 = level(
    "Frost Funnel", 11, 35,
    [
        # Highway
        seg(0, -40, 11, x=0, y=0, ramp=-0.5),
        # Ice funnel
        seg(-40, -60, 10, x=0, y=0, ramp=0.5, ice=True),
        seg(-60, -80, 8, x=0, y=0, ramp=1.0, ice=True),
        seg(-80, -95, 6, x=0, y=0, ramp=1.5, ice=True),
        # Gap out of ice funnel
        seg(-95, -110, 6, x=0, y=1.5, ramp=-2.0, jump=True),
        # Landing rest (non-ice)
        seg(-124, -154, 10, x=0, y=0, ramp=0),
        # Second ice funnel (tighter)
        seg(-154, -174, 9, x=0, y=0, ramp=0.5, ice=True),
        seg(-174, -189, 7, x=0, y=0, ramp=1.0, ice=True),
        seg(-189, -199, 6, x=0, y=0, ramp=1.5, ice=True),
        seg(-199, -214, 6, x=0, y=1.5, ramp=-2.0, jump=True),
        # Rest to finish
        seg(-228, -258, 10, x=0, y=0, ramp=0),
        seg(-258, -300, 10, x=0, y=0, ramp=-0.5),
    ],
    [
        coin(-20, x=0, y=2.2),
        coin(-70, x=3.0, y=2.5),     # risk: outer ice
        coin(-104, x=0, y=3.5),      # before gap
        coin(-139, x=0, y=2.2),
        coin(-182, x=3.5, y=2.5),    # risk
        coin(-279, x=0, y=2.2),
    ],
    -300,
    checkpoints=[-139, -243],
    obstacles=[
        obstacle("checkpoint", z=-139, x=0),
        obstacle("checkpoint", z=-243, x=0),
    ],
)

# 2-3: Highway → Ice downhill → gap. Speed maintenance on ice.
L2_3 = level(
    "Glacier Drop", 12, 30,
    [
        # Highway build speed
        seg(0, -40, 11, x=0, y=0, ramp=-0.5),
        # Ice downhill (speed release)
        seg(-40, -60, 10, x=0, y=0, ramp=-2.0, ice=True),
        seg(-60, -75, 10, x=0, y=0, ramp=-2.5, ice=True),
        # Gap at bottom of ice downhill
        seg(-75, -90, 10, x=0, y=0, ramp=0, ice=True, jump=True),
        # Landing rest
        seg(-104, -134, 10, x=0, y=0, ramp=0),
        # Second cycle: uphill then ice downhill gap
        seg(-134, -154, 9, x=0, y=0, ramp=2.0),
        seg(-154, -169, 9, x=0, y=0, ramp=-2.0, ice=True),
        seg(-169, -184, 9, x=0, y=0, ramp=-2.5, ice=True, jump=True),
        # Rest to finish
        seg(-198, -228, 10, x=0, y=0, ramp=0),
        seg(-228, -280, 10, x=0, y=0, ramp=-0.5),
    ],
    [
        coin(-20, x=0, y=2.2),
        coin(-50, x=0, y=2.5),       # ice downhill
        coin(-83, x=0, y=3.5),       # before gap
        coin(-119, x=0, y=2.2),
        coin(-178, x=0, y=3.0),      # before second gap
        coin(-254, x=0, y=2.2),
    ],
    -280,
    checkpoints=[-119, -213],
    obstacles=[
        obstacle("checkpoint", z=-119, x=0),
        obstacle("checkpoint", z=-213, x=0),
        obstacle("speed_boost", z=-45, x=0, strength=14),
    ],
)

# 2-4: Switchback on ice. Lateral control on low friction.
L2_4 = level(
    "Icy Switchback", 11, 38,
    [
        # Start
        seg(0, -35, 11, x=0, y=0, ramp=-0.5),
        # Ice build-up shift right
        seg(-35, -60, 9, x=0, y=0, ramp=1.0, ice=True),
        seg(-60, -80, 8, x=2, y=0, ramp=1.0, ice=True),
        # Ice downhill gap at inflection
        seg(-80, -95, 8, x=2, y=0, ramp=-2.0, ice=True, jump=True),
        # Landing rest
        seg(-109, -139, 9, x=2, y=0, ramp=0),
        # Build-up shift left
        seg(-139, -164, 8, x=2, y=0, ramp=1.0, ice=True),
        seg(-164, -184, 7, x=-2, y=0, ramp=1.0, ice=True),
        # Ice downhill gap at inflection
        seg(-184, -199, 7, x=-2, y=0, ramp=-2.0, ice=True, jump=True),
        # Landing rest to finish
        seg(-213, -243, 9, x=-2, y=0, ramp=0),
        seg(-243, -290, 10, x=0, y=0, ramp=-0.5),
    ],
    [
        coin(-17, x=0, y=2.2),
        coin(-70, x=2, y=2.5),
        coin(-90, x=3.5, y=2.5),     # risk: outer edge
        coin(-124, x=2, y=2.2),
        coin(-192, x=-3.5, y=2.5),   # risk
        coin(-266, x=0, y=2.2),
    ],
    -290,
    checkpoints=[-124, -228],
    obstacles=[
        obstacle("checkpoint", z=-124, x=2),
        obstacle("checkpoint", z=-228, x=-2),
    ],
)

# 2-5: Step-Up on ice. Momentum conservation on low friction.
L2_5 = level(
    "Stair Slide", 12, 40,
    [
        # Start
        seg(0, -35, 11, x=0, y=0, ramp=-0.5),
        # Ice step-up
        seg(-35, -55, 9, x=0, y=0, ramp=2.0, ice=True),
        seg(-55, -70, 8, x=0, y=1.0, ramp=2.0, ice=True),
        seg(-70, -85, 8, x=0, y=2.0, ramp=2.0, ice=True),
        # Ice downhill gap from top
        seg(-85, -100, 8, x=0, y=3.0, ramp=-3.0, ice=True, jump=True),
        # Landing rest
        seg(-116, -146, 10, x=0, y=0, ramp=0),
        # Second ice step-up (harder)
        seg(-146, -161, 8, x=0, y=0, ramp=2.0, ice=True),
        seg(-161, -176, 7, x=0, y=1.0, ramp=2.0, ice=True),
        seg(-176, -191, 7, x=0, y=2.0, ramp=2.0, ice=True),
        # Big downhill gap
        seg(-191, -206, 7, x=0, y=3.0, ramp=-3.5, ice=True, jump=True),
        # Rest to finish
        seg(-222, -252, 10, x=0, y=0, ramp=0),
        seg(-252, -300, 10, x=0, y=0, ramp=-0.5),
    ],
    [
        coin(-17, x=0, y=2.2),
        coin(-45, x=0, y=2.5),
        coin(-78, x=0, y=3.5),
        coin(-93, x=0, y=4.5),       # crest
        coin(-183, x=0, y=3.5),
        coin(-276, x=0, y=2.2),
    ],
    -300,
    checkpoints=[-131, -237],
    obstacles=[
        obstacle("checkpoint", z=-131, x=0),
        obstacle("checkpoint", z=-237, x=0),
    ],
)

# 2-6: Mastery. Fast downhill + ice + big gaps. Thrilling speed.
L2_6 = level(
    "Avalanche", 13, 35,
    [
        # FAST highway start (steep downhill)
        seg(0, -40, 11, x=0, y=0, ramp=-1.0),
        # Long ice downhill (build massive speed)
        seg(-40, -60, 10, x=0, y=0, ramp=-2.5, ice=True),
        seg(-60, -75, 10, x=0, y=0, ramp=-3.0, ice=True),
        seg(-75, -90, 10, x=0, y=0, ramp=-2.5, ice=True),
        # BIG gap at bottom of ice run
        seg(-90, -105, 10, x=0, y=0, ramp=0, ice=True, jump=True),
        # Landing rest (wide)
        seg(-121, -151, 11, x=0, y=0, ramp=0),
        # Second cycle: uphill then faster ice drop
        seg(-151, -171, 9, x=0, y=0, ramp=2.0),
        seg(-171, -186, 9, x=0, y=0, ramp=-2.5, ice=True),
        seg(-186, -201, 9, x=0, y=0, ramp=-3.5, ice=True),
        # Huge gap
        seg(-201, -216, 9, x=0, y=0, ramp=0, ice=True, jump=True),
        # Final rest + switchback to finish
        seg(-232, -262, 10, x=0, y=0, ramp=0),
        seg(-262, -277, 9, x=2, y=0, ramp=1.0),
        seg(-277, -292, 8, x=2, y=0, ramp=1.5),
        # Final ice gap
        seg(-292, -307, 8, x=2, y=0, ramp=-2.0, ice=True, jump=True),
        # Rest to finish
        seg(-323, -380, 10, x=0, y=0, ramp=-0.5),
    ],
    [
        coin(-20, x=0, y=2.2),
        coin(-50, x=0, y=2.5),       # ice downhill
        coin(-82, x=0, y=3.5),       # before big gap
        coin(-136, x=0, y=2.2),
        coin(-195, x=0, y=3.5),      # before huge gap
        coin(-352, x=0, y=2.2),
    ],
    -380,
    checkpoints=[-136, -247, -315],
    obstacles=[
        obstacle("checkpoint", z=-136, x=0),
        obstacle("checkpoint", z=-247, x=0),
        obstacle("checkpoint", z=-315, x=0),
        obstacle("speed_boost", z=-45, x=0, strength=16),
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
        # For short lists of primitives, keep inline
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

# Build output
levels = {
    "1-1": L1_1, "1-2": L1_2, "1-3": L1_3,
    "1-4": L1_4, "1-5": L1_5, "1-6": L1_6,
    "2-1": L2_1, "2-2": L2_2, "2-3": L2_3,
    "2-4": L2_4, "2-5": L2_5, "2-6": L2_6,
}

out_lines = []
out_lines.append('\t\t# ═══════════════════════════════════════════════════════════════════════════')
out_lines.append('\t\t# WORLD 1 — Gravity & Motion (green, learn to roll, jump, steer)')
out_lines.append('\t\t# ═══════════════════════════════════════════════════════════════════════════')
for key in ["1-1", "1-2", "1-3", "1-4", "1-5", "1-6"]:
    out_lines.append(f'\t\t"{key}": ' + fmt(levels[key], indent=2) + ",")

out_lines.append('\t\t# ═══════════════════════════════════════════════════════════════════════════')
out_lines.append('\t\t# WORLD 2 — Friction & Ice (blue, ice patches, speed control)')
out_lines.append('\t\t# ═══════════════════════════════════════════════════════════════════════════')
for key in ["2-1", "2-2", "2-3", "2-4", "2-5", "2-6"]:
    out_lines.append(f'\t\t"{key}": ' + fmt(levels[key], indent=2) + ",")

with open("tools/worlds_1_2_new.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(out_lines))
    f.write("\n")

print("Wrote tools/worlds_1_2_new.txt")
