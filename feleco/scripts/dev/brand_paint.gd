extends Node

# Dev-only: paints on creatures with real mouse input (a drag, the eraser,
# colour over a part, Undo, Clear) and photographs the studio and the valley.
#   godot --path . res://scenes/dev/brand_paint.tscn -- <out dir> [WxH]

const CASES: Array[String] = ["sheep", "falcon", "human"]

var _out: String = "user://brand_paint"
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

func _win(at: Vector2) -> Vector2:
	return get_viewport().get_final_transform() * at

func _move(at: Vector2, held: bool) -> void:
	var mv := InputEventMouseMotion.new()
	mv.position = _win(at)
	mv.global_position = mv.position
	if held:
		mv.button_mask = MOUSE_BUTTON_MASK_LEFT
	Input.parse_input_event(mv)
	await _wait(2)

func _button_event(at: Vector2, down: bool) -> void:
	var b := InputEventMouseButton.new()
	b.button_index = MOUSE_BUTTON_LEFT
	b.position = _win(at)
	b.global_position = b.position
	b.pressed = down
	if down:
		b.button_mask = MOUSE_BUTTON_MASK_LEFT
	Input.parse_input_event(b)
	await _wait(2)

func _click(c: Control) -> void:
	var at: Vector2 = c.get_global_rect().get_center()
	await _move(at, false)
	await _button_event(at, true)
	await _button_event(at, false)
	await _wait(3)

func _drag(from: Vector2, to: Vector2) -> void:
	await _move(from, false)
	await _button_event(from, true)
	for i: int in range(1, 9):
		await _move(from.lerp(to, i / 8.0), true)
	await _button_event(to, false)
	await _wait(3)

func _button(root_node: Node, text: String) -> Button:
	for n: Node in root_node.find_children("*", "Button", true, false):
		if (n as Button).text.begins_with(text):
			return n
	return null

func _inked(data: AgentData) -> int:
	var img: Image = BrandBook.canvas(data)
	var count: int = 0
	for y: int in BrandBook.PAINT_TILE:
		for x: int in BrandBook.PAINT_TILE:
			if img.get_pixel(x, y).a > 0.5:
				count += 1
	return count

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
	for sp: String in CASES:
		var agent: MarkovAgent = null
		for d: AgentData in dir._agent_registry:
			if d.species == sp and d.node is MarkovAgent and is_instance_valid(d.node):
				agent = d.node
				break
		if agent == null:
			_ok("found " + sp, false)
			continue
		var studio := BrandStudio.new()
		studio.agent = agent
		hud.add_child(studio)
		await _wait(6)
		var panel := studio.get_node("StudioPanel") as Panel
		_ok(sp + " panel on screen", get_viewport().get_visible_rect().encloses(panel.get_global_rect()))
		await _click(_button(panel, "Paint"))
		var stage := panel.get_node("Stage") as Control
		var box: Rect2 = stage.get_global_rect()
		var mid: Vector2 = box.get_center()
		var span: float = box.size.x * 0.22
		await _drag(mid - Vector2(span, 0), mid + Vector2(span, 0))
		var a: int = _inked(agent._data)
		_ok(sp + " drag paints", a > 200, str(a))
		await _click(_button(panel, "Eraser"))
		await _drag(mid - Vector2(10, 0), mid + Vector2(10, 0))
		var b: int = _inked(agent._data)
		_ok(sp + " eraser removes", b < a, "%d -> %d" % [a, b])
		await _click(_button(panel, "Undo"))
		_ok(sp + " undo restores", _inked(agent._data) == a, str(_inked(agent._data)))
		await _click(_button(panel, "Eraser"))
		await _click(_button(panel, "Colour over"))
		var c: int = _inked(agent._data)
		_ok(sp + " colour over a part", c > a, str(c))
		await _click(_button(panel, "Undo"))
		await _click(_button(panel, "Clear"))
		_ok(sp + " clear", _inked(agent._data) == 0)
		await _click(_button(panel, "Undo"))
		_ok(sp + " undo a clear", _inked(agent._data) == a)
		# A blue stripe across the body for the pictures.
		var blue: Button = null
		var tools := panel.get_node("Tools")
		var swatches: Array = []
		for n: Node in tools.find_children("*", "Button", true, false):
			if (n as Button).text.is_empty():
				swatches.append(n)
		_ok(sp + " sixteen swatches", swatches.size() == 16, str(swatches.size()))
		blue = swatches[14]
		await _click(blue)
		await _click(_button(panel, "Broad"))
		await _drag(mid + Vector2(-span, -span * 0.5), mid + Vector2(span, -span * 0.5))
		await _wait(4)
		get_viewport().get_texture().get_image().save_png(_out + "/" + sp + "_studio.png")
		await _click(_button(panel, "Done"))
		_ok(sp + " Done closes", not is_instance_valid(studio))
		hud.visible = false
		cam.follow(null)
		cam.set_view(agent.global_position, 0.3, deg_to_rad(-20.0), 18.0 if sp == "falcon" else 7.0, true)
		await _wait(8)
		var shot: Image = get_viewport().get_texture().get_image()
		shot.save_png(_out + "/" + sp + "_full.png")
		var lift: float = 9.0 if agent._data.species == "falcon" else 1.0
		var at: Vector2 = cam.unproject_position(agent._data.shown + Vector3.UP * lift) * (Vector2(shot.get_size()) / get_viewport().get_visible_rect().size)
		var crop: Image = shot.get_region(Rect2i(Vector2i(at) - Vector2i(160, 130), Vector2i(320, 260)).intersection(Rect2i(Vector2i.ZERO, shot.get_size())))
		crop.resize(640, 520)
		crop.save_png(_out + "/" + sp + "_valley.png")
		hud.visible = true
	print("PAINT FAILS ", _fails)
	tree.quit()
