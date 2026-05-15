extends TextureButton

var world_num: int  = 1
var level_num: int  = 1
var stars: int      = 0
var unlocked: bool  = false
var is_selected: bool = false
var world_color: Color = Color.WHITE

@onready var star_bar:    HBoxContainer = $StarBar
@onready var lock_icon:   Control       = $LockIcon
@onready var level_label: Label         = $LevelLabel
@onready var anim:        AnimationPlayer = $AnimationPlayer
@onready var bg:          ColorRect     = $BG

func setup(w: int, l: int, star_count: int, is_unlocked: bool, tint: Color) -> void:
	world_num = w
	level_num = l
	stars     = star_count
	unlocked  = is_unlocked
	world_color = tint
	modulate  = Color.WHITE
	bg.visible = false
	_refresh_visuals()

func refresh(new_stars: int, is_unlocked: bool) -> void:
	var just_unlocked: bool = is_unlocked and not unlocked
	stars    = new_stars
	unlocked = is_unlocked
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
	lock_icon.visible = not unlocked

	for i: int in range(3):
		var star: Control = star_bar.get_child(i)
		if star:
			star.modulate = Color.YELLOW if i < stars else Color(0.25, 0.25, 0.25)
	queue_redraw()

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
