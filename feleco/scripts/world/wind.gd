class_name Wind
extends Node

# The valley's wind: an invisible vector field that carries seeds (4.7).
#   direction   a prevailing wind for each season, bent by slow swirling
#               noise so it eddies around the valley instead of blowing flat
#   strength    calm at night, rising to a peak at midday
#   powers      Gale whips it up, Rain stills it, Drought brings hot gusts
# sample(pos) gives the wind there (metres a second, flat XZ). Trees and
# bushes drop their seeds downwind (see seed_drift).

# Prevailing wind by season: [direction in degrees (0 = toward +x), strength].
const SEASONS: Dictionary = {
	"Spring": [10.0, 4.0],    # a westerly
	"Summer": [100.0, 2.5],   # soft southerly breezes
	"Autumn": [215.0, 6.0],   # the blustery north-easterly
	"Winter": [300.0, 4.5],   # cold air spilling off the peaks
}
const NIGHT_FLOOR: float = 0.15
const MAX_SPEED: float = 20.0

var director: SimulationDirector
var _noise := FastNoiseLite.new()
var _t: float = 0.0
# A power's hold on the wind: a strength multiplier and how long it lasts.
var power_mult: float = 1.0
var power_left: float = 0.0
var power_dir: float = INF

func _ready() -> void:
	_noise.seed = 4703
	_noise.frequency = 0.025
	_noise.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	_build_streaks()

# What you see of the wind: faint pale streaks drifting with it around the
# camera, thicker and quicker the harder it blows. Gone on a still night.
var _streaks: CPUParticles3D

func _build_streaks() -> void:
	_streaks = CPUParticles3D.new()
	_streaks.name = "WindStreaks"
	_streaks.amount = 48
	_streaks.lifetime = 2.6
	_streaks.local_coords = false
	_streaks.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	_streaks.emission_box_extents = Vector3(26.0, 2.5, 26.0)
	_streaks.gravity = Vector3.ZERO
	_streaks.spread = 8.0
	_streaks.particle_flag_align_y = true
	var quad := QuadMesh.new()
	quad.size = Vector2(0.05, 2.2)
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.vertex_color_use_as_albedo = true
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	quad.material = mat
	_streaks.mesh = quad
	var fade := Gradient.new()
	fade.set_color(0, Color(1, 1, 1, 0))
	fade.set_color(1, Color(1, 1, 1, 0))
	fade.add_point(0.3, Color(1, 1, 1, 0.22))
	fade.add_point(0.7, Color(1, 1, 1, 0.22))
	_streaks.color_ramp = fade
	add_child(_streaks)

func _update_streaks() -> void:
	if _streaks == null:
		return
	var cam := get_viewport().get_camera_3d()
	if cam == null:
		return
	var at: Vector3 = cam.global_position
	var focus: Vector3 = at - cam.global_basis.z * 20.0
	focus.y = (director.ground_height(focus.x, focus.z) if director != null else 0.0) + 2.0
	_streaks.global_position = focus
	var w := sample(focus)
	var speed: float = w.length()
	_streaks.emitting = speed > 1.0
	if speed <= 1.0:
		return
	_streaks.direction = Vector3(w.x, 0.0, w.z).normalized()
	_streaks.initial_velocity_min = speed * 1.6
	_streaks.initial_velocity_max = speed * 2.4
	_streaks.speed_scale = clampf(0.6 + speed * 0.12, 0.6, 2.5)

func _process(delta: float) -> void:
	_t += delta * 0.05
	_update_streaks()
	if power_left > 0.0:
		power_left -= delta * Clock.LIFE_PACE
		if power_left <= 0.0:
			power_mult = 1.0
			power_dir = INF

# 0 at night (well, a whisper), 1 at noon.
func diurnal() -> float:
	if director == null:
		return 1.0
	var lit: float = Clock.SECONDS_PER_DAY * director.day_share()
	var t: float = director.seconds_into_day()
	if lit <= 0.0 or t > lit:
		return NIGHT_FLOOR
	return NIGHT_FLOOR + (1.0 - NIGHT_FLOOR) * sin(PI * clampf(t / lit, 0.0, 1.0))

func prevailing() -> Array:
	var season: String = director.get_season() if director != null else "Spring"
	return SEASONS.get(season, SEASONS["Spring"])

# The wind at a point, flat (y = 0). Always finite and bounded.
func sample(pos: Vector3) -> Vector3:
	var p: Array = prevailing()
	var deg: float = float(p[0]) if power_dir == INF else power_dir
	var swirl: float = _noise.get_noise_3d(pos.x, pos.z, _t * 10.0) * 0.9
	var gust: float = 0.7 + 0.6 * (_noise.get_noise_3d(pos.x * 0.5 + 100.0, pos.z * 0.5, _t * 20.0) * 0.5 + 0.5)
	var speed: float = float(p[1]) * diurnal() * power_mult * gust
	var a: float = deg_to_rad(deg) + swirl
	var v := Vector3(cos(a), 0.0, sin(a)) * clampf(speed, 0.0, MAX_SPEED)
	return v if v.is_finite() else Vector3.ZERO

# Where a seed dropped at pos lands: carried downwind, further on a windy day.
func seed_drift(pos: Vector3) -> Vector3:
	var w := sample(pos)
	return pos + w * randf_range(2.6, 6.0) + Vector3(randf_range(-2.5, 2.5), 0.0, randf_range(-2.5, 2.5))

# Powers: Gale (howling, from a random quarter), Rain (still air), Drought (hot gusts).
func gale() -> void:
	power_mult = 3.0
	power_dir = randf() * 360.0
	power_left = Clock.BIO_PER_DAY * 0.5

func calm() -> void:
	power_mult = 0.3
	power_left = Clock.BIO_PER_DAY * 0.5

func hot_gusts() -> void:
	power_mult = 1.6
	power_left = Clock.BIO_PER_DAY * 0.75

func describe() -> String:
	var w := sample(Vector3.ZERO)
	var deg: float = fposmod(rad_to_deg(atan2(w.z, w.x)), 360.0)
	return "%.1f m/s toward %d°  (season %s, daytime x%.2f, power x%.1f%s)" % [w.length(), int(deg), director.get_season() if director != null else "?", diurnal(), power_mult, (", %.1f days left" % (power_left / Clock.BIO_PER_DAY)) if power_left > 0.0 else ""]
