class_name DevConsole
extends CanvasLayer

# The developer console. Unlocked by clicking DM Zemo in the Credits; after
# that, ` (backquote) or F1 opens it anywhere. A draggable window with an
# output log and a command line (Up/Down for history, Tab completes).
# Commands test the game's limits (resources, unlocks, records, time,
# populations) and take the valley apart to diagnose graphics bugs
# (hide/show each layer, draw modes, an FPS counter). Type "help".

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")

# Pieces of the valley that can be hidden: name -> node path under World
# (or a special key). See "parts".
const PARTS: Dictionary = {
	"grass": "GrassLayer", "mycelium": "MyceliumLayer", "rot": "RotLayer",
	"trees": "Trees", "bushes": "Bushes", "creatures": "VisualProxyManager",
	"corpses": "Corpses", "spores": "Spores", "shelters": "Shelters",
	"terrain": "Valley", "weather": "Weather", "agents": "Agents",
	"particles": "@particles", "labels": "@labels", "hud": "@hud", "fx": "@fx",
}
const SPECIES: Array[String] = ["sheep", "rabbit", "deer", "goat", "wolf", "lion", "falcon", "human", "bear", "boar", "robin", "worm", "beetle", "fish"]

var _win: PanelContainer
var _out: RichTextLabel
var _in: LineEdit
var _history: Array[String] = []
var _hist_i: int = 0
var _fps: Label
var _hidden: Dictionary = {}

func _ready() -> void:
	layer = 120
	process_mode = Node.PROCESS_MODE_ALWAYS
	name = "DevConsole"
	_win = PanelContainer.new()
	_win.theme = FelecoUiScript.theme()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.02, 0.04, 0.03, 0.94)
	sb.border_color = Color(0.4, 1.0, 0.5)
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(10)
	sb.set_content_margin_all(10)
	_win.add_theme_stylebox_override("panel", sb)
	_win.position = Vector2(40, 40)
	_win.custom_minimum_size = Vector2(720, 420)
	_win.visible = false
	add_child(_win)
	HudWindow.movable(_win)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 6)
	_win.add_child(col)
	var head := HBoxContainer.new()
	col.add_child(head)
	var title := FelecoUiScript.heading("DEV CONSOLE  (drag me · ` or F1 to hide · type help)", 15, Color(0.5, 1.0, 0.6))
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title.mouse_filter = Control.MOUSE_FILTER_IGNORE
	head.add_child(title)
	var x := Button.new()
	x.text = "x"
	x.focus_mode = Control.FOCUS_NONE
	x.pressed.connect(func() -> void: _win.visible = false)
	head.add_child(x)
	_out = RichTextLabel.new()
	_out.bbcode_enabled = true
	_out.scroll_following = true
	_out.selection_enabled = true
	_out.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_out.add_theme_font_override("normal_font", SystemFont.new())
	_out.add_theme_font_size_override("normal_font_size", 14)
	_out.add_theme_color_override("default_color", Color(0.8, 1.0, 0.85))
	_out.mouse_filter = Control.MOUSE_FILTER_PASS
	col.add_child(_out)
	_in = LineEdit.new()
	_in.placeholder_text = "command (help)"
	_in.custom_minimum_size = Vector2(0, 38)
	_in.text_submitted.connect(_submit)
	_in.gui_input.connect(_line_keys)
	col.add_child(_in)
	_fps = Label.new()
	_fps.position = Vector2(8, 8)
	_fps.add_theme_color_override("font_color", Color(0.5, 1.0, 0.6))
	_fps.add_theme_color_override("font_outline_color", Color.BLACK)
	_fps.add_theme_constant_override("outline_size", 6)
	_fps.visible = false
	add_child(_fps)
	_print("[b]Feleco dev console.[/b] Type [color=yellow]help[/color] for commands.")

static func unlocked(gc: Node) -> bool:
	return gc != null and gc.record("dev", "on") != null

# Opens the console (and unlocks dev mode for good).
static func open_from(node: Node) -> void:
	var gc: Node = node.get_node_or_null("/root/GameConfig")
	if gc != null and not unlocked(gc):
		gc.set_record("dev", "on", true)
	var c: DevConsole = node.get_tree().root.get_node_or_null("DevConsole") as DevConsole
	if c == null:
		c = DevConsole.new()
		node.get_tree().root.add_child(c)
	c.show_console()

func show_console() -> void:
	_win.visible = true
	_in.grab_focus.call_deferred()

func _input(event: InputEvent) -> void:
	var k := event as InputEventKey
	if k == null or not k.pressed or k.echo:
		return
	if k.physical_keycode in [KEY_QUOTELEFT, KEY_F1] and unlocked(get_node_or_null("/root/GameConfig")):
		_win.visible = not _win.visible
		if _win.visible:
			_in.grab_focus.call_deferred()
		get_viewport().set_input_as_handled()

func _process(_delta: float) -> void:
	if _fps.visible:
		var d: SimulationDirector = _dir()
		var n: int = d._agent_registry.size() if d != null else 0
		_fps.text = "FPS %d   agents %d   draws %d   scale %.1fx" % [Engine.get_frames_per_second(), n, Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME), Engine.time_scale]

func _line_keys(event: InputEvent) -> void:
	var k := event as InputEventKey
	if k == null or not k.pressed:
		return
	if k.physical_keycode == KEY_UP and not _history.is_empty():
		_hist_i = maxi(_hist_i - 1, 0)
		_in.text = _history[_hist_i]
		_in.caret_column = _in.text.length()
		_in.accept_event()
	elif k.physical_keycode == KEY_DOWN and not _history.is_empty():
		_hist_i = mini(_hist_i + 1, _history.size())
		_in.text = _history[_hist_i] if _hist_i < _history.size() else ""
		_in.caret_column = _in.text.length()
		_in.accept_event()
	elif k.physical_keycode == KEY_TAB:
		var matches: Array = _commands().keys().filter(func(c: String) -> bool: return c.begins_with(_in.text.strip_edges()))
		if matches.size() == 1:
			_in.text = String(matches[0]) + " "
			_in.caret_column = _in.text.length()
		elif matches.size() > 1:
			_print(", ".join(matches))
		_in.accept_event()

func _print(s: String) -> void:
	_out.append_text(s + "\n")

func _ok(s: String) -> void:
	_print("[color=#7f7]" + s + "[/color]")

func _err(s: String) -> void:
	_print("[color=#f77]" + s + "[/color]")

func _gc() -> Node:
	return get_node_or_null("/root/GameConfig")

func _dir() -> SimulationDirector:
	var scene: Node = get_tree().current_scene
	return scene.get_node_or_null("World") as SimulationDirector if scene != null else null

func _need_valley() -> SimulationDirector:
	var d := _dir()
	if d == null:
		_err("Only in the valley (start a Valley Simulation first).")
	return d

func _submit(text: String) -> void:
	var line: String = text.strip_edges()
	_in.clear()
	if line.is_empty():
		return
	_history.append(line)
	_hist_i = _history.size()
	_print("[color=yellow]> %s[/color]" % line)
	var parts: PackedStringArray = line.split(" ", false)
	var cmd: String = parts[0].to_lower()
	var args: Array = Array(parts.slice(1)).map(func(a: String) -> String: return a.to_lower())
	var cmds := _commands()
	if not cmds.has(cmd):
		_err("Unknown command '%s'. Type help." % cmd)
		return
	(cmds[cmd][1] as Callable).call(args)

# name -> [help line, handler(args)].
func _commands() -> Dictionary:
	return {
		"help": ["help: list every command", _c_help],
		"clear": ["clear: clear this window", func(_a: Array) -> void: _out.clear()],
		# Resources and unlocks.
		"ep": ["ep <n> | ep max: add Eco Points (or set a huge pot)", _c_ep],
		"unlock": ["unlock all | unlock <feature>: open the menu (valley, greenhouse, challenge, minigames, opening, changelog)", _c_unlock],
		"lock": ["lock all: reset the menu ladder to a brand-new player", _c_lock],
		"powers": ["powers <n>: n of every power in stock", _c_powers],
		"power": ["power <id> [n]: stock one power (bloom, stampede, predator_call, feast, rot_rain, rain, drought, flood, eclipse)", _c_power],
		"touches": ["touches <n>: free power uses this run", _c_touches],
		"upgrades": ["upgrades all | none: own (or drop) every Greenhouse upgrade", _c_upgrades],
		"cosmetics": ["cosmetics all: own every cursor and aura", _c_cosmetics],
		"minigames": ["minigames win | reset: beat (or clear) every Mini-Game level, so every valley boon is on", _c_minigames],
		"runs": ["runs <n>: set years played (betting tiers open at 1 and 2)", _c_runs],
		"saga": ["saga year <1-5> | saga reset | saga win: jump the Valley Saga", _c_saga],
		"reset": ["reset intro | tutorial | goals | howto | save: replay first-time things (save wipes everything!)", _c_reset],
		# The valley.
		"census": ["census: head counts right now", _c_census],
		"spawn": ["spawn <species> [n]: add creatures to the valley", _c_spawn],
		"kill": ["kill <species|all> [n]: remove creatures (all = every creature of that kind)", _c_kill],
		"gold": ["gold <species|all>: make creatures golden (ready to Rampage)", _c_gold],
		"cast": ["cast <power>: fire a power for free (bloom, stampede, feast, rot_rain, rain, drought, flood, eclipse, call)", _c_cast],
		"day": ["day <n>: jump the clock forward n days", _c_day],
		"speed": ["speed <x>: game speed (0.1 to 16)", _c_speed],
		"end": ["end: end the year now (straight to the results)", _c_end],
		"bets": ["bets: every bet you hold, its odds and scheme bonus", _c_bets],
		"scheme": ["scheme <pct>: set the scheme bonus on every open bet", _c_scheme],
		# Graphics diagnosis.
		"parts": ["parts: the pieces of the valley you can hide", _c_parts],
		"hide": ["hide <part|all>: hide a piece of the valley", func(a: Array) -> void: _c_vis(a, false)],
		"show": ["show <part|all>: show it again", func(a: Array) -> void: _c_vis(a, true)],
		"toggle": ["toggle <part>: flip a piece on or off", func(a: Array) -> void: _c_vis(a, null)],
		"draw": ["draw normal | wire | overdraw | unshaded: how the 3D is drawn", _c_draw],
		"fps": ["fps: toggle an FPS / agent / draw-call counter", func(_a: Array) -> void: _fps.visible = not _fps.visible],
		"scene": ["scene <menu|valley|bets|shop|minigames|golf|race|brawl|dominion|sweep|rules>: jump to a screen", _c_scene],
	}

func _c_help(_a: Array) -> void:
	for k: String in _commands().keys():
		_print("  " + String(_commands()[k][0]))

func _num(a: Array, i: int, fallback: float) -> float:
	return float(a[i]) if a.size() > i and String(a[i]).is_valid_float() else fallback

func _c_ep(a: Array) -> void:
	var gc := _gc()
	if a.size() > 0 and a[0] == "max":
		gc.eco_points = 99999
	else:
		gc.eco_points += int(_num(a, 0, 500))
	gc.save_meta()
	_ok("Eco Points: %d" % gc.eco_points)

func _c_unlock(a: Array) -> void:
	var gc := _gc()
	if a.is_empty() or a[0] == "all":
		gc.set_record("unlock", "all", true)
		_ok("Everything unlocked. Reopen the menu to see it.")
	else:
		gc.set_record("unlock", a[0], true)
		_ok("Unlocked %s." % a[0])

func _c_lock(_a: Array) -> void:
	var gc := _gc()
	gc.records.erase("unlock")
	gc.records.erase("unlock_seen")
	gc.set_record("unlock", "migrated", true)
	_ok("Menu reset to a brand-new player's (only Rules).")

func _c_powers(a: Array) -> void:
	var gc := _gc()
	var n: int = int(_num(a, 0, 5))
	for id: String in Schemes.POWERS.keys():
		gc.powerup_inventory[id] = n
	gc.save_meta()
	_ok("%d of every power in stock." % n)

func _c_power(a: Array) -> void:
	if a.is_empty():
		_err("power <id> [n]")
		return
	var gc := _gc()
	gc.powerup_inventory[a[0]] = int(gc.powerup_inventory.get(a[0], 0)) + int(_num(a, 1, 1))
	gc.save_meta()
	_ok("%s: %d" % [a[0], gc.powerup_inventory[a[0]]])

func _c_touches(a: Array) -> void:
	var d := _need_valley()
	if d != null:
		d.touches_left = int(_num(a, 0, 99))
		_ok("Free power uses: %d" % d.touches_left)

func _c_upgrades(a: Array) -> void:
	var gc := _gc()
	if a.size() > 0 and a[0] == "none":
		gc.owned_upgrades.clear()
	else:
		for id: String in gc.UPGRADE_ORDER:
			gc.owned_upgrades[id] = true
	gc.save_meta()
	_ok("Upgrades owned: %s" % ", ".join(gc.owned_upgrades.keys()))

func _c_cosmetics(_a: Array) -> void:
	var gc := _gc()
	for r: Array in Cosmetics.CURSORS + Cosmetics.AURAS:
		Cosmetics.grant(gc, r[0])
	_ok("Every cursor and aura owned. Equip them in the Greenhouse.")

func _c_minigames(a: Array) -> void:
	var gc := _gc()
	if a.size() > 0 and a[0] == "reset":
		for g: String in ["golf", "race", "brawl", "dominion", "sweep"]:
			gc.records.erase(g)
		gc.save_meta()
		_ok("Mini-Game records cleared.")
		return
	for i: int in 8:
		gc.set_record("golf", str(i), "S")
	for i: int in 4:
		gc.set_record("race", str(i), "Gold")
	for sp: String in ["wolf", "lion", "falcon"]:
		gc.set_record("brawl", sp, "dire")
	for c: String in ["human", "bear", "boar", "robin"]:
		gc.set_record("dominion", c, "ruled")
	for i: int in 6:
		gc.set_record("sweep", str(i), "S")
	_ok("Every Mini-Game level beaten. Valley boons: %s" % ", ".join((gc.link_boons().values() as Array).map(func(b: Dictionary) -> String: return String(b["text"]))))

func _c_runs(a: Array) -> void:
	_gc().set_record("progress", "runs", int(_num(a, 0, 2)))
	_ok("Years played: %d" % _gc().valley_runs())

func _c_saga(a: Array) -> void:
	var gc := _gc()
	var s := ValleySaga.state(gc)
	match String(a[0]) if a.size() > 0 else "":
		"year":
			s["year"] = clampi(int(_num(a, 1, 1)), 1, ValleySaga.YEARS.size())
			s["met"] = []
			for i: int in int(s["year"]) - 1:
				(s["met"] as Array).append(true)
			s["carry"] = true
		"reset":
			s = {"year": 1, "met": [], "carry": false, "beaten": false}
		"win":
			s = {"year": ValleySaga.YEARS.size(), "met": [true, true, true, true], "carry": true, "beaten": false}
		_:
			_err("saga year <n> | reset | win")
			return
	ValleySaga.save_state(gc, s)
	_ok("Saga: %s (applies to the next Valley Simulation start)." % str(s))

func _c_reset(a: Array) -> void:
	var gc := _gc()
	match String(a[0]) if a.size() > 0 else "":
		"intro":
			gc.intro_seen = false
		"tutorial":
			gc.tutorial_done = false
		"goals":
			gc.records.erase("goals")
		"howto":
			gc.records.erase("howto")
		"save":
			gc.records = {}
			gc.eco_points = 0
			gc.owned_upgrades.clear()
			gc.powerup_inventory.clear()
			gc.intro_seen = false
			gc.tutorial_done = false
			gc.set_record("dev", "on", true)
		_:
			_err("reset intro | tutorial | goals | howto | save")
			return
	gc.save_meta()
	_ok("Reset %s." % a[0])

func _c_census(_a: Array) -> void:
	var d := _need_valley()
	if d == null:
		return
	var c: Dictionary = d.get_creature_counts()
	var keys: Array = c.keys()
	keys.sort()
	_print(", ".join(keys.map(func(k: String) -> String: return "%s %d" % [k, int(c[k])])))
	_print("Day %.2f of %.0f  ·  golden finds %d  ·  agents %d" % [d.get_day(), d.cfg_time_limit, d.golden_finds, d._agent_registry.size()])

func _species(s: String) -> String:
	for id: String in SPECIES:
		if s == id or s == SpeciesDB.plural(id) or s == id + "s":
			return id
	return ""

func _c_spawn(a: Array) -> void:
	var d := _need_valley()
	if d == null:
		return
	var id: String = _species(String(a[0]) if a.size() > 0 else "")
	if id.is_empty():
		_err("spawn <%s> [n]" % "|".join(SPECIES))
		return
	var n: int = clampi(int(_num(a, 1, 5)), 1, 200)
	var made: int = 0
	for i: int in n:
		var p := d.dry_land(Vector3(randf_range(-24, 24), 0, randf_range(-24, 24)))
		if id == "fish" and d.valley != null and d.valley.river != null:
			p = d.valley.river.random_point()
		var ag := d.spawn_scripted(id, p)
		if ag != null:
			ag.scripted = false
			ag.set_state(ag._current_state)
			made += 1
	_ok("Spawned %d %s." % [made, SpeciesDB.plural(id)])

func _c_kill(a: Array) -> void:
	var d := _need_valley()
	if d == null:
		return
	var which: String = String(a[0]) if a.size() > 0 else ""
	var id: String = _species(which)
	if id.is_empty() and which != "all":
		_err("kill <species|all> [n]")
		return
	var n: int = int(_num(a, 1, 99999))
	var gone: int = 0
	for data: AgentData in d._agent_registry.duplicate():
		if gone >= n:
			break
		if (which == "all" or data.species == id) and data.node != null and is_instance_valid(data.node) and data.node.has_method("die"):
			data.node.die()
			gone += 1
	_ok("Removed %d." % gone)

func _c_gold(a: Array) -> void:
	var d := _need_valley()
	if d == null:
		return
	var which: String = String(a[0]) if a.size() > 0 else "all"
	var id: String = _species(which)
	var n: int = 0
	for data: AgentData in d._agent_registry:
		if (which == "all" or data.species == id) and data.node is MarkovAgent and is_instance_valid(data.node):
			(data.node as MarkovAgent).make_golden(1.0, "dev")
			n += 1
	_ok("%d creatures turned golden. Click one, then Rampage!" % n)

func _c_cast(a: Array) -> void:
	var d := _need_valley()
	if d == null or a.is_empty():
		if a.is_empty():
			_err("cast <power>")
		return
	var methods: Dictionary = {"bloom": "trigger_bloom", "stampede": "trigger_stampede", "feast": "trigger_feast", "rot_rain": "trigger_rot_rain", "rain": "trigger_rain", "drought": "trigger_drought", "flood": "trigger_flood", "eclipse": "trigger_eclipse", "call": "trigger_predator_call"}
	if not methods.has(a[0]) or not d.has_method(methods[a[0]]):
		_err("cast " + "|".join(methods.keys()))
		return
	d.call(methods[a[0]])
	var power_id: String = "predator_call" if a[0] == "call" else String(a[0])
	var boosted: Array[String] = Schemes.on_power(_gc(), power_id, SpeciesDB.group_of(String(_gc().player_bet).to_lower()))
	_ok("Cast %s.%s" % [a[0], ("  Schemes: " + ", ".join(boosted)) if not boosted.is_empty() else ""])

func _c_day(a: Array) -> void:
	var d := _need_valley()
	if d == null:
		return
	var days: float = _num(a, 0, 1.0)
	d.set("_clock_s", float(d.get("_clock_s")) + days * Clock.SECONDS_PER_DAY)
	_ok("Jumped %.1f days. Now day %.2f." % [days, d.get_day()])

func _c_speed(a: Array) -> void:
	Engine.time_scale = clampf(_num(a, 0, 1.0), 0.1, 16.0)
	_ok("Speed %.1fx" % Engine.time_scale)

func _c_end(_a: Array) -> void:
	var d := _need_valley()
	if d != null and d.has_method("_end_simulation"):
		d.call("_end_simulation")
		_ok("Year ended.")

func _c_bets(_a: Array) -> void:
	var gc := _gc()
	if (gc.bets as Array).is_empty():
		_print("No bets held.")
	for b: Dictionary in gc.bets:
		_print("%s  [%s]  stake %d  x%.2f  scheme +%d%%  pays %d" % [b.get("label", "?"), b.get("state", "?"), int(b.get("stake", 0)), float(b.get("mult", 1.0)), int(float(b.get("scheme", 0.0)) * 100.0), Schemes.payout(b)])

func _c_scheme(a: Array) -> void:
	var v: float = clampf(_num(a, 0, 40.0) / 100.0, 0.0, 5.0)
	for b: Dictionary in _gc().bets:
		if b.get("state", "") == "open":
			b["scheme"] = v
	_ok("Scheme bonus on every open bet: +%d%%" % int(v * 100.0))

func _c_parts(_a: Array) -> void:
	_print("Parts: " + ", ".join(PARTS.keys()) + "   (hide <part>, show <part>, toggle <part>, hide all, show all)")

# Hide or show every visual under a part (works on plain Nodes too, which
# have no visibility of their own).
func _c_vis(a: Array, on: Variant) -> void:
	var d := _need_valley()
	if d == null:
		return
	if a.is_empty():
		_err("hide|show|toggle <part|all>")
		return
	var names: Array = PARTS.keys() if a[0] == "all" else [a[0]]
	for nm: String in names:
		if not PARTS.has(nm):
			_err("No part '%s'. Type parts." % nm)
			continue
		var want: bool = (not bool(_hidden.get(nm, false))) if on == null else not bool(on)
		_hidden[nm] = want
		var targets: Array = []
		var key: String = PARTS[nm]
		match key:
			"@particles":
				targets = get_tree().root.find_children("*", "GPUParticles3D", true, false) + get_tree().root.find_children("*", "CPUParticles3D", true, false)
			"@labels":
				targets = get_tree().root.find_children("*", "Label3D", true, false)
			"@hud":
				var hud: Node = get_tree().current_scene.find_child("SimulationHUD", true, false)
				if hud != null:
					targets = [hud]
			"@fx":
				var fx: Node = get_node_or_null("/root/FXManager")
				if fx != null:
					targets = [fx]
			_:
				var n: Node = d.get_node_or_null(key)
				if n != null:
					targets = [n] + n.find_children("*", "VisualInstance3D", true, false)
		for t: Node in targets:
			if "visible" in t:
				t.set("visible", not want)
		_ok("%s %s (%d nodes)" % [nm, "hidden" if want else "shown", targets.size()])

func _c_draw(a: Array) -> void:
	var modes: Dictionary = {"normal": Viewport.DEBUG_DRAW_DISABLED, "wire": Viewport.DEBUG_DRAW_WIREFRAME, "overdraw": Viewport.DEBUG_DRAW_OVERDRAW, "unshaded": Viewport.DEBUG_DRAW_UNSHADED}
	var m: String = String(a[0]) if a.size() > 0 else "normal"
	if not modes.has(m):
		_err("draw " + "|".join(modes.keys()))
		return
	if m == "wire":
		RenderingServer.set_debug_generate_wireframes(true)
	get_viewport().debug_draw = modes[m]
	_ok("Draw mode: %s%s" % [m, "  (wire/overdraw may be unavailable in the web build's renderer)" if m != "normal" else ""])

func _c_scene(a: Array) -> void:
	var scenes: Dictionary = {
		"menu": "res://scenes/ui/main_menu.tscn", "valley": "res://scenes/world.tscn", "bets": "res://scenes/ui/betting_table.tscn",
		"shop": "res://scenes/ui/greenhouse_shop.tscn", "minigames": "res://scenes/ui/campaign_setup.tscn",
		"golf": "res://scenes/minigames/seed_golf.tscn", "race": "res://scenes/minigames/stampede_sprint.tscn",
		"brawl": "res://scenes/minigames/predator_brawl.tscn", "dominion": "res://scenes/minigames/valley_dominion.tscn",
		"sweep": "res://scenes/minigames/mycelium_sweep.tscn",
	}
	var s: String = String(a[0]) if a.size() > 0 else ""
	if s == "rules":
		get_tree().change_scene_to_file(scenes["menu"])
		await get_tree().process_frame
		await get_tree().process_frame
		var m: Node = get_tree().current_scene
		if m != null and m.has_method("_on_rules"):
			m.call("_on_rules")
		return
	if not scenes.has(s):
		_err("scene " + "|".join(scenes.keys()) + "|rules")
		return
	if s == "valley":
		_gc().current_mode = "sandbox"
	Engine.time_scale = 1.0
	get_tree().paused = false
	get_tree().change_scene_to_file(scenes[s])
	_ok("Going to %s." % s)
