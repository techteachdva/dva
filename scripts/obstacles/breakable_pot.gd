extends ObstacleBase
class_name BreakablePot

@export var pot_color: Color = Color(0.72, 0.48, 0.28, 1.0)

var _broken: bool = false

func _ready() -> void:
	super._ready()
	obstacle_name = "Breakable Pot"
	one_shot = true
	score_value = 15

func _on_player_enter(player: Node3D) -> void:
	if _broken:
		return
	var is_slamming: bool = false
	if player.get("_slam_state") != null:
		is_slamming = int(player._slam_state) != 0  # SlamState.NONE == 0
	var falling_fast: bool = player.linear_velocity.y < -3.0
	var fast_enough: bool = player.linear_velocity.length() >= 8.0
	if is_slamming or falling_fast or fast_enough:
		_break(player)

func _break(_player: Node3D) -> void:
	_broken = true
	cleared = true
	GameManager.obstacle_cleared()
	obstacle_cleared.emit()

	# Instantly award 1-10 coins
	var coin_count: int = randi_range(1, 10)
	for i: int in range(coin_count):
		GameManager.add_coin()

	# Visual coin burst — spawn fake coins that fly outward and vanish
	_spawn_coin_burst(coin_count)

	# Trigger particle burst before destroying the pot
	for child: Node in get_children():
		if child is GPUParticles3D and child.name == "BreakBurst":
			child.restart()

	# Physical destruction via Destruction plugin
	var destruction: Node = get_node_or_null("Destruction")
	if destruction != null and destruction.has_method("destroy"):
		destruction.destroy(12.0)
	else:
		# Fallback: hide mesh and disable collision
		for child: Node in get_children():
			if child is MeshInstance3D:
				child.visible = false
			if child is CollisionShape3D:
				child.disabled = true

	if get_node_or_null("/root/AudioManager") != null:
		AudioManager.play_sfx("coin")

func _spawn_coin_burst(count: int) -> void:
	var container: Node = get_parent() if get_parent() != null else get_tree().current_scene
	if container == null:
		return

	for i: int in range(min(count, 12)):
		var visual := MeshInstance3D.new()
		var cyl := CylinderMesh.new()
		cyl.height = 0.12
		cyl.top_radius = 0.18
		cyl.bottom_radius = 0.18
		visual.mesh = cyl
		visual.transform.basis = Basis.from_euler(Vector3(deg_to_rad(90), 0, 0))

		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(1.0, 0.78, 0.05, 1.0)
		mat.metallic = 0.85
		mat.roughness = 0.25
		mat.emission_enabled = true
		mat.emission = Color(1.0, 0.65, 0.0, 1.0)
		mat.emission_energy_multiplier = 2.0
		visual.set_surface_override_material(0, mat)

		container.add_child(visual)
		visual.global_position = global_position + Vector3(
			randf_range(-1.2, 1.2),
			randf_range(1.0, 2.5),
			randf_range(-1.2, 1.2)
		)

		# Scene-tree tween so it survives pot being freed
		var tw := get_tree().create_tween().set_parallel()
		var dir := Vector3(randf_range(-1.0, 1.0), randf_range(0.5, 2.0), randf_range(-1.0, 1.0)).normalized()
		tw.tween_property(visual, "global_position", visual.global_position + dir * randf_range(2.0, 5.0), 0.45).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_QUINT)
		tw.tween_property(visual, "rotation:y", visual.rotation.y + randf_range(-PI * 2.0, PI * 2.0), 0.5)
		tw.chain().tween_property(visual, "scale", Vector3.ZERO, 0.18).set_ease(Tween.EASE_IN).set_trans(Tween.TRANS_BACK)
		tw.chain().tween_callback(visual.queue_free)

func _force_reset() -> void:
	_broken = false
	cleared = false
	for child: Node in get_children():
		if child is MeshInstance3D:
			child.visible = true
		if child is CollisionShape3D:
			child.disabled = false
