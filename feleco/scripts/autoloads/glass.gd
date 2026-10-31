extends Node

# Modern glass and motion for every screen. Any button or window that enters
# the tree is picked up here: buttons get a gradient chosen by what they do and
# a springy hover and press; free-standing windows ease open.

# Words -> baked art in assets/ui/buttons/ (see scripts/dev/bake_buttons.py).
const CATEGORIES: Array = [
	[["quit", "end early", "stop", "drop", "back", "skip", "let go", "x"], "exit"],
	[["rain", "flood", "fish", "river"], "rain"],
	[["drought", "summer", "sun"], "sun"],
	[["meteor", "power", "rampage", "eclipse", "golden", "gold", "fight"], "power"],
	[["food web", "census", "history", "ticker", "rules", "goals", "vault", "quests", "how", "film"], "info"],
	[["time", "1x", "2x", "4x", "pause", "view", "day"], "time"],
	[["settings", "lab", "simulation"], "settings"],
]
# Words -> an icon of their own, in assets/ui/buttons/icons/. First match wins.
const ICONS: Array = [
	["food web", "web"], ["census", "bars"], ["goals", "target"], ["hill", "crown"], ["champion", "flag"], ["creature", "paw"],
	["history", "book"], ["ticker", "scroll"], ["time", "clock"], ["power", "bolt"], ["clear view", "eye"], ["top view", "eye"],
	["vault", "eye"], ["quest", "scroll"], ["rules", "book"], ["film", "play"], ["how", "book"], ["settings", "gear"], ["lab", "gear"],
	["simulation", "gear"], ["greenhouse", "tree"], ["mini", "sword"], ["challenge", "sword"], ["fight", "sword"], ["valley", "tree"],
	["begin", "play"], ["play", "play"], ["pause", "clock"], ["rain", "drop"], ["flood", "wave"], ["river", "wave"], ["drought", "sun"],
	["meteor", "meteor"], ["rampage", "flame"], ["eclipse", "moon"], ["moon", "moon"], ["bloom", "flower"], ["feast", "flower"],
	["stampede", "paw"], ["claim", "hand"], ["make mine", "hand"], ["take control", "hand"], ["drop", "hand"], ["follow", "eye"],
	["train", "sprout"], ["brand", "flame"], ["random", "dice"], [" ep", "coin"], ["back", "back"], ["quit", "cross"], ["stop", "cross"],
	["end early", "cross"], ["skip", "back"],
]
const ICON_MIN_WIDTH: float = 96.0
const HOVER_SCALE: float = 1.05

var _cache: Dictionary = {}

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	get_tree().node_added.connect(_on_node)

func _on_node(n: Node) -> void:
	if n is Button:
		_dress_button.call_deferred(n)
	elif n is PanelContainer and not n.get_parent() is Container and not n.get_parent() is ScrollContainer:
		_open_window.call_deferred(n)

func _style(art: String, bright: float) -> StyleBoxTexture:
	var key: String = "%s%s" % [art, bright]
	if _cache.has(key):
		return _cache[key]
	var box := StyleBoxTexture.new()
	box.texture = load("res://assets/ui/buttons/%s.png" % art)
	# Corners and their blossoms hold their shape; the middle stretches.
	box.set_texture_margin_all(17.0)
	box.set_expand_margin_all(0.0)
	box.modulate_color = Color(1.0 + bright, 1.0 + bright, 1.0 + bright)
	for side: int in [SIDE_LEFT, SIDE_RIGHT]:
		box.set_content_margin(side, 16)
	for side: int in [SIDE_TOP, SIDE_BOTTOM]:
		box.set_content_margin(side, 10)
	_cache[key] = box
	return box

func _art(text: String) -> String:
	var t: String = text.to_lower()
	for row: Array in CATEGORIES:
		for word: String in row[0]:
			if t == word or (word.length() > 1 and t.contains(word)):
				return row[1]
	return "life"

func _dress_button(b: Button) -> void:
	if not is_instance_valid(b) or b.flat or b.has_meta("glass"):
		return
	b.set_meta("glass", true)
	var art: String = _art(b.text)
	b.add_theme_stylebox_override("normal", _style(art, 0.0))
	b.add_theme_stylebox_override("hover", _style(art, 0.2))
	b.add_theme_stylebox_override("focus", _style(art, 0.2))
	b.add_theme_stylebox_override("pressed", _style(art, 0.4))
	b.add_theme_color_override("font_color", Color(1.0, 0.98, 0.9))
	b.add_theme_color_override("font_hover_color", Color.WHITE)
	_add_icon(b)
	b.mouse_entered.connect(_spring.bind(b, HOVER_SCALE))
	b.mouse_exited.connect(_spring.bind(b, 1.0))
	b.button_down.connect(_spring.bind(b, 0.94))
	b.button_up.connect(_spring.bind(b, HOVER_SCALE))

# A true-shaped icon at the right end. Never on a button with its own, or too
# small to hold words and a symbol.
func _add_icon(b: Button) -> void:
	if b.icon != null or b.size.x < ICON_MIN_WIDTH or b.text.length() <= 1:
		return
	# Words first: no icon unless it clears them.
	var font: Font = b.get_theme_font("font")
	var words: float = font.get_string_size(b.text, HORIZONTAL_ALIGNMENT_LEFT, -1, b.get_theme_font_size("font_size")).x
	if (b.size.x + words) * 0.5 > b.size.x - 52.0:
		return
	var t: String = b.text.to_lower()
	for row: Array in ICONS:
		if t.contains(row[0]):
			var mark := TextureRect.new()
			mark.texture = load("res://assets/ui/buttons/icons/%s.png" % row[1])
			mark.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
			mark.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
			mark.mouse_filter = Control.MOUSE_FILTER_IGNORE
			var side: float = minf(b.size.y - 10.0, 34.0)
			mark.set_anchors_preset(Control.PRESET_CENTER_RIGHT)
			mark.offset_left = -side - 12.0
			mark.offset_right = -12.0
			mark.offset_top = -side * 0.5
			mark.offset_bottom = side * 0.5
			b.add_child(mark)
			return

func _spring(b: Button, to: float) -> void:
	if not is_instance_valid(b) or not b.is_inside_tree():
		return
	b.pivot_offset = b.size * 0.5
	var tw := b.create_tween().set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_property(b, "scale", Vector2.ONE * to, 0.16)

func _open_window(w: PanelContainer) -> void:
	if not is_instance_valid(w) or not w.is_visible_in_tree():
		return
	w.pivot_offset = w.size * 0.5
	var goal: Color = w.modulate
	w.scale = Vector2.ONE * 0.92
	w.modulate.a = 0.0
	var tw := w.create_tween().set_parallel().set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_property(w, "scale", Vector2.ONE, 0.26)
	tw.tween_property(w, "modulate", goal, 0.2)

# A window eases shut; freeing it, or just hiding it, once it has.
func close(w: Control, free: bool = false) -> void:
	if not is_instance_valid(w) or w.has_meta("closing"):
		return
	w.set_meta("closing", true)
	w.pivot_offset = w.size * 0.5
	var tw := w.create_tween().set_parallel().set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_IN)
	tw.tween_property(w, "scale", Vector2.ONE * 0.9, 0.18)
	tw.tween_property(w, "modulate:a", 0.0, 0.18)
	tw.chain().tween_callback(func() -> void:
		w.remove_meta("closing")
		if free:
			w.queue_free()
		else:
			w.visible = false
			w.scale = Vector2.ONE
			w.modulate.a = 1.0)

func open(w: Control) -> void:
	w.visible = true
	_open_window(w)
