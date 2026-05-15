extends AnimatableBody3D
class_name MovingPlatform

@export var move_distance: float   = 5.5
@export var move_axis:     Vector3 = Vector3(1.0, 0.0, 0.0)  # X = side, Y = up/down
@export var move_speed:    float   = 3.2
@export var pause_time:    float   = 0.35

var origin:    Vector3
var travel:    float  = 0.0
var direction: float  = 1.0
var pausing:   bool   = false

@onready var pause_timer: Timer = $PauseTimer

func _ready() -> void:
	origin                 = global_position
	pause_timer.wait_time  = pause_time
	pause_timer.one_shot   = true
	pause_timer.timeout.connect(func(): pausing = false)

func _physics_process(delta: float) -> void:
	if pausing:
		return
	travel += move_speed * delta * direction
	if absf(travel) >= move_distance:
		travel    = clampf(travel, -move_distance, move_distance)
		direction *= -1.0
		pausing   = true
		pause_timer.start()
	global_position = origin + move_axis.normalized() * travel
