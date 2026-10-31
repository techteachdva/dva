extends Node

# One creature, every brand part a different shape, photographed up close.
#   godot --path . res://scenes/dev/brand_parts.tscn -- <out dir> [era]

const SHAPES: Dictionary = {
	"legs": 1, "tail": 4, "belly": 2, "back": 3, "neck": 5, "head": 6, "crown": 6,
}

var _out: String = "user://brand_parts"
var _era: String = "valley"
var _species: String = "sheep"

func _ready() -> void:
	_run.call_deferred()

func _wait(n: int) -> void:
	for _i: int in n:
		await get_tree().process_frame

func _run() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		_out = args[0]
	if args.size() > 1:
		_era = args[1]
	if args.size() > 2:
		_species = args[2]
	DirAccess.make_dir_recursive_absolute(_out)
	get_window().mode = Window.MODE_WINDOWED
	get_window().size = Vector2i(1280, 720)
	var gc: Node = get_node("/root/GameConfig")
	gc.intro_seen = true
	gc.tutorial_done = true
	gc.current_mode = "main"
	gc.sprite_era = _era
	var scene: Node = load("res://scenes/world.tscn").instantiate()
	get_tree().root.add_child(scene)
	get_tree().current_scene = scene
	await _wait(40)
	var loading := scene.find_child("LoadingScreen", true, false)
	if loading != null:
		loading.queue_free()
	get_tree().paused = false
	await _wait(20)
	var director: SimulationDirector = scene.get_node("World") as SimulationDirector
	var creature: MarkovAgent = director.spawn_scripted(_species, Vector3(2.0, 0.0, 8.0))
	var data: AgentData = creature._data
	data.brand = BrandBook.fresh("light")
	for part: String in SHAPES.keys():
		data.brand["parts"][part]["shape"] = int(SHAPES[part])
		data.brand["parts"][part]["size"] = 1.0
	BrandBook.ensure(data)
	BrandBook.paint(data)
	var proxy: Node = director.get("_visual_proxy_manager")
	if proxy != null:
		proxy.process_mode = Node.PROCESS_MODE_ALWAYS
	await _wait(8)
	var hud: Node = scene.find_child("SimulationHUD", true, false)
	if hud != null:
		for c in hud.get_children():
			if c is CanvasItem:
				(c as CanvasItem).visible = false
	var cam := scene.get_node("Camera3D") as Camera3D
	cam.follow(creature)
	cam.set_view(creature.global_position, 0.4, deg_to_rad(-28.0), 10.0, true)
	await _wait(20)
	cam.set_view(creature.global_position, 0.4, deg_to_rad(-28.0), 10.0, true)
	await _wait(2)
	var img := get_viewport().get_texture().get_image()
	var file := "%s/%s_%s.png" % [_out, _era, _species]
	img.save_png(file)
	print("SHOT ", file, " slot=", data.brand_slot, " at=", creature.global_position, " dist=", cam.distance)
	get_tree().quit()
