extends Node

# Dev: a close look at a mossy tree.
func _ready() -> void:
	await get_tree().process_frame
	var world: Node = load("res://scenes/world.tscn").instantiate()
	get_tree().root.add_child(world)
	get_tree().current_scene = world
	await get_tree().create_timer(4.0).timeout
	for c: Node in world.find_children("*", "CanvasLayer", true, false):
		(c as CanvasLayer).visible = false
	var sim: SimulationDirector = world.get_node("World")
	var mossy: int = 0
	var trees: Array = sim.get_node("Trees").get_children()
	var pick: Node3D = trees[0]
	for t: Node in trees:
		if t.mossy:
			mossy += 1
			pick = t
	print("MOSSY ", mossy, " of ", trees.size())
	pick.mossy = true
	pick.moss = 1.0
	pick._dress_crown()
	var cam: Camera3D = world.get_node("Camera3D")
	cam.set_view(pick.global_position, cam.yaw, -0.2, 14.0, true)
	await get_tree().create_timer(1.0).timeout
	get_viewport().get_texture().get_image().save_png(OS.get_cmdline_user_args()[0])
	get_tree().quit()
