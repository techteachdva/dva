extends Node

# Dev-only: releasing the camera must not look like the creature died.
# godot --headless --path . res://scenes/dev/camera_follow_playtest.tscn

var _fails: int = 0

func _ready() -> void:
	var cam: Camera3D = $Cam
	cam.set_process(false)
	var body: Node3D = $Body
	var corpse: Node3D = $Corpse
	cam.follow(body)
	# The carcass is where the body stands, as a real death leaves it.
	_ok("following the live body", cam.following() == body)
	body.queue_free()
	await get_tree().process_frame
	_ok("a death stays on the carcass", cam.following() == corpse)

	var again := Node3D.new()
	again.position = corpse.position
	add_child(again)
	cam.follow(again)
	cam.release_follow()
	_ok("letting go does not grab the carcass", cam.following() == null)
	cam.follow(again)
	cam.follow(null)
	_ok("Stop does not grab the carcass", cam.following() == null)
	cam.follow(again)
	cam.snap_top_down()
	_ok("Top Down does not grab the carcass", cam.following() == null)
	cam.follow(again)
	cam.reset_view()
	_ok("reset view does not grab the carcass", cam.following() == null)
	if _fails == 0:
		print("CAM all passed")
	else:
		print("CAM FAILED %d" % _fails)
	get_tree().quit(1 if _fails > 0 else 0)

func _ok(name: String, cond: bool) -> void:
	if cond:
		print("CAM OK ", name)
	else:
		_fails += 1
		print("CAM FAIL ", name)
