import re, json, os, sys

# Export all levels from scripts/level_generator.gd to individual JSON files
# and calculate bronze/silver/gold medal times.

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

try:
    levels = eval(jt)
except Exception as e:
    print(f"Parse error: {e}")
    sys.exit(1)

os.makedirs("levels", exist_ok=True)

# ── Medal time calculation ────────────────────────────────────────────────────

def calculate_medal_times(level_key: str, level: dict) -> dict:
    """Calculate bronze/silver/gold medal times based on level geometry."""
    segments = level.get("segments", [])
    obstacles = level.get("obstacles", [])
    par_time = level.get("par_time", 30)

    # Total track length
    total_length = 0.0
    num_ice = 0
    for seg in segments:
        z0 = seg.get("z0", 0.0)
        z1 = seg.get("z1", 0.0)
        total_length += abs(z1 - z0)
        if seg.get("ice", False):
            num_ice += 1

    # Count speed-enhancing elements
    num_speed_boosts = 0
    num_hoops = 0
    num_wind = 0
    num_gravity_boost = 0  # high gravity = more traction
    num_gravity_reduce = 0  # low/zero gravity = bigger jumps/faster air time

    for obs in obstacles:
        kind = obs.get("kind", "")
        if kind == "speed_boost":
            num_speed_boosts += 1
        elif kind in ("hoop_bonus", "hoop_cp", "hoop_checkpoint"):
            num_hoops += 1
        elif kind == "wind":
            num_wind += 1
        elif kind == "gravity":
            gtype = obs.get("type", 1)
            if gtype == 0:  # BOOST / high gravity
                num_gravity_boost += 1
            elif gtype in (1, 3):  # REDUCE / ZERO
                num_gravity_reduce += 1

    # Physics model:
    # Base avg speed on flat ground with no boosts: ~10 m/s
    # Speed boosts add effective velocity (avg +1.5 m/s each)
    # Hoops add more (avg +2.0 m/s each) since they're significant
    # Ice adds speed conservation (+0.8 m/s per ice segment)
    # Low gravity helps with gaps and air time (+0.5 m/s each)

    base_speed_bronze = 8.0
    base_speed_silver = 10.0 + num_speed_boosts * 1.2 + num_hoops * 1.5 + num_ice * 0.6
    base_speed_gold = base_speed_silver * 1.3 + num_speed_boosts * 0.8 + num_hoops * 1.0

    # Wind can slow you down if it's a headwind, but we'll be generous
    # and assume the player handles it. Slight penalty.
    if num_wind > 0:
        base_speed_silver *= 0.95
        base_speed_gold *= 0.92

    # Clamp speeds to realistic bounds
    base_speed_bronze = min(base_speed_bronze, 14.0)
    base_speed_silver = min(base_speed_silver, 22.0)
    base_speed_gold = min(base_speed_gold, 30.0)

    bronze = round(total_length / base_speed_bronze + 2.0, 1)
    silver = round(total_length / base_speed_silver + 1.0, 1)
    gold = round(total_length / base_speed_gold, 1)

    # Ensure ordering: gold < silver < bronze
    gold = min(gold, silver * 0.75)
    bronze = max(bronze, silver * 1.35)

    # Round to nearest 0.5 for cleaner display
    gold = round(gold * 2) / 2
    silver = round(silver * 2) / 2
    bronze = round(bronze * 2) / 2

    return {
        "bronze": bronze,
        "silver": silver,
        "gold": gold,
        "par_time": par_time,
        "total_length": round(total_length, 1),
        "speed_boosts": num_speed_boosts,
        "hoops": num_hoops,
        "ice_segments": num_ice,
    }

# ── Export each level ─────────────────────────────────────────────────────────

for key, level in sorted(levels.items()):
    medals = calculate_medal_times(key, level)

    # Add medal data to level
    level["medal_times"] = {
        "bronze": medals["bronze"],
        "silver": medals["silver"],
        "gold": medals["gold"],
    }

    filename = f"levels/{key}.json"
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(level, f, indent=2)

    print(f"Exported {filename} | Length: {medals['total_length']}m | "
          f"Boosts: {medals['speed_boosts']} | Hoops: {medals['hoops']} | Ice: {medals['ice_segments']} | "
          f"Gold: {medals['gold']}s | Silver: {medals['silver']}s | Bronze: {medals['bronze']}s | Par: {medals['par_time']}s")

print(f"\nExported {len(levels)} levels to levels/")

# ── Generate level_generator loader ───────────────────────────────────────────

loader_code = '''extends Node3D

# Level Generator — builds tracks, walls, coins, obstacles from compact data.
# TrackRoot gets a slope rotation so gravity actually pulls the ball forward.
#
# Usage: attach to TrackRoot in a level scene. Reads world_number & level_number
# from the parent GameLevel node and builds everything in _ready().
# In the editor, use the "Build Track" button in the Inspector.

const TRACK_MAT := preload("res://scripts/track_builder.gd")

func _ready() -> void:
	# Auto-detect baked children and skip regeneration
	var has_baked := false
	for child in get_children():
		if child is StaticBody3D and child.name.begins_with("Seg_"):
			has_baked = true
			break
	if has_baked:
		_apply_materials_to_level(self)
		return

	var parent_level := get_parent()
	if parent_level == null:
		return
	var world: int = parent_level.get("world_number") if parent_level.get("world_number") != null else 1
	var level: int = parent_level.get("level_number") if parent_level.get("level_number") != null else 1
	var key: String = "%d-%d" % [world, level]

	var layout := _load_level_data(key)
	if layout.is_empty() and key == "0-0":
		var bonus_key: String = "B-%d" % parent_level.get("world_number", 1)
		layout = _load_level_data(bonus_key)

	if not layout.is_empty():
		_build_level(layout)

func _load_level_data(key: String) -> Dictionary:
	var path := "res://levels/%s.json" % key
	if FileAccess.file_exists(path):
		var file := FileAccess.open(path, FileAccess.READ)
		if file:
			var parsed = JSON.parse_string(file.get_as_text())
			if parsed is Dictionary:
				return parsed
	push_warning("Level data not found: %s" % path)
	return {}

func _build_level(layout: Dictionary) -> void:
	# Clear old geometry except the generator node itself
	for child in get_children():
		child.queue_free()
	var slope: float = layout.get("slope", 10.0)
	self.rotation = Vector3(deg_to_rad(slope), 0, 0)
	_build_segments(layout.get("segments", []))
	_build_coins(layout.get("coins", []))
	_build_finish(layout.get("finish_z", -200.0))
	_build_obstacles(layout.get("obstacles", []))
	_apply_materials_to_level(self)

func _apply_materials_to_level(node: Node) -> void:
	TRACK_MAT._apply_materials(node)
'''

# Append the rest of the builder functions
with open("tools/append_builders.py", "r") as f:
    append_text = f.read()

# Extract the builder functions from append_builders.py
# The builder code is inside a triple-quoted string
builder_start = append_text.find("builder_code = '''")
if builder_start != -1:
    builder_start += len("builder_code = '''")
    builder_end = append_text.find("'''", builder_start)
    builder_functions = append_text[builder_start:builder_end]
    loader_code += builder_functions

with open("scripts/level_generator.gd", "w", encoding="utf-8") as f:
    f.write(loader_code)

print("\nWrote new scripts/level_generator.gd (loads from levels/*.json)")

# ── Update level editor to load/save individual files ────────────────────────

print("\nNext: update level_editor.gd to load/save levels/*.json files")
