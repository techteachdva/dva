extends Node
class_name LevelFactory

# ═══════════════════════════════════════════════════════════════════════════════
# LevelFactory — Modular Procedural Level Builder for Physix
# ═══════════════════════════════════════════════════════════════════════════════
# Usage: var data := LevelFactory.generate(world, level)
#        Then write data to res://levels/{key}.json

enum LayoutType {
	STRAIGHTAWAY,
	WIDE_TO_SMALL,
	SMALL_TO_WIDE,
	CURVES,
	HILLS,
	COMBINATION,
}

# ── Difficulty Rating table ───────────────────────────────────────────────────
const OBSTACLE_DR: Dictionary = {
	"magnet":      5,
	"wind":        4,
	"spike":       3,
	"bumper":      2,
	"gravity":     2,
	"pot":         1,  # breakable reward — cheap, place many
	"brake_pad":   -1,
}

# ── World obstacle bias ───────────────────────────────────────────────────────
const WORLD_BIAS: Dictionary = {
	1: ["bumper", "spike", "pot"],              # World 1: no gravity, no magnets, no wind
	2: ["spike", "bumper", "pot"],              # ice is handled via segments
	3: ["gravity", "spike", "bumper", "pot"],
	4: ["bumper", "spike", "wind", "pot"],
	5: ["wind", "spike", "bumper", "pot"],
	6: ["magnet", "spike", "bumper", "pot"],  # World 6: Magnet Mastery
}

# ── Layout configs ──────────────────────────────────────────────────────────
const LAYOUT_CONFIGS: Dictionary = {
	# seg_count includes body segments only; opening (2) + closing (2) + runway (1) are added automatically
	LayoutType.STRAIGHTAWAY: {
		"seg_count": [14, 18],
		"length_range": [30.0, 50.0],
		"width_range": [10.0, 12.0],
		"ramp_range": [-0.5, -0.2],
		"x_shift": 0.0,
		"jump_chance": 0.0,
	},
	LayoutType.WIDE_TO_SMALL: {
		"seg_count": [14, 18],
		"length_range": [25.0, 40.0],
		"width_start": 12.0,
		"width_end": 6.0,
		"ramp_range": [-0.5, 1.5],
		"x_shift": 0.0,
		"jump_chance": 0.15,
	},
	LayoutType.SMALL_TO_WIDE: {
		"seg_count": [14, 18],
		"length_range": [25.0, 40.0],
		"width_start": 6.0,
		"width_end": 12.0,
		"ramp_range": [-0.5, 1.5],
		"x_shift": 0.0,
		"jump_chance": 0.15,
	},
	LayoutType.CURVES: {
		"seg_count": [15, 20],
		"length_range": [25.0, 40.0],
		"width_range": [8.0, 10.0],
		"ramp_range": [-0.3, 0.3],
		"x_shift": 3.0,
		"jump_chance": 0.2,
	},
	LayoutType.HILLS: {
		"seg_count": [15, 20],
		"length_range": [22.0, 35.0],
		"width_range": [8.0, 10.0],
		"ramp_range": [-2.5, 2.5],
		"x_shift": 0.0,
		"jump_chance": 0.25,
	},
	LayoutType.COMBINATION: {
		"seg_count": [16, 22],
		"length_range": [20.0, 35.0],
		"width_range": [6.0, 12.0],
		"ramp_range": [-2.5, 2.5],
		"x_shift": 3.0,
		"jump_chance": 0.3,
	},
}

# ── Hoop boost progression ────────────────────────────────────────────────────
const HOOP_BOOSTS: Array[float] = [10.0, 12.0, 14.0, 16.0, 18.0, 20.0]

# ── Zone constants ────────────────────────────────────────────────────────────
# Every level starts with an opening straightaway (acclimation) and ends with a
# closing straightaway (predictable landing). The body is the layout-specific
# excitement in between. Obstacles are never placed in opening/closing zones.
const OPENING_ZONE_SEGS: int = 2
const CLOSING_ZONE_SEGS: int = 2
const TARGET_HOOP_COUNT: int = 6
const HOOP_SPACING_MULTIPLIER: float = 1.5
const RUNWAY_SEGMENT_LENGTH: float = 50.0
# Center height above track_surface_y() — aligned with editor HOOP_HEIGHTS + torus clearance.
const HOOP_TIER_SURFACE_OFFSET: Array[float] = [0.35, 1.5, 3.0]
const HOOP_TIER_SURFACE_JITTER: Array[float] = [0.2, 0.45, 0.65]
const HOOP_MIN_SEGMENT_WIDTH: float = 7.0
const HOOP_MIN_SEGMENT_LENGTH: float = 8.0
const HOOP_MIN_ABOVE_SURFACE: float = 0.3

# ── Public API ──────────────────────────────────────────────────────────────

static func generate(world: int, level: int, seed_: int = -1, logic_world_override: int = -1) -> Dictionary:
	var rng := RandomNumberGenerator.new()
	if seed_ < 0:
		seed_ = hash("%d-%d-%d" % [world, level, Time.get_ticks_msec()])
	rng.seed = seed_

	# Secret levels default to World 1 logic unless overridden
	var logic_world: int = logic_world_override if logic_world_override > 0 else (world if world > 0 else 1)

	var layout_type := _pick_layout(world, level, rng)
	var segments := stitch_segments(_build_segments(layout_type, world, level, rng))
	var finish_z := _compute_finish_z(segments)
	# Place hoops FIRST so they get prime real-estate; obstacles avoid them.
	var hoops := _build_hoops(segments, [], world, rng, finish_z, false)
	var obstacles := _build_obstacles(segments, logic_world, level, rng, hoops)
	var par_time := _compute_par_time(segments)

	# Merge hoop checkpoints into obstacles
	var all_obstacles: Array[Dictionary] = []
	all_obstacles.append_array(obstacles)
	for h: Dictionary in hoops:
		all_obstacles.append({
			"kind": "hoop",
			"z": h.z,
			"x": h.x,
			"y": h.y,
			"boost": h.get("boost", 14.0),
		})

	var level_name := _level_name(world, level, layout_type)

	return {
		"name": level_name,
		"slope": rng.randi_range(9, 14),
		"par_time": par_time,
		"segments": segments,
		"coins": [],
		"finish_z": finish_z,
		"checkpoints": _hoop_z_positions(hoops),
		"obstacles": all_obstacles,
		"time_tiers": _par_time_tiers(par_time),
	}


static func generate_bonus(world: int, seed_: int = -1) -> Dictionary:
	var rng := RandomNumberGenerator.new()
	if seed_ < 0:
		seed_ = hash("bonus-%d-%d" % [world, Time.get_ticks_msec()])
	rng.seed = seed_

	var layout_type := LayoutType.HILLS if rng.randf() > 0.35 else LayoutType.STRAIGHTAWAY
	var body_count := rng.randi_range(12, 16)
	var segments := stitch_segments(_build_segments(layout_type, world, 0, rng, body_count))
	var finish_z := _compute_finish_z(segments)
	# Hoops first, then obstacles respect them.
	var hoops := _build_hoops(segments, [], world, rng, finish_z, true)
	var obstacles := _build_obstacles(segments, world, 0, rng, hoops)
	_add_bonus_boost_pads(segments, finish_z, obstacles, rng, hoops)

	var all_obstacles: Array[Dictionary] = []
	all_obstacles.append_array(obstacles)
	for h: Dictionary in hoops:
		all_obstacles.append({
			"kind": "hoop",
			"z": h["z"],
			"x": h["x"],
			"y": h["y"],
			"boost": h.get("boost", 14.0),
		})

	var bonus_names: Dictionary = {
		1: "Bonus: Hexa-Rush",
		2: "Bonus: Friction Hex",
		3: "Bonus: Grav-6",
		4: "Bonus: Bumper Hexagon",
		5: "Bonus: Wind Tunnel 6",
		6: "Bonus: The Ultimate Hex",
	}
	var par_time := _compute_par_time(segments)

	return {
		"name": bonus_names.get(world, "Bonus: World %d" % world),
		"slope": rng.randi_range(9, 12),
		"par_time": par_time,
		"segments": segments,
		"coins": [],
		"finish_z": finish_z,
		"checkpoints": _hoop_z_positions(hoops),
		"obstacles": all_obstacles,
		"time_tiers": _par_time_tiers(par_time),
	}


static func to_editor_import_data(layout: Dictionary) -> Dictionary:
	var segments: Array = layout.get("segments", [])
	var body_start: int = OPENING_ZONE_SEGS
	var body_end: int = maxi(body_start + 1, segments.size() - CLOSING_ZONE_SEGS - 1)
	var editor_segs: Array = []
	for i: int in range(body_start, body_end):
		if i >= segments.size():
			break
		var seg: Dictionary = segments[i]
		if seg is Dictionary:
			editor_segs.append(_factory_segment_to_editor_dict(seg as Dictionary))

	var obs: Array = []
	for item: Variant in layout.get("obstacles", []):
		if item is Dictionary:
			var compact: Dictionary = _factory_obstacle_to_editor_obs(item as Dictionary, segments)
			if not compact.is_empty():
				obs.append(compact)

	return {
		"v": "px1",
		"n": layout.get("name", "Random Level"),
		"pt": layout.get("par_time", 45.0),
		"segs": editor_segs,
		"mid_only": true,
		"obs": obs,
		"coins": [],
		"fz": layout.get("finish_z", -200.0),
	}


static func generate_random_editor_level(seed_: int = -1) -> Dictionary:
	var rng := RandomNumberGenerator.new()
	if seed_ < 0:
		seed_ = hash("editor-random-%d" % Time.get_ticks_msec())
	rng.seed = seed_
	var world: int = rng.randi_range(1, 6)
	var level: int = rng.randi_range(1, 6)
	var layout := generate(world, level, rng.randi())
	return to_editor_import_data(layout)

# ── Layout selection ──────────────────────────────────────────────────────────

static func _pick_layout(world: int, level: int, rng: RandomNumberGenerator) -> LayoutType:
	if level == 6:
		return LayoutType.COMBINATION
	# World 1: deterministic pedagogical progression
	if world == 1:
		match level:
			1: return LayoutType.STRAIGHTAWAY
			2: return LayoutType.WIDE_TO_SMALL
			3: return LayoutType.HILLS
			4:
				var w1_choices := [LayoutType.SMALL_TO_WIDE, LayoutType.STRAIGHTAWAY]
				return w1_choices[rng.randi_range(0, w1_choices.size() - 1)]
			5:
				var w1_choices := [LayoutType.HILLS, LayoutType.WIDE_TO_SMALL, LayoutType.SMALL_TO_WIDE]
				return w1_choices[rng.randi_range(0, w1_choices.size() - 1)]
	# Level 3: ramp up difficulty with hills or switchbacks
	if level == 3:
		var hard_choices := [LayoutType.HILLS, LayoutType.WIDE_TO_SMALL, LayoutType.SMALL_TO_WIDE]
		if world != 1:
			hard_choices.append(LayoutType.CURVES)
		return hard_choices[rng.randi_range(0, hard_choices.size() - 1)]
	var choices := [
		LayoutType.STRAIGHTAWAY,
		LayoutType.WIDE_TO_SMALL,
		LayoutType.SMALL_TO_WIDE,
		LayoutType.HILLS,
	]
	if world != 1:
		choices.append(LayoutType.CURVES)
	return choices[rng.randi_range(0, choices.size() - 1)]

# ── Segment generation ────────────────────────────────────────────────────────

static func _build_segments(
	layout_type: LayoutType,
	world: int,
	_level: int,
	rng: RandomNumberGenerator,
	body_count_override: int = -1,
) -> Array[Dictionary]:
	var cfg: Dictionary = LAYOUT_CONFIGS[layout_type]
	var count: int = body_count_override
	if count < 0 and cfg.get("seg_count") is Array:
		count = rng.randi_range(cfg["seg_count"][0], cfg["seg_count"][1])
	elif count < 0:
		count = int(cfg.get("seg_count", 6))
	# World 1: shorter levels for better pacing (body only)
	if world == 1 and layout_type == LayoutType.COMBINATION:
		count = rng.randi_range(12, 15)

	var segs: Array[Dictionary] = []
	var z: float = 0.0
	var current_y: float = 0.0

	# ── OPENING STRAIGHTAWAY: Acclimation / Takeoff ─────────────────────────
	for i: int in range(OPENING_ZONE_SEGS):
		var length: float = rng.randf_range(25.0, 35.0)
		var z0: float = z
		var z1: float = z - length
		var w: float = rng.randf_range(10.0, 12.0)
		if world == 1:
			w = maxf(w, 8.0)
		var ramp: float = rng.randf_range(-0.3, 0.0)
		ramp = roundf(ramp * 10.0) / 10.0

		var seg := {
			"z0": roundf(z0 * 10.0) / 10.0,
			"z1": roundf(z1 * 10.0) / 10.0,
			"w": roundf(w * 10.0) / 10.0,
			"x": 0.0,
			"ramp": ramp,
		}
		if current_y != 0.0:
			seg["y"] = roundf(current_y * 10.0) / 10.0

		segs.append(seg)
		current_y += ramp
		z = z1

	# ── BODY: Layout-specific excitement ────────────────────────────────────
	var body_count: int = maxi(count - OPENING_ZONE_SEGS - CLOSING_ZONE_SEGS, 3)
	for i: int in range(body_count):
		var length: float = rng.randf_range(cfg["length_range"][0], cfg["length_range"][1])
		var z0: float = z
		var z1: float = z - length
		var w: float = _pick_width(cfg, i, body_count, rng)
		if world == 1:
			w = maxf(w, 7.0)

		var x: float = _pick_x(cfg, i, body_count, rng)
		# Smooth transition from opening (x=0)
		if i == 0:
			x *= 0.3
		# Smooth transition toward closing (x=0)
		elif i == body_count - 1 and cfg.get("x_shift", 0.0) != 0.0:
			x *= 0.3

		var ramp: float = _pick_ramp(cfg, i, body_count, rng)
		if world == 1:
			ramp = clampf(ramp, -1.5, 1.5)

		# First body segment: ease ramp from opening
		if i == 0:
			var opening_ramp: float = segs[-1].get("ramp", 0.0)
			ramp = lerpf(opening_ramp, ramp, 0.6)
			ramp = roundf(ramp * 10.0) / 10.0

		# Last body segment: ease ramp toward 0 for closing
		if i == body_count - 1:
			ramp = lerpf(ramp, 0.0, 0.5)
			ramp = roundf(ramp * 10.0) / 10.0

		# Verticity bumps: replace flat segments with small launch ramps for fun
		if absf(ramp) < 0.2 and rng.randf() < 0.25:
			ramp = rng.randf_range(0.5, 1.0)
			ramp = roundf(ramp * 10.0) / 10.0

		var is_jump: bool = false
		var jump_chance: float = cfg.get("jump_chance", 0.0)
		if world == 1 and layout_type == LayoutType.COMBINATION:
			jump_chance = 0.08
		if rng.randf() < jump_chance and ramp >= 0:
			is_jump = true
			ramp = 2.5

		var seg_y: float = current_y

		var seg := {
			"z0": roundf(z0 * 10.0) / 10.0,
			"z1": roundf(z1 * 10.0) / 10.0,
			"w": roundf(w * 10.0) / 10.0,
			"x": roundf(x * 10.0) / 10.0,
			"ramp": ramp,
		}
		if is_jump:
			seg["jump"] = true
		if world == 2 and rng.randf() < 0.35:
			seg["ice"] = true
		if seg_y != 0.0:
			seg["y"] = roundf(seg_y * 10.0) / 10.0

		segs.append(seg)

		if is_jump:
			current_y = seg_y
		elif ramp != 0.0:
			current_y = seg_y + ramp
		else:
			current_y = seg_y
		z = z1

	# ── CLOSING STRAIGHTAWAY: Predictable landing ───────────────────────────
	var last_body_x: float = segs[-1].get("x", 0.0) if segs.size() > 0 else 0.0
	var last_body_ramp: float = segs[-1].get("ramp", 0.0) if segs.size() > 0 else 0.0
	for i: int in range(CLOSING_ZONE_SEGS):
		var length: float = rng.randf_range(25.0, 35.0)
		var z0: float = z
		var z1: float = z - length
		var w: float = rng.randf_range(10.0, 12.0)
		if world == 1:
			w = maxf(w, 8.0)

		var t: float = float(i + 1) / float(CLOSING_ZONE_SEGS)
		var x: float = lerpf(last_body_x, 0.0, t)
		var ramp: float = lerpf(last_body_ramp, 0.0, t)
		ramp = roundf(ramp * 10.0) / 10.0

		var seg_y: float = current_y

		var seg := {
			"z0": roundf(z0 * 10.0) / 10.0,
			"z1": roundf(z1 * 10.0) / 10.0,
			"w": roundf(w * 10.0) / 10.0,
			"x": roundf(x * 10.0) / 10.0,
			"ramp": ramp,
		}
		if seg_y != 0.0:
			seg["y"] = roundf(seg_y * 10.0) / 10.0

		segs.append(seg)
		current_y = seg_y + ramp
		z = z1

	# Append end runway segment (connects to closing; level_generator adds the long sunset mesh)
	var runway := {
		"z0": roundf(z * 10.0) / 10.0,
		"z1": roundf((z - RUNWAY_SEGMENT_LENGTH) * 10.0) / 10.0,
		"w": 10.0,
		"x": 0.0,
		"ramp": 0.0,
	}
	if current_y != 0.0:
		runway["y"] = roundf(current_y * 10.0) / 10.0
	segs.append(runway)

	segs = _ensure_gap_speed_setup(segs)
	segs = stitch_segments(segs)
	return segs

static func _ensure_gap_speed_setup(segs: Array[Dictionary]) -> Array[Dictionary]:
	"""Every jump segment must be preceded by a downhill segment to guarantee speed."""
	for i: int in range(1, segs.size() - 1):
		if segs[i].get("jump", false):
			var prev_ramp: float = segs[i - 1].get("ramp", 0.0)
			if prev_ramp >= -0.5:
				# Force previous segment to be a gentle downhill
				segs[i - 1]["ramp"] = -1.0
				segs[i - 1]["w"] = maxf(segs[i - 1].get("w", 8.0), 9.0)
	return segs

static func _pick_width(cfg: Dictionary, idx: int, total: int, rng: RandomNumberGenerator) -> float:
	if cfg.has("width_start") and cfg.has("width_end"):
		var t: float = float(idx) / maxf(total - 1, 1)
		return lerpf(cfg["width_start"], cfg["width_end"], t)
	var r: Array = cfg.get("width_range", [8.0, 10.0])
	return rng.randf_range(r[0], r[1])

static func _pick_x(cfg: Dictionary, idx: int, _total: int, rng: RandomNumberGenerator) -> float:
	var base: float = cfg.get("x_shift", 0.0)
	if base == 0.0:
		return 0.0
	var sign_: float = 1.0 if idx % 2 == 0 else -1.0
	return base * sign_ + rng.randf_range(-0.5, 0.5)

static func _pick_ramp(cfg: Dictionary, idx: int, total: int, rng: RandomNumberGenerator) -> float:
	var r: Array = cfg.get("ramp_range", [-0.5, 0.5])
	var ramp: float = rng.randf_range(r[0], r[1])
	# Hills: alternating sign for variety
	if cfg.get("x_shift", 0.0) == 0.0 and absf(r[0]) > 1.0:
		if idx > 0 and total > 1:
			var _prev_ramp_sign: float = signf(ramp)
			if idx % 2 == 0:
				ramp = absf(ramp)
			else:
				ramp = -absf(ramp)
	return roundf(ramp * 10.0) / 10.0

# ── Obstacle budget system ────────────────────────────────────────────────────

static func _build_obstacles(segments: Array[Dictionary], world: int, level: int, rng: RandomNumberGenerator, hoops: Array[Dictionary] = []) -> Array[Dictionary]:
	var budget: int = 5 + (world - 1) * 3 + (level - 1) * 2
	# Level 3 gets a small difficulty bump (+2 DR budget)
	if level == 3:
		budget += 2
	# World 1: fewer obstacles in early levels for a gentler learning curve
	if world == 1:
		if level <= 2:
			budget = maxi(budget - 3, 3)
		elif level <= 4:
			budget = maxi(budget - 1, 4)
	var bias: Array = WORLD_BIAS.get(world, WORLD_BIAS[1])

	var obstacles: Array[Dictionary] = []
	var placed_obs: Array[Dictionary] = []  # {z, x, half_len}
	# Seed placed_obs with hoop safe-zones so obstacles never crowd checkpoints.
	for h: Dictionary in hoops:
		placed_obs.append({"z": float(h.get("z", 0.0)), "x": float(h.get("x", 0.0)), "half_len": 4.0})
	var min_spacing: float = 16.0 if world == 1 else 12.0
	var ground_only: Array[String] = ["brake_pad", "bumper", "spike", "pot"]

	# Signature mechanic: every level must contain at least one of its world's star obstacle.
	var signature_kind: String = ""
	match world:
		3: signature_kind = "gravity"
		4: signature_kind = "wind"
		5: signature_kind = "wind"
		6: signature_kind = "magnet"
	var has_signature := false

	# Score segments by "interestingness"
	var scored_segs: Array[Dictionary] = []
	for i: int in range(segments.size()):
		var seg: Dictionary = segments[i]
		# Skip opening zone, closing zone, and runway finish segment
		var skip_end: int = CLOSING_ZONE_SEGS + 1  # closing + runway
		if i < OPENING_ZONE_SEGS or i >= segments.size() - skip_end:
			continue
		var score: float = 0.0
		if seg.get("jump", false):
			score += 40.0
		if absf(seg.get("ramp", 0.0)) >= 2.0:
			score += 20.0
		elif absf(seg.get("ramp", 0.0)) >= 1.0:
			score += 10.0
		var w: float = seg.get("w", 10.0)
		if w <= 7.0:
			score += 15.0
		elif w <= 8.0:
			score += 8.0
		if absf(seg.get("x", 0.0)) >= 2.0:
			score += 10.0
		scored_segs.append({"seg": seg, "score": score, "z": (seg["z0"] + seg["z1"]) * 0.5})

	scored_segs.sort_custom(func(a, b): return a["score"] > b["score"])

	# Greedily place obstacles
	for entry: Dictionary in scored_segs:
		if budget <= 0:
			break
		var seg: Dictionary = entry["seg"]
		var z: float = entry["z"]
		var is_jump: bool = seg.get("jump", false)

		var kind: String = _pick_obstacle_kind(budget, bias, world, rng)
		if kind.is_empty():
			continue
		# Force signature mechanic on the first valid placement if absent.
		if not has_signature and not signature_kind.is_empty():
			if not (is_jump and signature_kind in ground_only):
				kind = signature_kind
		# Ground obstacles need solid track — skip jumps
		if is_jump and kind in ground_only:
			continue
		var dr: int = OBSTACLE_DR.get(kind, 0)
		if dr > 0 and budget < dr:
			continue

		var obs := _make_obstacle(kind, seg, z, world, rng)
		if obs.is_empty():
			continue
		var ox: float = obs.get("x", seg.get("x", 0.0))

		# Size-aware spacing: ensure obstacles don't overlap in Z or X
		var obs_half_len: float = obs.get("length", 4.0) * 0.5
		var too_close := false
		for po: Dictionary in placed_obs:
			var required_z: float = po["half_len"] + obs_half_len + min_spacing * 0.5
			var required_x: float = 3.0
			if absf(po["z"] - z) < required_z and absf(po["x"] - ox) < required_x:
				too_close = true
				break
		if too_close:
			continue

		obstacles.append(obs)
		placed_obs.append({"z": z, "x": ox, "half_len": obs_half_len})
		budget -= maxi(dr, 0)
		if kind == signature_kind:
			has_signature = true

	# Bonus levels: scatter breakable pots for coin-smashing fun
	if level == 0 and world > 0:
		for seg: Dictionary in segments:
			var seg_len: float = absf(seg["z1"] - seg["z0"])
			var steps: int = maxi(1, int(seg_len / 10.0))
			for s: int in range(steps):
				var t: float = (float(s) + 0.5) / float(steps)
				var pz: float = lerpf(seg["z0"], seg["z1"], t)
				var pot := _make_obstacle("pot", seg, pz, world, rng)
				if pot.is_empty():
					continue
				var pot_x: float = pot.get("x", seg.get("x", 0.0))
				if not _is_clear_of_obstacles(pz, pot_x, placed_obs, 4.0, 3.0):
					continue
				obstacles.append(pot)
				placed_obs.append({"z": pz, "x": pot_x, "half_len": 1.5})

	return obstacles

static func _pick_obstacle_kind(_budget: int, bias: Array, world: int, rng: RandomNumberGenerator) -> String:
	# Always pick from world bias first; fallback only if bias is empty
	if not bias.is_empty():
		return bias[rng.randi_range(0, bias.size() - 1)]
	var pool := _fallback_pool(world)
	return pool[rng.randi_range(0, pool.size() - 1)]

static func _fallback_pool(world: int) -> Array[String]:
	# Each world gets ONLY its own signature mechanic + universal basics.
	# This prevents "wind in World 3" or "gravity in World 5" bleed-through.
	var base: Array[String] = ["brake_pad", "bumper", "spike", "pot"]
	match world:
		3: base.append("gravity")
		4: base.append("wind")
		5: base.append("wind")
		6: base.append("magnet")
	return base

static func _make_obstacle(kind: String, seg: Dictionary, z: float, _world: int, rng: RandomNumberGenerator) -> Dictionary:
	var x: float = seg.get("x", 0.0)
	var w: float = seg.get("w", 10.0)
	var obs := {"kind": kind, "z": z, "x": x, "seg_y": seg.get("y", 0.0)}

	match kind:
		"brake_pad":
			# brake_pad uses same scene as speed_boost, just boolean flag
			obs["strength"] = rng.randf_range(6.0, 10.0)
			obs["is_brake"] = true
		"bumper":
			obs["force"] = rng.randf_range(18.0, 24.0)
			# Offset bumper slightly off-center
			obs["x"] = x + (w * 0.3 if rng.randf() > 0.5 else -w * 0.3)
		"spike":
			obs["width"] = clampf(rng.randf_range(4.0, w - 1.0), 2.0, w - 1.0)
			obs["length"] = rng.randf_range(1.5, 3.0)
		"wind":
			obs["force"] = rng.randf_range(16.0, 26.0)
			obs["direction"] = [1.0 if rng.randf() > 0.5 else -1.0, 0.0, 0.0]
			obs["length"] = rng.randf_range(20.0, 40.0)
		"gravity":
			obs["type"] = rng.randi_range(0, 3)
			obs["multiplier"] = rng.randf_range(1.5, 3.5)
			obs["length"] = rng.randf_range(20.0, 40.0)
		"magnet":
			obs["magnet_type"] = "attract" if rng.randf() > 0.3 else "repel"
			obs["strength"] = rng.randf_range(14.0, 22.0)
			obs["length"] = rng.randf_range(40.0, 70.0)
		"pot":
			# Half-scale urn (~1.1 m radius) — stay on the segment surface
			var max_offset: float = maxf(0.0, w * 0.5 - 1.2)
			obs["x"] = x + clampf(rng.randf_range(-w * 0.3, w * 0.3), -max_offset, max_offset)
			obs["seg_y"] = track_surface_y(seg, z)
			obs["score_value"] = 15
		_:
			return {}
	return obs

# ── Segment continuity ────────────────────────────────────────────────────────

static func track_surface_y(seg: Dictionary, z: float) -> float:
	var z0: float = seg.get("z0", 0.0)
	var z1: float = seg.get("z1", 0.0)
	var span: float = z1 - z0
	var t: float = 0.5
	if absf(span) > 0.01:
		t = clampf((z - z0) / span, 0.0, 1.0)
	var seg_y: float = seg.get("y", 0.0)
	var ramp: float = seg.get("ramp", 0.0)
	const track_half: float = 0.2
	if absf(ramp) < 0.01:
		return seg_y + track_half
	return lerpf(seg_y, seg_y + ramp, t) + track_half


static func _segment_allows_hoop(seg: Dictionary) -> bool:
	if seg.get("jump", false):
		return false
	if float(seg.get("w", 10.0)) < HOOP_MIN_SEGMENT_WIDTH:
		return false
	var z0: float = float(seg.get("z0", 0.0))
	var z1: float = float(seg.get("z1", 0.0))
	if absf(z1 - z0) < HOOP_MIN_SEGMENT_LENGTH:
		return false
	return true


static func _hoop_center_y(seg: Dictionary, z: float, tier: int, rng: RandomNumberGenerator) -> float:
	var surface_y: float = track_surface_y(seg, z)
	var tier_i: int = clampi(tier, 0, HOOP_TIER_SURFACE_OFFSET.size() - 1)
	var offset: float = HOOP_TIER_SURFACE_OFFSET[tier_i] + rng.randf_range(
		0.0, HOOP_TIER_SURFACE_JITTER[tier_i]
	)
	return maxf(surface_y + offset, surface_y + HOOP_MIN_ABOVE_SURFACE)


static func _hoop_world_x(seg: Dictionary, tier: int, rng: RandomNumberGenerator) -> float:
	var base_x: float = float(seg.get("x", 0.0))
	var w: float = float(seg.get("w", 10.0))
	var max_off: float
	match tier:
		0:
			max_off = w * 0.28
		1:
			max_off = w * 0.38
		_:
			max_off = minf(w * 0.42, 3.8)
	var offset: float = rng.randf_range(-max_off, max_off)
	var half_w: float = w * 0.5 - 0.6
	if absf(offset) > half_w:
		offset = signf(offset) * half_w
	return base_x + offset


static func _score_hoop_segment(seg: Dictionary, z: float) -> float:
	var score: float = 0.0
	var ramp: float = float(seg.get("ramp", 0.0))
	var w: float = float(seg.get("w", 10.0))
	if absf(ramp) <= 0.3:
		score += 50.0
	elif absf(ramp) <= 0.8:
		score += 20.0
	else:
		score -= 30.0
	if w >= 9.0:
		score += 30.0
	elif w >= 7.5:
		score += 10.0
	else:
		score -= 40.0
	# Prefer flatter track at this Z (reachable roll-through / hop).
	var y_here: float = track_surface_y(seg, z)
	var z0: float = float(seg.get("z0", 0.0))
	var z1: float = float(seg.get("z1", 0.0))
	var span: float = absf(z1 - z0)
	if span > 2.0:
		var dz: float = minf(4.0, span * 0.15)
		var y_a: float = track_surface_y(seg, z + dz)
		var y_b: float = track_surface_y(seg, z - dz)
		if absf(y_a - y_here) < 0.6 and absf(y_b - y_here) < 0.6:
			score += 25.0
		elif absf(y_a - y_here) > 1.2 or absf(y_b - y_here) > 1.2:
			score -= 35.0
	return score


static func stitch_segments(segments: Array[Dictionary]) -> Array[Dictionary]:
	if segments.is_empty():
		return segments
	var current_y: float = 0.0
	var prev_z1: float = 0.0
	for i: int in range(segments.size()):
		var seg: Dictionary = segments[i]
		if i == 0:
			seg["z0"] = 0.0
		else:
			seg["z0"] = prev_z1
		var z0: float = seg["z0"]
		var ramp: float = seg.get("ramp", 0.0)
		var is_jump: bool = seg.get("jump", false)
		var gap: float = absf(z0 - prev_z1) if i > 0 else 0.0
		var seg_y: float = seg.get("y", current_y)
		if gap < 0.5 and seg.has("y") and absf(seg_y - current_y) > 0.05 and absf(ramp) < 0.01 and not is_jump:
			seg.erase("y")
			seg_y = current_y
		if is_jump:
			current_y = seg_y
		elif absf(ramp) > 0.01:
			current_y = seg_y + ramp
		else:
			current_y = seg_y
		seg["z0"] = roundf(seg["z0"] * 10.0) / 10.0
		seg["z1"] = roundf(seg["z1"] * 10.0) / 10.0
		prev_z1 = seg["z1"]
	return segments

static func normalize_level_data(data: Dictionary, world: int, level: int) -> Dictionary:
	var out: Dictionary = data.duplicate(true)
	var segments: Array = out.get("segments", [])
	if segments.is_empty():
		return out
	var seg_dicts: Array[Dictionary] = []
	for item: Variant in segments:
		if item is Dictionary:
			seg_dicts.append((item as Dictionary).duplicate())
	seg_dicts = stitch_segments(seg_dicts)
	out["segments"] = seg_dicts
	out["finish_z"] = _compute_finish_z(seg_dicts)
	var rng := RandomNumberGenerator.new()
	rng.seed = hash("%d-%d-hoops" % [world, level])
	var obstacles: Array[Dictionary] = []
	for item: Variant in out.get("obstacles", []):
		if item is Dictionary:
			var kind: String = str((item as Dictionary).get("kind", ""))
			if kind != "hoop":
				obstacles.append((item as Dictionary).duplicate())
	var finish_z: float = float(out.get("finish_z", _compute_finish_z(seg_dicts)))
	var is_bonus := level == 0 and world > 0
	var hoops := _build_hoops(seg_dicts, obstacles, world, rng, finish_z, is_bonus)
	for h: Dictionary in hoops:
		obstacles.append({
			"kind": "hoop",
			"z": h["z"],
			"x": h["x"],
			"y": h["y"],
			"boost": h.get("boost", 14.0),
		})
	out["obstacles"] = obstacles
	out["checkpoints"] = _hoop_z_positions(hoops)
	return out

# ── Checkpoint hoop placement ─────────────────────────────────────────────────

static func _min_hoop_spacing(world: int) -> float:
	var base: float = 22.0 if world == 1 else 18.0
	return base * HOOP_SPACING_MULTIPLIER

static func _is_clear_of_obstacles(z: float, x: float, obstacles: Array[Dictionary], extra_safe_z: float = 4.0, extra_safe_x: float = 3.5) -> bool:
	for obs: Dictionary in obstacles:
		var oz: float = float(obs.get("z", 0.0))
		var ox: float = float(obs.get("x", 0.0))
		var half_len: float = float(obs.get("length", 0.0)) * 0.5
		var safe_z: float = half_len + extra_safe_z
		var safe_x: float = extra_safe_x
		if absf(oz - z) < safe_z and absf(ox - x) < safe_x:
			return false
	return true

static func _build_hoops(
	segments: Array[Dictionary],
	_obstacles: Array[Dictionary],
	world: int,
	rng: RandomNumberGenerator,
	finish_z: float,
	is_bonus: bool,
) -> Array[Dictionary]:
	var hoops: Array[Dictionary] = []

	var body_start: int = OPENING_ZONE_SEGS
	var body_end: int = segments.size() - CLOSING_ZONE_SEGS - 1
	if body_end <= body_start:
		return _build_hoops_legacy(segments, _obstacles, world, rng, finish_z)

	var z_start: float = segments[body_start]["z0"]
	var track_finish_z: float = finish_z if finish_z != 0.0 else _compute_finish_z(segments)
	var finish_margin: float = 14.0 if is_bonus else 10.0
	var z_min: float = track_finish_z + finish_margin
	var z_max: float = z_start - 4.0
	if z_max <= z_min:
		return _build_hoops_legacy(segments, _obstacles, world, rng, finish_z)

	var min_hoop_spacing: float = _min_hoop_spacing(world)
	if is_bonus:
		min_hoop_spacing *= 0.72

	# Generate dense candidates inside every valid body segment so we can fit
	# 6 hoops even when some segments are narrow / jumps.
	var candidates: Array[Dictionary] = []
	for i: int in range(body_start, body_end):
		var seg: Dictionary = segments[i]
		if not _segment_allows_hoop(seg):
			continue
		var seg_z0: float = float(seg["z0"])
		var seg_z1: float = float(seg["z1"])
		var seg_len: float = absf(seg_z1 - seg_z0)
		# One candidate every ~10 m, minimum 1, cap at 5 per segment.
		var steps: int = clampi(int(seg_len / 10.0), 1, 5)
		for s: int in range(steps):
			var t: float = (float(s) + 0.5) / float(steps)
			var z: float = lerpf(seg_z0, seg_z1, t)
			z = clampf(z, z_min, z_max)
			var score: float = _score_hoop_segment(seg, z)
			candidates.append({"seg": seg, "score": score, "z": z, "idx": i})

	if candidates.is_empty():
		return _build_hoops_legacy(segments, _obstacles, world, rng, finish_z)

	# Greedily pick highest-scoring candidates that are at least min_hoop_spacing apart.
	candidates.sort_custom(func(a, b): return a["score"] > b["score"])
	var selected: Array[Dictionary] = []
	for cand: Dictionary in candidates:
		if selected.size() >= TARGET_HOOP_COUNT:
			break
		var too_close := false
		for s: Dictionary in selected:
			if absf(s["z"] - cand["z"]) < min_hoop_spacing:
				too_close = true
				break
		if not too_close:
			selected.append(cand)

	if selected.size() < TARGET_HOOP_COUNT:
		return _build_hoops_legacy(segments, _obstacles, world, rng, finish_z)

	# Sort by Z descending (start → finish).
	selected.sort_custom(func(a, b): return a["z"] > b["z"])

	# ── Tier distribution ─────────────────────────────────────────────────────
	var tiers: Array[int] = []
	match world:
		1: tiers = [0, 0, 1, 1, 2, 2]
		2: tiers = [0, 1, 1, 1, 2, 2]
		3: tiers = [0, 1, 1, 2, 2, 2]
		4: tiers = [0, 1, 2, 2, 2, 2]
		5: tiers = [1, 1, 2, 2, 2, 2]
		6: tiers = [1, 2, 2, 2, 2, 2]
		_: tiers = [0, 0, 1, 1, 2, 2]
	for _shuffle_idx: int in range(4):
		var swap_a := rng.randi_range(0, tiers.size() - 1)
		var swap_b := rng.randi_range(0, tiers.size() - 1)
		var tmp := tiers[swap_a]
		tiers[swap_a] = tiers[swap_b]
		tiers[swap_b] = tmp

	# ── Build hoop geometry ─────────────────────────────────────────────────
	var built: int = 0
	var combined_check: Array[Dictionary] = _obstacles.duplicate()
	for i: int in range(selected.size()):
		if built >= TARGET_HOOP_COUNT:
			break
		var cand: Dictionary = selected[i]
		var z: float = float(cand["z"])
		var seg: Dictionary = _segment_at_z(segments, z)
		if seg.is_empty() or not _segment_allows_hoop(seg):
			seg = cand["seg"]
		if not _segment_allows_hoop(seg):
			continue
		var tier: int = tiers[built]
		var x: float = _hoop_world_x(seg, tier, rng)
		var cleared := false
		for _retry: int in range(3):
			if _is_clear_of_obstacles(z, x, combined_check, 3.5, 2.5):
				cleared = true
				break
			x = _hoop_world_x(seg, tier, rng)
		if not cleared:
			for nudge: float in [2.0, -2.0, 4.0, -4.0, 6.0, -6.0, 8.0, -8.0, 12.0, -12.0, 16.0, -16.0, 20.0, -20.0, 30.0, -30.0]:
				var nz: float = z + nudge
				var nseg: Dictionary = _segment_at_z(segments, nz)
				if nseg.is_empty():
					nseg = seg
				if not _segment_allows_hoop(nseg):
					continue
				for _nx_retry: int in range(5):
					var nx: float = _hoop_world_x(nseg, tier, rng)
					if _is_clear_of_obstacles(nz, nx, combined_check, 3.0, 2.0):
						z = nz
						seg = nseg
						x = nx
						cleared = true
						break
				if cleared:
					break
		if not cleared:
			continue
		var y: float = _hoop_center_y(seg, z, tier, rng)

		var hoop := {
			"z": roundf(z * 10.0) / 10.0,
			"x": roundf(x * 10.0) / 10.0,
			"y": roundf(y * 10.0) / 10.0,
			"boost": HOOP_BOOSTS[built],
		}
		hoops.append(hoop)
		combined_check.append(hoop)
		built += 1

	# Nuclear fallback: place on any valid body segment that doesn't already host a hoop.
	if hoops.size() < TARGET_HOOP_COUNT:
		for i: int in range(body_start, body_end):
			if hoops.size() >= TARGET_HOOP_COUNT:
				break
			var seg: Dictionary = segments[i]
			if not _segment_allows_hoop(seg):
				continue
			var z: float = (float(seg["z0"]) + float(seg["z1"])) * 0.5
			# Ensure spacing from existing hoops
			var too_close := false
			for h: Dictionary in hoops:
				if absf(h["z"] - z) < min_hoop_spacing * 0.5:
					too_close = true
					break
			if too_close:
					continue
			var tier: int = tiers[hoops.size()]
			var x: float = _hoop_world_x(seg, tier, rng)
			if not _is_clear_of_obstacles(z, x, hoops, 3.5, 2.5):
				continue
			var y: float = _hoop_center_y(seg, z, tier, rng)
			hoops.append({
				"z": roundf(z * 10.0) / 10.0,
				"x": roundf(x * 10.0) / 10.0,
				"y": roundf(y * 10.0) / 10.0,
				"boost": HOOP_BOOSTS[hoops.size()],
			})

	return hoops

static func _add_bonus_boost_pads(
	segments: Array[Dictionary],
	finish_z: float,
	obstacles: Array[Dictionary],
	rng: RandomNumberGenerator,
	hoops: Array[Dictionary] = [],
) -> void:
	var z_min: float = finish_z + 18.0
	var z_max: float = -25.0
	var all_check: Array[Dictionary] = obstacles.duplicate()
	all_check.append_array(hoops)
	for _i: int in range(rng.randi_range(3, 5)):
		var z: float = rng.randf_range(z_max, z_min)
		var seg := _segment_at_z(segments, z)
		if seg.is_empty():
			continue
		var x: float = roundf(rng.randf_range(-2.0, 2.0) * 10.0) / 10.0
		if not _is_clear_of_obstacles(z, x, all_check, 4.0, 3.0):
			continue
		obstacles.append({
			"kind": "speed_boost",
			"z": roundf(z * 10.0) / 10.0,
			"x": x,
			"strength": roundf(rng.randf_range(18.0, 24.0) * 10.0) / 10.0,
		})


static func _factory_segment_to_editor_dict(seg: Dictionary) -> Dictionary:
	var length: float = absf(float(seg.get("z1", 0.0)) - float(seg.get("z0", 0.0)))
	var type_key := "straight"
	if seg.get("jump", false):
		type_key = "gap"
	elif seg.get("ice", false):
		type_key = "ice"
	elif float(seg.get("w", 10.0)) <= 6.5:
		type_key = "narrow"
	elif float(seg.get("w", 10.0)) >= 11.5:
		type_key = "wide"
	elif float(seg.get("ramp", 0.0)) >= 0.8:
		type_key = "ramp_up"
	elif float(seg.get("ramp", 0.0)) <= -0.8:
		type_key = "ramp_down"
	var editor_seg := EditorSegment.make(type_key)
	editor_seg.length = maxf(length, 8.0)
	editor_seg.width = float(seg.get("w", editor_seg.width))
	editor_seg.ramp = float(seg.get("ramp", editor_seg.ramp))
	editor_seg.x = float(seg.get("x", 0.0))
	editor_seg.y = float(seg.get("y", 0.0))
	editor_seg.apply_snap(EditorSegment.snap_id_from_offsets(editor_seg.x, editor_seg.y))
	return editor_seg.to_dict()


static func _factory_obstacle_to_editor_obs(obs: Dictionary, segments: Array) -> Dictionary:
	var kind: String = str(obs.get("kind", ""))
	var z: float = float(obs.get("z", 0.0))
	var x: float = float(obs.get("x", 0.0))
	var y: float = float(obs.get("y", 0.0))
	if y <= 0.0:
		var seg: Dictionary = _segment_at_z(_to_seg_dict_array(segments), z)
		if not seg.is_empty():
			y = track_surface_y(seg, z) + 0.5
		else:
			y = 1.5

	if kind == "hoop":
		var hoop_seg: Dictionary = _segment_at_z(_to_seg_dict_array(segments), z)
		if not hoop_seg.is_empty():
			var surface_y: float = track_surface_y(hoop_seg, z)
			y = maxf(y, surface_y + HOOP_MIN_ABOVE_SURFACE)
		return {"t": "hoop", "p": [x, y, z], "s": float(obs.get("boost", 14.0))}

	var type_key := ""
	match kind:
		"speed_boost", "boost":
			type_key = "boost"
		"brake_pad", "brake":
			type_key = "brake"
		"bumper":
			type_key = "bumper"
		"spike":
			type_key = "spike"
		"wind":
			type_key = "wind"
		"gravity":
			type_key = "grav"
		"magnet":
			type_key = "magnet"
		_:
			return {}

	var compact: Dictionary = {"t": type_key, "p": [x, y, z]}
	if obs.has("strength"):
		compact["s"] = obs["strength"]
	if obs.has("force"):
		compact["f"] = obs["force"]
	return compact


static func _to_seg_dict_array(segments: Array) -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	for item: Variant in segments:
		if item is Dictionary:
			out.append(item as Dictionary)
	return out


static func _build_hoops_legacy(
	segments: Array[Dictionary],
	_obstacles: Array[Dictionary],
	world: int,
	rng: RandomNumberGenerator,
	finish_z: float,
) -> Array[Dictionary]:
	"""Fallback fixed-percentage placement for levels that are too short for scoring."""
	var hoops: Array[Dictionary] = []
	var total_length: float = 0.0
	for seg: Dictionary in segments:
		total_length += absf(seg["z1"] - seg["z0"])
	var z_positions: Array[float] = []
	var min_sp: float = _min_hoop_spacing(world)
	var body_span: float = maxf(total_length * 0.55, min_sp * float(TARGET_HOOP_COUNT - 1))
	var track_finish_z: float = finish_z if finish_z != 0.0 else _compute_finish_z(segments)
	var z_head: float = -total_length * 0.12
	var z_floor: float = track_finish_z + 14.0
	for i: int in range(TARGET_HOOP_COUNT):
		var t: float = float(i + 1) / float(TARGET_HOOP_COUNT + 1)
		z_positions.append(clampf(z_head - body_span * t, z_floor, z_head))

	# Tier distribution (same as main builder)
	var tiers: Array[int] = []
	match world:
		1: tiers = [0, 0, 1, 1, 2, 2]
		2: tiers = [0, 1, 1, 1, 2, 2]
		3: tiers = [0, 1, 1, 2, 2, 2]
		4: tiers = [0, 1, 2, 2, 2, 2]
		5: tiers = [1, 1, 2, 2, 2, 2]
		6: tiers = [1, 2, 2, 2, 2, 2]
		_: tiers = [0, 0, 1, 1, 2, 2]
	for _shuffle_idx: int in range(4):
		var swap_a := rng.randi_range(0, tiers.size() - 1)
		var swap_b := rng.randi_range(0, tiers.size() - 1)
		var tmp := tiers[swap_a]
		tiers[swap_a] = tiers[swap_b]
		tiers[swap_b] = tmp

	for i: int in range(TARGET_HOOP_COUNT):
		var z: float = z_positions[i]
		var seg := _segment_at_z(segments, z)
		var tier: int = tiers[i]
		var x: float
		var cleared := false
		if not seg.is_empty() and _segment_allows_hoop(seg):
			x = _hoop_world_x(seg, tier, rng)
			for _retry: int in range(3):
				if _is_clear_of_obstacles(z, x, _obstacles, 3.0, 2.0):
					cleared = true
					break
				x = _hoop_world_x(seg, tier, rng)
		# If initial segment invalid or X blocked, nudge Z to find a valid segment.
		if not cleared:
			for nudge: float in [2.0, -2.0, 4.0, -4.0, 6.0, -6.0, 8.0, -8.0, 12.0, -12.0, 16.0, -16.0, 20.0, -20.0]:
				var nz: float = z + nudge
				var nseg: Dictionary = _segment_at_z(segments, nz)
				if nseg.is_empty() or not _segment_allows_hoop(nseg):
					continue
				var nx: float = _hoop_world_x(nseg, tier, rng)
				if _is_clear_of_obstacles(nz, nx, _obstacles, 3.0, 2.0):
					z = nz
					seg = nseg
					x = nx
					cleared = true
					break
		if not cleared:
			continue
		var y: float = _hoop_center_y(seg, z, tier, rng)
		hoops.append({
			"z": roundf(z * 10.0) / 10.0,
			"x": roundf(x * 10.0) / 10.0,
			"y": roundf(y * 10.0) / 10.0,
			"boost": HOOP_BOOSTS[i],
		})
	return hoops

static func _segment_at_z(segments: Array[Dictionary], z: float) -> Dictionary:
	for seg: Dictionary in segments:
		var z0: float = seg["z0"]
		var z1: float = seg["z1"]
		if z0 > z1:
			if z1 <= z and z <= z0:
				return seg
		else:
			if z0 <= z and z <= z1:
				return seg
	return {}

static func _hoop_z_positions(hoops: Array[Dictionary]) -> Array[float]:
	var out: Array[float] = []
	for h: Dictionary in hoops:
		out.append(h["z"])
	return out

# ── Finish & timing ───────────────────────────────────────────────────────────

static func _is_runway_segment(seg: Dictionary) -> bool:
	var span: float = absf(seg["z1"] - seg["z0"])
	return span >= RUNWAY_SEGMENT_LENGTH * 0.8 and absf(seg.get("ramp", 0.0)) < 0.01

static func _compute_finish_z(segments: Array[Dictionary]) -> float:
	if segments.is_empty():
		return -200.0
	if segments.size() >= 2 and _is_runway_segment(segments[-1]):
		return segments[-2]["z1"]
	return segments[-1]["z1"]

static func _compute_par_time(segments: Array[Dictionary]) -> float:
	var total_len: float = 0.0
	var total_ramp: float = 0.0
	for seg: Dictionary in segments:
		var len_: float = absf(seg["z1"] - seg["z0"])
		total_len += len_
		total_ramp += seg.get("ramp", 0.0)
	# Base time: assume ~12 m/s average
	var base: float = total_len / 12.0
	# Uphill penalty
	if total_ramp > 0:
		base += total_ramp * 1.5
	# Downhill bonus
	if total_ramp < 0:
		base += total_ramp * 0.5
	return roundf(base * 10.0) / 10.0

static func _par_time_tiers(par: float) -> Dictionary:
	return {
		"bronze": roundf(par * 1.15 * 10.0) / 10.0,
		"silver": roundf(par * 0.85 * 10.0) / 10.0,
		"gold":   roundf(par * 0.65 * 10.0) / 10.0,
	}

static func _level_name(world: int, level: int, layout: LayoutType) -> String:
	if world == 0:
		return "Secret Gauntlet S-%d" % level
	var layout_names := {
		LayoutType.STRAIGHTAWAY:   "Speedway",
		LayoutType.WIDE_TO_SMALL:  "Funnel",
		LayoutType.SMALL_TO_WIDE:  "Broadway",
		LayoutType.CURVES:         "S-Curve",
		LayoutType.HILLS:          "Roller",
		LayoutType.COMBINATION:    "Gauntlet",
	}
	var prefix: String = layout_names.get(layout, "Track")
	return "%s %d-%d" % [prefix, world, level]

# ── Helpers ───────────────────────────────────────────────────────────────────

static func signf(v: float) -> float:
	if v > 0.0:
		return 1.0
	elif v < 0.0:
		return -1.0
	return 0.0

static func save_bonus_to_file(world: int, data: Dictionary) -> void:
	save_to_file(world, 0, data, "B-%d" % world)


static func save_to_file(world: int, level: int, data: Dictionary, key_override: String = "") -> void:
	var key := key_override
	if key.is_empty():
		key = "%d-%d" % [world, level]
		if world == 0:
			key = "S-%d" % level
	var path := "res://levels/%s.json" % key
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(data, "\t"))
		file.close()
		print("[LevelFactory] Saved %s" % path)
	else:
		push_error("[LevelFactory] Failed to write %s" % path)
