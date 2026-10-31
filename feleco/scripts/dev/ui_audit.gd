extends Node

# Dev-only: opens every menu and flags what is off the screen, cut off, or
# lying on top of something else, and saves a picture of each.
#   godot --path . --resolution 1280x720 res://scenes/dev/ui_audit.tscn -- <out dir> [screen,screen]

const SCENES: Dictionary = {
	"menu": "res://scenes/ui/main_menu.tscn", "setup": "res://scenes/ui/setup_board.tscn",
	"shop": "res://scenes/ui/greenhouse_shop.tscn", "campaign": "res://scenes/ui/campaign_setup.tscn",
	"challenge": "res://scenes/ui/challenge_setup.tscn", "table": "res://scenes/ui/betting_table.tscn",
	"guide": "res://scenes/ui/field_guide.tscn", "lab": "res://scenes/ui/tuning_lab.tscn",
	"quests": "res://scenes/ui/quest_board.tscn", "world": "res://scenes/world.tscn",
}
# screen, base scene, action run once it has settled.
const SCREENS: Array = [
	["menu", "menu", ""], ["menu_about", "menu", "about"], ["menu_rules", "menu", "rules"], ["menu_rules_card", "menu", "rules_card"],
	["menu_sandbox", "menu", "sandbox"], ["setup", "setup", ""], ["shop", "shop", ""], ["campaign", "campaign", ""],
	["challenge", "challenge", ""], ["table", "table", ""], ["table_plans", "table", "plans"], ["table_guide", "table", "table_guide"],
	["guide", "guide", ""], ["guide_card", "guide", "guide_card"], ["lab", "lab", ""], ["quests", "quests", ""],
	["hud", "world", ""], ["hud_windows", "world", "windows"], ["hud_bets", "world", "bets"], ["hud_history", "world", "history"],
	["hud_hand", "world", "hand"], ["hud_studio", "world", "studio"], ["hud_levelup", "world", "levelup"], ["hud_follow", "world", "follow"],
	["hud_paused", "world", "pause"],
]

var _out: String = "user://ui_audit"
var _found: int = 0
var _sheep: MarkovAgent = null
# Reports wait here: a full-screen cover painted later hides what came before.
var _pending: Array[String] = []
var _window_id: int = 0

func _ready() -> void:
	_run.call_deferred()

func _detach() -> void:
	# Outlive the scene changes below.
	var tree := get_tree()
	var root := tree.root
	get_parent().remove_child(self)
	root.add_child(self)
	tree.current_scene = null

func _run() -> void:
	_detach()
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		_out = args[0]
	var only: Array = Array(args[1].split(",", false)) if args.size() > 1 else []
	DirAccess.make_dir_recursive_absolute(_out)
	var gc: Node = get_node("/root/GameConfig")
	if args.size() > 2:
		var wh: PackedStringArray = args[2].split("x")
		get_window().mode = Window.MODE_WINDOWED
		get_window().size = Vector2i(int(wh[0]), int(wh[1]))
		for _i: int in 5:
			await get_tree().process_frame
	print("VIEW ", get_viewport().get_visible_rect().size, " window ", get_window().size)
	for s: Array in SCREENS:
		if not only.is_empty() and not only.has(s[0]):
			continue
		gc.reset_run_state()
		gc.intro_seen = true
		gc.tutorial_done = true
		gc.current_mode = "main" if s[1] == "world" else "sandbox"
		gc.eco_points = 40
		# As the game does it, so _ready sees a current scene.
		get_tree().change_scene_to_file(SCENES[s[1]])
		await get_tree().scene_changed
		var scene: Node = get_tree().current_scene
		for _i: int in 50:
			await get_tree().process_frame
		if s[1] == "world":
			var ld := scene.find_child("LoadingScreen", true, false)
			if ld != null:
				ld.queue_free()
			get_tree().paused = false
			for _i: int in 30:
				await get_tree().process_frame
		await _act(String(s[2]), scene)
		for _i: int in 40:
			await get_tree().process_frame
		_inspect(String(s[0]))
		get_viewport().get_texture().get_image().save_png(_out + "/" + String(s[0]) + ".png")
		get_tree().paused = false
	print("UI PROBLEMS ", _found)
	get_tree().quit()

func _act(what: String, scene: Node) -> void:
	var hud: Node = scene.find_child("SimulationHUD", true, false)
	match what:
		"about":
			for c: Node in scene.get_children():
				if c is PopupPanel and c.name != "RulesPopup":
					(c as PopupPanel).popup_centered()
		"rules", "rules_card":
			scene.call("_on_rules")
			await get_tree().process_frame
			await get_tree().process_frame
			for c: Node in scene.find_children("*", "RulesTour", true, false):
				c.queue_free()
			if what == "rules_card":
				(scene.get_node("FieldGuide") as FieldGuide).focus_species("human")
		"sandbox":
			scene.call("_on_sandbox")
		"plans":
			scene.call("_open_plans")
		"table_guide":
			scene.call("_open_guide")
		"guide_card":
			(scene as FieldGuide).focus_species("human")
		"windows":
			for n: String in ["TopLeft", "TopRight", "HillBars"]:
				var w := hud.get_node_or_null(n) as Control
				if w != null:
					w.visible = true
					HudWindow.set_folded(w, false)
			var g: Control = hud.get("_goals")
			if g != null:
				g.visible = true
				HudWindow.set_folded(g, false)
		"bets":
			hud.call("_open_bets")
		"history":
			hud.call("_open_history")
		"pause":
			hud.call("_toggle_pause")
		"hand", "studio", "levelup", "follow":
			var dir := scene.get_node("World") as SimulationDirector
			_sheep = null
			for d: AgentData in dir._agent_registry:
				if d.species == "sheep" and d.node is MarkovAgent:
					_sheep = d.node
					break
			dir.process_mode = Node.PROCESS_MODE_DISABLED
			if what == "follow":
				hud.call("_start_follow", _sheep)
				return
			hud.call("_lift_in_hand", _sheep)
			for _i: int in 400:
				await get_tree().process_frame
				if hud.get_node_or_null("HandChoices") != null:
					break
			if what == "hand":
				return
			var ch: Node = hud.get_node_or_null("HandChoices")
			_press(ch, "Claim")
			await get_tree().process_frame
			await get_tree().process_frame
			_press(ch, "Brand" if what == "studio" else "Train")
			await get_tree().process_frame
			print("HAND ", what, " choices=", ch != null, " studio=", hud.find_children("*", "BrandStudio", false, false).size())

func _press(root_node: Node, text: String) -> void:
	if root_node == null:
		return
	for b: Node in root_node.find_children("*", "Button", true, false):
		if (b as Button).text == text:
			(b as Button).pressed.emit()
			return

func _report(screen: String, kind: String, msg: String) -> void:
	_pending.append("%s %s: %s" % [kind, screen, msg])

func _name(c: Control) -> String:
	var t: String = ""
	if c is Label:
		t = (c as Label).text
	elif c is Button:
		t = (c as Button).text
	elif c is RichTextLabel:
		t = (c as RichTextLabel).get_parsed_text()
	return "%s<%s> '%s'" % [c.name, c.get_class(), t.substr(0, 34).replace("\n", " ")]

# A one-line label's box can be far wider than its words; judge the words.
func _text_rect(c: Control) -> Rect2:
	var r := c.get_global_rect()
	if c is Label and (c as Label).autowrap_mode == TextServer.AUTOWRAP_OFF:
		var l := c as Label
		var k: float = c.get_global_transform().get_scale().x
		var w: float = l.get_theme_font("font").get_multiline_string_size(l.text, HORIZONTAL_ALIGNMENT_LEFT, -1, l.get_theme_font_size("font_size")).x * k
		var x: float = r.position.x
		if l.horizontal_alignment == HORIZONTAL_ALIGNMENT_CENTER:
			x += (r.size.x - w) * 0.5
		elif l.horizontal_alignment == HORIZONTAL_ALIGNMENT_RIGHT:
			x += r.size.x - w
		return Rect2(x, r.position.y, w, r.size.y)
	return r

func _inspect(screen: String) -> void:
	var view: Rect2 = get_viewport().get_visible_rect()
	var items: Array = []
	_pending.clear()
	_window_id = 0
	_walk(get_tree().root, view, view, screen, items, false)
	# Words or buttons lying on each other.
	for i: int in items.size():
		var a: Array = items[i]
		for j: int in range(i + 1, items.size()):
			var b: Array = items[j]
			if a[0].is_ancestor_of(b[0]) or b[0].is_ancestor_of(a[0]) or a[2] != b[2]:
				continue
			var hit: Rect2 = (a[1] as Rect2).intersection(b[1])
			var least: float = minf((a[1] as Rect2).get_area(), (b[1] as Rect2).get_area())
			if hit.has_area() and hit.get_area() > least * 0.12 and hit.size.y > 5.0 and hit.size.x > 5.0:
				_report(screen, "OVERLAP", "%s  x  %s" % [_name(a[0]), _name(b[0])])
	for line: String in _pending:
		print(line)
	_found += _pending.size()

func _walk(n: Node, view: Rect2, clip: Rect2, screen: String, items: Array, in_scroll: bool) -> void:
	if n is Window and n != get_tree().root:
		if not (n as Window).visible:
			return
		var win := Rect2((n as Window).position, (n as Window).size)
		if not view.encloses(win):
			_report(screen, "OFFSCREEN", "window %s %s" % [n.name, win])
		var inner := Rect2(Vector2.ZERO, win.size)
		_window_id += 1
		for c: Node in n.get_children():
			_walk(c, inner, inner, screen, items, false)
		return
	if n is CanvasLayer and not (n as CanvasLayer).visible:
		return
	# Passing world labels, and the marquee, which scrolls off on purpose.
	if n is FloatingText or n is Tickertape or n.name == "Toast":
		return
	if n is CanvasItem and (not (n as CanvasItem).visible or (n as CanvasItem).modulate.a < 0.05):
		return
	if n is Control:
		var c := n as Control
		var r: Rect2 = c.get_global_rect()
		# A zoomed picture is meant to run past its frame.
		if c.scale.x > 1.01:
			return
		if c.name == "StudioPanel":
			# An opaque card: what lies under it can't be seen.
			var keep: Array = items.filter(func(it: Array) -> bool: return not r.intersects(it[1]))
			items.clear()
			items.append_array(keep)
		var opaque: bool = c is FieldGuide or (c is ColorRect and (c as ColorRect).color.a > 0.6) or c.name == "TypePicker"
		if (opaque and r.get_area() > view.get_area() * 0.9) or (c.get_parent() is EventHistory and c is Panel):
			items.clear()
			_pending.clear()
		var worded: bool = c is Label and not (c as Label).text.strip_edges().is_empty()
		var labelled: bool = worded or c is Button or c is RichTextLabel or c is LineEdit or c is SpinBox
		if labelled and r.size.x > 1.0 and r.size.y > 1.0:
			var t: Rect2 = _text_rect(c)
			if not in_scroll:
				if not view.grow(1.0).encloses(t):
					_report(screen, "OFFSCREEN", "%s rect %s" % [_name(c), t])
				elif not clip.grow(2.0).encloses(t):
					_report(screen, "CUT OFF", "%s rect %s in %s" % [_name(c), t, clip])
			if c is Label and (c as Label).clip_text and t.size.x > r.size.x + 2.0:
				_report(screen, "CUT OFF", "%s text wider than its box" % _name(c))
			if clip.intersects(t):
				items.append([c, t.intersection(clip) if in_scroll else t, _window_id])
		if c is ScrollContainer:
			clip = clip.intersection(r)
			in_scroll = true
		elif c.clip_contents:
			clip = clip.intersection(r)
	for k: Node in n.get_children():
		if k != self:
			_walk(k, view, clip, screen, items, in_scroll)
