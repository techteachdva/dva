extends Node

# GhostAnalyzer — analyzes player ghosts and suggests factory-level redesigns.
# Aligned with the LevelFactory pattern: instead of hand-patching JSON, we
# diagnose issues, suggest factory parameter changes, and optionally regenerate.
#
# Workflow:
#   1. Player finishes a level, ghost saves to user://ghosts/
#   2. Call GhostAnalyzer.analyze_and_redesign(world, level)
#   3. Analyzer computes metrics, diagnoses issues, regenerates via LevelFactory
#   4. New level is validated with speed profile checks

# Module Database — maps diagnosed issues to recommended factory layouts
# Aligned with CLAUDE.md v2.1 module archetypes and momentum economics
const MODULE_DB: Dictionary = {
	"too_straight":    [LevelFactory.LayoutType.CURVES, LevelFactory.LayoutType.COMBINATION],
	"flat_speed":      [LevelFactory.LayoutType.HILLS, LevelFactory.LayoutType.COMBINATION],
	"death_cluster":   [LevelFactory.LayoutType.STRAIGHTAWAY, LevelFactory.LayoutType.WIDE_TO_SMALL],
	"low_hoop_rate":   [LevelFactory.LayoutType.HILLS, LevelFactory.LayoutType.SMALL_TO_WIDE],
	"speed_variance":  [LevelFactory.LayoutType.COMBINATION, LevelFactory.LayoutType.HILLS],
	"narrow_panic":    [LevelFactory.LayoutType.STRAIGHTAWAY, LevelFactory.LayoutType.SMALL_TO_WIDE],
	"no_momentum_arc": [LevelFactory.LayoutType.HILLS, LevelFactory.LayoutType.WIDE_TO_SMALL],
}

const LEVELS_DIR := "res://levels/"

# Sacred physics parameters from CLAUDE.md — do not change without research
const SACRED_PHYSICS := {
	"max_forward_speed": 32.0,
	"forward_push": 7.0,
	"speed_ramp_rate": 1.2,
	"gravity_scale": 1.25,
}

const LEARNED_RULES := {
	"min_variance": 1.5,
	"target_speed_cv": [0.20, 0.45],
	"checkpoint_before_death": 12.0,
	"max_steering_ratio": 0.60,
	"min_hoop_rate": 0.45,
	"min_momentum_cycles": 2,
}

# ── Public API ────────────────────────────────────────────────────────────────

func analyze_and_redesign(world: int, level: int) -> void:
	var key := "%d-%d" % [world, level]
	var ghost := GhostManager.load_ghost(world, level)
	if ghost.is_empty():
		push_warning("[GhostAnalyzer] No ghost data for %s — play the level first." % key)
		return

	var samples: Array[Dictionary] = _to_dict_array(ghost.get("samples", []))
	if samples.is_empty():
		push_warning("[GhostAnalyzer] Ghost has no samples for %s" % key)
		return
	if samples.size() < 30:
		push_warning("[GhostAnalyzer] Ghost too short (%d samples) for %s — play the level first." % [samples.size(), key])
		return

	var total_time: float = samples[-1].get("t", 0.0) - samples[0].get("t", 0.0)
	if total_time < 3.0:
		push_warning("[GhostAnalyzer] Ghost too brief (%.1fs) for %s — play the level first." % [total_time, key])
		return

	var metrics := _analyze(samples)
	print("[GhostAnalyzer] %s: variance=%.2f | cv=%.2f | steer=%.2f | deaths=%d | hoop_rate=%.2f | avg_speed=%.1f | cycles=%d | top_speed=%.1f" % [
		key,
		metrics.lateral_variance,
		metrics.speed_cv,
		metrics.steer_ratio,
		metrics.death_positions.size(),
		metrics.hoop_rate,
		metrics.avg_speed,
		metrics.momentum_cycles,
		metrics.top_speed,
	])

	if metrics.lateral_variance == 0.0 and metrics.speed_cv == 0.0 and metrics.steer_ratio == 0.0:
		push_warning("[GhostAnalyzer] %s ghost data is all zeros — level was not meaningfully played." % key)
		return

	var diagnosis := _diagnose(metrics)
	if diagnosis.is_empty():
		print("[GhostAnalyzer] %s is good. No factory changes needed." % key)
		return

	print("[GhostAnalyzer] %s DIAGNOSIS: %s" % [key, ", ".join(diagnosis)])

	# Suggest module replacements from Module Database
	var suggested_layouts := _suggest_layouts(diagnosis)
	print("[GhostAnalyzer] %s SUGGESTED LAYOUTS: %s" % [key, ", ".join(suggested_layouts)])

	# Regenerate with a new seed, forcing the suggested layout
	var new_seed := hash("%s-%d" % [key, Time.get_ticks_msec()])
	var forced_layout: int = -1
	if not suggested_layouts.is_empty():
		forced_layout = _layout_from_name(suggested_layouts[0])

	var new_layout := _regenerate(world, level, new_seed, forced_layout)
	if new_layout.is_empty():
		push_error("[GhostAnalyzer] Regeneration failed for %s" % key)
		return

	# Validate speed profile
	var validation := _validate_speed_profile(new_layout)
	print("[GhostAnalyzer] %s SPEED PROFILE: %s" % [key, validation.status])
	if not validation.passed:
		print("[GhostAnalyzer] %s VALIDATION ISSUES: %s" % [key, ", ".join(validation.issues)])

	# Save the regenerated level
	_save_level_data(key, new_layout)
	LevelFactory.save_to_file(world, level, new_layout)
	print("[GhostAnalyzer] %s REGENERATED with seed %d, layout=%s" % [key, new_seed, new_layout.get("name", "Unknown")])
	print("[GhostAnalyzer] Play again to validate.")

func analyze_only(world: int, level: int) -> Dictionary:
	"""Read ghost and return metrics + diagnosis without modifying level."""
	var ghost := GhostManager.load_ghost(world, level)
	if ghost.is_empty():
		return {}
	var samples: Array[Dictionary] = _to_dict_array(ghost.get("samples", []))
	var m := _analyze(samples)
	var diagnosis := _diagnose(m)
	return {
		"lateral_variance": m.lateral_variance,
		"speed_cv": m.speed_cv,
		"steer_ratio": m.steer_ratio,
		"death_positions": m.death_positions,
		"hoop_rate": m.hoop_rate,
		"avg_speed": m.avg_speed,
		"momentum_cycles": m.momentum_cycles,
		"time_in_narrow": m.time_in_narrow,
		"top_speed": m.top_speed,
		"diagnosis": diagnosis,
		"suggested_layouts": _suggest_layouts(diagnosis),
	}

# ── Metrics ─────────────────────────────────────────────────────────────────────

class Metrics:
	var lateral_variance: float = 0.0
	var speed_cv: float = 0.0
	var steer_ratio: float = 0.0
	var death_positions: Array[Vector3] = []
	var hoop_rate: float = 0.0
	var avg_speed: float = 0.0
	var momentum_cycles: int = 0
	var time_in_narrow: float = 0.0  # seconds in w <= 7
	var top_speed: float = 0.0

func _analyze(samples: Array[Dictionary]) -> Metrics:
	var m := Metrics.new()
	m.lateral_variance = _calc_variance(samples, "px")
	m.speed_cv = _calc_speed_cv(samples)
	m.steer_ratio = _calc_steer_ratio(samples)
	m.death_positions = _extract_deaths(samples)
	m.hoop_rate = _calc_hoop_rate(samples)
	m.avg_speed = _calc_avg_speed(samples)
	m.momentum_cycles = _calc_momentum_cycles(samples)
	m.time_in_narrow = _calc_time_in_narrow(samples)
	m.top_speed = _calc_top_speed(samples)
	return m

func _calc_variance(samples: Array[Dictionary], key: String) -> float:
	if samples.is_empty():
		return 0.0
	var sum := 0.0
	for s in samples:
		sum += s.get(key, 0.0)
	var mean := sum / samples.size()
	var variance := 0.0
	for s in samples:
		var diff: float = float(s.get(key, 0.0)) - mean
		variance += diff * diff
	return variance / samples.size()

func _calc_speed_cv(samples: Array[Dictionary]) -> float:
	if samples.is_empty():
		return 0.0
	var speeds: Array[float] = []
	for s in samples:
		var vz := absf(s.get("vz", 0.0))
		if vz > 0.01:
			speeds.append(vz)
	if speeds.is_empty():
		return 0.0
	var mean := 0.0
	for sp in speeds:
		mean += sp
	mean /= speeds.size()
	var variance := 0.0
	for sp in speeds:
		var d := sp - mean
		variance += d * d
	var stddev := sqrt(variance / speeds.size())
	return stddev / maxf(mean, 0.001)

func _calc_steer_ratio(samples: Array[Dictionary]) -> float:
	if samples.is_empty():
		return 0.0
	var steer_count := 0
	for s in samples:
		if absf(s.get("steer", 0.0)) > 0.1:
			steer_count += 1
	return float(steer_count) / samples.size()

func _extract_deaths(samples: Array[Dictionary]) -> Array[Vector3]:
	var deaths: Array[Vector3] = []
	for s in samples:
		if s.get("dead", false):
			deaths.append(Vector3(s.get("px", 0.0), s.get("py", 0.0), s.get("pz", 0.0)))
	return deaths

func _calc_hoop_rate(samples: Array[Dictionary]) -> float:
	# Heuristic: high vertical variance + jump inputs = hoop engagement
	if samples.is_empty():
		return 0.0
	var jump_count := 0
	var high_y_count := 0
	for s in samples:
		if s.get("jump", false):
			jump_count += 1
		if s.get("py", 0.0) > 2.5:
			high_y_count += 1
	return clampf((float(jump_count) + float(high_y_count)) / (samples.size() * 0.1), 0.0, 1.0)

func _calc_avg_speed(samples: Array[Dictionary]) -> float:
	if samples.is_empty():
		return 0.0
	var total := 0.0
	for s in samples:
		var v := Vector3(s.get("vx", 0.0), s.get("vy", 0.0), s.get("vz", 0.0))
		total += v.length()
	return total / samples.size()

func _calc_momentum_cycles(samples: Array[Dictionary]) -> int:
	# Detect Build-Up → Release → Rest arcs from speed profile
	if samples.is_empty():
		return 0
	var cycles := 0
	var phase := 0  # 0=rest, 1=build, 2=release
	for s in samples:
		var vz := absf(s.get("vz", 0.0))
		if phase == 0 and vz > 15.0:
			phase = 2  # jumped straight to release
		elif phase == 0 and vz > 8.0:
			phase = 1  # build
		elif phase == 1 and vz > 18.0:
			phase = 2  # release
		elif phase == 2 and vz < 8.0:
			cycles += 1
			phase = 0
	return cycles

func _calc_time_in_narrow(samples: Array[Dictionary]) -> float:
	var dt := 1.0 / 60.0  # assume 60 Hz ghost sampling
	var total := 0.0
	for s in samples:
		if s.get("track_w", 10.0) <= 7.0:
			total += dt
	return total

func _calc_top_speed(samples: Array[Dictionary]) -> float:
	var best := 0.0
	for s in samples:
		var v := Vector3(s.get("vx", 0.0), s.get("vy", 0.0), s.get("vz", 0.0))
		best = maxf(best, v.length())
	return best

# ── Diagnosis ───────────────────────────────────────────────────────────────────

func _diagnose(metrics: Metrics) -> Array[String]:
	var issues: Array[String] = []

	if metrics.lateral_variance < LEARNED_RULES.min_variance:
		issues.append("too_straight")

	if metrics.speed_cv < LEARNED_RULES.target_speed_cv[0] and metrics.speed_cv > 0.0:
		issues.append("flat_speed")

	if metrics.speed_cv > LEARNED_RULES.target_speed_cv[1]:
		issues.append("speed_variance")

	if not metrics.death_positions.is_empty():
		issues.append("death_cluster")

	if metrics.steer_ratio > LEARNED_RULES.max_steering_ratio:
		issues.append("narrow_panic")

	if metrics.hoop_rate < LEARNED_RULES.min_hoop_rate:
		issues.append("low_hoop_rate")

	if metrics.momentum_cycles < LEARNED_RULES.min_momentum_cycles:
		issues.append("no_momentum_arc")

	return issues

func _suggest_layouts(issues: Array[String]) -> Array[String]:
	var layouts: Array[String] = []
	for issue in issues:
		var candidates: Array = MODULE_DB.get(issue, [])
		for c in candidates:
			var layout_name := _layout_name(c)
			if not layouts.has(layout_name):
				layouts.append(layout_name)
	return layouts

func _layout_name(layout_type: int) -> String:
	match layout_type:
		LevelFactory.LayoutType.STRAIGHTAWAY:  return "STRAIGHTAWAY"
		LevelFactory.LayoutType.WIDE_TO_SMALL: return "WIDE_TO_SMALL"
		LevelFactory.LayoutType.SMALL_TO_WIDE: return "SMALL_TO_WIDE"
		LevelFactory.LayoutType.CURVES:        return "CURVES"
		LevelFactory.LayoutType.HILLS:         return "HILLS"
		LevelFactory.LayoutType.COMBINATION:   return "COMBINATION"
	return ""

func _layout_from_name(layout_name_str: String) -> int:
	match layout_name_str:
		"STRAIGHTAWAY":  return LevelFactory.LayoutType.STRAIGHTAWAY
		"WIDE_TO_SMALL": return LevelFactory.LayoutType.WIDE_TO_SMALL
		"SMALL_TO_WIDE": return LevelFactory.LayoutType.SMALL_TO_WIDE
		"CURVES":        return LevelFactory.LayoutType.CURVES
		"HILLS":         return LevelFactory.LayoutType.HILLS
		"COMBINATION":   return LevelFactory.LayoutType.COMBINATION
	return -1

# ── Regeneration ──────────────────────────────────────────────────────────────────

func _regenerate(world: int, level: int, seed_: int, forced_layout: int = -1) -> Dictionary:
	"""Generate a new level using LevelFactory with optional layout override."""
	var logic_world: int = world if world > 0 else 1
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_

	var layout_type: int
	if forced_layout >= 0:
		layout_type = forced_layout
	else:
		layout_type = LevelFactory._pick_layout(world, level, rng)

	var segments := LevelFactory._build_segments(layout_type, world, level, rng)
	var finish_z := LevelFactory._compute_finish_z(segments)
	var obstacles := LevelFactory._build_obstacles(segments, logic_world, level, rng)
	var hoops := LevelFactory._build_hoops(segments, obstacles, world, rng, finish_z, false)
	var par_time := LevelFactory._compute_par_time(segments)

	var all_obstacles: Array[Dictionary] = []
	all_obstacles.append_array(obstacles)
	for h: Dictionary in hoops:
		all_obstacles.append({
			"kind": "hoop",
			"z": h.z,
			"x": h.x,
			"y": h.y,
		})

	var level_name := LevelFactory._level_name(world, level, layout_type)

	return {
		"name": level_name,
		"slope": rng.randi_range(9, 14),
		"par_time": par_time,
		"segments": segments,
		"coins": [],
		"finish_z": finish_z,
		"checkpoints": LevelFactory._hoop_z_positions(hoops),
		"obstacles": all_obstacles,
		"time_tiers": LevelFactory._par_time_tiers(par_time),
	}

# ── Speed Profile Validation ────────────────────────────────────────────────────

class ValidationResult:
	var passed: bool = true
	var status: String = "PASS"
	var issues: Array[String] = []

func _validate_speed_profile(layout: Dictionary) -> ValidationResult:
	var result := ValidationResult.new()
	var segments: Array[Dictionary] = _to_dict_array(layout.get("segments", []))
	if segments.is_empty():
		result.passed = false
		result.status = "FAIL"
		result.issues.append("no_segments")
		return result

	var speed := 10.0
	var max_speed: float = SACRED_PHYSICS.max_forward_speed
	for seg in segments:
		var ramp: float = seg.get("ramp", 0.0)
		var length: float = absf(seg.get("z1", 0.0) - seg.get("z0", 0.0))
		var is_ice: bool = seg.get("ice", false)
		var is_jump: bool = seg.get("jump", false)
		var has_boost: bool = false  # conservative: assume no boost

		# Uphill reduces speed (ramp > 0 = uphill in our coord system)
		if ramp > 0.0:
			speed -= ramp * 2.5
		# Downhill increases speed
		if ramp < 0.0:
			speed += absf(ramp) * 3.0
		# Boost pad adds speed
		if has_boost:
			speed += 16.0 * 0.8
		# Ice reduces friction decay
		if is_ice:
			speed *= 0.98
		# Flat sections decay speed
		if ramp == 0.0 and not is_ice:
			speed *= 0.90
		# Clamp to physics limits
		speed = clampf(speed, 0.0, max_speed)

		# Gap requires minimum speed
		if is_jump:
			var required: float = length * 0.4
			if speed < required * 0.8:
				result.passed = false
				result.issues.append("gap_impossible:z=%s" % str(seg.get("z0", 0.0)))
		# Speed should not bleed to zero on long uphills
		if speed < 2.0:
			result.passed = false
			result.issues.append("speed_bleed:z=%s" % str(seg.get("z0", 0.0)))

	if not result.passed:
		result.status = "FAIL"
	return result

# ── Helpers ─────────────────────────────────────────────────────────────────────

func _load_level_data(key: String) -> Dictionary:
	var path := LEVELS_DIR + "%s.json" % key
	if FileAccess.file_exists(path):
		var file := FileAccess.open(path, FileAccess.READ)
		if file:
			var parsed: Variant = JSON.parse_string(file.get_as_text())
			if parsed is Dictionary:
				return parsed
	return {}

func _save_level_data(key: String, layout: Dictionary) -> void:
	var path := LEVELS_DIR + "%s.json" % key
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(layout, "\t"))
		file.close()

func _to_dict_array(arr: Array) -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	for item: Variant in arr:
		if item is Dictionary:
			out.append(item as Dictionary)
	return out
