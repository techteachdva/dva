#!/usr/bin/env python3
"""Generate redesigned LEVELS dictionary for Physix."""

def make_level(name, slope, par, segments, coins, obstacles, finish_z):
    return {
        "name": name,
        "slope": slope,
        "par_time": par,
        "segments": segments,
        "coins": coins,
        "obstacles": obstacles,
        "finish_z": finish_z,
    }

def seg(z0, z1, w, x, y=0, ramp=None, jump=False, ice=False):
    d = {"z0": z0, "z1": z1, "w": w, "x": x}
    if y != 0:
        d["y"] = y
    if ramp is not None:
        d["ramp"] = ramp
    if jump:
        d["jump"] = True
    if ice:
        d["ice"] = True
    return d

def coin(z, x, y=1.7):
    return {"z": z, "x": x, "y": y}

def checkpoint(z, x):
    return {"kind": "checkpoint", "z": z, "x": x}

def speed_boost(z, x, strength=14):
    return {"kind": "speed_boost", "z": z, "x": x, "strength": strength}

def brake_pad(z, x):
    return {"kind": "brake_pad", "z": z, "x": x}

def bumper(z, x, force=18):
    return {"kind": "bumper", "z": z, "x": x, "force": force}

def spike(z, x, width=5, length=2):
    return {"kind": "spike", "z": z, "x": x, "width": width, "length": length}

def gravity(z, x, gtype=0, multiplier=2.0, length=80):
    return {"kind": "gravity", "z": z, "x": x, "type": gtype, "multiplier": multiplier, "length": length}

def wind(z, x, force=20, direction=(1,0,0), length=60):
    return {"kind": "wind", "z": z, "x": x, "force": force, "direction": {"x": direction[0], "y": direction[1], "z": direction[2]}, "length": length}

def magnet(z, x, mag_type="attract", strength=18, length=60):
    return {"kind": "magnet", "z": z, "x": x, "type": mag_type, "strength": strength, "length": length}

def moving_platform(z, x, axis=(1,0,0), dist=3, speed=2.5):
    return {"kind": "moving_platform", "z": z, "x": x, "axis": {"x": axis[0], "y": axis[1], "z": axis[2]}, "dist": dist, "speed": speed}

def hoop(z, x, y, boost=18):
    return {"kind": "hoop", "z": z, "x": x, "y": y, "boost": boost}

def fmt_value(v):
    if isinstance(v, dict):
        if set(v.keys()) == {"x", "y", "z"}:
            return "Vector3(%s, %s, %s)" % (v["x"], v["y"], v["z"])
        return fmt_dict(v, "\t\t\t\t")
    if isinstance(v, str):
        return '"%s"' % v
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, float):
        if v == int(v):
            return str(int(v))
        return str(v)
    return str(v)

def fmt_dict(d, indent="\t"):
    lines = ["{"]
    items = list(d.items())
    for i, (k, v) in enumerate(items):
        if isinstance(v, list):
            lines.append(indent + "\"%s\": [" % k)
            for item in v:
                lines.append(indent + "\t" + fmt_dict(item, indent + "\t\t") + ",")
            lines.append(indent + "],")
        else:
            suffix = "," if i < len(items) - 1 else ""
            lines.append(indent + "\"%s\": %s%s" % (k, fmt_value(v), suffix))
    lines.append(indent[:-1] + "}")
    return "\n".join(lines)

def fmt_level(key, level):
    lines = ['\t"%s": {' % key]
    items = list(level.items())
    for i, (k, v) in enumerate(items):
        if k == "segments" or k == "coins" or k == "obstacles":
            lines.append('\t\t"%s": [' % k)
            for item in v:
                lines.append('\t\t\t' + fmt_dict(item, '\t\t\t\t') + ',')
            lines.append('\t\t],')
        else:
            suffix = "," if i < len(items) - 1 else ""
            lines.append('\t\t"%s": %s%s' % (k, fmt_value(v), suffix))
    lines.append('\t},')
    return "\n".join(lines)

# ═══════════════════════════════════════════════════════════════════════════════
# WORLD 1
# ═══════════════════════════════════════════════════════════════════════════════
levels = {}
levels["1-1"] = make_level(
    "First Roll", 9.0, 32.0,
    [seg(0, -40, 10, 0, 0), seg(-40, -70, 9, 2, ramp=1.5), seg(-70, -90, 9, 2, y=1.5),
     seg(-90, -110, 8, 0, y=1.5, jump=True), seg(-122, -152, 8, 0, y=0),
     seg(-152, -182, 8, -2, ramp=1.5), seg(-182, -202, 8, -2, y=1.5),
     seg(-202, -222, 8, 0, y=1.5, jump=True), seg(-234, -264, 8, 0, y=0),
     seg(-264, -290, 8, 0, ramp=1.0), seg(-290, -310, 8, 0, y=1.0)],
    [coin(-30, 0, 2.2), coin(-55, 2, 3.0), coin(-80, 2, 3.5), coin(-100, 0, 4.0),
     coin(-137, 0, 2.2), coin(-167, -2, 3.0), coin(-192, -2, 3.5), coin(-212, 0, 4.0),
     coin(-247, 0, 2.2), coin(-280, 0, 2.5)],
    [checkpoint(-140, 0), speed_boost(-50, 0, 12)], -310)

levels["1-2"] = make_level(
    "Serpentine", 9.5, 38.0,
    [seg(0, -40, 10, 0, 0), seg(-40, -70, 9, 3, ramp=2.0), seg(-70, -90, 8, 3, y=2.0, jump=True),
     seg(-104, -134, 8, 3, y=0), seg(-134, -164, 8, -3, ramp=-2.5),
     seg(-164, -184, 7, -3, y=0, jump=True), seg(-198, -228, 7, -3, y=0),
     seg(-228, -258, 7, 3, ramp=2.5), seg(-258, -278, 7, 3, y=2.5, jump=True),
     seg(-292, -322, 6, 0, y=0), seg(-322, -350, 7, 0, ramp=-1.5), seg(-350, -370, 8, 0, y=0.5)],
    [coin(-30, 0, 2.2), coin(-55, 3, 3.5), coin(-80, 3, 4.0), coin(-97, 3, 4.5),
     coin(-119, 3, 2.2), coin(-149, -3, 3.5), coin(-174, -3, 4.0), coin(-194, -3, 4.5),
     coin(-214, -3, 2.2), coin(-244, 3, 3.5), coin(-269, 3, 4.0), coin(-307, 0, 2.2)],
    [checkpoint(-130, 3), checkpoint(-210, -3), speed_boost(-50, 0, 12)], -370)

levels["1-3"] = make_level(
    "Leap of Faith", 10.0, 42.0,
    [seg(0, -40, 10, 0, 0), seg(-40, -65, 8, 0, ramp=3.0), seg(-65, -85, 8, 0, y=3.0, jump=True),
     seg(-101, -131, 8, 2, y=0), seg(-131, -156, 8, 2, ramp=2.5),
     seg(-156, -176, 7, 2, y=2.5, jump=True), seg(-192, -222, 7, -2, y=0),
     seg(-222, -247, 7, -2, ramp=2.5), seg(-247, -267, 7, -2, y=2.5, jump=True),
     seg(-283, -313, 7, 0, y=0), seg(-313, -338, 8, 0, ramp=-2.0),
     seg(-338, -358, 8, 0, y=-2.0), seg(-358, -380, 8, 0, ramp=1.5), seg(-380, -400, 8, 0, y=0)],
    [coin(-30, 0, 2.2), coin(-52, 0, 4.0), coin(-75, 0, 5.0), coin(-82, 0, 5.5),
     coin(-116, 2, 2.2), coin(-143, 2, 3.5), coin(-166, 2, 4.5), coin(-176, 2, 5.0),
     coin(-207, -2, 2.2), coin(-234, -2, 3.5), coin(-257, -2, 4.5), coin(-267, -2, 5.0),
     coin(-298, 0, 2.2), coin(-325, 0, 3.0), coin(-348, 0, 1.0), coin(-370, 0, 2.2), coin(-390, 0, 2.5)],
    [checkpoint(-140, 2), checkpoint(-220, -2), speed_boost(-50, 0, 16), speed_boost(-140, 2, 14),
     hoop(-85, 0, 7.0, 18), hoop(-176, 2, 6.5, 18), hoop(-131, 2, 3.3)], -400)

levels["1-4"] = make_level(
    "The Squeeze", 11.0, 45.0,
    [seg(0, -40, 10, 0, 0), seg(-40, -70, 6, 0, ramp=2.5), seg(-70, -90, 5, 0, y=2.5, jump=True),
     seg(-104, -134, 5, 2, y=0), seg(-134, -164, 5, 4, ramp=2.0),
     seg(-164, -184, 5, 4, y=2.0, jump=True), seg(-198, -228, 5, 2, y=0),
     seg(-228, -258, 5, 0, ramp=-2.0), seg(-258, -278, 5, 0, y=0),
     seg(-278, -300, 6, 0, ramp=1.5), seg(-300, -320, 7, 0, y=1.5)],
    [coin(-30, 0, 2.2), coin(-55, 0, 3.5), coin(-80, 0, 4.5), coin(-97, 0, 5.0),
     coin(-119, 2, 2.2), coin(-149, 4, 3.0), coin(-174, 4, 3.5), coin(-191, 4, 4.0),
     coin(-213, 2, 2.2), coin(-243, 0, 2.2), coin(-268, 0, 3.0), coin(-290, 0, 3.5)],
    [checkpoint(-130, 2), checkpoint(-210, 0), speed_boost(-50, 0, 14), brake_pad(-120, 0),
     hoop(-134, 4, 3.8)], -320)

levels["1-5"] = make_level(
    "Switchback", 11.0, 48.0,
    [seg(0, -40, 10, 0, 0), seg(-40, -70, 8, 3, ramp=2.0), seg(-70, -90, 7, 3, y=2.0, jump=True),
     seg(-104, -134, 7, 3, y=0), seg(-134, -164, 7, -3, ramp=-2.5),
     seg(-164, -184, 6, -3, y=0, jump=True), seg(-198, -228, 6, -3, y=0),
     seg(-228, -258, 6, 3, ramp=2.5), seg(-258, -278, 6, 3, y=2.5, jump=True),
     seg(-292, -322, 6, 0, y=0), seg(-322, -350, 7, 0, ramp=-1.5), seg(-350, -370, 8, 0, y=0.5)],
    [coin(-30, 0, 2.2), coin(-55, 3, 3.5), coin(-80, 3, 4.5), coin(-97, 3, 5.0),
     coin(-119, 3, 2.2), coin(-149, -3, 3.5), coin(-174, -3, 4.0), coin(-194, -3, 4.5),
     coin(-214, -3, 2.2), coin(-243, 3, 3.5), coin(-268, 3, 4.0), coin(-307, 0, 2.2),
     coin(-340, 0, 2.5)],
    [checkpoint(-130, 3), checkpoint(-210, -3), speed_boost(-50, 0, 14), brake_pad(-120, 3),
     brake_pad(-240, 3), hoop(-90, 3, 5.0, 16)], -370)

levels["1-6"] = make_level(
    "The Gauntlet", 12.0, 55.0,
    [seg(0, -40, 10, 0, 0), seg(-40, -70, 8, 3, ramp=2.5), seg(-70, -90, 6, 3, y=2.5, jump=True),
     seg(-104, -134, 6, 3, y=0), seg(-134, -164, 6, -3, ramp=-2.5),
     seg(-164, -184, 5, -3, y=0, jump=True), seg(-198, -228, 5, -3, y=0),
     seg(-228, -258, 5, 3, ramp=2.5), seg(-258, -278, 5, 3, y=2.5, jump=True),
     seg(-292, -322, 5, 0, y=0), seg(-322, -352, 5, 0, ramp=2.0),
     seg(-352, -372, 5, 0, y=2.0, jump=True), seg(-386, -416, 6, 0, y=0),
     seg(-416, -440, 8, 0, ramp=1.5), seg(-440, -460, 8, 0, y=1.5)],
    [coin(-30, 0, 2.2), coin(-55, 3, 3.5), coin(-80, 3, 4.5), coin(-97, 3, 5.0),
     coin(-119, 3, 2.2), coin(-149, -3, 3.5), coin(-174, -3, 4.0), coin(-194, -3, 4.5),
     coin(-214, -3, 2.2), coin(-243, 3, 3.5), coin(-268, 3, 4.0), coin(-307, 0, 2.2),
     coin(-337, 0, 3.0), coin(-362, 0, 3.5), coin(-401, 0, 2.2), coin(-430, 0, 3.0)],
    [checkpoint(-130, 3), checkpoint(-210, -3), checkpoint(-340, 0),
     speed_boost(-50, 0, 14), brake_pad(-120, 3), brake_pad(-280, 3), brake_pad(-380, 0),
     spike(-100, 3, 5, 2), spike(-180, -3, 5, 2), spike(-260, 3, 5, 2)], -460)

# ═══════════════════════════════════════════════════════════════════════════════
# WORLD 2
# ═══════════════════════════════════════════════════════════════════════════════
levels["2-1"] = make_level(
    "Icebreaker", 8.0, 38.0,
    [seg(0, -40, 10, 0, 0), seg(-40, -75, 9, 2, ramp=2.0, ice=True), seg(-75, -105, 9, 2, y=2.0, ice=True),
     seg(-105, -135, 8, -2, ramp=-2.0, ice=True), seg(-135, -165, 8, -2, y=0, ice=True),
     seg(-165, -195, 8, 0, ramp=1.5), seg(-195, -220, 8, 0, y=1.5),
     seg(-220, -245, 8, 0, jump=True), seg(-257, -290, 8, 0, y=0),
     seg(-290, -320, 8, 0, ramp=1.5), seg(-320, -340, 8, 0, y=1.0)],
    [coin(-30, 0, 2.2), coin(-57, 2, 3.5), coin(-90, 2, 4.0), coin(-120, -2, 3.5),
     coin(-150, -2, 2.2), coin(-180, 0, 2.5), coin(-210, 0, 3.0), coin(-232, 0, 4.0),
     coin(-273, 0, 2.2), coin(-305, 0, 2.5)],
    [checkpoint(-140, -2), checkpoint(-260, 0), speed_boost(-50, 0, 14), brake_pad(-120, 2)], -340)

levels["2-2"] = make_level(
    "Drift King", 9.0, 42.0,
    [seg(0, -40, 10, 0, 0), seg(-40, -70, 9, 3, ramp=2.0, ice=True), seg(-70, -95, 8, 3, y=2.0, ice=True),
     seg(-95, -120, 8, 3, jump=True, ice=True), seg(-134, -164, 8, 3, y=0, ice=True),
     seg(-164, -194, 8, -3, ramp=-2.5, ice=True), seg(-194, -219, 7, -3, y=0, ice=True),
     seg(-219, -244, 7, -3, jump=True, ice=True), seg(-258, -288, 7, -3, y=0),
     seg(-288, -318, 7, 3, ramp=2.5), seg(-318, -343, 8, 3, y=2.0),
     seg(-343, -368, 8, 0, ramp=-1.5), seg(-368, -390, 8, 0, y=0.5)],
    [coin(-30, 0, 2.2), coin(-55, 3, 3.5), coin(-82, 3, 4.0), coin(-107, 3, 4.5),
     coin(-127, 3, 5.0), coin(-149, 3, 2.2), coin(-179, -3, 3.5), coin(-206, -3, 4.0),
     coin(-231, -3, 4.5), coin(-273, -3, 2.2), coin(-303, 3, 3.5), coin(-328, 3, 4.0),
     coin(-355, 0, 2.2), coin(-380, 0, 2.5)],
    [checkpoint(-140, 3), checkpoint(-270, -3), speed_boost(-50, 0, 14), brake_pad(-110, 3),
     brake_pad(-230, -3), brake_pad(-340, 3)], -390)

levels["2-3"] = make_level(
    "Velocity Check", 10.0, 44.0,
    [seg(0, -40, 10, 0, 0), seg(-40, -65, 8, 0, ramp=2.5, ice=True), seg(-65, -85, 8, 0, y=2.5, jump=True, ice=True),
     seg(-101, -131, 7, 2, y=0, ice=True), seg(-131, -156, 7, 2, ramp=2.5, ice=True),
     seg(-156, -176, 6, 2, y=2.5, jump=True, ice=True), seg(-192, -222, 6, -2, y=0),
     seg(-222, -247, 6, -2, ramp=2.5), seg(-247, -267, 6, -2, y=2.5, jump=True),
     seg(-283, -313, 7, 0, y=0), seg(-313, -338, 8, 0, ramp=-2.0),
     seg(-338, -358, 8, 0, y=-2.0), seg(-358, -380, 8, 0, ramp=1.5), seg(-380, -400, 8, 0, y=0)],
    [coin(-30, 0, 2.2), coin(-52, 0, 4.0), coin(-75, 0, 5.0), coin(-82, 0, 5.5),
     coin(-116, 2, 2.2), coin(-143, 2, 3.5), coin(-166, 2, 4.5), coin(-174, 2, 5.0),
     coin(-207, -2, 2.2), coin(-234, -2, 3.5), coin(-257, -2, 4.5), coin(-267, -2, 5.0),
     coin(-298, 0, 2.2), coin(-325, 0, 3.0), coin(-348, 0, 1.0), coin(-370, 0, 2.2), coin(-390, 0, 2.5)],
    [checkpoint(-140, 2), checkpoint(-260, -2), speed_boost(-50, 0, 18), brake_pad(-120, 2),
     brake_pad(-240, -2), bumper(-180, -2, 18), hoop(-85, 0, 6.5, 18)], -400)

levels["2-4"] = make_level(
    "Glacier Spiral", 11.0, 48.0,
    [seg(0, -40, 10, 0, 0), seg(-40, -70, 9, 2, ramp=2.0, ice=True), seg(-70, -95, 8, 2, y=2.0, ice=True),
     seg(-95, -115, 8, 2, jump=True, ice=True), seg(-129, -159, 8, 2, y=0, ice=True),
     seg(-159, -189, 7, -2, ramp=-2.5, ice=True), seg(-189, -214, 7, -2, y=0, ice=True),
     seg(-214, -234, 7, -2, jump=True, ice=True), seg(-248, -278, 7, -2, y=0, ice=True),
     seg(-278, -308, 6, 3, ramp=2.5, ice=True), seg(-308, -333, 6, 3, y=2.5, ice=True),
     seg(-333, -358, 6, 3, jump=True), seg(-372, -402, 7, 0, y=0),
     seg(-402, -430, 8, 0, ramp=1.5), seg(-430, -450, 8, 0, y=1.0)],
    [coin(-30, 0, 2.2), coin(-55, 2, 3.5), coin(-82, 2, 4.0), coin(-105, 2, 4.5),
     coin(-122, 2, 5.0), coin(-144, 2, 2.2), coin(-174, -2, 3.5), coin(-201, -2, 4.0),
     coin(-226, -2, 4.5), coin(-243, -2, 5.0), coin(-273, -2, 2.2), coin(-293, 3, 3.5),
     coin(-320, 3, 4.0), coin(-345, 3, 4.5), coin(-362, 3, 5.0), coin(-387, 0, 2.2),
     coin(-415, 0, 3.0), coin(-440, 0, 2.5)],
    [checkpoint(-140, 2), checkpoint(-280, -2), checkpoint(-380, 3),
     speed_boost(-50, 0, 14), brake_pad(-120, 2), brake_pad(-250, -2), brake_pad(-360, 3),
     hoop(-129, 2, 3.3)], -450)

levels["2-5"] = make_level(
    "Drift Gauntlet", 10.0, 50.0,
    [seg(0, -40, 10, 0, 0), seg(-40, -70, 8, 3, ramp=2.5, ice=True), seg(-70, -90, 7, 3, y=2.5, ice=True),
     seg(-90, -110, 7, 3, jump=True, ice=True), seg(-124, -154, 7, 3, y=0, ice=True),
     seg(-154, -184, 7, -3, ramp=-2.5, ice=True), seg(-184, -204, 6, -3, y=0, ice=True),
     seg(-204, -224, 6, -3, jump=True, ice=True), seg(-238, -268, 6, -3, y=0, ice=True),
     seg(-268, -298, 6, 3, ramp=2.5, ice=True), seg(-298, -318, 6, 3, y=2.5, ice=True),
     seg(-318, -338, 6, 3, jump=True, ice=True), seg(-352, -382, 7, 0, y=0),
     seg(-382, -410, 8, 0, ramp=-1.5), seg(-410, -430, 8, 0, y=0.5)],
    [coin(-30, 0, 2.2), coin(-55, 3, 3.5), coin(-80, 3, 4.5), coin(-97, 3, 5.0),
     coin(-119, 3, 2.2), coin(-149, -3, 3.5), coin(-174, -3, 4.0), coin(-194, -3, 4.5),
     coin(-214, -3, 5.0), coin(-233, -3, 2.2), coin(-263, -3, 2.2), coin(-283, 3, 3.5),
     coin(-308, 3, 4.0), coin(-328, 3, 4.5), coin(-345, 3, 5.0), coin(-367, 0, 2.2),
     coin(-395, 0, 2.5), coin(-420, 0, 2.2)],
    [checkpoint(-140, 3), checkpoint(-270, -3), checkpoint(-380, 0),
     speed_boost(-50, 0, 14), brake_pad(-120, 3), brake_pad(-240, -3), brake_pad(-360, 3),
     spike(-100, 3, 5, 2), spike(-180, -3, 5, 2), spike(-260, -3, 5, 2)], -430)

levels["2-6"] = make_level(
    "Avalanche", 12.0, 56.0,
    [seg(0, -40, 10, 0, 0), seg(-40, -65, 8, 0, ramp=3.0, ice=True), seg(-65, -85, 8, 0, y=3.0, jump=True, ice=True),
     seg(-101, -131, 7, 2, y=0, ice=True), seg(-131, -156, 7, 2, ramp=2.5, ice=True),
     seg(-156, -176, 6, 2, y=2.5, jump=True, ice=True), seg(-192, -222, 6, -2, y=0, ice=True),
     seg(-222, -247, 6, -2, ramp=2.5, ice=True), seg(-247, -267, 5, -2, y=2.5, jump=True, ice=True),
     seg(-283, -313, 5, 0, y=0, ice=True), seg(-313, -338, 5, 0, ramp=2.0),
     seg(-338, -358, 5, 0, y=2.0, jump=True), seg(-374, -404, 6, 0, y=0),
     seg(-404, -430, 7, 0, ramp=-1.5), seg(-430, -450, 8, 0, y=0.5)],
    [coin(-30, 0, 2.2), coin(-52, 0, 4.0), coin(-75, 0, 5.0), coin(-82, 0, 5.5),
     coin(-116, 2, 2.2), coin(-143, 2, 3.5), coin(-166, 2, 4.5), coin(-174, 2, 5.0),
     coin(-207, -2, 2.2), coin(-234, -2, 3.5), coin(-257, -2, 4.5), coin(-267, -2, 5.0),
     coin(-298, 0, 2.2), coin(-325, 0, 3.0), coin(-348, 0, 4.0), coin(-358, 0, 4.5),
     coin(-389, 0, 2.2), coin(-417, 0, 2.5), coin(-440, 0, 2.2)],
    [checkpoint(-140, 2), checkpoint(-260, -2), checkpoint(-380, 0),
     speed_boost(-50, 0, 16), brake_pad(-120, 2), brake_pad(-240, -2), brake_pad(-360, 0),
     spike(-100, 2, 5, 2), spike(-180, -2, 5, 2), spike(-260, -2, 5, 2), spike(-340, 0, 5, 2),
     hoop(-85, 0, 6.5, 18), hoop(-192, -2, 3.3)], -450)

# ═══════════════════════════════════════════════════════════════════════════════
# WORLD 3
# ═══════════════════════════════════════════════════════════════════════════════
levels["3-1"] = make_level(
    "Featherweight", 9.0, 42.0,
    [seg(0, -40, 10, 0, 0), seg(-40, -70, 8, 0, ramp=2.5), seg(-70, -90, 8, 0, y=2.5, jump=True),
     seg(-108, -138, 8, 2, y=0), seg(-138, -163, 8, 2, ramp=2.5),
     seg(-163, -183, 7, 2, y=2.5, jump=True), seg(-201, -231, 7, -2, y=0),
     seg(-231, -256, 7, -2, ramp=2.5), seg(-256, -276, 7, -2, y=2.5, jump=True),
     seg(-294, -324, 8, 0, y=0), seg(-324, -349, 8, 0, ramp=-2.0),
     seg(-349, -369, 8, 0, y=-2.0), seg(-369, -390, 8, 0, ramp=1.5), seg(-390, -410, 8, 0, y=0)],
    [coin(-30, 0, 2.2), coin(-52, 0, 4.0), coin(-75, 0, 5.0), coin(-82, 0, 5.5),
     coin(-123, 2, 2.2), coin(-150, 2, 3.5), coin(-173, 2, 4.5), coin(-183, 2, 5.0),
     coin(-216, -2, 2.2), coin(-243, -2, 3.5), coin(-266, -2, 4.5), coin(-276, -2, 5.0),
     coin(-309, 0, 2.2), coin(-336, 0, 3.0), coin(-359, 0, 1.0), coin(-380, 0, 2.2), coin(-400, 0, 2.5)],
    [checkpoint(-140, 2), checkpoint(-260, -2), gravity(-90, 0, 3, 1.0, 120), gravity(-200, 0, 3, 1.0, 120),
     speed_boost(-50, 0, 14), brake_pad(-130, 2), brake_pad(-250, -2)], -410)

levels["3-2"] = make_level(
    "Heavy Metal", 7.0, 46.0,
    [seg(0, -40, 10, 0, 0), seg(-40, -70, 8, 0, ramp=-2.0), seg(-70, -95, 8, 0, y=-2.0),
     seg(-95, -115, 8, 0, jump=True), seg(-131, -161, 8, 2, y=0),
     seg(-161, -186, 8, 2, ramp=2.5), seg(-186, -206, 7, 2, y=2.5, jump=True),
     seg(-222, -252, 7, -2, y=0), seg(-252, -277, 7, -2, ramp=2.5),
     seg(-277, -297, 7, -2, y=2.5, jump=True), seg(-313, -343, 8, 0, y=0),
     seg(-343, -368, 8, 0, ramp=-1.5), seg(-368, -388, 8, 0, y=-1.5),
     seg(-388, -410, 8, 0, ramp=1.5), seg(-410, -430, 8, 0, y=0)],
    [coin(-30, 0, 2.2), coin(-52, 0, 1.0), coin(-80, 0, 1.0), coin(-97, 0, 2.2),
     coin(-123, 2, 2.2), coin(-148, 2, 3.5), coin(-171, 2, 4.5), coin(-181, 2, 5.0),
     coin(-214, -2, 2.2), coin(-241, -2, 3.5), coin(-264, -2, 4.5), coin(-274, -2, 5.0),
     coin(-298, 0, 2.2), coin(-328, 0, 3.0), coin(-353, 0, 1.0), coin(-378, 0, 1.0),
     coin(-400, 0, 2.2), coin(-420, 0, 2.5)],
    [checkpoint(-140, 2), checkpoint(-260, -2), gravity(-50, 0, 0, 2.5, 100), gravity(-160, 0, 0, 2.5, 100),
     speed_boost(-50, 0, 18), speed_boost(-160, 2, 16), speed_boost(-280, -2, 16),
     bumper(-210, -2, 18), bumper(-220, 0, 18)], -430)

levels["3-3"] = make_level(
    "Lunar Leaps", 9.0, 50.0,
    [seg(0, -40, 10, 0, 0), seg(-40, -65, 8, 0, ramp=2.5), seg(-65, -85, 8, 0, y=2.5, jump=True),
     seg(-105, -135, 8, 2, y=0), seg(-135, -160, 8, 2, ramp=2.5),
     seg(-160, -180, 7, 2, y=2.5, jump=True), seg(-200, -230, 7, -2, y=0),
     seg(-230, -255, 7, -2, ramp=2.5), seg(-255, -275, 7, -2, y=2.5, jump=True),
     seg(-295, -325, 7, 0, y=0), seg(-325, -350, 7, 0, ramp=2.5),
     seg(-350, -370, 7, 0, y=2.5, jump=True), seg(-390, -420, 8, 0, y=0),
     seg(-420, -445, 8, 0, ramp=-2.0), seg(-445, -465, 8, 0, y=-2.0),
     seg(-465, -490, 8, 0, ramp=1.5), seg(-490, -510, 8, 0, y=0)],
    [coin(-30, 0, 2.2), coin(-52, 0, 4.0), coin(-75, 0, 5.0), coin(-82, 0, 5.5),
     coin(-120, 2, 2.2), coin(-147, 2, 3.5), coin(-170, 2, 4.5), coin(-180, 2, 5.0),
     coin(-215, -2, 2.2), coin(-242, -2, 3.5), coin(-265, -2, 4.5), coin(-275, -2, 5.0),
     coin(-310, 0, 2.2), coin(-337, 0, 3.0), coin(-360, 0, 4.0), coin(-370, 0, 4.5),
     coin(-405, 0, 2.2), coin(-432, 0, 3.0), coin(-455, 0, 1.0), coin(-480, 0, 2.2), coin(-500, 0, 2.5)],
    [checkpoint(-140, 2), checkpoint(-270, -2), checkpoint(-420, 0),
     gravity(-80, 0, 3, 1.0, 140), gravity(-200, 0, 3, 1.0, 140), gravity(-340, 0, 3, 1.0, 140),
     speed_boost(-50, 0, 16), brake_pad(-140, 2), brake_pad(-280, -2), brake_pad(-430, 0)], -510)

levels["3-4"] = make_level(
    "Zero-G Gauntlet", 8.0, 52.0,
    [seg(0, -40, 10, 0, 0), seg(-40, -70, 8, 0, ramp=2.5), seg(-70, -90, 8, 0, y=2.5, jump=True),
     seg(-108, -138, 8, 2, y=0), seg(-138, -163, 8, 2, ramp=2.5),
     seg(-163, -183, 7, 2, y=2.5, jump=True), seg(-201, -231, 7, -2, y=0),
     seg(-231, -256, 7, -2, ramp=2.5), seg(-256, -276, 7, -2, y=2.5, jump=True),
     seg(-294, -324, 7, 0, y=0), seg(-324, -349, 7, 0, ramp=2.5),
     seg(-349, -369, 7, 0, y=2.5, jump=True), seg(-387, -417, 8, 0, y=0),
     seg(-417, -442, 8, 0, ramp=-2.0), seg(-442, -462, 8, 0, y=-2.0),
     seg(-462, -485, 8, 0, ramp=1.5), seg(-485, -505, 8, 0, y=0)],
    [coin(-30, 0, 2.2), coin(-52, 0, 4.0), coin(-75, 0, 5.0), coin(-82, 0, 5.5),
     coin(-123, 2, 2.2), coin(-150, 2, 3.5), coin(-173, 2, 4.5), coin(-183, 2, 5.0),
     coin(-216, -2, 2.2), coin(-243, -2, 3.5), coin(-266, -2, 4.5), coin(-276, -2, 5.0),
     coin(-309, 0, 2.2), coin(-336, 0, 3.0), coin(-359, 0, 4.0), coin(-369, 0, 4.5),
     coin(-402, 0, 2.2), coin(-429, 0, 3.0), coin(-452, 0, 1.0), coin(-475, 0, 2.2), coin(-495, 0, 2.5)],
    [checkpoint(-140, 2), checkpoint(-270, -2), checkpoint(-420, 0),
     gravity(-60, 0, 3, 1.0, 160), gravity(-180, 0, 3, 1.0, 160), gravity(-320, 0, 3, 1.0, 160), gravity(-440, 0, 3, 1.0, 160),
     speed_boost(-50, 0, 16), speed_boost(-200, 0, 18), brake_pad(-140, 2), brake_pad(-280, -2)], -505)

levels["3-5"] = make_level(
    "Gravity Gauntlet", 9.0, 54.0,
    [seg(0, -40, 10, 0, 0), seg(-40, -70, 8, 3, ramp=2.5), seg(-70, -90, 7, 3, y=2.5, jump=True),
     seg(-108, -138, 7, 3, y=0), seg(-138, -163, 7, -3, ramp=-2.5),
     seg(-163, -183, 6, -3, y=0, jump=True), seg(-201, -231, 6, -3, y=0),
     seg(-231, -256, 6, 3, ramp=2.5), seg(-256, -276, 6, 3, y=2.5, jump=True),
     seg(-294, -324, 7, 0, y=0), seg(-324, -349, 7, 0, ramp=-2.5),
     seg(-349, -369, 7, 0, y=0), seg(-369, -390, 8, 0, ramp=1.5), seg(-390, -410, 8, 0, y=1.5)],
    [coin(-30, 0, 2.2), coin(-55, 3, 3.5), coin(-80, 3, 4.5), coin(-97, 3, 5.0),
     coin(-119, 3, 2.2), coin(-149, -3, 3.5), coin(-174, -3, 4.0), coin(-194, -3, 4.5),
     coin(-214, -3, 5.0), coin(-243, 3, 2.2), coin(-268, 3, 3.5), coin(-288, 3, 4.0),
     coin(-309, 0, 2.2), coin(-336, 0, 3.0), coin(-359, 0, 1.0), coin(-380, 0, 2.2), coin(-400, 0, 2.5)],
    [checkpoint(-130, 3), checkpoint(-250, -3), checkpoint(-340, 0),
     gravity(-60, 0, 0, 2.5, 80), gravity(-170, 0, 1, 2.0, 80), gravity(-280, 0, 0, 2.5, 80), gravity(-360, 0, 1, 2.0, 80),
     speed_boost(-50, 0, 14), brake_pad(-120, 3), brake_pad(-240, -3), brake_pad(-350, 0),
     bumper(-220, -3, 18), spike(-100, 3, 5, 2), spike(-180, -3, 5, 2), spike(-280, 3, 5, 2),
     hoop(-138, 3, 3.8), hoop(-180, -3, 5.3, 18)], -410)

levels["3-6"] = make_level(
    "Gravity Maze", 10.0, 60.0,
    [seg(0, -40, 10, 0, 0), seg(-40, -70, 7, 0, ramp=3.0), seg(-70, -90, 6, 0, y=3.0, jump=True),
     seg(-108, -138, 6, 2, y=0), seg(-138, -163, 6, 2, ramp=2.5),
     seg(-163, -183, 6, 2, y=2.5, jump=True), seg(-201, -231, 6, -2, y=0),
     seg(-231, -256, 6, -2, ramp=2.5), seg(-256, -276, 6, -2, y=2.5, jump=True),
     seg(-294, -324, 7, 0, y=0), seg(-324, -349, 7, 0, ramp=2.5),
     seg(-349, -369, 7, 0, y=2.5, jump=True), seg(-387, -417, 7, 2, y=0),
     seg(-417, -442, 7, 2, ramp=-2.5), seg(-442, -462, 8, 0, y=0),
     seg(-462, -485, 8, 0, ramp=1.5), seg(-485, -505, 8, 0, y=1.5)],
    [coin(-30, 0, 2.2), coin(-55, 0, 4.0), coin(-80, 0, 4.5), coin(-97, 0, 5.0),
     coin(-123, 2, 2.2), coin(-150, 2, 3.5), coin(-173, 2, 4.5), coin(-183, 2, 5.0),
     coin(-216, -2, 2.2), coin(-243, -2, 3.5), coin(-266, -2, 4.5), coin(-276, -2, 5.0),
     coin(-309, 0, 2.2), coin(-336, 0, 3.0), coin(-359, 0, 4.0), coin(-369, 0, 4.5),
     coin(-402, 2, 2.2), coin(-429, 2, 3.0), coin(-452, 0, 2.2), coin(-475, 0, 3.0), coin(-495, 0, 3.5)],
    [checkpoint(-130, 2), checkpoint(-270, -2), checkpoint(-430, 2),
     gravity(-50, 0, 0, 2.5, 120), gravity(-170, 0, 1, 2.0, 120), gravity(-290, 0, 3, 1.0, 120), gravity(-410, 0, 0, 2.5, 120),
     speed_boost(-50, 0, 14), speed_boost(-200, 0, 18), brake_pad(-120, 0), brake_pad(-260, -2),
     bumper(-390, 0, 18)], -505)

# ═══════════════════════════════════════════════════════════════════════════════
# WORLD 4
# ═══════════════════════════════════════════════════════════════════════════════
levels["4-1"] = make_level(
    "Bumper Garden", 9.0, 48.0,
    [seg(0, -40, 12, 0, 0), seg(-40, -75, 14, 0, ramp=2.0), seg(-75, -105, 14, 0, y=2.0),
     seg(-105, -135, 12, 0, ramp=-2.0), seg(-135, -160, 10, 0, y=0),
     seg(-160, -185, 8, 0, ramp=2.0), seg(-185, -205, 6, 0, y=2.0, jump=True),
     seg(-221, -251, 6, 2, y=0), seg(-251, -276, 6, 2, ramp=-2.0),
     seg(-276, -296, 7, 0, y=0), seg(-296, -321, 8, 0, ramp=1.5), seg(-321, -341, 8, 0, y=1.5)],
    [coin(-30, 0, 2.2), coin(-55, -4, 3.5), coin(-55, 4, 3.5), coin(-80, 0, 3.5),
     coin(-90, -5, 3.5), coin(-90, 5, 3.5), coin(-115, 0, 3.5), coin(-120, -4, 4.0), coin(-120, 4, 4.0),
     coin(-145, 0, 2.2), coin(-172, 0, 3.0), coin(-195, 0, 3.5), coin(-212, 0, 4.0),
     coin(-233, 2, 2.2), coin(-263, 2, 2.5), coin(-288, 0, 2.2), coin(-310, 0, 3.0), coin(-331, 0, 2.5)],
    [checkpoint(-130, 0), checkpoint(-240, 2), bumper(-60, -3, 18), bumper(-60, 3, 18),
     bumper(-80, 0, 20), bumper(-80, -5, 20), bumper(-80, 5, 20),
     bumper(-100, -3, 22), bumper(-100, 3, 22), bumper(-100, 0, 22),
     bumper(-120, -4, 20), bumper(-120, 4, 20), speed_boost(-50, 0, 14), brake_pad(-170, 0),
     moving_platform(-210, 0, (1,0,0), 3, 2.5), spike(-140, 0, 6, 2), spike(-260, 2, 5, 2)], -341)

levels["4-2"] = make_level(
    "Pinball Palace", 8.0, 50.0,
    [seg(0, -40, 12, 0, 0), seg(-40, -70, 14, 0, ramp=2.0), seg(-70, -100, 14, 0, y=2.0),
     seg(-100, -130, 12, 0, ramp=-2.0), seg(-130, -155, 8, 0, y=0),
     seg(-155, -180, 6, 0, ramp=2.0), seg(-180, -200, 6, 0, y=2.0, jump=True),
     seg(-216, -246, 6, 2, y=0), seg(-246, -271, 6, 2, ramp=-2.0),
     seg(-271, -291, 7, 0, y=0), seg(-291, -316, 8, 0, ramp=1.5), seg(-316, -336, 8, 0, y=1.5)],
    [coin(-30, 0, 2.2), coin(-55, -4, 3.5), coin(-55, 4, 3.5), coin(-80, 0, 3.5),
     coin(-85, -5, 3.5), coin(-85, 5, 3.5), coin(-110, 0, 3.0), coin(-110, -4, 3.0), coin(-110, 4, 3.0),
     coin(-140, 0, 2.2), coin(-165, 0, 3.0), coin(-188, 0, 3.5), coin(-208, 0, 4.0),
     coin(-228, 2, 2.2), coin(-258, 2, 2.5), coin(-278, 0, 2.2), coin(-303, 0, 3.0), coin(-326, 0, 2.5)],
    [checkpoint(-120, 0), checkpoint(-240, 2), bumper(-70, -3, 18), bumper(-70, 3, 18),
     bumper(-90, 0, 20), bumper(-90, -5, 20), bumper(-90, 5, 20),
     bumper(-110, -3, 22), bumper(-110, 3, 22), bumper(-110, 0, 22),
     speed_boost(-50, 0, 16), brake_pad(-160, 0), moving_platform(-210, 0, (1,0,0), 3, 2.5)], -336)

levels["4-3"] = make_level(
    "Bounce House", 7.0, 52.0,
    [seg(0, -40, 10, 0, 0), seg(-40, -65, 8, 0, ramp=2.5), seg(-65, -85, 8, 0, y=2.5, jump=True),
     seg(-101, -126, 8, 0, y=0), seg(-126, -151, 8, 2, ramp=2.0),
     seg(-151, -171, 7, 2, y=2.0, jump=True), seg(-187, -212, 7, -2, y=0),
     seg(-212, -237, 7, -2, ramp=2.0), seg(-237, -257, 7, -2, y=2.0, jump=True),
     seg(-273, -298, 8, 0, y=0), seg(-298, -323, 8, 0, ramp=-1.5), seg(-323, -343, 8, 0, y=0.5)],
    [coin(-30, 0, 2.2), coin(-52, 0, 4.0), coin(-72, 0, 5.0), coin(-82, 0, 5.5),
     coin(-113, 0, 2.2), coin(-138, 2, 3.0), coin(-161, 2, 4.0), coin(-171, 2, 4.5),
     coin(-199, -2, 2.2), coin(-224, -2, 3.0), coin(-247, -2, 4.0), coin(-257, -2, 4.5),
     coin(-283, 0, 2.2), coin(-308, 0, 3.0), coin(-331, 0, 2.5)],
    [checkpoint(-120, 0), checkpoint(-230, -2), bumper(-55, 0, 16), bumper(-75, -2, 16), bumper(-75, 2, 16),
     bumper(-140, 0, 18), bumper(-160, -2, 18), bumper(-160, 2, 18),
     bumper(-200, -2, 20), bumper(-220, 0, 20), speed_boost(-50, 0, 16), gravity(-130, 0, 1, 2.0, 80),
     hoop(-85, 0, 6.5, 18), hoop(-126, 0, 3.3)], -343)

levels["4-4"] = make_level(
    "Ricochet Run", 9.0, 54.0,
    [seg(0, -40, 10, 0, 0), seg(-40, -70, 7, 0, ramp=2.0), seg(-70, -90, 6, 0, y=2.0, jump=True),
     seg(-106, -136, 6, 2, y=0), seg(-136, -161, 6, 2, ramp=-1.5),
     seg(-161, -181, 5, 2, y=0.5), seg(-181, -201, 5, -2, ramp=2.0),
     seg(-201, -221, 5, -2, y=2.5, jump=True), seg(-237, -267, 5, -2, y=0),
     seg(-267, -292, 5, 0, ramp=-2.0), seg(-292, -312, 6, 0, y=0),
     seg(-312, -337, 7, 0, ramp=1.5), seg(-337, -357, 8, 0, y=1.5)],
    [coin(-30, 0, 2.2), coin(-55, 0, 3.5), coin(-78, 0, 4.5), coin(-88, 0, 5.0),
     coin(-121, 2, 2.2), coin(-148, 2, 3.0), coin(-171, 2, 2.5), coin(-191, -2, 3.5),
     coin(-211, -2, 4.5), coin(-221, -2, 5.0), coin(-247, -2, 2.2), coin(-277, 0, 3.0),
     coin(-298, 0, 2.2), coin(-324, 0, 3.0), coin(-347, 0, 2.5)],
    [checkpoint(-130, 2), checkpoint(-250, -2), bumper(-55, -2, 18), bumper(-55, 2, 18),
     bumper(-80, 0, 20), bumper(-80, -2, 20), bumper(-80, 2, 20),
     bumper(-100, -2, 22), bumper(-100, 2, 22), bumper(-150, 2, 20), bumper(-150, -2, 20),
     bumper(-200, -2, 22), bumper(-200, 2, 22), speed_boost(-50, 0, 16), brake_pad(-280, 0),
     spike(-90, 0, 5, 2), spike(-170, 2, 5, 2), spike(-210, -2, 5, 2)], -357)

levels["4-5"] = make_level(
    "Bumper Gauntlet", 9.0, 56.0,
    [seg(0, -40, 10, 0, 0), seg(-40, -65, 7, 0, ramp=2.0), seg(-65, -85, 6, 0, y=2.0, jump=True),
     seg(-101, -126, 6, 0, y=0), seg(-126, -151, 6, 2, ramp=2.0),
     seg(-151, -171, 5, 2, y=2.0, jump=True), seg(-187, -212, 5, -2, y=0),
     seg(-212, -237, 5, -2, ramp=2.0), seg(-237, -257, 5, -2, y=2.5, jump=True),
     seg(-273, -298, 6, 0, y=0), seg(-298, -323, 7, 0, ramp=-1.5), seg(-323, -343, 8, 0, y=0.5)],
    [coin(-30, 0, 2.2), coin(-52, 0, 3.5), coin(-72, 0, 4.5), coin(-82, 0, 5.0),
     coin(-113, 0, 2.2), coin(-138, 2, 3.0), coin(-161, 2, 4.0), coin(-171, 2, 4.5),
     coin(-199, -2, 2.2), coin(-224, -2, 3.0), coin(-247, -2, 4.0), coin(-257, -2, 4.5),
     coin(-283, 0, 2.2), coin(-308, 0, 3.0), coin(-331, 0, 2.5)],
    [checkpoint(-120, 0), checkpoint(-230, -2), bumper(-55, 0, 18), bumper(-70, -1.5, 18), bumper(-70, 1.5, 18),
     bumper(-90, 0, 20), bumper(-110, -1.5, 20), bumper(-110, 1.5, 20),
     bumper(-130, 0, 22), bumper(-140, -1.5, 22), bumper(-140, 1.5, 22),
     bumper(-160, 0, 20), bumper(-180, -1.5, 20), bumper(-180, 1.5, 20),
     bumper(-200, 0, 22), bumper(-220, -1.5, 22), bumper(-220, 1.5, 22),
     speed_boost(-50, 0, 16), brake_pad(-280, 0), spike(-85, 0, 5, 2), spike(-165, 2, 5, 2),
     spike(-245, -2, 5, 2), hoop(-126, 0, 3.8), hoop(-151, 2, 5.3, 18)], -343)

levels["4-6"] = make_level(
    "Bumper Hell", 10.0, 62.0,
    [seg(0, -40, 10, 0, 0), seg(-40, -65, 7, 0, ramp=2.0), seg(-65, -85, 6, 0, y=2.0, jump=True),
     seg(-101, -126, 6, 2, y=0), seg(-126, -151, 5, 2, ramp=-1.5),
     seg(-151, -171, 5, 2, y=0.5), seg(-171, -191, 5, -2, ramp=2.0),
     seg(-191, -211, 5, -2, y=2.5, jump=True), seg(-227, -252, 5, -2, y=0),
     seg(-252, -277, 5, 0, ramp=-2.0), seg(-277, -297, 6, 0, y=0),
     seg(-297, -322, 7, 0, ramp=1.5), seg(-322, -342, 8, 0, y=1.5)],
    [coin(-30, 0, 2.2), coin(-52, 0, 3.5), coin(-72, 0, 4.5), coin(-82, 0, 5.0),
     coin(-113, 2, 2.2), coin(-138, 2, 3.0), coin(-161, 2, 2.5), coin(-181, -2, 3.5),
     coin(-201, -2, 4.5), coin(-211, -2, 5.0), coin(-237, -2, 2.2), coin(-262, 0, 3.0),
     coin(-283, 0, 2.2), coin(-308, 0, 3.0), coin(-331, 0, 2.5)],
    [checkpoint(-120, 2), checkpoint(-240, -2), bumper(-55, -2, 18), bumper(-55, 2, 18),
     bumper(-70, 0, 20), bumper(-80, -2, 20), bumper(-80, 2, 20),
     bumper(-95, 0, 22), bumper(-105, -2, 22), bumper(-105, 2, 22),
     bumper(-120, 0, 20), bumper(-130, -2, 20), bumper(-130, 2, 20),
     bumper(-145, 0, 18), bumper(-155, -2, 18), bumper(-155, 2, 18),
     bumper(-170, -2, 20), bumper(-170, 2, 20), bumper(-185, 0, 22),
     bumper(-195, -2, 22), bumper(-195, 2, 22), bumper(-210, 0, 20),
     bumper(-220, -2, 20), bumper(-220, 2, 20), bumper(-235, 0, 18),
     bumper(-245, -2, 18), bumper(-245, 2, 18), speed_boost(-50, 0, 16), brake_pad(-270, 0),
     spike(-85, 0, 5, 2), spike(-165, 2, 5, 2), spike(-205, -2, 5, 2)], -342)

# ═══════════════════════════════════════════════════════════════════════════════
# WORLD 5
# ═══════════════════════════════════════════════════════════════════════════════
levels["5-1"] = make_level(
    "Crosswind Corridor", 8.0, 50.0,
    [seg(0, -40, 10, 0, 0), seg(-40, -70, 8, 3, ramp=2.0), seg(-70, -90, 7, 3, y=2.0, jump=True),
     seg(-106, -136, 7, 3, y=0), seg(-136, -166, 7, -3, ramp=-2.5),
     seg(-166, -186, 6, -3, y=0, jump=True), seg(-202, -232, 6, -3, y=0),
     seg(-232, -262, 6, 3, ramp=2.5), seg(-262, -282, 6, 3, y=2.5, jump=True),
     seg(-298, -328, 6, 0, y=0), seg(-328, -353, 7, 0, ramp=-1.5), seg(-353, -373, 8, 0, y=0.5)],
    [coin(-30, 0, 2.2), coin(-55, 3, 3.5), coin(-80, 3, 4.0), coin(-97, 3, 4.5),
     coin(-119, 3, 2.2), coin(-149, -3, 3.5), coin(-174, -3, 4.0), coin(-194, -3, 4.5),
     coin(-214, -3, 2.2), coin(-244, 3, 3.5), coin(-269, 3, 4.0), coin(-289, 3, 4.5),
     coin(-313, 0, 2.2), coin(-338, 0, 3.0), coin(-361, 0, 2.5)],
    [checkpoint(-130, 3), checkpoint(-250, -3),
     wind(-60, 0, 20, (1,0,0), 60), wind(-60, 0, 20, (-1,0,0), 60),
     wind(-140, 0, 22, (-1,0,0), 60), wind(-140, 0, 22, (1,0,0), 60),
     wind(-220, 0, 24, (1,0,0), 50), wind(-220, 0, 24, (-1,0,0), 50),
     wind(-300, 0, 26, (-1,0,0), 50), wind(-300, 0, 26, (1,0,0), 50),
     speed_boost(-50, 0, 14), brake_pad(-180, 0), brake_pad(-340, 0)], -373)

levels["5-2"] = make_level(
    "Gust Bridge", 8.0, 54.0,
    [seg(0, -40, 10, 0, 0), seg(-40, -65, 7, 0, ramp=2.0), seg(-65, -85, 6, 0, y=1.5, jump=True),
     seg(-101, -126, 6, 0, y=0), seg(-126, -151, 6, 2, ramp=2.0),
     seg(-151, -171, 5, 2, y=2.0, jump=True), seg(-187, -212, 5, -2, y=0),
     seg(-212, -237, 5, -2, ramp=2.0), seg(-237, -257, 5, -2, y=2.0, jump=True),
     seg(-273, -298, 6, 0, y=0), seg(-298, -323, 7, 0, ramp=-1.5), seg(-323, -343, 8, 0, y=0.5)],
    [coin(-30, 0, 2.2), coin(-52, 0, 3.5), coin(-72, 0, 4.5), coin(-82, 0, 5.0),
     coin(-113, 0, 2.2), coin(-138, 2, 3.0), coin(-161, 2, 4.0), coin(-171, 2, 4.5),
     coin(-199, -2, 2.2), coin(-224, -2, 3.0), coin(-247, -2, 4.0), coin(-257, -2, 4.5),
     coin(-283, 0, 2.2), coin(-308, 0, 3.0), coin(-331, 0, 2.5)],
    [checkpoint(-120, 0), checkpoint(-240, -2),
     wind(-60, 0, 20, (1,0,0), 80), wind(-60, 0, 20, (-1,0,0), 80),
     wind(-140, 0, 22, (1,0,0), 70), wind(-140, 0, 22, (-1,0,0), 70),
     wind(-220, 0, 24, (-1,0,0), 60), wind(-220, 0, 24, (1,0,0), 60),
     wind(-300, 0, 26, (1,0,0), 50), wind(-300, 0, 26, (-1,0,0), 50),
     bumper(-90, 0, 16), speed_boost(-50, 0, 14), brake_pad(-280, 0)], -343)

levels["5-3"] = make_level(
    "Crosswind", 9.0, 56.0,
    [seg(0, -40, 10, 0, 0), seg(-40, -65, 8, 0, ramp=2.0, ice=True), seg(-65, -85, 8, 0, y=2.0, ice=True),
     seg(-85, -105, 7, 0, ramp=-2.0, ice=True), seg(-105, -125, 7, 0, y=0, jump=True),
     seg(-141, -166, 6, 0, y=0), seg(-166, -191, 6, 2, ramp=2.0),
     seg(-191, -211, 5, 2, y=2.0, jump=True), seg(-227, -252, 5, -2, y=0),
     seg(-252, -277, 5, -2, ramp=2.0), seg(-277, -297, 5, -2, y=2.0, jump=True),
     seg(-313, -338, 6, 0, y=0), seg(-338, -363, 7, 0, ramp=-1.5), seg(-363, -383, 8, 0, y=0.5)],
    [coin(-30, 0, 2.2), coin(-52, 0, 3.5), coin(-72, 0, 4.5), coin(-82, 0, 5.0),
     coin(-97, 0, 2.0), coin(-115, 0, 2.2), coin(-135, 0, 3.0), coin(-153, 0, 2.2),
     coin(-178, 2, 3.0), coin(-201, 2, 4.0), coin(-211, 2, 4.5), coin(-239, -2, 2.2),
     coin(-264, -2, 3.0), coin(-287, -2, 4.0), coin(-297, -2, 4.5), coin(-325, 0, 2.2),
     coin(-348, 0, 3.0), coin(-371, 0, 2.5)],
    [checkpoint(-130, 0), checkpoint(-250, -2),
     wind(-70, 0, 20, (1,0,0), 80), wind(-70, 0, 20, (-1,0,0), 80),
     wind(-150, 0, 22, (1,0,0), 70), wind(-150, 0, 22, (-1,0,0), 70),
     wind(-230, 0, 24, (-1,0,0), 60), wind(-230, 0, 24, (1,0,0), 60),
     bumper(-100, 0, 16), bumper(-120, -1.5, 18), bumper(-120, 1.5, 18),
     bumper(-180, 2, 20), bumper(-200, -2, 20), speed_boost(-50, 0, 16), speed_boost(-180, 2, 18),
     brake_pad(-280, 0), hoop(-130, 0, 3.6), hoop(-191, 2, 5.3, 18)], -383)

levels["5-4"] = make_level(
    "Gust Garden", 8.0, 52.0,
    [seg(0, -40, 10, 0, 0), seg(-40, -70, 8, 2, ramp=2.0), seg(-70, -90, 8, 2, y=2.0, jump=True),
     seg(-106, -136, 8, 2, y=0), seg(-136, -166, 7, -2, ramp=-2.5),
     seg(-166, -186, 7, -2, y=0, jump=True), seg(-202, -232, 7, -2, y=0),
     seg(-232, -262, 7, 3, ramp=2.5), seg(-262, -282, 7, 3, y=2.5, jump=True),
     seg(-298, -328, 8, 0, y=0), seg(-328, -353, 8, 0, ramp=-1.5), seg(-353, -373, 8, 0, y=0.5)],
    [coin(-30, 0, 2.2), coin(-55, 2, 3.5), coin(-80, 2, 4.0), coin(-97, 2, 4.5),
     coin(-119, 2, 2.2), coin(-149, -2, 3.5), coin(-174, -2, 4.0), coin(-194, -2, 4.5),
     coin(-214, -2, 2.2), coin(-244, 3, 3.5), coin(-269, 3, 4.0), coin(-289, 3, 4.5),
     coin(-313, 0, 2.2), coin(-338, 0, 3.0), coin(-361, 0, 2.5)],
    [checkpoint(-130, 2), checkpoint(-250, -2),
     wind(-60, 0, 22, (1,0,0), 80), wind(-60, 0, 22, (-1,0,0), 80),
     wind(-140, 0, 24, (-1,0,0), 70), wind(-140, 0, 24, (1,0,0), 70),
     wind(-220, 0, 26, (1,0,0), 60), wind(-220, 0, 26, (-1,0,0), 60),
     bumper(-80, 0, 18), bumper(-100, -1.5, 18), bumper(-100, 1.5, 18),
     bumper(-160, -2, 20), bumper(-180, -2, 20), speed_boost(-50, 0, 14), brake_pad(-280, 0),
     spike(-90, 2, 5, 2), spike(-170, -2, 5, 2), spike(-250, 3, 5, 2), spike(-330, 0, 5, 2)], -373)

levels["5-5"] = make_level(
    "Whirlwind", 9.0, 56.0,
    [seg(0, -40, 10, 0, 0), seg(-40, -70, 8, 3, ramp=2.5), seg(-70, -90, 7, 3, y=2.5, jump=True),
     seg(-106, -136, 7, 3, y=0), seg(-136, -166, 7, -3, ramp=-2.5),
     seg(-166, -186, 6, -3, y=0, jump=True), seg(-202, -232, 6, -3, y=0),
     seg(-232, -262, 6, 3, ramp=2.5), seg(-262, -282, 6, 3, y=2.5, jump=True),
     seg(-298, -328, 6, -3, y=0), seg(-328, -358, 6, -3, ramp=-2.5),
     seg(-358, -378, 7, 0, y=0), seg(-378, -403, 8, 0, ramp=1.5), seg(-403, -423, 8, 0, y=1.5)],
    [coin(-30, 0, 2.2), coin(-55, 3, 3.5), coin(-80, 3, 4.0), coin(-97, 3, 4.5),
     coin(-119, 3, 2.2), coin(-149, -3, 3.5), coin(-174, -3, 4.0), coin(-194, -3, 4.5),
     coin(-214, -3, 2.2), coin(-244, 3, 3.5), coin(-269, 3, 4.0), coin(-289, 3, 4.5),
     coin(-313, -3, 2.2), coin(-343, -3, 3.0), coin(-368, -3, 2.5), coin(-388, 0, 2.2), coin(-413, 0, 3.0)],
    [checkpoint(-130, 3), checkpoint(-270, -3), checkpoint(-370, 0),
     wind(-50, 0, 22, (1,0,0), 60), wind(-130, 0, 22, (-1,0,0), 60),
     wind(-210, 0, 24, (1,0,0), 60), wind(-290, 0, 24, (-1,0,0), 60),
     bumper(-100, 1.5, 18), bumper(-100, -1.5, 18), speed_boost(-50, 0, 14), brake_pad(-260, 0),
     spike(-90, 3, 5, 2), spike(-170, -3, 5, 2), spike(-250, 3, 5, 2)], -423)

levels["5-6"] = make_level(
    "Perfect Storm", 10.0, 62.0,
    [seg(0, -40, 10, 0, 0), seg(-40, -65, 8, 0, ramp=2.5, ice=True), seg(-65, -85, 7, 2, y=2.5, jump=True, ice=True),
     seg(-101, -126, 7, 2, y=0, ice=True), seg(-126, -151, 6, -2, ramp=-2.5, ice=True),
     seg(-151, -171, 6, -2, y=0.5, ice=True), seg(-171, -191, 6, 3, ramp=2.0),
     seg(-191, -211, 5, 3, y=2.5, jump=True), seg(-227, -252, 5, -3, y=0),
     seg(-252, -277, 5, -3, ramp=2.5), seg(-277, -297, 5, -3, y=2.5, jump=True),
     seg(-313, -338, 6, 0, y=0), seg(-338, -363, 7, 0, ramp=-2.0),
     seg(-363, -383, 7, 0, y=-2.0), seg(-383, -403, 8, 0, ramp=1.5), seg(-403, -423, 8, 0, y=0.5)],
    [coin(-30, 0, 2.2), coin(-52, 0, 4.0), coin(-72, 2, 4.5), coin(-82, 2, 5.0),
     coin(-113, 2, 2.2), coin(-138, 2, 3.0), coin(-161, -2, 3.5), coin(-181, -2, 2.5),
     coin(-201, 3, 4.0), coin(-211, 3, 4.5), coin(-239, -3, 2.2), coin(-264, -3, 3.0),
     coin(-287, -3, 4.0), coin(-297, -3, 4.5), coin(-325, 0, 2.2), coin(-348, 0, 3.0),
     coin(-371, 0, 1.0), coin(-393, 0, 2.2), coin(-413, 0, 2.5)],
    [checkpoint(-130, 2), checkpoint(-270, -3), checkpoint(-370, 0),
     wind(-50, 0, 20, (1,0,0), 60), wind(-50, 0, 20, (-1,0,0), 60),
     wind(-130, 0, 22, (-1,0,0), 60), wind(-130, 0, 22, (1,0,0), 60),
     wind(-210, 0, 24, (1,0,0), 50), wind(-210, 0, 24, (-1,0,0), 50),
     wind(-290, 0, 26, (-1,0,0), 50), wind(-290, 0, 26, (1,0,0), 50),
     bumper(-80, 1.5, 18), bumper(-80, -1.5, 18), bumper(-160, -2, 20), bumper(-180, 0, 20),
     bumper(-240, 1.5, 22), bumper(-240, -1.5, 22), speed_boost(-45, 0, 14), brake_pad(-260, 0),
     spike(-90, 2, 5, 2), spike(-170, -2, 5, 2), spike(-250, -3, 5, 2),
     hoop(-130, 2, 3.8), hoop(-80, 2, 5.3, 16)], -423)

# ═══════════════════════════════════════════════════════════════════════════════
# WORLD 6
# ═══════════════════════════════════════════════════════════════════════════════
levels["6-1"] = make_level(
    "Magnetic Pull", 9.0, 40.0,
    [seg(0, -40, 10, 0, 0), seg(-40, -70, 9, 3, ramp=2.0), seg(-70, -90, 8, 3, y=2.0, jump=True),
     seg(-106, -136, 8, 3, y=0), seg(-136, -166, 8, -3, ramp=-2.5),
     seg(-166, -186, 7, -3, y=0, jump=True), seg(-202, -232, 7, -3, y=0),
     seg(-232, -262, 7, 3, ramp=2.5), seg(-262, -282, 7, 3, y=2.5),
     seg(-282, -302, 8, 0, ramp=-1.5), seg(-302, -322, 8, 0, y=0.5)],
    [coin(-30, 0, 2.2), coin(-55, 3, 3.5), coin(-80, 3, 4.0), coin(-97, 3, 4.5),
     coin(-119, 3, 2.2), coin(-149, -3, 3.5), coin(-174, -3, 4.0), coin(-194, -3, 4.5),
     coin(-214, -3, 2.2), coin(-244, 3, 3.5), coin(-269, 3, 4.0), coin(-292, 0, 2.2), coin(-312, 0, 2.5)],
    [checkpoint(-130, 3), checkpoint(-250, -3), magnet(-60, 3, "attract", 18, 70),
     magnet(-140, -3, "attract", 18, 70), magnet(-220, 3, "attract", 18, 70),
     speed_boost(-50, 0, 12), brake_pad(-180, 0)], -322)

levels["6-2"] = make_level(
    "Like Charges", 9.0, 42.0,
    [seg(0, -40, 10, 0, 0), seg(-40, -70, 9, 0, ramp=2.0), seg(-70, -90, 8, 0, y=2.0, jump=True),
     seg(-106, -136, 8, 2, y=0), seg(-136, -166, 8, 2, ramp=-2.5),
     seg(-166, -186, 7, 2, y=0, jump=True), seg(-202, -232, 7, -2, y=0),
     seg(-232, -262, 7, -2, ramp=2.5), seg(-262, -282, 7, -2, y=2.5, jump=True),
     seg(-298, -328, 8, 0, y=0), seg(-328, -353, 8, 0, ramp=-1.5), seg(-353, -373, 8, 0, y=0.5)],
    [coin(-30, 0, 2.2), coin(-55, 0, 3.5), coin(-78, 0, 4.5), coin(-88, 0, 5.0),
     coin(-121, 2, 2.2), coin(-148, 2, 3.0), coin(-171, 2, 2.5), coin(-191, -2, 3.5),
     coin(-211, -2, 4.5), coin(-221, -2, 5.0), coin(-247, -2, 2.2), coin(-277, -2, 3.0),
     coin(-298, 0, 2.2), coin(-313, 0, 3.0), coin(-338, 0, 2.5)],
    [checkpoint(-130, 2), checkpoint(-250, -2), magnet(-70, 0, "repel", 20, 60),
     magnet(-150, 0, "repel", 22, 70), magnet(-230, 0, "repel", 20, 60),
     speed_boost(-50, 0, 14), brake_pad(-180, 0), spike(-90, 0, 5, 2), spike(-170, 2, 5, 2)], -373)

levels["6-3"] = make_level(
    "Field Lines", 9.0, 46.0,
    [seg(0, -40, 10, 0, 0), seg(-40, -70, 8, 3, ramp=2.0), seg(-70, -90, 7, 3, y=2.0, jump=True),
     seg(-106, -136, 7, 3, y=0), seg(-136, -166, 7, -3, ramp=-2.5),
     seg(-166, -186, 6, -3, y=0, jump=True), seg(-202, -232, 6, -3, y=0),
     seg(-232, -262, 6, 3, ramp=2.5), seg(-262, -282, 6, 3, y=2.5, jump=True),
     seg(-298, -328, 7, 0, y=0), seg(-328, -353, 7, 0, ramp=-1.5), seg(-353, -373, 8, 0, y=0.5)],
    [coin(-30, 0, 2.2), coin(-55, 3, 3.5), coin(-80, 3, 4.0), coin(-97, 3, 4.5),
     coin(-119, 3, 2.2), coin(-149, -3, 3.5), coin(-174, -3, 4.0), coin(-194, -3, 4.5),
     coin(-214, -3, 2.2), coin(-244, 3, 3.5), coin(-269, 3, 4.0), coin(-289, 3, 4.5),
     coin(-313, 0, 2.2), coin(-338, 0, 3.0), coin(-361, 0, 2.5)],
    [checkpoint(-130, 3), checkpoint(-250, -3), magnet(-60, 0, "attract", 18, 70),
     magnet(-140, 0, "repel", 20, 70), magnet(-220, 0, "attract", 18, 70), magnet(-300, 0, "repel", 20, 70),
     speed_boost(-50, 0, 12), brake_pad(-180, 0), brake_pad(-340, 0),
     hoop(-130, 3, 3.8), hoop(-60, 0, 3.8, 16)], -373)

levels["6-4"] = make_level(
    "Polarity Shift", 9.0, 50.0,
    [seg(0, -40, 10, 0, 0), seg(-40, -70, 8, 3, ramp=2.0), seg(-70, -90, 7, 3, y=2.0, jump=True),
     seg(-106, -136, 7, 3, y=0), seg(-136, -166, 7, -3, ramp=-2.5),
     seg(-166, -186, 6, -3, y=0, jump=True), seg(-202, -232, 6, -3, y=0),
     seg(-232, -262, 6, 3, ramp=2.5), seg(-262, -282, 6, 3, y=2.5, jump=True),
     seg(-298, -328, 6, -3, y=0), seg(-328, -358, 6, -3, ramp=-2.5),
     seg(-358, -378, 7, 0, y=0), seg(-378, -403, 8, 0, ramp=1.5), seg(-403, -423, 8, 0, y=1.5)],
    [coin(-30, 0, 2.2), coin(-55, 3, 3.5), coin(-80, 3, 4.0), coin(-97, 3, 4.5),
     coin(-119, 3, 2.2), coin(-149, -3, 3.5), coin(-174, -3, 4.0), coin(-194, -3, 4.5),
     coin(-214, -3, 2.2), coin(-244, 3, 3.5), coin(-269, 3, 4.0), coin(-289, 3, 4.5),
     coin(-313, -3, 2.2), coin(-343, -3, 3.0), coin(-368, -3, 2.5), coin(-388, 0, 2.2), coin(-413, 0, 3.0)],
    [checkpoint(-130, 3), checkpoint(-250, -3), checkpoint(-370, 0),
     magnet(-60, 0, "attract", 20, 70), magnet(-140, 0, "repel", 22, 60),
     magnet(-220, 0, "attract", 20, 70), magnet(-300, 0, "repel", 22, 60),
     speed_boost(-50, 0, 14), brake_pad(-180, 0), brake_pad(-340, 0)], -423)

levels["6-5"] = make_level(
    "Ironclad Gauntlet", 8.0, 54.0,
    [seg(0, -40, 10, 0, 0), seg(-40, -70, 8, 0, ramp=2.5), seg(-70, -90, 7, 0, y=2.5, jump=True),
     seg(-106, -131, 7, 2, y=0), seg(-131, -156, 7, 2, ramp=2.0),
     seg(-156, -176, 6, 2, y=2.0, jump=True), seg(-192, -217, 6, -2, y=0),
     seg(-217, -242, 6, -2, ramp=2.0), seg(-242, -262, 6, -2, y=2.5, jump=True),
     seg(-278, -303, 6, 0, y=0), seg(-303, -328, 6, 0, ramp=-2.0),
     seg(-328, -348, 7, 0, y=0), seg(-348, -368, 7, 0, ramp=1.5), seg(-368, -388, 8, 0, y=1.5)],
    [coin(-30, 0, 2.2), coin(-52, 0, 3.5), coin(-72, 0, 4.5), coin(-82, 0, 5.0),
     coin(-113, 2, 2.2), coin(-138, 2, 3.0), coin(-161, 2, 4.0), coin(-171, 2, 4.5),
     coin(-199, -2, 2.2), coin(-224, -2, 3.0), coin(-247, -2, 4.0), coin(-257, -2, 4.5),
     coin(-283, 0, 2.2), coin(-308, 0, 3.0), coin(-331, 0, 2.5), coin(-353, 0, 3.0), coin(-373, 0, 2.5)],
    [checkpoint(-120, 2), checkpoint(-240, -2), checkpoint(-340, 0),
     magnet(-55, 3, "attract", 18, 50), magnet(-100, -2, "repel", 20, 50),
     wind(-140, 0, 18, (1,0,0), 60), wind(-180, 0, 18, (-1,0,0), 60),
     bumper(-160, 1.5, 18), bumper(-160, -1.5, 18), speed_boost(-45, 0, 14), brake_pad(-280, 0),
     spike(-90, 0, 6, 2), spike(-170, 2, 5, 2), spike(-250, -2, 5, 2), spike(-330, 0, 5, 2),
     hoop(-80, 0, 4.3), hoop(-130, 0, 4.8, 18)], -388)

levels["6-6"] = make_level(
    "Entropy", 9.0, 64.0,
    [seg(0, -40, 10, 0, 0), seg(-40, -70, 8, 0, ramp=2.5, ice=True), seg(-70, -90, 7, 2, y=2.5, jump=True, ice=True),
     seg(-106, -131, 7, 2, y=0, ice=True), seg(-131, -156, 6, -2, ramp=-2.5),
     seg(-156, -176, 6, -2, y=0, jump=True), seg(-192, -217, 6, -2, y=0),
     seg(-217, -242, 5, 3, ramp=2.5), seg(-242, -262, 5, 3, y=2.5, jump=True),
     seg(-278, -303, 5, -3, y=0), seg(-303, -328, 5, -3, ramp=-2.5),
     seg(-328, -348, 5, -3, y=0.5, jump=True), seg(-364, -389, 6, 0, y=0),
     seg(-389, -414, 6, 0, ramp=2.0), seg(-414, -434, 6, 0, y=2.0, jump=True),
     seg(-450, -475, 7, 0, y=0), seg(-475, -500, 8, 0, ramp=-2.0),
     seg(-500, -520, 8, 0, y=-2.0), seg(-520, -545, 8, 0, ramp=1.5),
     seg(-545, -565, 8, 0, y=1.5)],
    [coin(-30, 0, 2.2), coin(-52, 0, 4.0), coin(-72, 2, 4.5), coin(-82, 2, 5.0),
     coin(-113, 2, 2.2), coin(-138, 2, 3.0), coin(-161, -2, 3.5), coin(-181, -2, 2.5),
     coin(-201, -2, 4.0), coin(-211, -2, 4.5), coin(-224, 3, 2.2), coin(-247, 3, 3.0),
     coin(-267, 3, 4.0), coin(-277, 3, 4.5), coin(-298, -3, 2.2), coin(-323, -3, 3.0),
     coin(-343, -3, 2.5), coin(-372, 0, 2.2), coin(-397, 0, 3.0), coin(-419, 0, 4.0),
     coin(-429, 0, 4.5), coin(-457, 0, 2.2), coin(-482, 0, 3.0), coin(-505, 0, 1.0),
     coin(-525, 0, 2.2), coin(-550, 0, 3.0)],
    [checkpoint(-130, 2), checkpoint(-270, -3), checkpoint(-420, 0),
     magnet(-60, 3, "attract", 18, 50), magnet(-100, -2, "repel", 20, 50),
     wind(-140, 0, 18, (1,0,0), 60), wind(-180, 0, 18, (-1,0,0), 60),
     bumper(-160, 0, 18), bumper(-180, 1.5, 20), bumper(-180, -1.5, 20),
     bumper(-200, 0, 22), gravity(-280, 0, 0, 2.0, 80), gravity(-360, 0, 1, 2.0, 80),
     speed_boost(-45, 0, 16), speed_boost(-200, 0, 18), speed_boost(-380, 0, 18),
     brake_pad(-120, 2), brake_pad(-240, 3), brake_pad(-380, 0), brake_pad(-520, 0),
     hoop(-130, 2, 3.8), hoop(-220, 3, 5.3, 18)], -565)

parts = []
for i in range(1, 7):
    parts.append('\t# ═══════════════════════════════════════════════════════════════════════════')
    themes = ["Gravity & Motion (green, gentle slopes, learn to roll)",
              "Friction & Ice (blue, ice patches, speed control)",
              "Variable Gravity (orange/purple, gravity zones)",
              "Collisions & Energy (red, bumpers, moving platforms)",
              "All Forces Combined (purple, the ultimate test)",
              "Magnetism & Polarity (cyan/teal)"]
    parts.append('\t# WORLD %d — %s' % (i, themes[i-1]))
    parts.append('\t# ═══════════════════════════════════════════════════════════════════════════')
    for j in range(1, 7):
        key = "%d-%d" % (i, j)
        parts.append(fmt_level(key, levels[key]))

with open(r"C:\Users\phili\OneDrive\Desktop\Physix\tools\new_levels.txt", "w", encoding="utf-8") as f:
    f.write("const LEVELS: Dictionary = {\n")
    f.write("\n".join(parts))
    f.write("\n}\n")

