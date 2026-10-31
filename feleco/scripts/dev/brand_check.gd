extends Node

# Claims a sheep, brands its head, and saves pictures of the hand, the studio,
# and the creature in the valley.
#   godot --path . res://scenes/dev/brand_check.tscn -- <out dir>

var _out: String
var _fails: int = 0

func _ready() -> void:
	_run.call_deferred()

func _ok(name: String, cond: bool, detail: String = "") -> void:
	print(("OK " if cond else "FAIL ") + name + (" " + detail if not detail.is_empty() else ""))
	if not cond:
		_fails += 1

func _shot(name: String) -> void:
	var img := get_viewport().get_texture().get_image()
	img.save_png(_out + "/" + name + ".png")
	print("SHOT ", name)

func _run() -> void:
	_out = OS.get_cmdline_user_args()[0] if OS.get_cmdline_user_args().size() > 0 else "user://brand_check"
	DirAccess.make_dir_recursive_absolute(_out)
	var gc: Node = get_node("/root/GameConfig")
	gc.intro_seen = true
	gc.tutorial_done = true
	gc.current_mode = "main"
	gc.main_claim = false
	# Keep this node alive. change_scene would free it with the starter scene.
	var scene: Node = load("res://scenes/world.tscn").instantiate()
	get_tree().root.add_child(scene)
	get_tree().current_scene = scene
	for _i: int in 40:
		await get_tree().process_frame
	_ok("world loaded", scene != null and scene.name == "Main", str(scene))
	var hud: Node = scene.find_child("SimulationHUD", true, false)
	var goals: Node = scene.find_child("Goals", true, false)
	_ok("hud and goals", hud != null and goals != null)
	# Skip the loading poster so the valley is on screen.
	var loading := scene.find_child("LoadingScreen", true, false)
	if loading != null:
		loading.queue_free()
	get_tree().paused = false
	for _i: int in 30:
		await get_tree().process_frame
	var sheep: MarkovAgent = null
	var director: SimulationDirector = scene.get_node("World") as SimulationDirector
	for data: AgentData in director._agent_registry:
		if data.species == "sheep" and data.node is MarkovAgent and is_instance_valid(data.node):
			sheep = data.node
			break
	_ok("found a sheep", sheep != null and sheep._data != null, sheep.display_name if sheep != null else "")
	if sheep == null:
		get_tree().quit(1)
		return
	# Overpopulation culling can delete the sheep mid-test. Freeze the valley
	# and keep the sprite proxy drawing.
	director.process_mode = Node.PROCESS_MODE_DISABLED
	var visuals := director.get("_visual_proxy_manager") as Node
	if visuals != null:
		visuals.process_mode = Node.PROCESS_MODE_ALWAYS
	var cam := scene.get_node("Camera3D") as Camera3D
	cam.follow(sheep)
	cam.set_view(sheep.global_position, cam.yaw, cam.pitch, 16.0, true)
	for _i: int in 8:
		await get_tree().process_frame
	_shot("before")
	hud.call("_lift_in_hand", sheep)
	for _i: int in 400:
		await get_tree().process_frame
		if scene.get_node_or_null("SpectralHand") != null and hud.get_node_or_null("HandChoices") != null:
			break
	var hand := scene.get_node_or_null("SpectralHand")
	var choices := hud.get_node_or_null("HandChoices")
	_ok("hand appeared", hand != null)
	_ok("hand choices", choices != null)
	_shot("hand")
	var claim := _button_named(choices, "Claim")
	_ok("claim button", claim != null)
	if claim != null:
		claim.pressed.emit()
	for _i: int in 5:
		await get_tree().process_frame
	_ok("claimed", goals.companion == sheep, str(goals.companion))
	# Claim in a normal run does not open the studio. Brand does.
	var brand_btn := _button_named(choices, "Brand")
	_ok("brand button", brand_btn != null)
	if brand_btn != null:
		brand_btn.pressed.emit()
	for _i: int in 8:
		await get_tree().process_frame
	var studio := hud.find_child("BrandStudio", true, false)
	if studio == null:
		# The studio is a Control added to the hud; it has no name of its own.
		for c in hud.get_children():
			if c is BrandStudio:
				studio = c
				break
	_ok("studio open", studio != null)
	_shot("studio")
	_ok("sheep lived", is_instance_valid(sheep))
	if not is_instance_valid(sheep) or sheep._data == null:
		print("BRAND FAILS ", _fails + 1)
		get_tree().quit(1)
		return
	_ok("brand slot", sheep._data.brand_slot > 0, str(sheep._data.brand_slot))
	var before: Color = BrandBook.atlas().get_image().get_pixel(10, sheep._data.brand_slot)
	studio.call("_set_part", "color", Color(1, 0, 0))
	for _i: int in 3:
		await get_tree().process_frame
	var after: Color = BrandBook.atlas().get_image().get_pixel(10, sheep._data.brand_slot)
	_ok("head colour painted", after.r > 0.9 and after.g < 0.1, str(after))
	_ok("colour actually changed", not after.is_equal_approx(before), str(before) + " -> " + str(after))
	studio.call("_set_part", "shape", 6)
	studio.call("_set_part", "size", 1.0)
	for _i: int in 4:
		await get_tree().process_frame
	var shape_px: Color = BrandBook.atlas().get_image().get_pixel(11, sheep._data.brand_slot)
	_ok("horn shape stored", shape_px.r > 0.9, str(shape_px))
	_shot("studio_red")
	# Swatch buttons must not all write the last colour in the row.
	var tools := studio.find_child("Tools", true, false)
	var swatches: Array[Button] = []
	if tools != null:
		for n in tools.get_children():
			_collect_swatches(n, swatches)
	_ok("colour swatches", swatches.size() >= 2, str(swatches.size()))
	if swatches.size() >= 2:
		swatches[1].pressed.emit()
		for _i: int in 3:
			await get_tree().process_frame
		var swatch: Color = BrandBook.atlas().get_image().get_pixel(10, sheep._data.brand_slot)
		_ok("second swatch is gold not white", swatch.g > 0.7 and swatch.r > 0.9 and swatch.b < 0.5, str(swatch))
	# Leave the head red for the valley picture. The gold swatch already proved
	# the buttons are not all wired to the last colour.
	studio.call("_set_part", "color", Color(1, 0, 0))
	for _i: int in 3:
		await get_tree().process_frame
	studio.queue_free()
	var choices2 := hud.get_node_or_null("HandChoices")
	if choices2 != null:
		var follow := _button_named(choices2, "Follow")
		if follow != null:
			follow.pressed.emit()
	for _i: int in 90:
		await get_tree().process_frame
		if scene.get_node_or_null("SpectralHand") == null:
			break
	_ok("hand set the sheep down", scene.get_node_or_null("SpectralHand") == null)
	for c in hud.get_children():
		if c is CanvasItem:
			(c as CanvasItem).visible = false
	var proxy: Node = director.get("_visual_proxy_manager") as Node
	if proxy != null:
		for species in proxy._proxies:
			if str(species) != "sheep":
				(proxy._proxies[species] as Node3D).visible = false
	cam.follow(sheep)
	cam.set_view(sheep.global_position, 0.4, deg_to_rad(-22.0), 5.5, true)
	for _i: int in 8:
		await get_tree().process_frame
	_ok("still branded in the valley", sheep._data.brand_slot > 0 and not sheep._data.brand.is_empty())
	_shot("valley")
	var shot := get_viewport().get_texture().get_image()
	var reds := 0
	for y in range(0, shot.get_height(), 2):
		for x in range(0, shot.get_width(), 2):
			var px := shot.get_pixel(x, y)
			if px.r > 0.62 and px.g < 0.35 and px.b < 0.35:
				reds += 1
	_ok("red head is on the sheep", reds > 20, "reds %d" % reds)
	print("BRAND FAILS ", _fails)
	get_tree().quit(1 if _fails > 0 else 0)

func _collect_swatches(n: Node, into: Array[Button]) -> void:
	if n is Button and (n as Button).text.is_empty() and (n as Button).custom_minimum_size.x <= 40.0 and (n as Button).custom_minimum_size.x > 0.0:
		into.append(n)
	for c in n.get_children():
		_collect_swatches(c, into)

func _button_named(root_node: Node, text: String) -> Button:
	if root_node == null:
		return null
	for n in root_node.find_children("*", "Button", true, false):
		if n is Button and (n as Button).text == text:
			return n
	return null
