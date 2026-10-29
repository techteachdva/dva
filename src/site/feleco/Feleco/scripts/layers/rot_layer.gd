class_name RotLayer
extends CALayer

@export var decay_rate: float = 0.1

func _ready() -> void:
	super()
	max_density = 5.0

func propagate_growth(_dt: float) -> void:
	# No autonomous growth; only external additions
	pass

func diffuse_step(dt: float) -> void:
	_grid = _diffuse(_grid, diffusion_rate * dt, max_density, true, 0.0)

func tick(dt: float) -> void:
	# Exact continuous exponential decay using Euler's constant:
	# N(t+dt) = N(t) * e^(-decay_rate * dt)
	# This is the natural continuous solution rather than the discrete Euler approximation.
	# Traces below 0.0005 are cleared so diffusion skips empty soil.
	var k: float = exp(-decay_rate * dt)
	for i: int in _grid.size():
		var v: float = _grid[i]
		if v <= 0.0:
			continue
		v *= k
		_grid[i] = 0.0 if v < 0.0005 else minf(v, max_density)
	diffuse_step(dt)
