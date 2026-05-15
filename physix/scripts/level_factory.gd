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
	6: ["magnet", "spike", "bumper", "pot"],
}

# ── Layout configs ──────────────────────────────────────────────────────────
const LAYOUT_CONFIGS: Dictionary = {
	# seg_count includes body segments only; opening (2) + closing (2) + runway (1) are added automatically
	LayoutType.STRAIGHTAWAY: {
		"seg_count": [10, 13],
		"length_range": [25.0, 45.0],
		"width_range": [10.0, 12.0],
		"ramp_range": [-0.5, -0.2],
		"x_shift": 0.0,
		"jump_chance": 0.0,
	},
	LayoutType.WIDE_TO_SMALL: {
		"seg_count": [11, 14],
		"length_range": [20.0, 35.0],
		"width_start": 12.0,
		"width_end": 6.0,
		"ramp_range": [-0.5, 1.5],
		"x_shift": 0.0,
		"jump_chance": 0.15,
	},
	LayoutType.SMALL_TO_WIDE: {
		"seg_count": [11, 14],
		"length_range": [20.0, 35.0],
		"width_start": 6.0,
		"width_end": 12.0,
		"ramp_range": [-0.5, 1.5],
		"x_shift": 0.0,
		"jump_chance": 0.15,
	},
	LayoutType.CURVES: {
		"seg_count": [12, 15],
		"length_range": [20.0, 30.0],
		"width_range": [8.0, 10.0],
		"ramp_range": [-0.3, 0.3],
		"x_shift": 3.0,
		"jump_chance": 0.2,
	},
	LayoutType.HILLS: {
		"seg_count": [12, 16],
		"length_range": [18.0, 28.0],
		"width_range": [8.0, 10.0],
		"ramp_range": [-2.5, 2.5],
		"x_shift": 0.0,
		"jump_chance": 0.25,
	},
	LayoutType.COMBINATION: {
		"seg_count": [14, 18],
		"length_range": [15.0, 30.0],
		"width_range": [6.0, 12.0],
		"ramp_range": [-2.5, 2.5],
		"x_shift": 3.0,
		"jump_chance": 0.3,
	},
}

# ── Hoop boost progression ────────────────────────────────────────────────────
const HOOP_BOOSTS: Array[float] = [20.0, 24.0, 28.0, 32.0, 36.0, 40.0]

# ── Zone constants ────────────────────────────────────────────────────────────
# Every level starts with an opening straightaway (acclimation) and ends with a
# closing straightaway (predictable landing). The body is the layout-specific
# excitement in between. Obstacles are never placed in opening/closing zones.
const OPENING_ZONE_SEGS: int = 2
const CLOSING_ZONE_SEGS: int = 2

# ── Public API ──────────────────────────────────────────────────────────────

static func generate(world: int, level: int, seed_: int = -1, logic_world_override: int = -1) -> Dictionary:
	var rng := RandomNumberGenerator.new()
	if seed_ < 0:
		seed_ = hash("%d-%d-%d" % [world, level, Time.get_ticks_msec()])
	rng.seed = seed_

	# Secret levels default to World 1 logic unless overridden
	var logic_world: int = logic_world_override if logic_world_override > 0 else (world if world > 0 else 1)

	var layout_type := _pick_layout(world, level, rng)
	var segments := _build_segments(layout_type, world, level, rng)
	var obstacles := _build_obstacles(segments, logic_world, level, rng)
	var hoops := _build_hoops(segments, obstacles, world, rng)
	var finish_z := _compute_finish_z(segments)
	var par_time := _compute_par_time(segments)

	# Merge hoop checkpoints into obstacles
	var all_obstacles: Array[Dictionary] = []
	all_obstacles.append_array(obstacles)
	for h: Dictionary in hoops:
		all_obstacles.append({
			"kind": "hoop_checkpoint",
			"z": h.z,
			"x": h.x,
			"y": h.y,
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
		"medal_times": _medal_times(par_time),
	}

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

static func _build_segments(layout_type: LayoutType, world: int, _level: int, rng: RandomNumberGenerator) -> Array[Dictionary]:
	var cfg: Dictionary = LAYOUT_CONFIGS[layout_type]
	var count: int = cfg.get("seg_count", [6, 9])[0]
	if cfg.get("seg_count") is Array:
		count = rng.randi_range(cfg["seg_count"][0], cfg["seg_count"][1])
	# World 1: shorter levels for better pacing (body only)
	if world == 1 and layout_type == LayoutType.COMBINATION:
		count = rng.randi_range(12, 15)

	var segs: Array[Dictionary] = []
	var z: float = 0.0
	var current_y: float = 0.0
	var __prev_z1: float = 0.0

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
		_prev_z1 = z1
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
		_prev_z1 = z1
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
		_prev_z1 = z1
		z = z1

	# Append finish runway
	var runway_length: float = rng.randf_range(15.0, 25.0)
	var runway := {
		"z0": roundf(z * 10.0) / 10.0,
		"z1": roundf((z - runway_length) * 10.0) / 10.0,
		"w": 10.0,
		"x": 0.0,
		"ramp": 0.0,
	}
	if current_y != 0.0:
		runway["y"] = roundf(current_y * 10.0) / 10.0
	segs.append(runway)

	# Post-process: ensure jumps have downhill approach for speed
	segs = _ensure_gap_speed_setup(segs)

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

static func _build_obstacles(segments: Array[Dictionary], world: int, level: int, rng: RandomNumberGenerator) -> Array[Dictionary]:
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
	var placed_obs: Array[Dictionary] = []  # {z, half_len}
	var min_spacing: float = 16.0 if world == 1 else 12.0
	var ground_only: Array[String] = ["brake_pad", "bumper", "spike", "pot"]

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
		# Ground obstacles need solid track — skip jumps
		if is_jump and kind in ground_only:
			continue
		var dr: int = OBSTACLE_DR.get(kind, 0)
		if dr > 0 and budget < dr:
			continue

		var obs := _make_obstacle(kind, seg, z, world, rng)
		if obs.is_empty():
			continue

		# Size-aware spacing: ensure obstacles don't overlap in Z
		var obs_half_len: float = obs.get("length", 4.0) * 0.5
		var too_close := false
		for po: Dictionary in placed_obs:
			var required: float = po["half_len"] + obs_half_len + min_spacing * 0.5
			if absf(po["z"] - z) < required:
				too_close = true
				break
		if too_close:
			continue

		obstacles.append(obs)
		placed_obs.append({"z": z, "half_len": obs_half_len})
		budget -= maxi(dr, 0)

	# Bonus / Secret levels: scatter breakable pots everywhere for coin-smashing fun
	if world == 0:
		for seg: Dictionary in segments:
			var seg_len: float = absf(seg["z1"] - seg["z0"])
			var steps: int = maxi(1, int(seg_len / 10.0))
			for s: int in range(steps):
				var t: float = (float(s) + 0.5) / float(steps)
				var pz: float = lerpf(seg["z0"], seg["z1"], t)
				var too_close := false
				for po: Dictionary in placed_obs:
					if absf(po["z"] - pz) < 5.0:
						too_close = true
						break
				if too_close:
					continue
				var pot := _make_obstacle("pot", seg, pz, world, rng)
				if not pot.is_empty():
					obstacles.append(pot)
					placed_obs.append({"z": pz, "half_len": 1.5})

	return obstacles

static func _pick_obstacle_kind(_budget: int, bias: Array, world: int, rng: RandomNumberGenerator) -> String:
	# 75% chance to pick from world bias, 25% fallback to world-appropriate pool
	if rng.randf() < 0.75 and not bias.is_empty():
		return bias[rng.randi_range(0, bias.size() - 1)]
	var pool := _fallback_pool(world)
	return pool[rng.randi_range(0, pool.size() - 1)]

static func _fallback_pool(world: int) -> Array[String]:
	# Obstacle progression: earlier worlds only see their own mechanics
	var base: Array[String] = ["brake_pad", "bumper", "spike", "pot"]
	if world >= 3:
		base.append("gravity")
	if world >= 4:
		base.append("wind")
	if world >= 6:
		base.append("magnet")
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
			obs["type"] = "attract" if rng.randf() > 0.3 else "repel"
			obs["strength"] = rng.randf_range(14.0, 22.0)
			obs["length"] = rng.randf_range(40.0, 70.0)
		"pot":
			# Offset slightly off-center for visual variety, clamped to track bounds
			# Urn radius is ~2.2, keep it inside the track with margin
			var max_offset: float = maxf(0.0, w * 0.5 - 2.3)
			obs["x"] = x + clampf(rng.randf_range(-w * 0.35, w * 0.35), -max_offset, max_offset)
			obs["score_value"] = 15
		_:
			return {}
	return obs

# ── Checkpoint hoop placement ─────────────────────────────────────────────────

static func _build_hoops(segments: Array[Dictionary], _obstacles: Array[Dictionary], world: int, rng: RandomNumberGenerator) -> Array[Dictionary]:
	var hoops: Array[Dictionary] = []

	# ── 1. Score every body segment as a checkpoint candidate ────────────────
	var body_start: int = OPENING_ZONE_SEGS
	var body_end: int = segments.size() - CLOSING_ZONE_SEGS - 1  # exclude runway
	if body_end <= body_start:
		push_warning("[LevelFactory] Level too short for physics-aware hoops — falling back to legacy placement")
		return _build_hoops_legacy(segments, _obstacles, world, rng)

	var candidates: Array[Dictionary] = []
	for i: int in range(body_start, body_end):
		var seg: Dictionary = segments[i]
		var score: float = 0.0
		var z: float = (seg["z0"] + seg["z1"]) * 0.5
		var ramp: float = seg.get("ramp", 0.0)
		var w: float = seg.get("w", 10.0)
		var x: float = seg.get("x", 0.0)
		var has_jump: bool = seg.get("jump", false)

		# Rest-zone scoring: flat/wide segments are ideal checkpoint habitats
		if absf(ramp) <= 0.3:
			score += 50.0
		elif absf(ramp) <= 0.8:
			score += 20.0
		else:
			score -= 30.0

		if w >= 9.0:
			score += 30.0
		elif w >= 7.0:
			score += 10.0
		else:
			score -= 40.0

		# Reward: checkpoint after a hard section (jump or steep downhill)
		if i > body_start:
			var prev_ramp: float = segments[i - 1].get("ramp", 0.0)
			var prev_jump: bool = segments[i - 1].get("jump", false)
			if prev_jump or prev_ramp < -1.0:
				score += 20.0

		# Reward: checkpoint before upcoming build-up (uphill ahead)
		if i < body_end - 1:
			var next_ramp: float = segments[i + 1].get("ramp", 0.0)
			if next_ramp > 0.5:
				score += 10.0

		# Penalty: never place hoop on a jump segment
		if has_jump:
			score -= 100.0

		# Penalty: avoid x discontinuities (player can't see hoop around sharp corners)
		if i > body_start:
			var prev_x: float = segments[i - 1].get("x", 0.0)
			if absf(x - prev_x) > 2.0:
				score -= 20.0

		candidates.append({"seg": seg, "score": score, "z": z, "idx": i})

	candidates.sort_custom(func(a, b): return a["score"] > b["score"])

	# ── 2. Greedily select up to 6 hoops with minimum spacing ─────────────────
	var selected: Array[Dictionary] = []
	var selected_z: Array[float] = []
	var min_hoop_spacing: float = 22.0 if world == 1 else 16.0

	for cand: Dictionary in candidates:
		if selected.size() >= 6:
			break
		var cz: float = cand["z"]
		var too_close := false
		for sz: float in selected_z:
			if absf(sz - cz) < min_hoop_spacing:
				too_close = true
				break
		if too_close:
			continue
		selected.append(cand)
		selected_z.append(cz)

	# Sort front-to-back so boost progression matches level flow
	selected.sort_custom(func(a, b): return a["z"] > b["z"])

	# ── 3. Assign height tiers (ground / mid / high) ──────────────────────────
	# Every level has at least 1 of each tier. Remaining 3 vary by world.
	var tiers: Array[int] = []
	match world:
		1: tiers = [0, 0, 1, 1, 2, 2]  # 2 ground, 2 mid, 2 high — balanced
		2: tiers = [0, 1, 1, 1, 2, 2]  # 1 ground, 3 mid, 2 high
		3: tiers = [0, 1, 1, 2, 2, 2]  # 1 ground, 2 mid, 3 high
		4: tiers = [0, 1, 2, 2, 2, 2]  # 1 ground, 1 mid, 4 high
		5: tiers = [1, 1, 2, 2, 2, 2]  # 0 ground, 2 mid, 4 high
		6: tiers = [1, 2, 2, 2, 2, 2]  # 0 ground, 1 mid, 5 high
		_: tiers = [0, 0, 1, 1, 2, 2]

	# Shuffle so order isn't predictable, but preserve the count
	for _shuffle_idx: int in range(4):
		var swap_a := rng.randi_range(0, tiers.size() - 1)
		var swap_b := rng.randi_range(0, tiers.size() - 1)
		var tmp := tiers[swap_a]
		tiers[swap_a] = tiers[swap_b]
		tiers[swap_b] = tmp

	# Tier definitions: [min_clearance, max_clearance]
	# 0 = ground (roll through), 1 = mid (slight hop), 2 = high (full jump)
	const TIER_CLEARANCE: Array = [
		[0.0, 0.4],
		[0.8, 1.5],
		[2.0, 3.2],
	]

	# ── 4. Build hoop geometry ─────────────────────────────────────────────
	for i: int in range(selected.size()):
		var cand: Dictionary = selected[i]
		var seg: Dictionary = cand["seg"]
		var z: float = cand["z"]
		var base_x: float = seg.get("x", 0.0)
		var w: float = seg.get("w", 10.0)
		var seg_y: float = seg.get("y", 0.0)
		var has_jump: bool = seg.get("jump", false)
		var ramp: float = absf(seg.get("ramp", 0.0))
		var tier: int = tiers[i]

		# Offset scales with tier: ground = centered, mid = moderate, high = wild
		var offset: float
		match tier:
			0:
				# Ground hoops stay near center — player is rolling, not aiming
				offset = rng.randf_range(-1.2, 1.2)
			1:
				# Mid hoops ask for a little steering + timing
				offset = (1.0 if rng.randf() > 0.5 else -1.0) * rng.randf_range(1.5, 2.5)
			2:
				# High hoops demand full commitment — place them wide for risk/reward
				offset = (1.0 if rng.randf() > 0.5 else -1.0) * rng.randf_range(2.5, 4.0)

		var half_w: float = w * 0.5 - 0.5
		if absf(offset) > half_w:
			offset = signf(offset) * half_w

		var clearance_range: Array = TIER_CLEARANCE[tier]
		var clearance: float = rng.randf_range(clearance_range[0], clearance_range[1])

		# Jump ramps give extra lift — add clearance bonus so hoop isn't buried
		if has_jump:
			clearance += rng.randf_range(0.5, 1.0)
		elif ramp >= 2.0:
			clearance += rng.randf_range(0.3, 0.6)

		var y: float = seg_y + 0.7 + clearance

		hoops.append({
			"z": roundf(z * 10.0) / 10.0,
			"x": roundf((base_x + offset) * 10.0) / 10.0,
			"y": roundf(y * 10.0) / 10.0,
			"boost": HOOP_BOOSTS[i],
		})

	return hoops

static func _build_hoops_legacy(segments: Array[Dictionary], _obstacles: Array[Dictionary], world: int, rng: RandomNumberGenerator) -> Array[Dictionary]:
	"""Fallback fixed-percentage placement for levels that are too short for scoring."""
	var hoops: Array[Dictionary] = []
	var total_length: float = 0.0
	for seg: Dictionary in segments:
		total_length += absf(seg["z1"] - seg["z0"])
	var z_positions: Array[float] = []
	for i: int in range(6):
		var t: float = 0.18 + float(i) * 0.11 if world == 1 else float(i + 1) / 7.0
		z_positions.append(-total_length * t)

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

	const TIER_CLEARANCE: Array = [[0.0, 0.4], [0.8, 1.5], [2.0, 3.2]]

	for i: int in range(6):
		var z: float = z_positions[i]
		var seg := _segment_at_z(segments, z)
		if seg.is_empty():
			continue
		var base_x: float = seg.get("x", 0.0)
		var w: float = seg.get("w", 10.0)
		var seg_y: float = seg.get("y", 0.0)
		var tier: int = tiers[i]

		var offset: float
		match tier:
			0: offset = rng.randf_range(-1.2, 1.2)
			1: offset = (1.0 if rng.randf() > 0.5 else -1.0) * rng.randf_range(1.5, 2.5)
			2: offset = (1.0 if rng.randf() > 0.5 else -1.0) * rng.randf_range(2.5, 4.0)

		var half_w: float = w * 0.5 - 0.5
		if absf(offset) > half_w:
			offset = signf(offset) * half_w

		var clearance_range: Array = TIER_CLEARANCE[tier]
		var clearance: float = rng.randf_range(clearance_range[0], clearance_range[1])
		var y: float = seg_y + 0.7 + clearance
		hoops.append({"z": roundf(z), "x": roundf((base_x + offset) * 10.0) / 10.0, "y": roundf(y * 10.0) / 10.0, "boost": HOOP_BOOSTS[i]})
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

static func _compute_finish_z(segments: Array[Dictionary]) -> float:
	if segments.is_empty():
		return -200.0
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

static func _medal_times(par: float) -> Dictionary:
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

static func save_to_file(world: int, level: int, data: Dictionary) -> void:
	var key := "%d-%d" % [world, level]
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
