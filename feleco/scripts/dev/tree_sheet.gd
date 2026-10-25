extends SceneTree

# Dev-only: one grown tree per season, side by side.
# godot --path . -s res://scripts/dev/tree_sheet.gd -- --out=<png>
func _initialize() -> void:
	var out: String = "user://trees.png"
	for a: String in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out = a.substr(6)
	var root := Node3D.new()
	get_root().add_child(root)
	var env := WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_COLOR
	env.environment.background_color = Color(0.55, 0.7, 0.85)
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.environment.ambient_light_color = Color(0.6, 0.65, 0.7)
	root.add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation = Vector3(deg_to_rad(-40), deg_to_rad(-35), 0)
	sun.shadow_enabled = true
	root.add_child(sun)
	var ground := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(60, 30)
	ground.mesh = pm
	var gm := StandardMaterial3D.new()
	gm.albedo_color = Color(0.36, 0.52, 0.24)
	ground.material_override = gm
	root.add_child(ground)
	var trees: Array = []
	var seasons: Array[String] = ["Spring", "Summer", "Autumn", "Winter"]
	for i: int in 4:
		var t: Node3D = load("res://scenes/tree.tscn").instantiate()
		t.position = Vector3(-10.5 + i * 7.0, 0, 0)
		t.set_process(false)
		root.add_child(t)
		trees.append(t)
	var cam := Camera3D.new()
	cam.position = Vector3(0, 4.5, 17)
	cam.fov = 50
	root.add_child(cam)
	cam.transform = Transform3D(Basis(), cam.position).looking_at(Vector3(0, 3.0, 0))
	await process_frame
	for i: int in 4:
		trees[i]._season = ""
		trees[i].apply_season(seasons[i])
		# A few growth ticks: buds, swelling green fruit, ripening red.
		for g: int in 5:
			trees[i]._grow_fruit()
	for k: int in 8:
		await process_frame
	get_root().get_texture().get_image().save_png(out)
	quit()
