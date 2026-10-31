extends CanvasLayer

const FloatingTextScript := preload("res://scripts/effects/floating_text.gd")

var _camera: Camera3D = null
var _world: Node3D = null
var _original_cam_pos: Vector3 = Vector3.ZERO

var _death_accum: int = 0
var _death_accum_timer: float = 0.0

# Throttling counters
var _fx_this_second: int = 0
var _fx_second_timer: float = 0.0
const FX_BUDGET_PER_SEC: int = 15

# Object pools
var _particle_pools: Dictionary = {}  # type -> Array[CPUParticles3D]
var _text_pool: Array[FloatingText] = []
const POOL_SIZE: int = 20

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	# Beneath the HUD (layer 1): world labels must not draw over open windows.
	layer = 0
	# Flash overlay - must NOT block mouse input
	var flash := ColorRect.new()
	flash.name = "FlashOverlay"
	flash.color = Color.TRANSPARENT
	flash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	flash.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(flash)
	# Pre-warm pools
	_init_text_pool()

func _init_text_pool() -> void:
	for i in range(POOL_SIZE):
		var label: FloatingText = FloatingTextScript.new() as FloatingText
		label.visible = false
		label._started = false
		label._on_done = Callable(self, "_return_text_to_pool")
		add_child(label)
		_text_pool.append(label)

func _return_text_to_pool(label: FloatingText) -> void:
	label.visible = false
	label._started = false
	label._elapsed = 0.0
	label._is_dramatic = false
	label._shake_intensity = 0.0
	label._life = 1.5
	label._on_done = Callable(self, "_return_text_to_pool")

func _find_camera() -> Camera3D:
	if _camera != null and is_instance_valid(_camera):
		return _camera
	var root := get_tree().current_scene
	if root == null:
		return null
	_camera = root.get_node_or_null("Camera3D") as Camera3D
	if _camera == null:
		_camera = _find_camera_recursive(root)
	if _camera != null:
		_original_cam_pos = _camera.position
	return _camera

func _find_camera_recursive(node: Node) -> Camera3D:
	for child in node.get_children():
		if child is Camera3D:
			return child as Camera3D
		var found := _find_camera_recursive(child)
		if found != null:
			return found
	return null

func _find_world() -> Node3D:
	if _world != null and is_instance_valid(_world):
		return _world
	var root := get_tree().current_scene
	if root == null:
		return null
	_world = root.get_node_or_null("World") as Node3D
	return _world

func _process(delta: float) -> void:
	# Mass death events now show dramatic floating text instead of intrusive camera shake
	_death_accum_timer -= delta
	if _death_accum_timer <= 0.0:
		_death_accum_timer = 2.0
		if _death_accum >= 10:
			show_dramatic_text(Vector3.ZERO, "MASS DEATH!", Color(0.9, 0.1, 0.1))
		_death_accum = 0

	# Replenish FX budget once per second
	_fx_second_timer -= delta
	if _fx_second_timer <= 0.0:
		_fx_second_timer = 1.0
		_fx_this_second = 0

func _has_budget() -> bool:
	if _fx_this_second >= FX_BUDGET_PER_SEC:
		return false
	_fx_this_second += 1
	return true

# ------------------------------------------------------------------
# Particle pool helpers
# ------------------------------------------------------------------
func _get_pooled_particle(type: String) -> CPUParticles3D:
	var pool: Array = _particle_pools.get(type, [])
	var idx: int = 0
	var p = null
	while idx < pool.size():
		p = pool[idx]
		if not is_instance_valid(p):
			pool.remove_at(idx)
			continue
		if not p.emitting:
			return p
		idx += 1
	# No inactive particle: create new one
	p = CPUParticles3D.new()
	pool.append(p)
	_particle_pools[type] = pool
	return p

func _configure_particle(p: CPUParticles3D, cfg: Dictionary) -> void:
	p.one_shot = true
	p.explosiveness = cfg.get("explosiveness", 1.0)
	p.amount = cfg.get("amount", 8)
	p.lifetime = cfg.get("lifetime", 0.6)
	p.direction = cfg.get("direction", Vector3.UP)
	p.spread = cfg.get("spread", 90.0)
	p.gravity = cfg.get("gravity", Vector3(0, 4, 0))
	p.initial_velocity_min = cfg.get("initial_velocity_min", 2.0)
	p.initial_velocity_max = cfg.get("initial_velocity_max", 5.0)
	p.scale_amount_min = cfg.get("scale_amount_min", 0.1)
	p.scale_amount_max = cfg.get("scale_amount_max", 0.25)
	p.color = cfg.get("color", Color.WHITE)

func _spawn_particle(type: String, pos: Vector3, cfg: Dictionary) -> void:
	if not _has_budget():
		return
	var p := _get_pooled_particle(type)
	_configure_particle(p, cfg)
	var world := _find_world()
	if world == null:
		p.emitting = false
		return
	if p.get_parent() != world:
		if p.get_parent() != null:
			p.get_parent().remove_child(p)
		world.add_child(p)
	p.global_position = pos + Vector3.UP * 0.5
	p.emitting = true
	var delay: float = cfg.get("lifetime", 0.6) + 0.2
	var tween := create_tween()
	# The particle may be gone by then (freed with the world on a scene change).
	tween.tween_callback(func() -> void:
		if is_instance_valid(p):
			p.emitting = false).set_delay(delay)

# ------------------------------------------------------------------
# Public spawn API
# ------------------------------------------------------------------
func spawn_birth_particles(pos: Vector3, color: Color) -> void:
	_spawn_particle("birth", pos, {
		"explosiveness": 1.0, "amount": 8, "lifetime": 0.6,
		"direction": Vector3.UP, "spread": 90.0, "gravity": Vector3(0, 4, 0),
		"initial_velocity_min": 2.0, "initial_velocity_max": 5.0,
		"scale_amount_min": 0.1, "scale_amount_max": 0.25, "color": color,
	})

func spawn_death_particles(pos: Vector3, color: Color) -> void:
	_spawn_particle("death", pos, {
		"explosiveness": 0.8, "amount": 12, "lifetime": 0.8,
		"direction": Vector3.UP, "spread": 180.0, "gravity": Vector3(0, -2, 0),
		"initial_velocity_min": 1.0, "initial_velocity_max": 4.0,
		"scale_amount_min": 0.1, "scale_amount_max": 0.3, "color": color.darkened(0.4),
	})

func spawn_combat_particles(pos: Vector3) -> void:
	_spawn_particle("combat", pos, {
		"explosiveness": 1.0, "amount": 6, "lifetime": 0.4,
		"direction": Vector3.UP, "spread": 60.0, "gravity": Vector3.ZERO,
		"initial_velocity_min": 1.0, "initial_velocity_max": 3.0,
		"scale_amount_min": 0.05, "scale_amount_max": 0.15, "color": Color(0.9, 0.1, 0.1),
	})

func spawn_heal_particles(pos: Vector3) -> void:
	_spawn_particle("heal", pos, {
		"explosiveness": 0.6, "amount": 4, "lifetime": 0.6,
		"direction": Vector3.UP, "spread": 30.0, "gravity": Vector3(0, -1, 0),
		"initial_velocity_min": 0.5, "initial_velocity_max": 2.0,
		"scale_amount_min": 0.05, "scale_amount_max": 0.12, "color": Color(0.3, 0.9, 0.3),
	})

func spawn_graze_particles(pos: Vector3) -> void:
	_spawn_particle("graze", pos, {
		"explosiveness": 1.0, "amount": 3, "lifetime": 0.4,
		"direction": Vector3.UP, "spread": 45.0, "gravity": Vector3(0, 1, 0),
		"initial_velocity_min": 0.3, "initial_velocity_max": 1.0,
		"scale_amount_min": 0.03, "scale_amount_max": 0.08, "color": Color(0.2, 0.8, 0.2),
	})

func show_floating_text(world_pos: Vector3, text: String, color: Color, is_crit: bool = false) -> void:
	if text == "+0":
		return
	if not _has_budget():
		return
	# Births are constant; a few labels say so without burying the valley.
	if text.begins_with("Baby ") and randf() > 0.25:
		return
	var label: FloatingText = null
	for l in _text_pool:
		if not l.visible:
			label = l
			break
	if label == null:
		return
	label.setup(world_pos, text, color, is_crit)
	label._on_done = Callable(self, "_return_text_to_pool")
	label.visible = true
	label._started = false
	label._elapsed = 0.0
	label.call_deferred("_do_start")

func screen_shake(_intensity: float, _duration: float) -> void:
	pass  # Camera shake disabled: replaced by dramatic floating text for better UX

func show_dramatic_text(world_pos: Vector3, text: String, color: Color) -> void:
	if not _has_budget():
		return
	# Births are constant; a few labels say so without burying the valley.
	if text.begins_with("Baby ") and randf() > 0.25:
		return
	var label: FloatingText = null
	for l in _text_pool:
		if not l.visible:
			label = l
			break
	if label == null:
		return
	label.setup_dramatic(world_pos, text, color)
	label._on_done = Callable(self, "_return_text_to_pool")
	label.visible = true
	label._started = false
	label._elapsed = 0.0
	label.call_deferred("_do_start")

func flash_vignette(color: Color, duration: float) -> void:
	var flash := get_node_or_null("FlashOverlay") as ColorRect
	if flash == null:
		return
	flash.color = color
	flash.modulate.a = 0.22
	var tween := create_tween()
	tween.tween_property(flash, "modulate:a", 0.0, duration)
	tween.tween_callback(func() -> void: flash.color = Color.TRANSPARENT)

func report_death(_species: String) -> void:
	_death_accum += 1
	if _death_accum_timer <= 0.0:
		_death_accum_timer = 2.0
