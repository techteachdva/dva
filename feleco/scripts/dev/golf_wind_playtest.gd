extends SceneTree

# A Windy hole used to coast forever: multiplicative drag never falls below
# the wind's terminal speed, so a missed putt never ended. This drives the
# real roll step on open ground and requires the seed to stop, while the
# wind still pushes it sideways.
#   godot --path . -s res://scripts/dev/golf_wind_playtest.gd

func _initialize() -> void:
	_run.call_deferred()

func _roll(g: Control, wind: Vector2, seconds: float) -> Dictionary:
	# Open left side of the first fairway, clear of the centre hill.
	g._seed = Vector2(200, 400)
	g._vel = Vector2(0, -220)
	g._wind = wind
	g._cond = ["Windy", 0.45, wind.length()] if wind.length_squared() > 0.0 else ["Calm", 0.45, 0.0]
	g._rolling = true
	g._strokes = 1
	g._phase = g.Phase.PUTT
	var t: float = 0.0
	var dt: float = 1.0 / 360.0
	while g._rolling and t < seconds:
		g._step(dt)
		t += dt
	return {"rolling": g._rolling, "t": t, "at": g._seed, "speed": g._vel.length()}

func _run() -> void:
	var g: Control = (load("res://scenes/minigames/seed_golf.tscn") as PackedScene).instantiate()
	root.add_child(g)
	await process_frame
	g._start_level(0)
	var calm: Dictionary = _roll(g, Vector2.ZERO, 12.0)
	var windy: Dictionary = _roll(g, Vector2(90, 0), 12.0)
	var ok: bool = not calm["rolling"] and not windy["rolling"]
	# The wind has to do something: a sideways push, not a no-op.
	ok = ok and float(windy["at"].x) > float(calm["at"].x) + 30.0
	print("GOLF calm rolling=%s t=%.2f at=%s" % [calm["rolling"], calm["t"], calm["at"]])
	print("GOLF windy rolling=%s t=%.2f at=%s speed=%.1f" % [windy["rolling"], windy["t"], windy["at"], windy["speed"]])
	if not ok:
		print("GOLF WIND FAIL")
		quit(1)
		return
	print("GOLF WIND PASS")
	quit(0)
