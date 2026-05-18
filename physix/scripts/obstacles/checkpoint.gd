extends Hoop
class_name Checkpoint

## Legacy checkpoint scenes upgrade to hex hoop visuals at runtime.

func _ready() -> void:
	for child: Node in get_children():
		child.queue_free()
	build_visuals()
	super._ready()
