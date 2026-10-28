extends SceneTree

# Dev playtest of Mycelium Sweep: a bot plays every level like a careful
# player (proves a cell safe by the numbers before digging, guesses only when
# stuck) and logs the Fun Factor inputs: frontier size (P), rocks on the
# frontier (O), guesses, strikes and whether it cleared the level.
#   godot --path . -s res://scripts/dev/sweep_playtest.gd -- <out dir>

func _initialize() -> void:
	_run.call_deferred()

# Cells the numbers prove safe right now.
func _proven_safe(g: Control) -> Array:
	var safe: Dictionary = {}
	for i: int in g._count():
		if not g._open[i] or g._kind[i] == 2:
			continue
		var need: int = g._rocks_near(i)
		var unknown: Array = []
		for j: int in g._neighbors(i):
			if g._open[j] and g._kind[j] == 2:
				need -= 1
			elif g._flag[j]:
				need -= 1
			elif not g._open[j]:
				unknown.append(j)
		if need == 0:
			for j: int in unknown:
				safe[j] = true
		elif need == unknown.size():
			for j: int in unknown:
				g._flag[j] = true
	return safe.keys()

func _run() -> void:
	var out: String = OS.get_cmdline_user_args()[0]
	var g: Control = (load("res://scenes/minigames/mycelium_sweep.tscn") as PackedScene).instantiate()
	root.add_child(g)
	await process_frame
	for c: Node in g.get_children():
		if c is ColorRect:
			c.queue_free()
	for lv: int in g.LEVELS.size():
		var p_sum: float = 0.0
		var o_sum: float = 0.0
		var n: int = 0
		var guesses: int = 0
		var clears: int = 0
		var strikes: int = 0
		var games: int = 12
		for gi: int in games:
			g._start(lv)
			var steps: int = 0
			while g._mode == "play" and steps < 80:
				steps += 1
				var front: Array = []
				var rocks: int = 0
				for i: int in g._count():
					if g._frontier(i) and not g._flag[i]:
						front.append(i)
						if g._kind[i] == 2:
							rocks += 1
				if front.is_empty():
					break
				p_sum += front.size()
				o_sum += 1.0 + rocks
				n += 1
				var safe: Array = _proven_safe(g).filter(func(i: int) -> bool: return g._frontier(i))
				var pick: int = -1
				if not safe.is_empty():
					# Chase corpses: prefer safe cells next to mushroom dots.
					safe.sort_custom(func(a: int, b: int) -> bool: return g._corpses_near(a) > g._corpses_near(b))
					pick = safe[0]
				else:
					guesses += 1
					pick = front[randi() % front.size()]
				g._dig(pick)
				if g._reached and safe.is_empty() and randf() < 0.5:
					g._end(true)
			if g._mode == "play" and g._reached:
				g._end(true)
			if g._reached:
				clears += 1
			strikes += g._strikes
			if gi == 0 and lv in [0, 3, 5]:
				for k: int in 30:
					await process_frame
				root.get_texture().get_image().save_png(out + "/sweep_l%d.png" % lv)
		print("SWEEP L%d P=%.2f O=%.2f guesses/game=%.2f clears=%d/%d strikes/game=%.2f" % [lv + 1, p_sum / maxf(n, 1), o_sum / maxf(n, 1), float(guesses) / games, clears, games, float(strikes) / games])
	quit()
