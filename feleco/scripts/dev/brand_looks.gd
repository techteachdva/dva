extends Node

# Dev-only: brands creatures with real mouse clicks in the studio (school,
# colour, size, hide, Done) and photographs the studio and the valley.
#   godot --path . res://scenes/dev/brand_looks.tscn -- <out dir> [WxH]

const CASES: Array = [["sheep", "light"], ["sheep", "dark"], ["wolf", "light"], ["wolf", "dark"], ["human", "light"], ["human", "dark"]]

var _out: String = "user://brand_looks"
var _fails: int = 0

func _ready() -> void:
	_run.call_deferred()

func _ok(name: String, cond: bool, detail: String = "") -> void:
	print(("OK " if cond else "FAIL ") + name + " " + detail)
	if not cond:
		_fails += 1

func _wait(n: int) -> void:
	for _i: int in n:
		await get_tree().process_frame

# A real click, through the same stretch transform a mouse goes through.
func _click(c: Control) -> void:
	var at: Vector2 = get_viewport().get_final_transform() * c.get_global_rect().get_center()
	var mv := InputEventMouseMotion.new()
	mv.position = at
	mv.global_position = at
	Input.parse_input_event(mv)
	await _wait(2)
	for down: bool in [true, false]:
		var b := InputEventMouseButton.new()
		b.button_index = MOUSE_BUTTON_LEFT
		b.position = at
		b.global_position = at
		b.pressed = down
		if down:
			b.button_mask = MOUSE_BUTTON_MASK_LEFT
		Input.parse_input_event(b)
		await _wait(2)

func _button(root_node: Node, text: String) -> Button:
	for n: Node in root_node.find_children("*", "Button", true, false):
		if (n as Button).text == text:
			return n
	return null

func _run() -> void:
	var tree := get_tree()
	var root := tree.root
	get_parent().remove_child(self)
	root.add_child(self)
	tree.current_scene = null
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		_out = args[0]
	if args.size() > 1:
		var wh: PackedStringArray = args[1].split("x")
		get_window().mode = Window.MODE_WINDOWED
		get_window().size = Vector2i(int(wh[0]), int(wh[1]))
		await _wait(5)
	DirAccess.make_dir_recursive_absolute(_out)
	var gc: Node = get_node("/root/GameConfig")
	gc.intro_seen = true
	gc.tutorial_done = true
	gc.current_mode = "main"
	gc.main_claim = false
	tree.change_scene_to_file("res://scenes/world.tscn")
	await tree.scene_changed
	var scene: Node = tree.current_scene
	await _wait(50)
	var ld := scene.find_child("LoadingScreen", true, false)
	if ld != null:
		ld.queue_free()
	tree.paused = false
	await _wait(40)
	var hud: Node = scene.find_child("SimulationHUD", true, false)
	var dir := scene.get_node("World") as SimulationDirector
	dir.process_mode = Node.PROCESS_MODE_DISABLED
	(dir.get("_visual_proxy_manager") as Node).process_mode = Node.PROCESS_MODE_ALWAYS
	var cam := scene.get_node("Camera3D") as Camera3D
	var used: Array = []
	for c: Array in CASES:
		var agent: MarkovAgent = null
		for d: AgentData in dir._agent_registry:
			if d.species == c[0] and d.node is MarkovAgent and is_instance_valid(d.node) and not used.has(d.node):
				agent = d.node
				break
		if agent == null:
			_ok("found " + str(c[0]), false)
			continue
		used.append(agent)
		var name: String = "%s_%s" % [c[0], c[1]]
		var studio := BrandStudio.new()
		studio.agent = agent
		hud.add_child(studio)
		await _wait(6)
		var panel := studio.get_node("StudioPanel") as Panel
		var view: Rect2 = get_viewport().get_visible_rect()
		_ok(name + " panel on screen", view.encloses(panel.get_global_rect()), str(panel.get_global_rect()))
		await _click(_button(panel, "Dark magic" if c[1] == "dark" else "Light magic"))
		await _wait(3)
		_ok(name + " school", str(agent._data.brand.get("school", "")) == c[1])
		var swatches: Array = []
		for n: Node in panel.get_node("Tools").find_children("*", "Button", true, false):
			if (n as Button).text.is_empty():
				swatches.append(n)
		_ok(name + " swatches", swatches.size() == 8, str(swatches.size()))
		var pick: int = 5 if c[1] == "light" else 2
		var want: Color = (swatches[pick] as Button).get_theme_stylebox("normal").bg_color
		await _click(swatches[pick])
		await _wait(3)
		_ok(name + " clicked colour", (agent._data.brand["parts"]["head"]["color"] as Color).is_equal_approx(want))
		await _click(_button(panel, "Back"))
		await _wait(3)
		await _click(_button(panel, "Grand"))
		await _wait(3)
		_ok(name + " clicked size", is_equal_approx(float(agent._data.brand["parts"]["back"]["size"]), 0.75))
		await _wait(4)
		get_viewport().get_texture().get_image().save_png(_out + "/" + name + "_studio.png")
		await _click(_button(panel, "Done"))
		await _wait(4)
		_ok(name + " Done closes", not is_instance_valid(studio))
		hud.visible = false
		var p: Vector3 = agent.global_position
		cam.follow(null)
		cam.set_view(p, 0.3, deg_to_rad(-20.0), 7.0, true)
		await _wait(8)
		var shot: Image = get_viewport().get_texture().get_image()
		var at: Vector2 = cam.unproject_position(agent._data.shown + Vector3.UP) * (Vector2(shot.get_size()) / get_viewport().get_visible_rect().size)
		var box := Rect2i(Vector2i(at) - Vector2i(160, 130), Vector2i(320, 260)).intersection(Rect2i(Vector2i.ZERO, shot.get_size()))
		var crop: Image = shot.get_region(box)
		crop.resize(640, 520)
		crop.save_png(_out + "/" + name + "_valley.png")
		hud.visible = true
	print("BRAND LOOK FAILS ", _fails)
	tree.quit()
