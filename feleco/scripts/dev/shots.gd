extends Node

# Dev-only screenshot harness; not exported (export_presets.cfg exclude_filter).
# godot --path . res://scenes/dev/shots.tscn -- --out=<abs dir> --scene=<name> [--top] [--times=3,8,14]
# Scenes: world, menu, setup, shop, campaign, challenge, sprites.

const SCENES: Dictionary = {
	"world": "res://scenes/world.tscn",
	"menu": "res://scenes/ui/main_menu.tscn",
	"setup": "res://scenes/ui/setup_board.tscn",
	"shop": "res://scenes/ui/greenhouse_shop.tscn",
	"campaign": "res://scenes/ui/campaign_setup.tscn",
	"challenge": "res://scenes/ui/challenge_setup.tscn",
	"table": "res://scenes/ui/betting_table.tscn",
	"guide": "res://scenes/ui/field_guide.tscn",
	"lab": "res://scenes/ui/tuning_lab.tscn",
}

var out: String = "user://shots"
var scene: String = "world"
var times: Array[float] = []
var top: bool = false
var close: bool = false
var south: bool = false
var myc: bool = false
var about: bool = false
var play_at: float = 0.0
var _elapsed: float = 0.0
var _shot: int = 0
var _armed: bool = false
var swipe: bool = false
var demo_bets: bool = false
var mark: bool = false
var menuposter: bool = false
var fast: bool = false
var guide: bool = false
var live_table: float = 0.0
var lineup: bool = false
var follow_at: float = 0.0
var lineup_at: float = 1.6

# A finger drag right-to-left across the middle of the screen.
func _fake_swipe() -> void:
	# Window pixels, like a real finger; the stretch transform maps them.
	var vp := Vector2(get_window().size)
	var a := Vector2(vp.x * 0.8, vp.y * 0.5)
	var press := InputEventMouseButton.new()
	press.button_index = MOUSE_BUTTON_LEFT
	press.pressed = true
	press.position = a
	Input.parse_input_event(press)
	for i: int in 6:
		var mv := InputEventMouseMotion.new()
		mv.position = a - Vector2(vp.x * 0.1 * (i + 1), 0)
		mv.button_mask = MOUSE_BUTTON_MASK_LEFT
		Input.parse_input_event(mv)
	var rel := InputEventMouseButton.new()
	rel.button_index = MOUSE_BUTTON_LEFT
	rel.position = a - Vector2(vp.x * 0.6, 0)
	Input.parse_input_event(rel)

func _ready() -> void:
	if _armed:
		return
	for arg: String in OS.get_cmdline_user_args():
		if arg.begins_with("--out="):
			out = arg.substr(6)
		elif arg.begins_with("--scene="):
			scene = arg.substr(8)
		elif arg.begins_with("--times="):
			for t: String in arg.substr(8).split(","):
				times.append(float(t))
		elif arg == "--top":
			top = true
		elif arg == "--close":
			close = true
		elif arg == "--south":
			south = true
		elif arg == "--myc":
			myc = true
		elif arg.begins_with("--power="):
			for item: String in arg.substr(8).split(","):
				var kv := item.split(":")
				sim_powers.append([float(kv[0]), kv[1]])
		elif arg == "--about":
			about = true
		elif arg.begins_with("--play="):
			play_at = float(arg.substr(7))
		elif arg.begins_with("--live-table="):
			live_table = float(arg.substr(13))
		elif arg == "--lineup":
			lineup = true
		elif arg.begins_with("--lineup="):
			lineup = true
			lineup_at = float(arg.substr(9))
		elif arg.begins_with("--follow="):
			follow_at = float(arg.substr(9))
		elif arg == "--guide":
			guide = true
		elif arg == "--menuposter":
			menuposter = true
		elif arg == "--mark":
			mark = true
		elif arg == "--demo-bets":
			demo_bets = true
		elif arg == "--swipe":
			swipe = true
		elif arg == "--fast":
			Engine.time_scale = 4.0
			fast = true
		elif arg.begins_with("--window="):
			# Phone/tablet checks, e.g. --window=390x844 (portrait phone).
			var wh := arg.substr(9).split("x")
			get_window().mode = Window.MODE_WINDOWED
			get_window().size = Vector2i(int(wh[0]), int(wh[1]))
	DirAccess.make_dir_recursive_absolute(out)
	if scene == "sprites":
		_sprite_sheet()
		get_tree().quit()
		return
	if scene == "sim":
		_start_sim()
		return
	if scene == "anim":
		_anim_sheet.call_deferred()
		return
	if scene == "bake":
		SpriteGenerator.bake_all(ProjectSettings.globalize_path(SpriteGenerator.SPRITE_DIR))
		print("BAKED ", SpriteGenerator.SPRITE_DIR)
		get_tree().quit()
		return
	if times.is_empty():
		times = [3.0, 8.0, 14.0] if scene == "world" else [1.5]
	var gc: Node = get_node("/root/GameConfig")
	gc.load_meta()
	gc.reset_run_state()
	gc.player_bet = "Sheep"
	if OS.get_cmdline_user_args().has("--bets"):
		# A spread of bets so the tracker, live wins and results can be seen.
		gc.eco_points = maxi(gc.eco_points, 40)
		gc.time_limit = 60.0
		gc.spawn_roster.clear()
		for sp: String in ["sheep", "wolf", "rabbit", "worm"]:
			gc.spawn_roster.append({"name": NameGenerator.generate(sp), "species": sp, "sex": "female", "role": "tough"})
		var offers := BetBook.catalogue({"sheep": 10, "wolves": 3, "humans": 5, "falcons": 3, "robins": 8, "boars": 5, "rabbits": 8, "worms": 15, "fish": 12}, gc.spawn_roster, 60.0)
		for o: Dictionary in offers:
			if o["id"] in ["faction:fish", "flood:20", "boom:rabbits", "extinct:wolves", "guild:grazers"] or String(o["id"]).begins_with("doomed:"):
				gc.place_bet(o, 2)
	var keeper: Node = get_script().new()
	keeper.name = "ShotKeeper"
	keeper.process_mode = Node.PROCESS_MODE_ALWAYS
	keeper.out = out
	keeper.scene = scene
	keeper.times = times
	keeper.top = top
	keeper.close = close
	keeper.south = south
	keeper.myc = myc
	keeper.about = about
	keeper.play_at = play_at
	keeper.swipe = swipe
	keeper.demo_bets = demo_bets
	keeper.mark = mark
	keeper.menuposter = menuposter
	keeper.fast = fast
	keeper.guide = guide
	keeper.live_table = live_table
	keeper.lineup = lineup
	keeper.follow_at = follow_at
	keeper.lineup_at = lineup_at
	keeper.sim_powers = sim_powers
	keeper._armed = true
	get_tree().root.add_child.call_deferred(keeper)
	get_tree().change_scene_to_file.call_deferred(SCENES.get(scene, SCENES["world"]))

func _process(delta: float) -> void:
	if not _armed:
		return
	if scene == "simrun":
		_sim_tick()
		return
	_elapsed += delta
	if top and _elapsed > 1.5:
		var cam := get_viewport().get_camera_3d()
		if cam != null and cam.has_method("snap_top_down"):
			cam.snap_top_down()
		top = false
	if close and _elapsed > 1.5:
		var cam := get_viewport().get_camera_3d()
		if cam != null and cam.has_method("set_view"):
			cam.set_view(Vector3(2.0, 0.0, 8.0), 0.15, deg_to_rad(-26.0), 22.0, true)
		close = false
	if south and _elapsed > 1.5:
		var cam := get_viewport().get_camera_3d()
		if cam != null and cam.has_method("set_view"):
			cam.set_view(Vector3(0.0, 0.0, 40.0), PI, deg_to_rad(-24.0), 30.0, true)
		south = false
	if not sim_powers.is_empty() and get_tree().current_scene != null:
		var wp := get_tree().current_scene.get_node_or_null("World") as SimulationDirector
		if wp != null and wp.get_day() >= float(sim_powers[0][0]):
			wp.call("trigger_" + String(sim_powers.pop_front()[1]))
	if play_at > 0.0 and _elapsed >= play_at:
		play_at = 0.0
		var ls := get_tree().current_scene.find_child("LoadingScreen", true, false)
		if ls != null and ls.has_method("_blow_away"):
			ls._blow_away()
	if about and _elapsed > 1.0:
		for child in get_tree().current_scene.get_children():
			if child is PopupPanel and child.get_child_count() > 0 and not (child as PopupPanel).visible and child.name != "RulesPopup":
				(child as PopupPanel).popup_centered()
				break
		about = false
	if myc and _elapsed > 2.0:
		var w := get_tree().current_scene.get_node_or_null("World") as SimulationDirector
		if w != null and w.mycelium != null:
			var m: MyceliumLayer = w.mycelium
			for centre: Vector3 in [Vector3(-4, 0, 10), Vector3(6, 0, 6), Vector3(0, 0, 16)]:
				var c := m.world_to_grid(centre)
				for gz: int in range(c.y - 3, c.y + 4):
					for gx: int in range(c.x - 3, c.x + 4):
						var d: float = Vector2(gx - c.x, gz - c.y).length()
						if d <= 3.2:
							var i: int = gz * m.grid_width + gx
							m._grid[i] = clampf(0.65 - d * 0.15, 0.05, 1.0)
							m._mark_dirty(i)
			m.flush_visuals()
		myc = false
	if fast and not get_tree().paused:
		Engine.time_scale = 4.0
	if menuposter and _elapsed > 3.0:
		menuposter = false
		var mp: Node = load("res://scripts/dev/menu_poster.gd").new()
		mp.out = out
		add_child(mp)
		await mp.setup()
		# Autumn last: its carcasses would linger into the other seasons.
		for sn: String in ["Spring", "Summer", "Winter", "Autumn"]:
			await mp.season(sn)
			await get_tree().create_timer(0.4).timeout
			await mp.shoot(sn)
		get_tree().quit()
	if mark and _elapsed > 2.0:
		mark = false
		# Put a bet on the three creatures nearest the --close camera's spot.
		var wm := get_tree().current_scene.get_node_or_null("World") as SimulationDirector
		var hud := get_tree().current_scene.find_child("SimulationHUD", true, false)
		if wm != null and hud != null:
			var picks: Array = wm._agent_registry.filter(func(d: AgentData) -> bool: return d.node is MarkovAgent)
			picks.sort_custom(func(a: AgentData, b: AgentData) -> bool: return a.pos.distance_to(Vector3(2, 0, 8)) < b.pos.distance_to(Vector3(2, 0, 8)))
			for d: AgentData in picks.slice(0, 3):
				GameConfig.bets.append({"type": "survivor", "meta": {"name": (d.node as MarkovAgent).display_name, "species": d.species}})
			hud._setup_side_bet_marker()
			GameConfig.bets.clear()
	if lineup and _elapsed > lineup_at:
		lineup = false
		# A row of carcasses (one per species) and mushrooms in every stage,
		# right in front of the --close camera.
		var w := get_tree().current_scene.get_node_or_null("World") as SimulationDirector
		if w != null:
			var sp_list: Array[String] = ["sheep", "wolf", "boar", "human", "rabbit", "falcon", "robin", "fish", "worm"]
			for i: int in sp_list.size():
				var x: float = -6.0 + i * 1.9
				w.spawn_corpse(Vector3(x, 0, 10.5), 3.0, sp_list[i])
			for i: int in 6:
				w.spawn_mushroom_spore(null, Vector3(-4.0 + i * 1.7, 0, 6.5))
	if live_table > 0.0 and _elapsed > live_table:
		live_table = 0.0
		var hud := get_tree().current_scene.find_child("SimulationHUD", true, false)
		if hud != null:
			hud._open_bets()
	if follow_at > 0.0 and _elapsed > follow_at:
		follow_at = 0.0
		var hud3 := get_tree().current_scene.find_child("SimulationHUD", true, false)
		var w3 := get_tree().current_scene.get_node_or_null("World") as SimulationDirector
		if hud3 != null and w3 != null and not w3._active_sheep.is_empty():
			hud3._start_follow(w3._active_sheep[0])
	if guide and _elapsed > 1.0:
		guide = false
		var gt := get_tree().current_scene as BettingTable
		if gt != null:
			gt._open_guide()
	if demo_bets and _elapsed > 1.0:
		demo_bets = false
		var t := get_tree().current_scene as BettingTable
		if t != null:
			for id: String in ["faction:wolves", "flood:30", "extinct:robins", "guild:grazers"]:
				if t._boxes.has(id):
					t.set_chip(5 if id == "faction:wolves" else 1)
					t.add_coins(t._boxes[id])
			for b in t._boxes.values():
				if String(b.offer["type"]) == "survivor":
					t.add_coins(b, 2)
					break
	if swipe and _elapsed > 1.0:
		swipe = false
		_fake_swipe()
	if _shot < times.size() and _elapsed >= times[_shot]:
		var img := get_viewport().get_texture().get_image()
		var file := "%s/%s_%d.png" % [out, scene, _shot]
		img.save_png(file)
		print("SHOT ", file, " fps=", Engine.get_frames_per_second())
		var music: Node = get_node_or_null("/root/Music")
		if music != null:
			var p: AudioStreamPlayer = music._players[music._active]
			print("  music track=", music._current, " playing=", p.playing, " stream=", p.stream.resource_path if p.stream != null else "none", " vol=", p.volume_db)
		var world := get_tree().current_scene.get_node_or_null("World") as SimulationDirector
		if world != null:
			var roles: Dictionary = {}
			for d: AgentData in world._agent_registry:
				if not d.role.is_empty():
					var k: String = d.species + ":" + d.variant
					roles[k] = int(roles.get(k, 0)) + 1
			print("  day=", int(world.get_day()), " counts=", world.get_creature_counts(), "\n  roles=", roles)
			if world.bet_tracker != null:
				var st: Dictionary = world.bet_tracker.stats
				print("  bets: toll=", st.get("flood_toll"), " extinct=", st.get("extinct_day"), " dead=", st.get("named_dead"), " states=", gc_states())
			print("  spores=", world._active_spores.size(), " registry=", world._agent_registry.size(), " corpses=", world.get_node("Corpses").get_child_count(), " trees=", world.get_node("Trees").get_child_count(), " away=", world._fish_away.size(), " tick=", Engine.physics_ticks_per_second, " steps=", Engine.max_physics_steps_per_frame)
		var c := get_viewport().get_camera_3d()
		if c != null:
			print("  cam pos=", c.global_position, " target=", c.get("target"), " dist=", c.get("distance"), " pitch=", c.get("pitch"), " follow=", c.call("following") if c.has_method("following") else null)
		_shot += 1
		if _shot >= times.size():
			get_tree().quit()

func gc_states() -> Array:
	var out: Array = []
	for b: Dictionary in get_node("/root/GameConfig").bets:
		out.append("%s:%s:%d" % [b["id"].get_slice("|", 0), b["state"], int(b["payout"])])
	return out

# Headless year run: logs a CSV row every 5 sim days, then quits.
# godot --headless --fixed-fps 30 --path . res://scenes/dev/shots.tscn -- --sim --scene=sim --seed=1 --days=120 [--bet=Sheep] [--power=day:id,...]
var sim_days: float = 120.0
var sim_next: float = 0.0
var sim_powers: Array = []
var sim_header: bool = false

func _start_sim() -> void:
	var seed_v: int = 1
	var bet: String = "Sheep"
	sim_powers.clear()
	for arg: String in OS.get_cmdline_user_args():
		if arg.begins_with("--seed="):
			seed_v = int(arg.substr(7))
		elif arg.begins_with("--days="):
			sim_days = float(arg.substr(7))
		elif arg.begins_with("--bet="):
			bet = arg.substr(6)
		elif arg.begins_with("--power="):
			for item: String in arg.substr(8).split(","):
				var kv := item.split(":")
				sim_powers.append([float(kv[0]), kv[1]])
	seed(seed_v)
	var gc: Node = get_node("/root/GameConfig")
	gc.reset_run_state()
	gc.player_bet = bet
	gc.time_limit = sim_days + 1.0
	var keeper: Node = get_script().new()
	keeper.name = "SimKeeper"
	keeper.scene = "simrun"
	keeper.sim_days = sim_days
	keeper.sim_powers = sim_powers
	keeper._armed = true
	get_tree().root.add_child.call_deferred(keeper)
	get_tree().change_scene_to_file.call_deferred(SCENES["world"])

func _sim_tick() -> void:
	if get_tree().current_scene == null:
		return
	var w := get_tree().current_scene.get_node_or_null("World") as SimulationDirector
	if w == null:
		return
	var day: float = w.get_day()
	while not sim_powers.is_empty() and day >= float(sim_powers[0][0]):
		var pid: String = sim_powers.pop_front()[1]
		w.call("trigger_" + pid)
		print("POWER,", int(day), ",", pid)
	if day < sim_next:
		return
	sim_next += 0.5
	var c: Dictionary = w.get_creature_counts()
	var keys: Array = ["sheep", "wolves", "humans", "falcons", "robins", "boars", "worms", "rabbits", "fish", "deer", "goats", "bears", "lions", "beetles"]
	if not sim_header:
		sim_header = true
		print("CSV,day,season,", ",".join(keys), ",spores,huts,tribes,grass,trees")
	var grass_sum: float = 0.0
	for v: float in w.grass._grid:
		grass_sum += v
	var tribes: Dictionary = {}
	for h in w._active_humans:
		if is_instance_valid(h) and int(h.get("_settlement_id")) > 0:
			tribes[int(h.get("_settlement_id"))] = true
	var row: Array = [snappedf(day, 0.1), w.get_season()]
	for k: String in keys:
		row.append(int(c.get(k, 0)))
	row.append_array([w._active_spores.size(), w._active_shelters.size(), tribes.size(), int(grass_sum), w.get_node("Trees").get_child_count()])
	print("CSV,", ",".join(row.map(func(x): return str(x))))
	print("CONTROL,", int(day), ",", ",".join(keys.map(func(k): return "%.1f" % float(w.control_days.get(k, 0.0)))))
	# 3.0: food-web group totals, gold carriers and the paths gold has taken.
	var g: Dictionary = w.get_group_counts()
	print("GROUPS,", snappedf(day, 0.1), ",", ",".join(SpeciesDB.GROUPS.map(func(k): return "%s=%d" % [k, int(g.get(k, 0.0))])))
	print("GOLD,", snappedf(day, 0.1), ",finds=", w.golden_finds, ",", JSON.stringify(w.golden_census()), ",", JSON.stringify(w.gold_links))
	# Diagnostics: mean energy/health and the commonest states per species.
	var diag: Dictionary = {}
	for d: AgentData in w._agent_registry:
		if d.node == null or not is_instance_valid(d.node):
			continue
		var e: Dictionary = diag.get(d.species, {"n": 0, "en": 0.0, "hp": 0.0, "st": {}})
		e["n"] += 1
		e["en"] += float(d.node.get("energy")) if d.node.get("energy") != null else 0.0
		e["hp"] += float(d.node.get("health")) if d.node.get("health") != null else 0.0
		var st: String = d.node.current_state() if d.node.has_method("current_state") else "?"
		e["st"][st] = int(e["st"].get(st, 0)) + 1
		diag[d.species] = e
	var parts: Array = []
	for sp: String in diag.keys():
		var e: Dictionary = diag[sp]
		var states: Array = e["st"].keys()
		states.sort_custom(func(a, b): return e["st"][a] > e["st"][b])
		var top: Array = []
		for s: String in states.slice(0, 3):
			top.append("%s%d" % [s.substr(0, 4), e["st"][s]])
		parts.append("%s n%d e%.0f h%.0f %s" % [sp.substr(0, 5), e["n"], e["en"] / e["n"], e["hp"] / e["n"], "/".join(top)])
	print("DIAG,", int(day), ", ", " | ".join(parts))
	var stage_n: Array = [0, 0, 0, 0]
	var stage_d: Array = [0.0, 0.0, 0.0, 0.0]
	for i: int in w.grass._grid.size():
		if w.grass._masked.size() == w.grass._grid.size() and w.grass._masked[i] == 1:
			continue
		var s: int = int(w.grass._cell_stage[i])
		stage_n[s] += 1
		stage_d[s] += w.grass._grid[i]
	print("GRASS,", int(day), ", seed %d/%.2f sprout %d/%.2f tall %d/%.2f dead %d/%.2f nutr=%.2f exh=%.1f" % [
		stage_n[0], stage_d[0] / maxf(stage_n[0], 1), stage_n[1], stage_d[1] / maxf(stage_n[1], 1),
		stage_n[2], stage_d[2] / maxf(stage_n[2], 1), stage_n[3], stage_d[3] / maxf(stage_n[3], 1),
		Array(w.grass._nutrients).reduce(func(a, b): return a + b, 0.0) / w.grass._nutrients.size(), w.grass._soil_exhaustion])
	if day >= sim_days:
		get_tree().quit()

# Each species twice (top row walking, bottom row idle) at several gait
# phases, stacked into one contact sheet.
func _anim_sheet() -> void:
	var root := Node3D.new()
	add_child(root)
	var env := WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_COLOR
	env.environment.background_color = Color(0.4, 0.55, 0.3)
	root.add_child(env)
	var vpm := VisualProxyManager.new()
	root.add_child(vpm)
	var cam := Camera3D.new()
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	cam.size = 18.5
	cam.position = Vector3(14.5, 0.6, 20.0)
	root.add_child(cam)
	cam.make_current()
	var names: Array = VisualProxyManager.SPECIES_CONFIG.keys()
	var phases: Array[float] = [0.0, 0.8, 1.6, 2.4, 3.2, 4.0, 4.8]
	var frames: Array[Image] = []
	# Each frame row shows the next action (0 move, 1 eat, 2 fight, 3 flee,
	# 4 sleep, 5 court, 6 work), so one sheet checks every pose.
	var frame_i: int = 0
	for ph: float in phases:
		var act: float = float(frame_i % 7) / 15.0
		frame_i += 1
		for i: int in names.size():
			var mmi: MultiMeshInstance3D = vpm._proxies[names[i]]
			var mm := mmi.multimesh
			mm.instance_count = 2
			for row: int in 2:
				var size: Vector2 = VisualProxyManager.SPECIES_CONFIG[names[i]]["size"]
				var pos := Vector3(i * 2.9, 2.0 - row * 3.4 + size.y * 0.5 - 1.2, 0.0)
				mm.set_instance_transform(row, Transform3D(Basis(), pos))
				mm.set_instance_color(row, Color(1, 1, 1, act))
				var motion: float = 1.0 if row == 0 else 0.0
				# Idle frames use a slow clock so grazing/rooting/twitches show.
				var p: float = ph if row == 0 else ph * 6.0
				mm.set_instance_custom_data(row, Color(1.0, p, motion, 0.0))
		await get_tree().process_frame
		await get_tree().process_frame
		frames.append(get_viewport().get_texture().get_image())
	var w: int = frames[0].get_width()
	var h: int = frames[0].get_height()
	var sheet := Image.create(w, h * frames.size() / 2, false, frames[0].get_format())
	for k: int in frames.size():
		var half := frames[k].get_region(Rect2i(0, h / 4, w, h / 2))
		sheet.blit_rect(half, Rect2i(0, 0, w, h / 2), Vector2i(0, k * h / 2))
	sheet.save_png(out + "/anim.png")
	print("SHOT ", out, "/anim.png")
	get_tree().quit()

# Every species atlas side by side: 3 kinds across, male over female.
func _sprite_sheet() -> void:
	var names: Array[String] = SpriteGenerator.SPECIES
	var cell: int = 128
	var half: int = names.size() / 2 + names.size() % 2
	var sheet := Image.create(cell * 3 * half, cell * 2 * 2, false, Image.FORMAT_RGBA8)
	sheet.fill(Color(0.36, 0.46, 0.26))
	for i: int in names.size():
		var atlas: Image = SpriteGenerator.atlas_image(names[i])
		var off := Vector2i((i % half) * cell * 3, (i / half) * cell * 2)
		sheet.blend_rect(atlas, Rect2i(Vector2i.ZERO, atlas.get_size()), off)
	sheet.save_png(out + "/sprites.png")
	print("SHOT ", out, "/sprites.png")
