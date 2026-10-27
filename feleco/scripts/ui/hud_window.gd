class_name HudWindow
extends RefCounted

# Every window on the valley HUD can be dragged by its background and folded
# down to its title bar, so players can clear the view of the simulation.
# dress() adds a title bar (title, fold, close) as the first row of the
# window's own column; the rest of that column is the body that folds away.
# Children keep their scene paths, so the HUD's $TopLeft/VBox/... still work.

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")

static func dress(win: Control, title: String, col: Container = null, on_close: Callable = Callable()) -> void:
	if col == null:
		for child: Node in win.get_children():
			if child is Container:
				col = child
				break
	movable(win)
	var bar := HBoxContainer.new()
	bar.name = "TitleBar"
	bar.add_theme_constant_override("separation", 4)
	bar.mouse_filter = Control.MOUSE_FILTER_PASS
	var name_label := FelecoUiScript.heading(title, 14, FelecoUiScript.GOLD)
	name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	name_label.tooltip_text = "Drag to move."
	bar.add_child(name_label)
	var fold := _bar_button("-", "Fold this window down to its title.")
	fold.pressed.connect(func() -> void: set_folded(win, not is_folded(win)))
	bar.add_child(fold)
	var close := _bar_button("x", "Close. Open it again from the rail on the right.")
	close.pressed.connect(func() -> void:
		if on_close.is_valid():
			on_close.call()
		else:
			win.visible = false)
	bar.add_child(close)
	col.add_child(bar)
	col.move_child(bar, 0)
	win.set_meta("hud_col", col)
	win.set_meta("hud_fold", fold)

static func _bar_button(text: String, tip: String) -> Button:
	var b := Button.new()
	b.text = text
	b.tooltip_text = tip
	style_bar_button(b)
	return b

# Small square title-bar buttons; the theme's touch-size margins would make
# every title bar as tall as a dock button.
static func style_bar_button(b: Button) -> void:
	b.custom_minimum_size = Vector2(28, 24)
	b.add_theme_font_size_override("font_size", 14)
	b.focus_mode = Control.FOCUS_NONE
	for state: String in ["normal", "hover", "pressed", "focus"]:
		var sb := StyleBoxFlat.new()
		sb.bg_color = Color(1, 1, 1, 0.16 if state == "hover" else (0.24 if state == "pressed" else 0.06))
		sb.set_corner_radius_all(6)
		sb.content_margin_left = 6
		sb.content_margin_right = 6
		sb.content_margin_top = 0
		sb.content_margin_bottom = 0
		if state == "focus":
			sb.draw_center = false
		b.add_theme_stylebox_override(state, sb)

static func is_folded(win: Control) -> bool:
	return bool(win.get_meta("hud_folded", false))

static func set_folded(win: Control, folded: bool) -> void:
	if not win.has_meta("hud_col") or folded == is_folded(win):
		return
	var col: Container = win.get_meta("hud_col")
	for child: Node in col.get_children():
		if child.name != "TitleBar" and child is CanvasItem:
			if folded:
				child.set_meta("hud_was_visible", (child as CanvasItem).visible)
				(child as CanvasItem).visible = false
			else:
				(child as CanvasItem).visible = bool(child.get_meta("hud_was_visible", true))
	win.set_meta("hud_folded", folded)
	(win.get_meta("hud_fold") as Button).text = "+" if folded else "-"
	if win is Container:
		win.reset_size()
	else:
		# A plain Panel does not shrink to its content: set its height by hand.
		if folded:
			win.set_meta("hud_full_h", win.size.y)
			win.size.y = 52.0
		else:
			win.size.y = float(win.get_meta("hud_full_h", win.size.y))

# Drag by the window's background (labels let the press through; buttons keep it).
static func movable(win: Control) -> void:
	win.mouse_filter = Control.MOUSE_FILTER_STOP
	win.gui_input.connect(func(event: InputEvent) -> void:
		var mm := event as InputEventMouseMotion
		if mm != null and mm.button_mask & MOUSE_BUTTON_MASK_LEFT:
			var screen: Vector2 = win.get_viewport_rect().size
			var pos: Vector2 = win.position + mm.relative
			pos.x = clampf(pos.x, 40.0 - win.size.x, screen.x - 40.0)
			pos.y = clampf(pos.y, 0.0, screen.y - 40.0)
			win.position = pos
			win.accept_event()
		elif event is InputEventMouseButton:
			win.accept_event())
