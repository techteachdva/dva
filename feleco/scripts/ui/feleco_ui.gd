class_name FelecoUi
extends RefCounted

# One visual system for every Feleco menu. Godot has no Tailwind; this theme
# is the stylesheet: ink surfaces, cream type, one gold primary, 52px targets.

const INK := Color(0.078, 0.102, 0.086, 1)
const MOSS := Color(0.145, 0.188, 0.157, 1)
const CARD := Color(0.176, 0.231, 0.192, 0.94)
const GLASS := Color(0.09, 0.125, 0.102, 0.86)
const LINE := Color(0.345, 0.455, 0.365, 0.9)
const CREAM := Color(0.957, 0.937, 0.894, 1)
const MIST := Color(0.733, 0.784, 0.725, 1)
const GOLD := Color(0.902, 0.765, 0.416, 1)
const GOLD_DEEP := Color(0.62, 0.46, 0.18, 1)
const LEAF := Color(0.455, 0.62, 0.345, 1)
const CLAY := Color(0.78, 0.42, 0.34, 1)

static var _theme: Theme
static var _fonts: Dictionary = {}
static var _species_tex: Dictionary = {}

# Fredoka (rounded, storybook) for headings; Nunito for everything you read.
# Both are OFL; licences sit next to the files in assets/fonts.
static func font(kind: String = "body") -> Font:
	if not _fonts.has(kind):
		var path: String = "res://assets/fonts/Fredoka.ttf" if kind == "heading" else "res://assets/fonts/Nunito.ttf"
		var fv := FontVariation.new()
		fv.base_font = load(path) as FontFile
		var ts := TextServerManager.get_primary_interface()
		fv.variation_opentype = {ts.name_to_tag("wght"): 600 if kind == "heading" else (800 if kind == "bold" else 650)}
		if kind == "italic":
			# Nunito has no italic face: slant the regular one.
			fv.variation_transform = Transform2D(Vector2(1, 0), Vector2(0.22, 1), Vector2.ZERO)
		_fonts[kind] = fv
	return _fonts[kind]

static func heading(text: String, size: int, color: Color) -> Label:
	var lbl := label(text, size, color)
	lbl.add_theme_font_override("font", font("heading"))
	return lbl

# A creature's own sprite (its atlas cell) for menus and the betting table.
# role: 0 normal, 1 tough, 2 special.
static func species_texture(species: String, role: int = 0, female: bool = false) -> Texture2D:
	if not SpriteGenerator.SPECIES.has(species):
		# Producers and anything without a creature sprite: a grass tuft.
		if not _species_tex.has("tuft"):
			var tuft := "res://assets/sprites/tuft.png"
			_species_tex["tuft"] = load(tuft) if ResourceLoader.exists(tuft) else ImageTexture.create_from_image(SpriteGenerator.tuft_image())
		return _species_tex["tuft"]
	if species == "mushroom" and role == 0:
		role = 1  # cell 0 is the drifting spore; menus show the cap
	var key := "%s:%d:%s:%s" % [species, role, female, EraBook.id()]
	if not _species_tex.has(key):
		var atlas := AtlasTexture.new()
		atlas.atlas = SpriteGenerator.texture_for(species)
		var cell: Vector2i = SpriteGenerator.cell_size(species)
		atlas.region = Rect2(role * cell.x, (1 if female else 0) * cell.y, cell.x, cell.y)
		_species_tex[key] = atlas
	return _species_tex[key]

static func forget_creatures() -> void:
	_species_tex.clear()

# Phones and tablets: narrow, portrait or touch. Menus switch to big
# targets and swipeable pages.
static func is_compact(node: Control) -> bool:
	var size: Vector2 = node.get_viewport_rect().size
	return DisplayServer.is_touchscreen_available() or size.x < 1000.0 or size.y > size.x

static func theme() -> Theme:
	if _theme == null:
		_theme = _build()
	return _theme

static func dress_menu(root: Control) -> void:
	var th := theme()
	_assign(root, th)
	var bg := root.get_node_or_null("BG")
	if bg is ColorRect:
		(bg as ColorRect).color = INK
	_backdrop(root)
	_fit_targets(root)

# Every menu sits over the valley's season paintings, dimmed so the cards
# read clearly. The main menu has its own, brighter copy.
static func _backdrop(root: Control) -> void:
	if root.get_node_or_null("SeasonBackdrop") != null or root.find_children("*", "MenuBackdrop", true, false).size() > 0:
		return
	var holder := Control.new()
	holder.name = "SeasonBackdrop"
	holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	holder.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var art := MenuBackdrop.new()
	holder.add_child(art)
	var dim := ColorRect.new()
	dim.color = Color(INK.r, INK.g, INK.b, 0.74)
	dim.mouse_filter = Control.MOUSE_FILTER_IGNORE
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	holder.add_child(dim)
	root.add_child(holder)
	var bg2 := root.get_node_or_null("BG")
	root.move_child(holder, bg2.get_index() + 1 if bg2 != null else 0)

# A thin gold rule that fades out at both ends, under titles.
static func divider(width: float = 0.0) -> Control:
	var line := TextureRect.new()
	var grad := Gradient.new()
	grad.offsets = PackedFloat32Array([0.0, 0.5, 1.0])
	grad.colors = PackedColorArray([Color(GOLD.r, GOLD.g, GOLD.b, 0.0), GOLD, Color(GOLD.r, GOLD.g, GOLD.b, 0.0)])
	var tex := GradientTexture2D.new()
	tex.gradient = grad
	tex.width = 256
	tex.height = 2
	line.texture = tex
	line.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	line.stretch_mode = TextureRect.STRETCH_SCALE
	line.custom_minimum_size = Vector2(width, 2)
	line.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return line

static func dress_hud(layer: Node) -> void:
	_assign(layer, theme())
	_fit_targets(layer)

static func mark(button: Button, variation: String) -> void:
	button.theme_type_variation = variation

static func _assign(node: Node, th: Theme) -> void:
	if node is Control or node is Window:
		node.theme = th
	for child in node.get_children():
		_assign(child, th)

static func _fit_targets(node: Node) -> void:
	if node is Button:
		var btn := node as Button
		if btn.custom_minimum_size.y < 48.0:
			btn.custom_minimum_size.y = 48.0
		btn.expand_icon = true
	for child in node.get_children():
		_fit_targets(child)

# One-screen menu frame: a header (Back, title), a row of cards that fills
# the middle, and a footer for the primary action. The cards scroll when they
# outgrow the screen, and stack on a tall phone, so Back and the footer always
# stay in reach. Returns {"body": BoxContainer, "footer": HBoxContainer,
# "title": Label}. The body stacks on a tall window. BoxContainer is the one
# that can change direction; HBoxContainer refuses and prints an error.
static func build_screen(root: Control, title: String, on_back: Callable) -> Dictionary:
	var margin := MarginContainer.new()
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	for side: String in ["left", "right"]:
		margin.add_theme_constant_override("margin_" + side, 36)
	margin.add_theme_constant_override("margin_top", 20)
	margin.add_theme_constant_override("margin_bottom", 20)
	root.add_child(margin)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 14)
	margin.add_child(column)

	var header := HBoxContainer.new()
	column.add_child(header)
	var back := Button.new()
	back.text = "Back"
	back.icon = load("res://assets/icons/back.svg")
	back.custom_minimum_size = Vector2(150, 48)
	back.tooltip_text = "Back to Menu."
	back.theme_type_variation = "GhostButton"
	back.pressed.connect(on_back)
	header.add_child(back)
	var titles := VBoxContainer.new()
	titles.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	titles.add_theme_constant_override("separation", 4)
	header.add_child(titles)
	var head := heading(title, 36, GOLD)
	head.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	head.add_theme_color_override("font_outline_color", Color(0.05, 0.04, 0.02, 0.9))
	head.add_theme_constant_override("outline_size", 6)
	titles.add_child(head)
	var rule := divider(360.0)
	rule.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	titles.add_child(rule)
	var balance := Control.new()
	balance.custom_minimum_size = Vector2(150, 0)
	header.add_child(balance)

	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	column.add_child(scroll)
	var body := BoxContainer.new()
	body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	body.add_theme_constant_override("separation", 16)
	var view: Vector2 = root.get_viewport_rect().size
	body.vertical = view.y > view.x
	scroll.add_child(body)
	var footer := HBoxContainer.new()
	footer.alignment = BoxContainer.ALIGNMENT_CENTER
	footer.add_theme_constant_override("separation", 14)
	column.add_child(footer)
	return {"body": body, "footer": footer, "title": head}

# A titled card in the body row. stretch weights how much width it takes.
static func card(parent: Control, title: String, stretch: float = 1.0, min_width: float = 0.0) -> VBoxContainer:
	var panel := PanelContainer.new()
	panel.custom_minimum_size.x = min_width
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	panel.size_flags_stretch_ratio = stretch
	parent.add_child(panel)
	var inner := VBoxContainer.new()
	inner.add_theme_constant_override("separation", 10)
	panel.add_child(inner)
	if not title.is_empty():
		inner.add_child(heading(title, 22, GOLD))
		inner.add_child(divider())
	return inner

static func label(text: String, size: int, color: Color) -> Label:
	var lbl := Label.new()
	lbl.text = text
	lbl.add_theme_font_size_override("font_size", size)
	lbl.add_theme_color_override("font_color", color)
	return lbl

# A row of equal buttons where one is the current choice (gold).
static func choice_row(parent: Control, labels: Array, icons: Array = []) -> Array[Button]:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	parent.add_child(row)
	var buttons: Array[Button] = []
	for i: int in labels.size():
		var btn := Button.new()
		btn.text = str(labels[i])
		if i < icons.size() and icons[i] != null:
			btn.icon = icons[i]
			btn.add_theme_constant_override("icon_max_width", 22)
		btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		btn.custom_minimum_size = Vector2(0, 48)
		btn.add_theme_font_size_override("font_size", 15)
		btn.theme_type_variation = "TouchButton"
		btn.add_theme_constant_override("h_separation", 6)
		btn.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
		row.add_child(btn)
		buttons.append(btn)
	return buttons

static func pick(buttons: Array[Button], chosen: Button) -> void:
	for btn in buttons:
		btn.theme_type_variation = "PrimaryButton" if btn == chosen else "TouchButton"

static func _build() -> Theme:
	var th := Theme.new()
	th.default_font_size = 18
	th.default_font = font("body")

	var card := _box(CARD, LINE, 18, 1)
	var glass := _box(GLASS, Color(LINE.r, LINE.g, LINE.b, 0.45), 20, 1)
	# Panels: a gold top edge and a soft drop shadow.
	glass.border_color = Color(GOLD.r, GOLD.g, GOLD.b, 0.32)
	glass.border_width_top = 2
	glass.shadow_color = Color(0, 0, 0, 0.45)
	glass.shadow_size = 14
	# Frosted: the valley shows through every window.
	glass.bg_color.a = 0.66
	glass.border_color = Color(1, 1, 1, 0.22)
	glass.set_border_width_all(1)
	glass.border_width_top = 2
	glass.shadow_offset = Vector2(0, 4)
	# Spirit-of-nature buttons: leaf-shaped, deep forest, edged in living gold.
	var button := _leaf(Color(0.11, 0.2, 0.15, 1), Color(0.45, 0.62, 0.36, 1))
	var button_hover := _leaf(Color(0.17, 0.3, 0.2, 1), GOLD)
	var button_down := _box(Color(0.11, 0.15, 0.12, 1), GOLD_DEEP, 16, 1)
	var button_off := _box(Color(0.12, 0.14, 0.12, 0.55), Color(LINE.r, LINE.g, LINE.b, 0.25), 16, 1)

	th.set_stylebox("panel", "Panel", glass)
	th.set_stylebox("panel", "PanelContainer", glass)
	th.set_stylebox("panel", "PopupPanel", card)

	th.set_stylebox("normal", "Button", button)
	th.set_stylebox("hover", "Button", button_hover)
	th.set_stylebox("pressed", "Button", button_down)
	th.set_stylebox("disabled", "Button", button_off)
	th.set_stylebox("focus", "Button", button_hover)
	_font(th, "Button", CREAM, MIST)
	th.set_constant("icon_max_width", "Button", 48)
	th.set_constant("h_separation", "Button", 12)
	th.set_color("icon_normal_color", "Button", CREAM)
	th.set_color("icon_hover_color", "Button", GOLD)
	th.set_color("icon_pressed_color", "Button", GOLD)
	th.set_color("icon_focus_color", "Button", GOLD)

	var primary := _leaf(Color(0.14, 0.34, 0.22, 1), GOLD)
	var primary_hover := _leaf(Color(0.2, 0.46, 0.28, 1), Color(1.0, 0.93, 0.62, 1))
	var primary_down := _leaf(Color(0.09, 0.22, 0.14, 1), GOLD_DEEP)
	var primary_off := _box(Color(GOLD.r, GOLD.g, GOLD.b, 0.35), Color(0, 0, 0, 0), 16, 0)
	th.set_type_variation("PrimaryButton", "Button")
	th.set_stylebox("normal", "PrimaryButton", primary)
	th.set_stylebox("hover", "PrimaryButton", primary_hover)
	th.set_stylebox("pressed", "PrimaryButton", primary_down)
	th.set_stylebox("disabled", "PrimaryButton", primary_off)
	th.set_stylebox("focus", "PrimaryButton", primary_hover)
	_font(th, "PrimaryButton", Color(1.0, 0.96, 0.82), Color(0.8, 0.8, 0.7, 0.55))
	th.set_color("icon_normal_color", "PrimaryButton", GOLD)
	th.set_color("icon_hover_color", "PrimaryButton", GOLD)
	th.set_color("icon_pressed_color", "PrimaryButton", GOLD)
	th.set_color("icon_focus_color", "PrimaryButton", GOLD)
	th.set_color("icon_disabled_color", "PrimaryButton", Color(0.2, 0.16, 0.08, 0.4))
	th.set_constant("icon_max_width", "PrimaryButton", 48)

	var ghost := _box(Color(0.08, 0.1, 0.08, 0.35), Color(LINE.r, LINE.g, LINE.b, 0.35), 14, 1)
	var ghost_hover := _box(Color(0.16, 0.2, 0.16, 0.72), CREAM, 14, 1)
	th.set_type_variation("GhostButton", "Button")
	th.set_stylebox("normal", "GhostButton", ghost)
	th.set_stylebox("hover", "GhostButton", ghost_hover)
	th.set_stylebox("pressed", "GhostButton", button_down)
	th.set_stylebox("disabled", "GhostButton", button_off)
	th.set_stylebox("focus", "GhostButton", ghost_hover)
	_font(th, "GhostButton", CREAM, MIST)
	th.set_constant("icon_max_width", "GhostButton", 48)
	th.set_color("icon_normal_color", "GhostButton", CREAM)
	th.set_color("icon_hover_color", "GhostButton", GOLD)
	th.set_color("icon_pressed_color", "GhostButton", GOLD)
	th.set_color("icon_focus_color", "GhostButton", GOLD)

	var touch := _box(Color(0.22, 0.32, 0.2, 0.95), LEAF, 16, 1)
	var touch_hover := _box(Color(0.3, 0.42, 0.26, 1), GOLD, 16, 1)
	th.set_type_variation("TouchButton", "Button")
	th.set_stylebox("normal", "TouchButton", touch)
	th.set_stylebox("hover", "TouchButton", touch_hover)
	th.set_stylebox("pressed", "TouchButton", button_down)
	th.set_stylebox("disabled", "TouchButton", button_off)
	th.set_stylebox("focus", "TouchButton", touch_hover)
	_font(th, "TouchButton", CREAM, MIST)
	th.set_constant("icon_max_width", "TouchButton", 48)
	th.set_color("icon_normal_color", "TouchButton", CREAM)
	th.set_color("icon_hover_color", "TouchButton", GOLD)
	th.set_color("icon_pressed_color", "TouchButton", GOLD)
	th.set_color("icon_focus_color", "TouchButton", GOLD)

	var danger := _box(Color(0.28, 0.12, 0.1, 0.9), CLAY, 16, 1)
	var danger_hover := _box(Color(0.4, 0.16, 0.13, 1), Color(0.95, 0.7, 0.6, 1), 16, 1)
	th.set_type_variation("DangerButton", "Button")
	th.set_stylebox("normal", "DangerButton", danger)
	th.set_stylebox("hover", "DangerButton", danger_hover)
	th.set_stylebox("pressed", "DangerButton", button_down)
	th.set_stylebox("disabled", "DangerButton", button_off)
	th.set_stylebox("focus", "DangerButton", danger_hover)
	_font(th, "DangerButton", CREAM, MIST)
	th.set_constant("icon_max_width", "DangerButton", 48)
	th.set_color("icon_normal_color", "DangerButton", CREAM)
	th.set_color("icon_hover_color", "DangerButton", Color(0.95, 0.7, 0.6, 1))
	th.set_color("icon_pressed_color", "DangerButton", Color(0.95, 0.7, 0.6, 1))
	th.set_color("icon_focus_color", "DangerButton", Color(0.95, 0.7, 0.6, 1))

	th.set_color("font_color", "Label", CREAM)
	th.set_color("font_color", "RichTextLabel", CREAM)
	th.set_color("default_color", "RichTextLabel", CREAM)
	th.set_constant("separation", "VBoxContainer", 12)
	th.set_constant("separation", "HBoxContainer", 10)

	var field := _box(Color(0.1, 0.13, 0.11, 1), LINE, 12, 1)
	th.set_stylebox("normal", "LineEdit", field)
	th.set_stylebox("focus", "LineEdit", _box(Color(0.1, 0.13, 0.11, 1), GOLD, 12, 1))
	th.set_color("font_color", "LineEdit", CREAM)
	th.set_color("font_placeholder_color", "LineEdit", MIST)

	th.set_stylebox("normal", "OptionButton", button)
	th.set_stylebox("hover", "OptionButton", button_hover)
	th.set_stylebox("pressed", "OptionButton", button_down)
	th.set_stylebox("disabled", "OptionButton", button_off)
	th.set_stylebox("focus", "OptionButton", button_hover)
	_font(th, "OptionButton", CREAM, MIST)
	th.set_constant("icon_max_width", "OptionButton", 28)
	th.set_color("icon_normal_color", "OptionButton", GOLD)
	th.set_color("icon_hover_color", "OptionButton", GOLD)
	th.set_color("icon_pressed_color", "OptionButton", GOLD)
	th.set_color("icon_focus_color", "OptionButton", GOLD)

	var popup := _box(Color(0.12, 0.16, 0.13, 1), LINE, 12, 1)
	var popup_hover := _box(Color(GOLD.r, GOLD.g, GOLD.b, 0.28), GOLD, 8, 0)
	th.set_stylebox("panel", "PopupMenu", popup)
	th.set_stylebox("hover", "PopupMenu", popup_hover)
	th.set_color("font_color", "PopupMenu", CREAM)
	th.set_color("font_hover_color", "PopupMenu", CREAM)
	th.set_color("font_accelerator_color", "PopupMenu", MIST)

	th.set_stylebox("panel", "ItemList", _box(Color(0.1, 0.13, 0.11, 1), LINE, 14, 1))
	th.set_stylebox("selected", "ItemList", _box(Color(GOLD.r, GOLD.g, GOLD.b, 0.28), GOLD, 8, 0))
	th.set_stylebox("selected_focus", "ItemList", _box(Color(GOLD.r, GOLD.g, GOLD.b, 0.38), GOLD, 8, 0))
	th.set_stylebox("cursor", "ItemList", _box(Color(0, 0, 0, 0), GOLD, 8, 1))
	th.set_color("font_color", "ItemList", CREAM)
	th.set_color("font_selected_color", "ItemList", CREAM)
	th.set_color("guide_color", "ItemList", LINE)
	th.set_constant("h_separation", "ItemList", 12)
	th.set_constant("v_separation", "ItemList", 8)

	var grab := _box(Color(GOLD.r, GOLD.g, GOLD.b, 0.85), Color(0, 0, 0, 0), 6, 0)
	grab.content_margin_left = 1
	grab.content_margin_right = 1
	grab.content_margin_top = 8
	grab.content_margin_bottom = 8
	var track := _box(Color(0, 0, 0, 0.25), Color(0, 0, 0, 0), 8, 0)
	for bar: String in ["VScrollBar", "HScrollBar"]:
		th.set_stylebox("grabber", bar, grab)
		th.set_stylebox("grabber_highlight", bar, _box(GOLD, Color(0, 0, 0, 0), 8, 0))
		th.set_stylebox("grabber_pressed", bar, _box(GOLD_DEEP, Color(0, 0, 0, 0), 8, 0))
		th.set_stylebox("scroll", bar, track)

	return th

static func _font(th: Theme, kind: String, enabled: Color, disabled: Color) -> void:
	th.set_color("font_color", kind, enabled)
	th.set_color("font_hover_color", kind, enabled)
	th.set_color("font_pressed_color", kind, enabled)
	th.set_color("font_focus_color", kind, enabled)
	th.set_color("font_disabled_color", kind, disabled)

static func _leaf(bg: Color, edge: Color) -> StyleBoxFlat:
	var box := _box(bg, edge, 6, 2)
	box.corner_radius_top_left = 24
	box.corner_radius_bottom_right = 24
	box.shadow_color = Color(edge.r, edge.g, edge.b, 0.28)
	box.shadow_size = 6
	return box

static func _box(bg: Color, border: Color, radius: int, border_w: int) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = bg
	box.border_color = border
	box.set_border_width_all(border_w)
	box.set_corner_radius_all(radius)
	box.content_margin_left = 16
	box.content_margin_right = 16
	box.content_margin_top = 10
	box.content_margin_bottom = 10
	return box
