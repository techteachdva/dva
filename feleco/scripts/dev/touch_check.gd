extends Node

# Dev: synthetic fingers against the real camera.
func _ev(i: int, at: Vector2, rel: Vector2) -> InputEventScreenDrag:
	var d := InputEventScreenDrag.new()
	d.index = i
	d.position = at
	d.relative = rel
	d.velocity = rel * 60.0
	return d

func _tap(i: int, at: Vector2, down: bool) -> InputEventScreenTouch:
	var t := InputEventScreenTouch.new()
	t.index = i
	t.position = at
	t.pressed = down
	return t

func _ready() -> void:
	await get_tree().process_frame
	var world: Node = load("res://scenes/world.tscn").instantiate()
	get_tree().root.add_child(world)
	get_tree().current_scene = world
	await get_tree().create_timer(3.0, true, false, true).timeout
	var sim0: SimulationDirector = world.get_node("World")
	var counts: Dictionary = sim0.get_creature_counts()
	print("ROLES wizards ", counts.get("wizards", 0), " builders ", counts.get("builders", 0))
	var cam: Node = world.get_node("Camera3D")
	cam._touch(_tap(0, Vector2(400, 300), true))
	cam._touch(_tap(1, Vector2(600, 300), true))
	var d0: float = cam._goal_distance
	var y0: float = cam._goal_yaw
	cam._touch(_ev(1, Vector2(800, 300), Vector2(200, 0)))
	print("PINCH ", d0, " -> ", cam._goal_distance)
	cam._touch(_ev(1, Vector2(600, 500), Vector2(-200, 200)))
	print("TWIST ", y0, " -> ", cam._goal_yaw)
	cam._touch(_tap(1, Vector2(600, 500), false))
	var t0: Vector3 = cam._goal_target
	cam._touch(_ev(0, Vector2(440, 300), Vector2(40, 0)))
	await get_tree().process_frame
	cam._touch(_tap(0, Vector2(440, 300), false))
	var t1: Vector3 = cam._goal_target
	await get_tree().create_timer(0.4, true, false, true).timeout
	print("PAN ", t0.distance_to(t1), " GLIDE ", t1.distance_to(cam._goal_target))
	print("TOUCH DONE")
	get_tree().quit()
