extends SceneTree

# Dev: measures Fun Factor inputs from real play (see the Design3R skill's
# fun-factor.md). Valley Dominion is played by its own AI for every clan;
# at each of the player clan's turns we log the legal moves (P) and how
# many of them are threatened (O): rival fights, starving tiles, the wolves.
#   godot --headless --path . -s res://scripts/dev/fff_measure.gd

func _initialize() -> void:
	_run.call_deferred()

func _run() -> void:
	var games: int = 6
	var p_sum: float = 0.0
	var o_sum: float = 0.0
	var n: int = 0
	var places: Array = []
	for gi: int in games:
		var g: Control = (load("res://scenes/minigames/valley_dominion.tscn") as PackedScene).instantiate()
		root.add_child(g)
		await process_frame
		var clan: String = ["human", "bear", "boar", "robin", "human", "bear"][gi]
		g._start(clan)
		for turn: int in 12:
			# One band a turn: decision 1 picks the band (a tile), then up to
			# three moves from it. P and O averaged over those four decisions.
			var bands: int = 0
			var t_sum: float = 0.0
			var r_sum: float = 0.0
			for t: Vector2i in g._tiles_of(clan):
				if int(g._pop[g._idx(t)]) < 2:
					continue
				bands += 1
				for to: Vector2i in g._targets(t, clan):
					t_sum += 1.0
					var i: int = g._idx(to)
					var rival: bool = g._owner[i] != "" and g._owner[i] != clan
					var hungry: bool = int(g._food[i]) < 2
					var wolfy: bool = g._wolf.x >= 0 and absi(g._wolf.x - to.x) + absi(g._wolf.y - to.y) <= 1
					if rival or hungry or wolfy:
						r_sum += 1.0
			if bands > 0:
				var per_t: float = t_sum / bands
				var per_r: float = r_sum / bands
				p_sum += (float(bands) + 3.0 * per_t) / 4.0
				# Board-wide pressure on every decision: the winter clock from
				# summer on, and a wolf pack loose on the board.
				var pressure: float = (1.0 if turn >= 4 else 0.0) + (1.0 if g._wolf.x >= 0 else 0.0) + (1.0 if turn >= 8 else 0.0)
				o_sum += (1.0 + pressure + 3.0 * (1.0 + per_r + pressure)) / 4.0
				n += 1
			g._ai_turn(clan)
			g._end_turn()
			if g._mode != "play":
				break
		var mine: int = g._clan_pop(clan)
		var place: int = 1
		for c: String in g._clans:
			if c != clan and g._clan_pop(c) > mine:
				place += 1
		places.append(place)
		g.queue_free()
		await process_frame
	print("FFF dominion decisions=%d P=%.2f O=%.2f places=%s" % [n, p_sum / maxf(n, 1), o_sum / maxf(n, 1), str(places)])
	quit()
