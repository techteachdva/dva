#!/usr/bin/env python3
"""Fix hoop Y placements that are too low / embedded in elevated track segments."""

path = r"C:\Users\phili\OneDrive\Desktop\Physix\scripts\level_generator.gd"

with open(path, "r", encoding="utf-8") as f:
    text = f.read()

replacements = [
    # 1-3 — embedded in jump ramps
    ('{"kind": "hoop_bonus", "z": -100, "x": 0, "y": 5.0, "boost": 18}', '{"kind": "hoop_bonus", "z": -100, "x": 0, "y": 7.5, "boost": 18}'),
    ('{"kind": "hoop_bonus", "z": -205, "x": 2, "y": 4.5, "boost": 18}', '{"kind": "hoop_bonus", "z": -205, "x": 2, "y": 6.5, "boost": 18}'),
    ('{"kind": "hoop_checkpoint", "z": -240, "x": 2, "y": 3.0}', '{"kind": "hoop_checkpoint", "z": -240, "x": 2, "y": 4.0}'),

    # 2-3 — tight / embedded
    ('{"kind": "hoop_bonus", "z": -100, "x": 0, "y": 5.5, "boost": 18}', '{"kind": "hoop_bonus", "z": -100, "x": 0, "y": 7.0, "boost": 18}'),
    ('{"kind": "hoop_checkpoint", "z": -180, "x": 0, "y": 2.0}', '{"kind": "hoop_checkpoint", "z": -180, "x": 0, "y": 4.5}'),

    # 2-4 — slightly low on elevated ice
    ('{"kind": "hoop_checkpoint", "z": -220, "x": 4, "y": 4.0}', '{"kind": "hoop_checkpoint", "z": -220, "x": 4, "y": 5.0}'),
    ('{"kind": "hoop_bonus", "z": -100, "x": 3, "y": 4.5, "boost": 16}', '{"kind": "hoop_bonus", "z": -100, "x": 3, "y": 5.5, "boost": 16}'),

    # 3-2 — embedded in jump ramp
    ('{"kind": "hoop_bonus", "z": -270, "x": 2, "y": 5.0, "boost": 18}', '{"kind": "hoop_bonus", "z": -270, "x": 2, "y": 7.5, "boost": 18}'),
    ('{"kind": "hoop_checkpoint", "z": -160, "x": 0, "y": 2.0}', '{"kind": "hoop_checkpoint", "z": -160, "x": 0, "y": 4.5}'),

    # 4-3 — tight on jump ramp
    ('{"kind": "hoop_bonus", "z": -100, "x": 0, "y": 5.5, "boost": 18}', '{"kind": "hoop_bonus", "z": -100, "x": 0, "y": 7.0, "boost": 18}'),

    # 4-5 — nearly touching track
    ('{"kind": "hoop_bonus", "z": -100, "x": 0, "y": 3.5, "boost": 18}', '{"kind": "hoop_bonus", "z": -100, "x": 0, "y": 5.5, "boost": 18}'),

    # 5-3 — tight on jump ramp
    ('{"kind": "hoop_bonus", "z": -275, "x": 0, "y": 5.0, "boost": 18}', '{"kind": "hoop_bonus", "z": -275, "x": 0, "y": 6.5, "boost": 18}'),

    # 5-6 — nearly touching track
    ('{"kind": "hoop_bonus", "z": -100, "x": 0, "y": 4.0, "boost": 16}', '{"kind": "hoop_bonus", "z": -100, "x": 0, "y": 6.0, "boost": 16}'),

    # 6-5 — nearly touching track
    ('{"kind": "hoop_checkpoint", "z": -80, "x": 0, "y": 3.5}', '{"kind": "hoop_checkpoint", "z": -80, "x": 0, "y": 5.5}'),
    ('{"kind": "hoop_bonus", "z": -130, "x": 0, "y": 3.5, "boost": 18}', '{"kind": "hoop_bonus", "z": -130, "x": 0, "y": 5.0, "boost": 18}'),
]

for old, new in replacements:
    if old in text:
        text = text.replace(old, new)
        print(f"Fixed: {old[:50]}...")
    else:
        print(f"NOT FOUND: {old[:50]}...")

with open(path, "w", encoding="utf-8") as f:
    f.write(text)

print("Done fixing hoop heights.")
