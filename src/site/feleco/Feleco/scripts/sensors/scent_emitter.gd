class_name ScentEmitter
extends Node3D

@export var scent_strength: float = 1.0
@export var scent_decay_rate: float = 0.5

var _network_id: int = -1
var _director: SimulationDirector = null

func _ready() -> void:
	# The director steps every emitter in one batch (see step()).
	set_process(false)
	var node := get_parent()
	while node != null:
		if node is SimulationDirector:
			_director = node as SimulationDirector
			break
		node = node.get_parent()
	if _director != null:
		_director.register_scent_emitter(self)

func _enter_tree() -> void:
	# Pooled creatures leave and re-enter the tree; _ready only runs once.
	if _director != null:
		_director.register_scent_emitter(self)

func _exit_tree() -> void:
	if _director == null:
		return
	_director.unregister_scent_emitter(self)
	# Let the last scent fade out instead of hanging in the valley forever.
	if _network_id >= 0:
		_director.scent_network.release(_network_id, scent_decay_rate)
		_network_id = -1

func _ensure_registered() -> void:
	if _network_id >= 0:
		return
	if _director != null:
		_network_id = _director.scent_network.add_node(global_position, scent_strength)

func emit_scent(intensity: float) -> void:
	if _director == null:
		return
	if _network_id < 0:
		_network_id = _director.scent_network.add_node(global_position, intensity)
	else:
		_director.scent_network.update_node(_network_id, global_position, intensity)

func step(delta: float) -> void:
	if _director == null:
		return
	if _network_id < 0:
		_ensure_registered()
	if _network_id >= 0:
		_director.scent_network.decay(_network_id, scent_decay_rate * delta)
		var w := _director.scent_network.get_weight(_network_id)
		if w <= 0.0:
			_network_id = -1
