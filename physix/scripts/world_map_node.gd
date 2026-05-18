extends TextureButton

var world_num: int  = 1
var level_num: int  = 1
var stars: int      = 0
var best_time: float = INF
var unlocked: bool  = false
var is_selected: bool = false
var world_color: Color = Color.WHITE

var star_bar:    HBoxContainer
var lock_icon:   TextureRect
var level_label: Label
var best_time_lbl: Label
var anim:        AnimationPlayer
var bg:          ColorRect
var _icons_ready: bool = false


func _ready() -> void:
	star_bar = $StarBar
	lock_icon = $LockIcon
	level_label = $LevelLabel
	anim = $AnimationPlayer
	bg = $BG
	_ensure_best_time_label()
	_layout_node_labels()
	_setup_icons()
	_icons_ready = true
	_refresh_visuals()


func _setup_icons() -> void:
	if lock_icon:
		UiIconLayout.configure_icon_rect(lock_icon, "lock", Vector2(40, 40))
	if star_bar:
		for i: int in range(mini(3, star_bar.get_child_count())):
			var star: TextureRect = star_bar.get_child(i) as TextureRect
			if star:
				UiIconLayout.configure_icon_rect(star, "star_empty", Vector2(20, 20))


func setup(w: int, l: int, star_count: int, is_unlocked: bool, tint: Color, p_best_time: float = INF) -> void:
	world_num = w
	level_num = l
	stars     = star_count
	best_time = p_best_time
	unlocked  = is_unlocked
	world_color = tint
	modulate  = Color.WHITE
	if bg:
		bg.visible = false
	if _icons_ready:
		_refresh_visuals()

func refresh(new_stars: int, is_unlocked: bool, p_best_time: float = INF) -> void:
	var just_unlocked: bool = is_unlocked and not unlocked
	stars    = new_stars
	unlocked = is_unlocked
	if p_best_time < INF:
		best_time = p_best_time
	_refresh_visuals()
	if just_unlocked and anim.has_animation("unlock_pop"):
		anim.play("unlock_pop")

func _refresh_visuals() -> void:
	if level_num == 0:
		level_label.text = "B"
		level_label.set("theme_override_font_sizes/font_size", 24)
	else:
		level_label.text  = "%d-%d" % [world_num, level_num]
		level_label.set("theme_override_font_sizes/font_size", 16)
	if lock_icon:
		lock_icon.visible = not unlocked

	_update_best_time_label()
	if star_bar == null:
		queue_redraw()
		return
	for i: int in range(3):
		var star: TextureRect = star_bar.get_child(i) as TextureRect
		if star == null:
			continue
		var earned: bool = i < stars
		star.texture = GameIcons.get_texture("star" if earned else "star_empty")
		star.modulate = Color(1.15, 1.1, 0.95) if earned else Color(0.7, 0.72, 0.78)
	queue_redraw()

func _ensure_best_time_label() -> void:
	best_time_lbl = get_node_or_null("BestTimeLabel") as Label
	if best_time_lbl != null:
		return
	best_time_lbl = Label.new()
	best_time_lbl.name = "BestTimeLabel"
	add_child(best_time_lbl)

func _layout_node_labels() -> void:
	if level_label:
		level_label.anchor_left = 0.05
		level_label.anchor_right = 0.95
		level_label.anchor_top = 0.08
		level_label.anchor_bottom = 0.30
		level_label.offset_left = 0.0
		level_label.offset_right = 0.0
		level_label.offset_top = 0.0
		level_label.offset_bottom = 0.0
		level_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		level_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	if star_bar:
		star_bar.anchor_left = 0.08
		star_bar.anchor_right = 0.92
		star_bar.anchor_top = 0.46
		star_bar.anchor_bottom = 0.66
		star_bar.offset_left = 0.0
		star_bar.offset_right = 0.0
		star_bar.offset_top = 0.0
		star_bar.offset_bottom = 0.0
		star_bar.alignment = BoxContainer.ALIGNMENT_CENTER
	if best_time_lbl:
		best_time_lbl.anchor_left = 0.05
		best_time_lbl.anchor_right = 0.95
		best_time_lbl.anchor_top = 0.70
		best_time_lbl.anchor_bottom = 0.92
		best_time_lbl.offset_left = 0.0
		best_time_lbl.offset_right = 0.0
		best_time_lbl.offset_top = 0.0
		best_time_lbl.offset_bottom = 0.0
		best_time_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		best_time_lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		best_time_lbl.add_theme_font_size_override("font_size", 9)
		best_time_lbl.add_theme_color_override("font_color", Color(0.82, 0.88, 1.0, 0.95))
		best_time_lbl.clip_text = true

func _update_best_time_label() -> void:
	if best_time_lbl == null:
		return
	if not unlocked or best_time >= INF or level_num == 0:
		best_time_lbl.visible = false
		best_time_lbl.text = ""
	else:
		best_time_lbl.visible = true
		best_time_lbl.text = LevelManager.format_time_display(best_time)

func _hex_points(center: Vector2, radius: float) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for i: int in range(6):
		var angle := float(i) * TAU / 6.0 - PI / 2.0
		pts.append(center + Vector2(cos(angle), sin(angle)) * radius)
	return pts

func _draw() -> void:
	var center := size / 2.0
	var radius := 30.0
	var hex := _hex_points(center, radius)

	# Outer glow when selected
	if is_selected:
		for i: int in range(3):
			var glow := world_color
			glow.a = 0.12 - i * 0.03
			draw_polygon(_hex_points(center, radius + 14.0 + i * 6.0), PackedColorArray([glow]))
		var ring := world_color
		ring.a = 0.9
		draw_polyline(_hex_points(center, radius + 14.0) + PackedVector2Array([_hex_points(center, radius + 14.0)[0]]), ring, 3.5)

	# Body fill
	if unlocked:
		draw_polygon(hex, PackedColorArray([world_color.darkened(0.3)]))
		var inner := _hex_points(center, radius - 2.0)
		draw_polygon(inner, PackedColorArray([world_color]))
		# Inner highlight (top-left bias)
		var hl := world_color.lightened(0.25)
		hl.a = 0.4
		draw_polygon(_hex_points(center + Vector2(-6, -6), radius * 0.55), PackedColorArray([hl]))
	else:
		draw_polygon(hex, PackedColorArray([Color(0.18, 0.18, 0.24)]))
		# Subtle cross-hatch for locked
		var lock_col := Color(0.35, 0.35, 0.4, 0.25)
		draw_line(center + Vector2(-10, -10), center + Vector2(10, 10), lock_col, 2.0)
		draw_line(center + Vector2(10, -10), center + Vector2(-10, 10), lock_col, 2.0)

	# Border
	var border_col := Color.WHITE if unlocked else Color(0.4, 0.4, 0.45)
	draw_polyline(hex + PackedVector2Array([hex[0]]), border_col, 3.0)

	# Completed sparkle ring (3 stars)
	if unlocked and stars >= 3:
		var sparkle := Color(1, 0.9, 0.4, 0.5)
		draw_polyline(_hex_points(center, radius + 6.0) + PackedVector2Array([_hex_points(center, radius + 6.0)[0]]), sparkle, 2.0)

	# Inner subtle highlight ring
	draw_polyline(_hex_points(center, radius - 4.0) + PackedVector2Array([_hex_points(center, radius - 4.0)[0]]), Color(1, 1, 1, 0.15), 2.0)
