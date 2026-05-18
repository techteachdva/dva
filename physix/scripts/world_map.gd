extends Node2D

# ── Map layout ────────────────────────────────────────────────────────────────
# Level nodes are hand-positioned to look like an SMW overworld.
# Each world forms a cluster; clusters are connected by unlock paths.

# ── Hexagonal cluster layout ──────────────────────────────────────────────────
# 6 worlds × 6 levels + 6 bonus hubs arranged in a honeycomb grid.
# Each world is a hex cluster; worlds sit in a 3×2 grid with bridges.

# ── Giant hexagon layout ──────────────────────────────────────────────────────
# One large hexagon centered at (960, 540).
# World 1 at top, then clockwise: W2 top-right, W3 bottom-right, W4 bottom,
# W5 bottom-left, W6 top-left.  Bonus nodes sit in an inner hex ring.

const CENTER := Vector2(960, 540)
const WORLD_R := 320.0
const LEVEL_R := 90.0

const NODE_POSITIONS: Dictionary = {
	# ── World 1 (green) — top ──
	"1-1": Vector2(960, 130),   "1-2": Vector2(1038, 175),
	"1-3": Vector2(1038, 265),  "1-4": Vector2(960, 310),
	"1-5": Vector2(882, 265),   "1-6": Vector2(882, 175),

	# ── World 2 (cyan) — top-right ──
	"2-1": Vector2(1237, 290),  "2-2": Vector2(1315, 335),
	"2-3": Vector2(1315, 425),  "2-4": Vector2(1237, 470),
	"2-5": Vector2(1159, 425),  "2-6": Vector2(1159, 335),

	# ── World 3 (blue) — bottom-right ──
	"3-1": Vector2(1237, 610),  "3-2": Vector2(1315, 655),
	"3-3": Vector2(1315, 745),  "3-4": Vector2(1237, 790),
	"3-5": Vector2(1159, 745),  "3-6": Vector2(1159, 655),

	# ── World 4 (red) — bottom ──
	"4-1": Vector2(960, 770),   "4-2": Vector2(1038, 815),
	"4-3": Vector2(1038, 905),  "4-4": Vector2(960, 950),
	"4-5": Vector2(882, 905),    "4-6": Vector2(882, 815),

	# ── World 5 (purple) — bottom-left ──
	"5-1": Vector2(683, 610),   "5-2": Vector2(761, 655),
	"5-3": Vector2(761, 745),   "5-4": Vector2(683, 790),
	"5-5": Vector2(605, 745),   "5-6": Vector2(605, 655),

	# ── World 6 (magenta) — top-left ──
	"6-1": Vector2(683, 290),    "6-2": Vector2(761, 335),
	"6-3": Vector2(761, 425),   "6-4": Vector2(683, 470),
	"6-5": Vector2(605, 425),    "6-6": Vector2(605, 335),

	# ── Central Bonus Hub ──
	"BONUS": Vector2(960, 540),
	"B-1": Vector2(960, 465),
	"B-2": Vector2(1025, 503),
	"B-3": Vector2(1025, 577),
	"B-4": Vector2(960, 615),
	"B-5": Vector2(895, 577),
	"B-6": Vector2(895, 503),

	# ── Secret World S-1 — between bonus and World 4 ──
	"S-1": Vector2(960, 690),
	"S-2": Vector2(1050, 740),
}

const PATHS: Array = [
	# ── Within-world rings ──
	["1-1","1-2"], ["1-2","1-3"], ["1-3","1-4"], ["1-4","1-5"], ["1-5","1-6"], ["1-6","1-1"],
	["2-1","2-2"], ["2-2","2-3"], ["2-3","2-4"], ["2-4","2-5"], ["2-5","2-6"], ["2-6","2-1"],
	["3-1","3-2"], ["3-2","3-3"], ["3-3","3-4"], ["3-4","3-5"], ["3-5","3-6"], ["3-6","3-1"],
	["4-1","4-2"], ["4-2","4-3"], ["4-3","4-4"], ["4-4","4-5"], ["4-5","4-6"], ["4-6","4-1"],
	["5-1","5-2"], ["5-2","5-3"], ["5-3","5-4"], ["5-4","5-5"], ["5-5","5-6"], ["5-6","5-1"],
	["6-1","6-2"], ["6-2","6-3"], ["6-3","6-4"], ["6-4","6-5"], ["6-5","6-6"], ["6-6","6-1"],
	# ── Bonus ring around center ──
	["B-1","B-2"], ["B-2","B-3"], ["B-3","B-4"], ["B-4","B-5"], ["B-5","B-6"], ["B-6","B-1"],
	# ── Center to bonus spokes ──
	["BONUS","B-1"], ["BONUS","B-2"], ["BONUS","B-3"],
	["BONUS","B-4"], ["BONUS","B-5"], ["BONUS","B-6"],
	# ── World-to-bonus bridges ──
	["1-4","B-1"], ["2-5","B-2"], ["3-6","B-3"],
	["4-1","B-4"], ["5-2","B-5"], ["6-3","B-6"],
	# ── Between-world bridges ──
	["1-3","2-6"], ["2-4","3-1"], ["3-5","4-2"],
	["4-6","5-3"], ["5-1","6-4"], ["6-2","1-5"],
	# ── Secret bridge ──
	["S-1","B-4"], ["S-1","4-1"],
	["S-2","S-1"], ["S-2","B-5"],
]


const LevelNodeScene: PackedScene = preload("res://scenes/ui/world_map_node.tscn")
const NODE_RADIUS    := 32.0

# ── Camera ────────────────────────────────────────────────────────────────────
# The entire giant hex fits comfortably inside the default viewport at zoom 1.0,
# so the camera stays centered and only nudges slightly toward the selected node.
const MAP_CENTER     := Vector2(960, 540)
const CAM_NUDGE      := 0.18      # how much the camera shifts toward selection (0-1)
const CAM_PAN_TIME   := 0.35
const CAM_PAN_EASE   := Tween.EASE_OUT
const CAM_PAN_TRANS  := Tween.TRANS_QUAD
const MIN_MAP_ZOOM   := 0.45
const MAX_MAP_ZOOM   := 2.2
const MUSIC_TRACKS: Array[Dictionary] = [
	{"id": "menu",   "name": "Main Theme",    "locked": false},
	{"id": "world_1","name": "World 1 Theme", "locked": false},
	{"id": "world_2","name": "World 2 Theme", "locked": false},
	{"id": "world_3","name": "World 3 Theme", "locked": false},
	{"id": "world_4","name": "World 4 Theme", "locked": false},
	{"id": "world_5","name": "World 5 Theme", "locked": false},
	{"id": "world_6","name": "World 6 Theme", "locked": false},
	{"id": "chill",  "name": "Chill Mode",    "locked": true},
	{"id": "action", "name": "Action Mode",   "locked": true},
	{"id": "retro",  "name": "Retro Mode",    "locked": true},
]

@onready var node_root:   Node2D   = $NodeLayer
@onready var avatar:      Node2D   = $Avatar
@onready var move_hint_layer: Node2D = $MoveHintLayer
@onready var world_lbl:    Label    = $UI/Panel/WorldLabel
@onready var concept_lbl:  Label    = $UI/Panel/ConceptLabel
@onready var star_lbl:     Label    = $UI/Panel/StarCounter
@onready var level_lbl:    Label    = $UI/LevelPanel/LevelInfo
@onready var level_desc:   Label    = $UI/LevelPanel/LevelDesc
@onready var hint_lbl:     Label    = $UI/HintLabel
@onready var camera:       Camera2D = $Camera2D
@onready var shop_btn:     Button   = $UI/SidebarPanel/ShopBtn
@onready var shop_panel: Control = $UI/ShopPanel
@onready var ball_preview:  Panel    = $UI/SidebarPanel/BallPreview
@onready var lives_panel:   Panel    = $UI/SidebarPanel/LivesPanel
@onready var lives_lbl:      Label    = $UI/SidebarPanel/LivesPanel/LivesLabel
@onready var coins_panel:   Panel    = $UI/SidebarPanel/CoinsPanel
@onready var coins_lbl:      Label    = $UI/SidebarPanel/CoinsPanel/CoinsLabel
@onready var stars_panel:    Panel    = $UI/SidebarPanel/StarsPanel
@onready var stars_lbl:      Label    = $UI/SidebarPanel/StarsPanel/StarsLabel
@onready var music_btn:     Button   = $UI/SidebarPanel/MusicBtn
@onready var options_btn:    Button   = $UI/SidebarPanel/OptionsBtn
@onready var fact_lbl:     Label    = $UI/FactPanel/FactLabel
@onready var music_panel:  Panel    = $UI/MusicPanel
@onready var music_title:  Label    = $UI/MusicPanel/MusicTitle
@onready var close_music_btn: Button = $UI/MusicPanel/CloseMusicBtn
@onready var dive_transition: CanvasLayer = $LevelDiveTransition

var path_anim_offset: float = 0.0
var _path_redraw_accum: float = 0.0
const PATH_REDRAW_INTERVAL: float = 0.05

var selected_world: int = 1
var selected_level: int = 1
var node_map: Dictionary = {}    # "w-l" -> WorldMapNode
var avatar_bounce: float = 0.0
var _cam_tween: Tween = null
var _avatar_tween: Tween = null
var is_launching: bool = false

# Directional navigation adjacency built from PATHS
var _adjacency: Dictionary = {}  # key -> Array of neighboring keys

# Cheat buffer for world-map typing
var _cheat_buffer: String = ""

# Map pan/zoom (Camera2D does not affect Node2D under CanvasLayer — use MapRoot transform)
var map_root: Node2D
var _map_draw_layer: Node2D
var _map_pan: Vector2 = Vector2.ZERO
var _map_zoom: float = 1.0
var _panning: bool = false
var _pan_mouse_start: Vector2 = Vector2.ZERO
var _pan_offset_start: Vector2 = Vector2.ZERO

func _ready() -> void:
	set_process_input(true)
	set_process_unhandled_input(true)
	_setup_map_view_root()
	camera.enabled = false
	avatar.draw.connect(_draw_avatar)
	move_hint_layer.draw.connect(_draw_move_hints)
	_spawn_lava_hexes()
	_build_map()
	_build_adjacency()
	_update_ui()
	_move_selector(selected_world, selected_level, true)
	LevelManager.level_unlocked.connect(func(_w: int, _l: int): _refresh_all_nodes())
	LevelManager.world_unlocked.connect(_on_world_unlocked)
	LevelManager.music_unlocked.connect(_on_music_unlocked)
	_update_available_moves()
	LevelManager.apply_session_to_game_manager()
	if LevelManager.is_session_game_over() or GameManager.lives <= 0:
		call_deferred("_prompt_out_of_lives")
	if GameManager.has_meta("open_shop_on_map"):
		GameManager.remove_meta("open_shop_on_map")
		call_deferred("_on_shop_pressed")
	shop_btn.text = "Shop"
	shop_btn.pressed.connect(_on_shop_pressed)
	music_btn.pressed.connect(_on_music_pressed)
	options_btn.pressed.connect(_on_options_pressed)
	close_music_btn.pressed.connect(_on_music_pressed)
	_populate_sidebar()
	_style_hud_panels()
	_update_controls_hint()
	UiIconLayout.ensure_texture_child($UI/Panel, "StarCounterIcon", "star", Vector2(20, 20))
	_show_random_fact()
	_setup_sidebar_button_icons()
	if get_node_or_null("/root/AudioManager") != null:
		AudioManager.playback_mode = LevelManager.get_music_mode()
		AudioManager.loop_enabled = LevelManager.is_music_loop_enabled()
		AudioManager.single_track = LevelManager.get_equipped_music()
		AudioManager.play_music("menu")

func _setup_map_view_root() -> void:
	map_root = Node2D.new()
	map_root.name = "MapRoot"
	add_child(map_root)
	move_child(map_root, 0)
	for node_name: String in ["BGLayer", "ParallaxBackground", "PathLayer", "NodeLayer", "MoveHintLayer", "Avatar"]:
		var node: Node = get_node(node_name)
		remove_child(node)
		map_root.add_child(node)
	_map_draw_layer = Node2D.new()
	_map_draw_layer.name = "MapDrawLayer"
	_map_draw_layer.z_index = -5
	map_root.add_child(_map_draw_layer)
	map_root.move_child(_map_draw_layer, 0)
	_map_draw_layer.draw.connect(_draw_map_content)
	_apply_map_view(true)


func _apply_map_view(instant: bool = false) -> void:
	if map_root == null:
		return
	var vp_half: Vector2 = get_viewport_rect().size * 0.5
	var target_pos: Vector2 = vp_half - MAP_CENTER * _map_zoom + _map_pan
	map_root.scale = Vector2(_map_zoom, _map_zoom)
	if instant:
		map_root.position = target_pos
	else:
		var tw := create_tween().set_ease(CAM_PAN_EASE).set_trans(CAM_PAN_TRANS)
		tw.tween_property(map_root, "position", target_pos, CAM_PAN_TIME)
	var para: ParallaxBackground = map_root.get_node_or_null("ParallaxBackground") as ParallaxBackground
	if para != null:
		para.scroll_base_offset = -_map_pan * 0.25


func _apply_zoom(factor: float, focal: Vector2 = Vector2.ZERO) -> void:
	if map_root == null:
		return
	var focus: Vector2 = focal
	if focus == Vector2.ZERO:
		focus = get_viewport_rect().size * 0.5
	var map_coord: Vector2 = (focus - map_root.position) / _map_zoom
	_map_zoom = clampf(_map_zoom * factor, MIN_MAP_ZOOM, MAX_MAP_ZOOM)
	var vp_half: Vector2 = get_viewport_rect().size * 0.5
	map_root.position = focus - map_coord * _map_zoom
	_map_pan = map_root.position - vp_half + MAP_CENTER * _map_zoom
	map_root.scale = Vector2(_map_zoom, _map_zoom)
	var para: ParallaxBackground = map_root.get_node_or_null("ParallaxBackground") as ParallaxBackground
	if para != null:
		para.scroll_base_offset = -_map_pan * 0.25


func _style_hud_panels() -> void:
	var panel_style := _hud_panel_style(Color(0.05, 0.08, 0.12, 0.94), Color(0.25, 0.55, 0.78, 0.9))
	for path: String in ["UI/Panel", "UI/LevelPanel", "UI/SidebarPanel", "UI/FactPanel"]:
		var panel: Panel = get_node_or_null(path) as Panel
		if panel:
			panel.add_theme_stylebox_override("panel", panel_style)


func _hud_panel_style(bg: Color, border: Color) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.border_color = border
	s.border_width_left = 2
	s.border_width_top = 2
	s.border_width_right = 2
	s.border_width_bottom = 2
	s.corner_radius_top_left = 10
	s.corner_radius_top_right = 10
	s.corner_radius_bottom_left = 10
	s.corner_radius_bottom_right = 10
	s.shadow_color = Color(0, 0, 0, 0.45)
	s.shadow_size = 6
	return s


func _update_controls_hint() -> void:
	var controls: Label = get_node_or_null("UI/Controls") as Label
	if controls:
		controls.text = "Right/Middle drag: pan map  |  Scroll: zoom  |  Arrows + Enter: play  |  Esc: options  |  S: shop"


func _spawn_lava_hexes() -> void:
	var bg: Node2D = map_root.get_node("BGLayer") if map_root else $BGLayer
	var shader: Shader = preload("res://assets/shaders/lava_lamp_2d.gdshader")
	for world: int in LevelManager.WORLDS:
		var world_data: Dictionary = LevelManager.WORLDS[world]
		var tint: Color = world_data.get("color", Color.WHITE)
		var center := _world_center(world)
		var radius := _world_radius(world)
		var hex_pts := _hex_outline(center, radius, 6)

		var poly := Polygon2D.new()
		poly.name = "LavaHex_%d" % world
		poly.polygon = hex_pts
		# Inherits BGLayer z_index; drawn after RainbowBG so it sits on top

		var mat := ShaderMaterial.new()
		mat.shader = shader
		mat.set_shader_parameter("base_color", tint)
		mat.set_shader_parameter("speed", 0.18)
		mat.set_shader_parameter("rainbow_mode", false)
		poly.material = mat

		bg.add_child(poly)

	# Bonus hub hex
	var bonus_pts := _hex_outline(CENTER, 52, 6)
	var bonus_poly := Polygon2D.new()
	bonus_poly.name = "LavaHex_Bonus"
	bonus_poly.polygon = bonus_pts
	var bonus_mat := ShaderMaterial.new()
	bonus_mat.shader = shader
	bonus_mat.set_shader_parameter("base_color", Color(1.0, 0.88, 0.15))
	bonus_mat.set_shader_parameter("speed", 0.18)
	bonus_mat.set_shader_parameter("rainbow_mode", false)
	bonus_poly.material = bonus_mat
	bg.add_child(bonus_poly)

func _require_lives_to_launch() -> bool:
	if GameManager.lives > 0 and not LevelManager.is_session_game_over():
		LevelManager.clear_session_game_over()
		LevelManager.save_progress()
		return true
	is_launching = false
	set_process_input(true)
	hint_lbl.text = "Out of lives! Open Shop to buy a life, then Continue from the main menu."
	hint_lbl.visible = true
	var timer := get_tree().create_timer(3.0)
	timer.timeout.connect(func() -> void:
		if is_inside_tree():
			hint_lbl.visible = false
	, CONNECT_ONE_SHOT)
	return false

func _prompt_out_of_lives() -> void:
	hint_lbl.text = "Out of lives — buy one in the Shop (10 coins), then use Continue on the main menu."
	hint_lbl.visible = true

func _on_shop_pressed() -> void:
	shop_panel.open(0)

func _populate_sidebar() -> void:
	# Ball preview — match equipped skin color
	var skin := LevelManager.get_equipped_skin()
	var ball_col := Color(1.0, 0.35, 0.0)
	match skin:
		"skin_gold":    ball_col = Color(1.0, 0.78, 0.05)
		"skin_neon":    ball_col = Color(0.05, 0.95, 1.0)
		"skin_crystal": ball_col = Color(0.5, 0.75, 1.0)
	var ball_style := StyleBoxFlat.new()
	ball_style.bg_color = ball_col
	ball_style.corner_radius_top_left = 40
	ball_style.corner_radius_top_right = 40
	ball_style.corner_radius_bottom_left = 40
	ball_style.corner_radius_bottom_right = 40
	ball_preview.add_theme_stylebox_override("panel", ball_style)

	var sidebar_cyan := _sidebar_panel_style()
	lives_panel.add_theme_stylebox_override("panel", sidebar_cyan)
	coins_panel.add_theme_stylebox_override("panel", sidebar_cyan.duplicate())
	stars_panel.add_theme_stylebox_override("panel", sidebar_cyan.duplicate())

	var stat_font := Color(0.95, 0.98, 1.0)
	lives_lbl.text = "x%d" % GameManager.lives
	lives_lbl.add_theme_font_size_override("font_size", 20)
	lives_lbl.add_theme_color_override("font_color", stat_font)
	UiIconLayout.stat_label_with_icon(lives_panel, lives_lbl, "heart", lives_lbl.text)

	coins_lbl.text = "x%d" % GameManager.coins
	coins_lbl.add_theme_font_size_override("font_size", 20)
	coins_lbl.add_theme_color_override("font_color", stat_font)
	UiIconLayout.stat_label_with_icon(coins_panel, coins_lbl, "coin", coins_lbl.text)

	stars_lbl.text = "%d" % GameManager.total_stars
	stars_lbl.add_theme_font_size_override("font_size", 20)
	stars_lbl.add_theme_color_override("font_color", stat_font)
	UiIconLayout.stat_label_with_icon(stars_panel, stars_lbl, "star", stars_lbl.text)

func _setup_sidebar_button_icons() -> void:
	var music_tex := GameIcons.get_menu_texture("MusicBtn")
	if music_tex:
		music_btn.icon = music_tex
		music_btn.expand_icon = true
		music_btn.icon_alignment = HORIZONTAL_ALIGNMENT_LEFT
		music_btn.text = " Music"

	var shop_tex := GameIcons.get_menu_texture("ShopBtn")
	if shop_tex:
		shop_btn.icon = shop_tex
		shop_btn.expand_icon = true
		shop_btn.icon_alignment = HORIZONTAL_ALIGNMENT_LEFT
		shop_btn.text = " Shop"

	var options_tex := GameIcons.get_menu_texture("OptionsBtn")
	if options_tex:
		options_btn.icon = options_tex
		options_btn.expand_icon = true
		options_btn.icon_alignment = HORIZONTAL_ALIGNMENT_LEFT
		options_btn.text = " Options"

func _sidebar_panel_style() -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = Color(0.06, 0.58, 0.78, 0.94)
	s.border_color = Color(0.35, 0.88, 1.0, 0.85)
	s.border_width_top = 2
	s.border_width_bottom = 2
	s.border_width_left = 2
	s.border_width_right = 2
	s.corner_radius_top_left = 32
	s.corner_radius_top_right = 32
	s.corner_radius_bottom_left = 32
	s.corner_radius_bottom_right = 32
	return s

func _show_random_fact() -> void:
	fact_lbl.text = GameplayFacts.format_did_you_know(LevelManager.pop_next_fact())

func _on_music_unlocked(_track_id: String) -> void:
	if music_panel.visible:
		_build_music_menu()

func _on_music_pressed() -> void:
	music_panel.visible = not music_panel.visible
	if music_panel.visible:
		music_panel.add_theme_stylebox_override("panel", _hud_panel_style(Color(0.04, 0.06, 0.1, 0.97), Color(0.35, 0.62, 0.88, 0.95)))
		_build_music_menu()

func _build_music_menu() -> void:
	# Clear old track buttons except title and close
	for child: Node in music_panel.get_children():
		if child is Button and child != close_music_btn:
			child.queue_free()
	var y_off := 50

	# Default mode button
	var default_btn := Button.new()
	default_btn.text = "Default (World Tracks)"
	default_btn.anchor_left = 0.1
	default_btn.anchor_right = 0.9
	default_btn.offset_top = y_off
	default_btn.offset_bottom = y_off + 34
	if LevelManager.get_music_mode() == "default":
		default_btn.text += "  >"
	default_btn.pressed.connect(_on_music_mode_selected.bind("default"))
	music_panel.add_child(default_btn)
	y_off += 40

	# Loop toggle button
	var loop_btn := Button.new()
	var loop_on := LevelManager.is_music_loop_enabled()
	loop_btn.text = "Loop: %s" % ("ON" if loop_on else "OFF")
	loop_btn.anchor_left = 0.1
	loop_btn.anchor_right = 0.9
	loop_btn.offset_top = y_off
	loop_btn.offset_bottom = y_off + 34
	loop_btn.pressed.connect(_toggle_loop)
	music_panel.add_child(loop_btn)
	y_off += 40

	# Random Play All button
	var random_btn := Button.new()
	random_btn.text = "Random Play All"
	random_btn.anchor_left = 0.1
	random_btn.anchor_right = 0.9
	random_btn.offset_top = y_off
	random_btn.offset_bottom = y_off + 34
	if LevelManager.get_music_mode() == "random":
		random_btn.text += "  >"
	random_btn.pressed.connect(_on_music_mode_selected.bind("random"))
	music_panel.add_child(random_btn)
	y_off += 36

	# Individual track buttons
	for track: Dictionary in MUSIC_TRACKS:
		var btn := Button.new()
		btn.text = track["name"]
		btn.anchor_left = 0.1
		btn.anchor_right = 0.9
		btn.offset_top = y_off
		btn.offset_bottom = y_off + 34
		var locked: bool = bool(track["locked"])
		var is_unlocked: bool = not locked or LevelManager.is_music_unlocked(track["id"])
		btn.disabled = not is_unlocked
		if not is_unlocked:
			btn.text += "  [LOCKED]"
			btn.modulate = Color(0.5, 0.5, 0.5, 1)
		var mode_is_track := LevelManager.get_music_mode() == "track"
		var equipped := LevelManager.get_equipped_music()
		if mode_is_track and equipped == track["id"]:
			btn.text += "  >"
		btn.pressed.connect(_on_music_track_selected.bind(track["id"]))
		music_panel.add_child(btn)
		y_off += 36

func _on_music_mode_selected(mode: String) -> void:
	LevelManager.set_music_mode(mode)
	if get_node_or_null("/root/AudioManager") != null:
		AudioManager.set_playback_mode(mode)
		if mode == "random":
			AudioManager.play_music("menu")
		elif mode == "default":
			AudioManager.play_music("menu")
		else:
			var equipped := LevelManager.get_equipped_music()
			AudioManager.play_music(equipped if not equipped.is_empty() else "menu")
	_build_music_menu()

func _toggle_loop() -> void:
	var new_val := not LevelManager.is_music_loop_enabled()
	LevelManager.set_music_loop_enabled(new_val)
	if get_node_or_null("/root/AudioManager") != null:
		AudioManager.set_loop_enabled(new_val)
	_build_music_menu()

func _on_music_track_selected(track_id: String) -> void:
	LevelManager.equip_music(track_id)
	LevelManager.set_music_mode("track")
	if get_node_or_null("/root/AudioManager") != null:
		AudioManager.set_playback_mode("track")
		AudioManager.set_single_track(track_id)
		AudioManager.play_music(track_id)
	_build_music_menu()

func _ensure_options_panel() -> void:
	var ui: CanvasLayer = $UI
	var opts: Node = ui.get_node_or_null("OptionsPanel")
	if opts == null:
		opts = preload("res://scripts/ui/options_panel.gd").new()
		opts.name = "OptionsPanel"
		opts.closed.connect(_on_options_closed)
		if opts.has_signal("main_menu_requested"):
			opts.main_menu_requested.connect(_on_back_to_menu)
		ui.add_child(opts)

func _on_options_pressed() -> void:
	if get_node_or_null("/root/AudioManager") != null:
		AudioManager.play_sfx("menu_select")
	_ensure_options_panel()
	var opts := $UI.get_node_or_null("OptionsPanel")
	if opts != null:
		if opts is CanvasItem:
			(opts as CanvasItem).z_index = 50
		if opts.has_method("open"):
			opts.open()

func _map_modals_open() -> bool:
	if shop_panel.visible or music_panel.visible:
		return true
	var opts := $UI.get_node_or_null("OptionsPanel")
	return opts != null and opts.visible

func _on_options_closed() -> void:
	pass

func _on_back_to_menu() -> void:
	if get_node_or_null("/root/AudioManager") != null:
		AudioManager.play_sfx("menu_select")
	Main.instance.load_main_menu()

func _on_quit_game() -> void:
	if get_node_or_null("/root/AudioManager") != null:
		AudioManager.play_sfx("menu_select")
	get_tree().quit()

# ── Map construction ──────────────────────────────────────────────────────────

func _build_map() -> void:
	_redraw_map_layer()
	for world: int in LevelManager.WORLDS:
		var world_data: Dictionary = LevelManager.WORLDS[world]
		for lvl: int in range(1, world_data.levels + 1):
			var key := "%d-%d" % [world, lvl]
			if not NODE_POSITIONS.has(key):
				continue
			var node: Node = LevelNodeScene.instantiate()
			node_root.add_child(node)
			node.position = NODE_POSITIONS[key]
			node.setup(world, lvl,
				LevelManager.get_level_stars(world, lvl),
				LevelManager.is_level_unlocked(world, lvl),
				world_data.color,
				LevelManager.get_best_time(world, lvl))
			node.pressed.connect(_on_node_pressed.bind(world, lvl))
			node_map[key] = node
	# Bonus nodes B-1 through B-6
	for world: int in LevelManager.WORLDS:
		var b_key := "B-%d" % world
		if not NODE_POSITIONS.has(b_key):
			continue
		var b_node: Node = LevelNodeScene.instantiate()
		node_root.add_child(b_node)
		b_node.position = NODE_POSITIONS[b_key]
		var b_unlocked := _is_bonus_unlocked(world)
		var b_stars := LevelManager.get_level_stars(world, 0)
		b_node.setup(world, 0, b_stars, b_unlocked, Color(1.0, 0.85, 0.1))
		b_node.pressed.connect(_on_bonus_pressed.bind(world))
		node_map[b_key] = b_node

	# Center Bonus Hub label
	var hub_lbl := Label.new()
	hub_lbl.text = "BONUS\nLEVELS"
	hub_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hub_lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	hub_lbl.add_theme_font_size_override("font_size", 12)
	hub_lbl.modulate = Color(0.35, 0.30, 0.05, 0.95)
	hub_lbl.position = CENTER - Vector2(28, 16)
	node_root.add_child(hub_lbl)

	# Secret nodes S-1 and S-2
	if LevelManager.is_secret_unlocked():
		for s_key: String in ["S-1", "S-2"]:
			if not NODE_POSITIONS.has(s_key):
				continue
			var s_lvl: int = int(s_key.split("-")[1])
			var s_node: Node = LevelNodeScene.instantiate()
			node_root.add_child(s_node)
			s_node.position = NODE_POSITIONS[s_key]
			s_node.setup(0, s_lvl, 0, true, Color(0.95, 0.15, 0.45))
			s_node.pressed.connect(_on_secret_pressed.bind(s_lvl))
			node_map[s_key] = s_node

func _on_secret_pressed(level: int = 1) -> void:
	if is_launching:
		return
	if selected_world == 0 and selected_level == level:
		_launch_secret()
		return
	selected_world = 0
	selected_level = level
	_move_selector_to_key("S-%d" % level)
	_update_ui()
	_update_available_moves()

func _launch_secret() -> void:
	if is_launching:
		return
	is_launching = true
	set_process_input(false)
	if not _require_lives_to_launch():
		return
	GameManager.current_world = 0
	GameManager.current_level = selected_level

	var key := "S-%d" % selected_level
	var selected_node: Node = node_map.get(key)
	if selected_node:
		var node_tween := create_tween()
		node_tween.tween_property(selected_node, "scale", Vector2(1.25, 1.25), 0.3).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_QUAD)
		_tween_map_focus_on_key(key, 0.55)
		await get_tree().create_timer(0.15).timeout
		var hex_screen_pos: Vector2 = _hex_center_screen(selected_node, key)
		var hex_color: Color = selected_node.world_color if selected_node.get("world_color") != null else Color(0.8, 0.2, 0.9)
		dive_transition.start(hex_screen_pos, hex_color, func():
			Main.instance.load_secret_level(0, selected_level)
		)
	else:
		var tween := create_tween().set_parallel()
		_tween_map_zoom_out(tween, 0.5)
		tween.tween_property(self, "modulate:a", 0.0, 0.6).set_ease(Tween.EASE_IN)
		await tween.finished
		Main.instance.load_secret_level(0, selected_level)

func _build_adjacency() -> void:
	_adjacency.clear()
	for path: Array in PATHS:
		var a: String = path[0]
		var b: String = path[1]
		# Only add adjacency for nodes that exist in the map
		if a == "BONUS" or b == "BONUS":
			continue
		if not _adjacency.has(a):
			_adjacency[a] = []
		if not _adjacency.has(b):
			_adjacency[b] = []
		if not b in _adjacency[a]:
			_adjacency[a].append(b)
		if not a in _adjacency[b]:
			_adjacency[b].append(a)

func _is_bonus_unlocked(world: int) -> bool:
	var world_data: Dictionary = LevelManager.WORLDS.get(world, {})
	var total_levels: int = world_data.get("levels", 0)
	for lvl: int in range(1, total_levels + 1):
		if not LevelManager.is_level_unlocked(world, lvl):
			return false
	return true

func _draw_map_content() -> void:
	_draw_map_backdrop()
	_world_regions_draw()
	_path_lines_draw()

func _draw_map_backdrop() -> void:
	if _map_draw_layer == null:
		return
	# Layered vignette disc + subtle inner glow
	_map_draw_layer.draw_circle(CENTER, 760, Color(0.03, 0.04, 0.07, 0.55))
	_map_draw_layer.draw_circle(CENTER, 700, Color(0.05, 0.07, 0.12, 0.88))
	_map_draw_layer.draw_circle(CENTER, 640, Color(0.07, 0.09, 0.15, 0.35))
	_map_draw_layer.draw_circle(CENTER, 700, Color(0.18, 0.32, 0.48, 0.12), false, 3.0)
	# Soft map grid
	var grid_col := Color(0.35, 0.5, 0.65, 0.07)
	for gx: int in range(-4, 5):
		var x := CENTER.x + float(gx) * 120.0
		_map_draw_layer.draw_line(Vector2(x, CENTER.y - 720), Vector2(x, CENTER.y + 720), grid_col, 1.0)
	for gy: int in range(-4, 5):
		var y := CENTER.y + float(gy) * 120.0
		_map_draw_layer.draw_line(Vector2(CENTER.x - 720, y), Vector2(CENTER.x + 720, y), grid_col, 1.0)

func _world_regions_draw() -> void:
	if _map_draw_layer == null:
		return
	# Lava-lamp hex fills are now Polygon2D nodes created in _ready.
	# Only draw borders here (they change brightness with selection).
	for world: int in LevelManager.WORLDS:
		var world_data: Dictionary = LevelManager.WORLDS[world]
		var base_color: Color = world_data.get("color", Color.WHITE)
		var center := _world_center(world)
		var radius := _world_radius(world)
		var is_active: bool = (world == selected_world)

		var hex_pts := _hex_outline(center, radius, 6)
		var border_col := base_color.lightened(0.35)
		border_col.a = 0.65 if is_active else 0.24
		var line_w := 2.5 if is_active else 1.5
		_map_draw_layer.draw_polyline(hex_pts + PackedVector2Array([hex_pts[0]]), border_col, line_w)

	# Center Bonus Hub border
	var bonus_pts := _hex_outline(CENTER, 52, 6)
	var hub_border := Color(1.0, 0.92, 0.35, 0.55)
	_map_draw_layer.draw_polyline(bonus_pts + PackedVector2Array([bonus_pts[0]]), hub_border, 2.0)

func _hex_outline(center: Vector2, radius: float, sides: int) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for i: int in range(sides):
		var angle := float(i) * TAU / float(sides) - PI / 2.0
		pts.append(center + Vector2(cos(angle), sin(angle)) * radius)
	return pts

func _get_adjacent_worlds(world: int) -> Array[int]:
	var adj: Array[int] = []
	for path: Array in PATHS:
		var w1 := int(path[0].split("-")[0])
		var w2 := int(path[1].split("-")[0])
		if w1 == world and w2 != world and not w2 in adj:
			adj.append(w2)
		elif w2 == world and w1 != world and not w1 in adj:
			adj.append(w1)
	return adj

# ── Bezier path helpers ─────────────────────────────────────────────────────────

func _bezier_point(a: Vector2, ctrl: Vector2, b: Vector2, t: float) -> Vector2:
	var u := 1.0 - t
	return u * u * a + 2.0 * u * t * ctrl + t * t * b

func _bezier_samples(a: Vector2, b: Vector2, curvature: float, count: int = 24) -> Array[Vector2]:
	var mid := (a + b) * 0.5
	var perp := Vector2(-(b - a).y, (b - a).x).normalized()
	var ctrl := mid + perp * curvature
	var pts: Array[Vector2] = []
	for i: int in range(count + 1):
		var t := float(i) / float(count)
		pts.append(_bezier_point(a, ctrl, b, t))
	return pts

func _bezier_length(pts: Array[Vector2]) -> float:
	var len_ := 0.0
	for i: int in range(pts.size() - 1):
		len_ += pts[i].distance_to(pts[i + 1])
	return len_

func _path_lines_draw() -> void:
	if _map_draw_layer == null:
		return
	for path: Array in PATHS:
		var a_key: String = path[0]
		var b_key: String = path[1]
		if not NODE_POSITIONS.has(a_key) or not NODE_POSITIONS.has(b_key):
			continue

		var a: Vector2 = NODE_POSITIONS[a_key] + Vector2(40, 40)
		var b: Vector2 = NODE_POSITIONS[b_key] + Vector2(40, 40)
		var a_parts: PackedStringArray = a_key.split("-")
		var b_parts: PackedStringArray = b_key.split("-")
		var w1: int = int(a_parts[0]) if a_parts[0] != "B" else int(a_parts[1])
		var w2: int = int(b_parts[0]) if b_parts[0] != "B" else int(b_parts[1])

		# All paths are visible now; only alpha varies by proximity to selection
		var is_in_world: bool = (w1 == selected_world and w2 == selected_world)
		var touches_world: bool = (w1 == selected_world or w2 == selected_world)
		var path_alpha: float = 1.0 if is_in_world else (0.55 if touches_world else 0.22)
		var is_unlocked: bool = _is_path_unlocked(a_key)

		# Curvature: larger for between-world bridges, smaller for within-world
		var is_bridge: bool = w1 != w2
		var curve: float = 50.0 if is_bridge else 20.0
		var pts := _bezier_samples(a, b, curve)
		var dist := _bezier_length(pts)

		var perp := Vector2(-(b - a).y, (b - a).x).normalized()
		var ctrl_pt := (a + b) * 0.5 + perp * curve

		if is_unlocked:
			# Glow underneath
			var glow_col := Color(0.9, 0.85, 0.4, 0.12 * path_alpha)
			_map_draw_layer.draw_polyline(pts, glow_col, 6.0)
			_map_draw_layer.draw_polyline(pts, glow_col, 4.0)
			# Bright core
			var core := Color(0.95, 0.9, 0.5, 0.9 * path_alpha)
			_map_draw_layer.draw_polyline(pts, core, 3.0)
			# Animated dashes
			var dash_len := 12.0
			var gap_len := 8.0
			var total := dash_len + gap_len
			var offset := fmod(path_anim_offset, total)
			var steps := int(dist / total) + 2
			for i: int in range(steps):
				var t0 := (float(i) * total + offset) / dist
				var t1 := (float(i) * total + offset + dash_len) / dist
				if t1 < 0.0 or t0 > 1.0:
					continue
				t0 = clampf(t0, 0.0, 1.0)
				t1 = clampf(t1, 0.0, 1.0)
				var seg_a := _bezier_point(a, ctrl_pt, b, t0)
				var seg_b := _bezier_point(a, ctrl_pt, b, t1)
				var dash_col := Color(1, 1, 1, 0.55 * path_alpha)
				_map_draw_layer.draw_line(seg_a, seg_b, dash_col, 2.0)
		else:
			# Locked path — subtle dashed line following the curve
			var steps := int(dist / 14.0)
			for i: int in range(steps):
				var t0 := float(i) / float(steps)
				var t1 := float(i + 0.5) / float(steps)
				var seg_a := _bezier_point(a, ctrl_pt, b, t0)
				var seg_b := _bezier_point(a, ctrl_pt, b, t1)
				var locked_col := Color(0.3, 0.3, 0.35, 0.5 * path_alpha)
				_map_draw_layer.draw_line(seg_a, seg_b, locked_col, 2.0)

func _redraw_map_layer() -> void:
	if _map_draw_layer != null:
		_map_draw_layer.queue_redraw()


func _update_map_pan_drag() -> void:
	if _map_modals_open():
		_panning = false
		return
	var want_pan := Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT) or Input.is_mouse_button_pressed(MOUSE_BUTTON_MIDDLE)
	var mouse := get_viewport().get_mouse_position()
	if want_pan:
		if not _panning:
			_panning = true
			_pan_mouse_start = mouse
			_pan_offset_start = _map_pan
		else:
			_map_pan = _pan_offset_start + (mouse - _pan_mouse_start)
			_apply_map_view(true)
	else:
		_panning = false


func _process(delta: float) -> void:
	avatar_bounce += delta * 6.0
	path_anim_offset += delta * 40.0
	avatar.queue_redraw()
	_path_redraw_accum += delta
	if _path_redraw_accum >= PATH_REDRAW_INTERVAL:
		_path_redraw_accum = 0.0
		_redraw_map_layer()

	_update_map_pan_drag()

func _is_path_unlocked(key: String) -> bool:
	if key == "BONUS":
		return true
	var parts := key.split("-")
	if parts[0] == "B":
		return _is_bonus_unlocked(int(parts[1]))
	var w := int(parts[0])
	var l_str: String = parts[1]
	if l_str == "B":
		return _is_bonus_unlocked(w)
	var l := int(l_str)
	return LevelManager.is_level_unlocked(w, l)

func _world_center(world: int) -> Vector2:
	var sum := Vector2.ZERO
	var count := 0
	for lvl: int in range(1, LevelManager.WORLDS[world].levels + 1):
		var key := "%d-%d" % [world, lvl]
		if NODE_POSITIONS.has(key):
			# NODE_POSITIONS stores Control top-left corners;
			# add half size to get the visual center of each 80×80 node
			sum += NODE_POSITIONS[key] + Vector2(40, 40)
			count += 1
	return sum / maxi(count, 1)

func _world_radius(world: int) -> float:
	var center := _world_center(world)
	var max_r := 0.0
	for lvl: int in range(1, LevelManager.WORLDS[world].levels + 1):
		var key := "%d-%d" % [world, lvl]
		if NODE_POSITIONS.has(key):
			var node_center: Vector2 = NODE_POSITIONS[key] + Vector2(40, 40)
			max_r = maxf(max_r, center.distance_to(node_center))
	return max_r + 48.0  # node hex radius (30) + padding

# ── Input ─────────────────────────────────────────────────────────────────────

func _unhandled_input(event: InputEvent) -> void:
	if _map_modals_open():
		return
	if event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_WHEEL_UP and mb.pressed:
			_apply_zoom(1.1, mb.position)
			get_viewport().set_input_as_handled()
		elif mb.button_index == MOUSE_BUTTON_WHEEL_DOWN and mb.pressed:
			_apply_zoom(1.0 / 1.1, mb.position)
			get_viewport().set_input_as_handled()

func _input(event: InputEvent) -> void:
	if not _map_modals_open():
		if event is InputEventMouseButton:
			var mb := event as InputEventMouseButton
			if mb.button_index == MOUSE_BUTTON_WHEEL_UP and mb.pressed:
				_apply_zoom(1.1, mb.position)
				get_viewport().set_input_as_handled()
				return
			if mb.button_index == MOUSE_BUTTON_WHEEL_DOWN and mb.pressed:
				_apply_zoom(1.0 / 1.1, mb.position)
				get_viewport().set_input_as_handled()
				return

	var opts_panel := $UI.get_node_or_null("OptionsPanel")
	if opts_panel != null and opts_panel.visible:
		if event.is_action_pressed("ui_cancel"):
			opts_panel._on_close()
			get_viewport().set_input_as_handled()
		return
	if shop_panel.visible or music_panel.visible:
		if event.is_action_pressed("ui_cancel") or (event is InputEventKey and event.pressed and event.keycode == KEY_S):
			shop_panel.visible = false
			music_panel.visible = false
			get_viewport().set_input_as_handled()
		return
	if event.is_action_pressed("ui_accept"):
		_launch()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_right") or event.is_action_pressed("steer_right"):
		_navigate(0, 1)
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_left") or event.is_action_pressed("steer_left"):
		_navigate(0, -1)
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_down") or event.is_action_pressed("brake"):
		_navigate(1, 0)
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_up") or (event is InputEventKey and event.pressed and event.keycode == KEY_W):
		_navigate(-1, 0)
		get_viewport().set_input_as_handled()
	elif event is InputEventKey and event.pressed and event.keycode == KEY_S:
		_on_shop_pressed()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_cancel"):
		shop_panel.visible = false
		music_panel.visible = false
		_on_options_pressed()
		get_viewport().set_input_as_handled()
	elif event is InputEventKey and event.pressed and not event.echo:
		var ch := event.as_text().to_lower()
		if ch.length() == 1 and ch[0] >= 'a' and ch[0] <= 'z':
			_cheat_buffer += ch
			if _cheat_buffer.length() > 10:
				_cheat_buffer = _cheat_buffer.substr(_cheat_buffer.length() - 10)
			if _cheat_buffer.contains("jilly"):
				_unlock_secret_world()
				_cheat_buffer = ""

func _unlock_secret_world() -> void:
	LevelManager.unlock_secret()
	var spawned := false
	for s_key: String in ["S-1", "S-2"]:
		if not node_map.has(s_key) and NODE_POSITIONS.has(s_key):
			var s_lvl: int = int(s_key.split("-")[1])
			var s_node: Node = LevelNodeScene.instantiate()
			node_root.add_child(s_node)
			s_node.position = NODE_POSITIONS[s_key]
			s_node.setup(0, s_lvl, 0, true, Color(0.95, 0.15, 0.45))
			s_node.pressed.connect(_on_secret_pressed.bind(s_lvl))
			node_map[s_key] = s_node
			spawned = true
	if spawned:
		_build_adjacency()
	selected_world = 0
	selected_level = 1
	_move_selector(0, 1)
	_update_ui()
	_update_available_moves()
	_show_cheat_feedback("Secret world revealed!")

func _show_cheat_feedback(text: String) -> void:
	var cheat_lbl := Label.new()
	cheat_lbl.text = text
	cheat_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	cheat_lbl.add_theme_font_size_override("font_size", 28)
	cheat_lbl.position = Vector2(640, 680)
	add_child(cheat_lbl)
	var tw := create_tween()
	tw.tween_property(cheat_lbl, "modulate:a", 0.0, 2.0)
	tw.tween_callback(func(): cheat_lbl.queue_free())

func _navigate(dw: int, dl: int) -> void:
	if is_launching:
		return
	var current_key: String = _get_selected_key()
	var neighbors: Array = _adjacency.get(current_key, [])
	if neighbors.is_empty():
		return

	var current_pos: Vector2 = NODE_POSITIONS.get(current_key, Vector2.ZERO) + Vector2(40, 40)
	var target_dir := Vector2(float(dl), float(dw)).normalized()
	if target_dir == Vector2.ZERO:
		return

	var best_key: String = ""
	var best_score: float = -INF

	for neighbor_key: String in neighbors:
		if not node_map.has(neighbor_key):
			continue
		if not NODE_POSITIONS.has(neighbor_key):
			continue
		var neighbor_pos: Vector2 = NODE_POSITIONS.get(neighbor_key, Vector2.ZERO) + Vector2(40, 40)
		var delta_pos: Vector2 = neighbor_pos - current_pos
		if delta_pos == Vector2.ZERO:
			continue

		# Check if the neighbor is unlocked
		var n_parts := neighbor_key.split("-")
		var is_unlocked: bool = false
		if n_parts[0] == "B":
			is_unlocked = _is_bonus_unlocked(int(n_parts[1]))
		else:
			var w: int = int(n_parts[0])
			var l_str: String = n_parts[1]
			if l_str == "B":
				is_unlocked = _is_bonus_unlocked(w)
			else:
				is_unlocked = LevelManager.is_level_unlocked(w, int(l_str))
		if not is_unlocked:
			continue

		var angle_diff: float = delta_pos.angle() - target_dir.angle()
		angle_diff = wrapf(angle_diff, -PI, PI)

		# Only consider neighbors within 60 degrees of the intended direction
		if absf(angle_diff) > deg_to_rad(60):
			continue

		# Score by directional alignment (dot product); higher = better
		var ndir: Vector2 = delta_pos.normalized()
		var score: float = ndir.dot(target_dir)
		# Tiny distance penalty to prefer nearer nodes when alignment is equal
		var dist: float = current_pos.distance_to(neighbor_pos)
		score -= dist * 0.001
		# Deterministic tiebreaker: alphabetical key order
		score += (1.0 if neighbor_key < current_key else 0.0) * 0.0001

		if score > best_score:
			best_score = score
			best_key = neighbor_key

	if best_key.is_empty():
		return

	var parts := best_key.split("-")
	if parts[0] == "B":
		selected_world = int(parts[1])
		selected_level = 0
	elif parts[0] == "S":
		selected_world = 0
		selected_level = int(parts[1])
	else:
		selected_world = int(parts[0])
		selected_level = 0 if parts[1] == "B" else int(parts[1])
	_move_selector(selected_world, selected_level)
	_update_ui()
	_update_available_moves()

func _on_node_pressed(world: int, level: int) -> void:
	if is_launching:
		return
	if not LevelManager.is_level_unlocked(world, level):
		hint_lbl.text    = "[LOCKED] Earn more stars to unlock!"
		hint_lbl.visible = true
		await get_tree().create_timer(2.0).timeout
		if not is_inside_tree():
			return
		hint_lbl.visible = false
		return
	if selected_world == world and selected_level == level:
		_launch()
		return
	selected_world = world
	selected_level = level
	_move_selector_to_key("%d-%d" % [world, level])
	_update_ui()
	_update_available_moves()

func _on_bonus_pressed(world: int) -> void:
	if is_launching:
		return
	if not _is_bonus_unlocked(world):
		hint_lbl.text    = "[LOCKED] Complete all levels in this world to unlock!"
		hint_lbl.visible = true
		await get_tree().create_timer(2.5).timeout
		if not is_inside_tree():
			return
		hint_lbl.visible = false
		return
	if selected_world == world and selected_level == 0:
		_launch_bonus()
		return
	selected_world = world
	selected_level = 0
	_move_selector_to_key("B-%d" % world)
	_update_ui()
	_update_available_moves()

func _launch() -> void:
	if is_launching:
		return
	is_launching = true
	set_process_input(false)

	if selected_world == 0 and selected_level > 0:
		_launch_secret()
		return

	if selected_level == 0:
		_launch_bonus()
		return

	if not LevelManager.is_level_unlocked(selected_world, selected_level):
		is_launching = false
		set_process_input(true)
		return

	if not _require_lives_to_launch():
		return

	GameManager.current_world = selected_world
	GameManager.current_level = selected_level
	var _path := LevelManager.get_level_scene_path(selected_world, selected_level)

	# Holographic dive transition
	var key := "%d-%d" % [selected_world, selected_level]
	var selected_node: Node = node_map.get(key)
	if selected_node:
		# Gentle hex pulse + subtle camera drift
		var node_tween := create_tween()
		node_tween.tween_property(selected_node, "scale", Vector2(1.25, 1.25), 0.3).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_QUAD)

		_tween_map_focus_on_key(key, 0.55)

		# Start holographic splash after a brief settle
		await get_tree().create_timer(0.15).timeout
		var hex_screen_pos: Vector2 = _hex_center_screen(selected_node, key)
		var hex_color: Color = selected_node.world_color if selected_node.get("world_color") != null else Color(1.0, 0.35, 0.0)
		dive_transition.start(hex_screen_pos, hex_color, func():
			Main.instance.load_level(selected_world, selected_level)
		)
	else:
		# Fallback: gentle fade if node missing
		var tween := create_tween().set_parallel()
		_tween_map_zoom_out(tween, 0.5)
		tween.tween_property(self, "modulate:a", 0.0, 0.6).set_ease(Tween.EASE_IN)
		await tween.finished
		Main.instance.load_level(selected_world, selected_level)

func _launch_bonus() -> void:
	if not _is_bonus_unlocked(selected_world):
		is_launching = false
		set_process_input(true)
		return
	if not _require_lives_to_launch():
		return

	GameManager.current_world = selected_world
	GameManager.current_level = 0

	# Holographic dive transition
	var key := "B-%d" % selected_world
	var selected_node: Node = node_map.get(key)
	if selected_node:
		var node_tween := create_tween()
		node_tween.tween_property(selected_node, "scale", Vector2(1.25, 1.25), 0.3).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_QUAD)
		_tween_map_focus_on_key(key, 0.55)
		await get_tree().create_timer(0.15).timeout
		var hex_screen_pos: Vector2 = _hex_center_screen(selected_node, key)
		var hex_color: Color = selected_node.world_color if selected_node.get("world_color") != null else Color(1.0, 0.78, 0.05)
		dive_transition.start(hex_screen_pos, hex_color, func():
			Main.instance.load_bonus_level(selected_world)
		)
	else:
		var tween := create_tween().set_parallel()
		_tween_map_zoom_out(tween, 0.5)
		tween.tween_property(self, "modulate:a", 0.0, 0.6).set_ease(Tween.EASE_IN)
		await tween.finished
		Main.instance.load_bonus_level(selected_world)

# ── Selector / Avatar movement ──────────────────────────────────────────────────

func _hex_center_screen(node: Node, key: String) -> Vector2:
	if node != null:
		return node.global_position + Vector2(40, 40)
	var local_center: Vector2 = NODE_POSITIONS.get(key, MAP_CENTER) + Vector2(40, 40)
	if map_root != null:
		return map_root.position + local_center * _map_zoom
	return local_center


func _tween_map_focus_on_key(key: String, duration: float = 0.55) -> void:
	var node_center: Vector2 = NODE_POSITIONS.get(key, MAP_CENTER) + Vector2(40, 40)
	var end_zoom: float = clampf(_map_zoom * 1.35, MIN_MAP_ZOOM, MAX_MAP_ZOOM)
	var end_pan: Vector2 = get_viewport_rect().size * 0.5 - node_center * end_zoom
	var tw := create_tween().set_parallel().set_ease(Tween.EASE_IN_OUT).set_trans(Tween.TRANS_QUAD)
	tw.tween_method(
		func(z: float) -> void:
			_map_zoom = z
			_apply_map_view(true),
		_map_zoom,
		end_zoom,
		duration
	)
	tw.tween_method(
		func(p: Vector2) -> void:
			_map_pan = p
			_apply_map_view(true),
		_map_pan,
		end_pan,
		duration
	)


func _tween_map_zoom_out(tween: Tween, duration: float) -> void:
	var end_zoom: float = clampf(_map_zoom * 1.75, MIN_MAP_ZOOM, MAX_MAP_ZOOM)
	tween.tween_method(
		func(z: float) -> void:
			_map_zoom = z
			_apply_map_view(true),
		_map_zoom,
		end_zoom,
		duration
	)


func _move_selector(world: int, level: int, instant: bool = false) -> void:
	var key := _get_key(world, level)
	_move_selector_to_key(key, instant)

func _get_key(world: int, level: int) -> String:
	if world == 0 and level > 0:
		return "S-%d" % level
	if level == 0:
		return "B-%d" % world
	return "%d-%d" % [world, level]

func _move_selector_to_key(key: String, instant: bool = false) -> void:
	var target: Vector2 = NODE_POSITIONS.get(key, avatar.position) + Vector2(40, 40)
	if instant:
		avatar.position = target
		if _avatar_tween != null:
			_avatar_tween.kill()
			_avatar_tween = null
	else:
		if _avatar_tween != null:
			_avatar_tween.kill()
		_avatar_tween = create_tween().set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_BACK)
		_avatar_tween.tween_property(avatar, "position", target, 0.25)
	# Gentle view nudge toward selected node — full map stays visible
	var selected_pos: Vector2 = NODE_POSITIONS.get(key, MAP_CENTER) + Vector2(40, 40)
	var vp_half: Vector2 = get_viewport_rect().size * 0.5
	var focus_pan: Vector2 = vp_half - selected_pos * _map_zoom
	var target_pan: Vector2 = _map_pan.lerp(focus_pan, CAM_NUDGE)
	if instant:
		_map_pan = target_pan
		_apply_map_view(true)
		if _cam_tween != null:
			_cam_tween.kill()
			_cam_tween = null
	else:
		if _cam_tween != null:
			_cam_tween.kill()
		_cam_tween = create_tween().set_ease(CAM_PAN_EASE).set_trans(CAM_PAN_TRANS)
		_cam_tween.tween_method(
			func(p: Vector2) -> void:
				_map_pan = p
				_apply_map_view(true),
			_map_pan,
			target_pan,
			CAM_PAN_TIME
		)
	# Update node selected state
	for k: String in node_map:
		var n: Node = node_map[k]
		n.is_selected = (k == key)
		n.queue_redraw()

func _draw_avatar() -> void:
	var center := Vector2.ZERO + Vector2(0, sin(avatar_bounce) * 6.0)
	# Shadow (soft blurred look via multiple circles)
	for i: int in range(3):
		var sh := Color(0, 0, 0, 0.08 - i * 0.02)
		avatar.draw_circle(Vector2(0, 18 + i * 2), 14 + i * 3, sh)
	# Outer glow
	var glow := Color(0.3, 0.75, 1.0, 0.2)
	avatar.draw_circle(center, 20, glow)
	# Ball body (gradient simulation)
	avatar.draw_circle(center, 16, Color(0.15, 0.5, 0.9))
	avatar.draw_circle(center + Vector2(-2, -2), 13, Color(0.3, 0.7, 1.0))
	# Border
	avatar.draw_arc(center, 16, 0.0, TAU, 32, Color(0.1, 0.4, 0.8), 2.5)
	# Shine
	avatar.draw_circle(center + Vector2(-5, -5), 5, Color(1, 1, 1, 0.45))
	avatar.draw_circle(center + Vector2(-3, -3), 2, Color(1, 1, 1, 0.7))
	# Inner highlight ring
	avatar.draw_arc(center, 10, 0.0, TAU, 32, Color(0.5, 0.8, 1.0, 0.4), 1.5)

# ── Available moves hints ─────────────────────────────────────────────────────

func _update_available_moves() -> void:
	move_hint_layer.queue_redraw()

func _draw_move_hints() -> void:
	var current_key := _get_selected_key()
	var current_pos: Vector2 = NODE_POSITIONS.get(current_key, Vector2.ZERO) + Vector2(40, 40)
	for path: Array in PATHS:
		var other_key: String = ""
		if path[0] == current_key:
			other_key = path[1]
		elif path[1] == current_key:
			other_key = path[0]
		if other_key.is_empty():
			continue
		var parts := other_key.split("-")
		var ow: int = 0
		var ol_str: String = ""
		if parts.size() >= 2:
			ol_str = parts[1]
		var unlocked: bool = false
		if other_key == "BONUS":
			continue
		if parts[0] == "B":
			ow = int(parts[1])
			unlocked = _is_bonus_unlocked(ow)
		else:
			ow = int(parts[0])
			if ol_str == "B":
				unlocked = _is_bonus_unlocked(ow)
			else:
				unlocked = LevelManager.is_level_unlocked(ow, int(ol_str))
		if not unlocked:
			continue
		var other_pos: Vector2 = NODE_POSITIONS.get(other_key, Vector2.ZERO) + Vector2(40, 40)
		var dir := (other_pos - current_pos).normalized()
		var arrow_start := current_pos + dir * 34.0
		var arrow_end := other_pos - dir * 34.0
		var arrow_col := Color(0.5, 1.0, 0.5, 0.6)
		move_hint_layer.draw_line(arrow_start, arrow_end, arrow_col, 2.0)
		_draw_arrowhead_on_layer(move_hint_layer, arrow_end, dir, 8.0, arrow_col)

func _get_selected_key() -> String:
	if selected_world == 0 and selected_level > 0:
		return "S-%d" % selected_level
	if selected_level == 0:
		return "B-%d" % selected_world
	return "%d-%d" % [selected_world, selected_level]

func _draw_arrowhead_on_layer(layer: Node2D, pos: Vector2, dir: Vector2, size: float, col: Color) -> void:
	var perp := Vector2(-dir.y, dir.x)
	var p1 := pos - dir * size + perp * size * 0.5
	var p2 := pos - dir * size - perp * size * 0.5
	var points := PackedVector2Array([pos, p1, p2])
	var colors := PackedColorArray([col, col, col])
	layer.draw_polygon(points, colors)

# ── UI ──────────────────────────────────────────────────────────────────────────

func _update_ui() -> void:
	var wd: Dictionary = LevelManager.WORLDS.get(selected_world, {})
	world_lbl.text   = "World %d — %s" % [selected_world, wd.get("name", "")]
	concept_lbl.text = "Concept: %s" % wd.get("concept", "")
	star_lbl.text    = "%d" % GameManager.total_stars
	_populate_sidebar()
	if selected_world == 0 and selected_level > 0:
		var secret_data: Dictionary = LevelManager.SECRET_LEVELS.get(selected_level, {})
		level_lbl.text = "Secret: %s" % secret_data.get("name", "Secret")
		level_desc.text = "Secret Level |  Press ENTER to play"
	elif selected_level == 0:
		var bonus_data: Dictionary = LevelManager.BONUS_LEVELS.get(selected_world, {})
		level_lbl.text = "Bonus: %s" % bonus_data.get("name", "Bonus")
		var completed: bool = LevelManager.is_bonus_completed(selected_world)
		level_desc.text = "Bonus: %s  |  Reward: +$%d  +HP%d" % [
			"COMPLETED" if completed else "AVAILABLE",
			bonus_data.get("reward_coins", 10),
			bonus_data.get("reward_lives", 1)
		]
	else:
		var s := LevelManager.get_level_stars(selected_world, selected_level)
		level_lbl.text   = "Level %d-%d   %d/3 stars" % [selected_world, selected_level, s]
		var status: String = "UNLOCKED" if LevelManager.is_level_unlocked(selected_world, selected_level) else "LOCKED"
		var best := LevelManager.get_best_time(selected_world, selected_level)
		var best_line := ""
		if best < INF:
			best_line = "  |  Best: %s" % LevelManager.format_time_display(best)
		level_desc.text = "Status: %s%s  |  Press ENTER to play" % [status, best_line]

func _refresh_all_nodes() -> void:
	for key: String in node_map:
		var parts: PackedStringArray = key.split("-")
		var w: int = 0
		var l_str: String = parts[1]
		var is_bonus: bool = false
		var is_secret: bool = false
		if parts[0] == "B":
			w = int(parts[1])
			is_bonus = true
		elif parts[0] == "S":
			is_secret = true
		else:
			w = int(parts[0])
			is_bonus = (l_str == "B")
		if is_bonus:
			node_map[key].refresh(
				1 if LevelManager.is_bonus_completed(w) else 0,
				_is_bonus_unlocked(w)
			)
		elif is_secret:
			node_map[key].refresh(
				0,
				LevelManager.is_secret_unlocked()
			)
		else:
			var l := int(l_str)
			node_map[key].refresh(
				LevelManager.get_level_stars(w, l),
				LevelManager.is_level_unlocked(w, l),
				LevelManager.get_best_time(w, l)
			)
	_redraw_map_layer()
	_update_available_moves()

func _on_world_unlocked(world: int) -> void:
	world_lbl.text = "World %d Unlocked!" % world
	await get_tree().create_timer(2.5).timeout
	if not is_inside_tree():
		return
	_update_ui()
