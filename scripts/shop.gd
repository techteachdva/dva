extends Control

# ── Shop data ─────────────────────────────────────────────────────────────────

const SHOP_ITEMS: Array[Dictionary] = [
	# Cosmetics — Skins
	{ "id": "skin_gold",     "name": "Gold Ball",       "cost": 15,  "type": "skin",  "desc": "A shiny golden sphere" },
	{ "id": "skin_neon",     "name": "Neon Ball",       "cost": 25,  "type": "skin",  "desc": "Glowing cyan sphere" },
	{ "id": "skin_crystal",  "name": "Crystal Ball",    "cost": 35,  "type": "skin",  "desc": "Transparent blue crystal" },
	# Cosmetics — Level Themes
	{ "id": "theme_neon",    "name": "Neon Nights",     "cost": 15,  "type": "theme", "desc": "Purple & cyan track" },
	{ "id": "theme_nature",  "name": "Nature",          "cost": 25,  "type": "theme", "desc": "Green & brown track" },
	{ "id": "theme_space",   "name": "Space",           "cost": 35,  "type": "theme", "desc": "Dark track with stars" },
	# Music Tracks
	{ "id": "music_chill",   "name": "Chill Mode",      "cost": 10,  "type": "music", "desc": "Relaxing background track" },
	{ "id": "music_action",  "name": "Action Mode",     "cost": 10,  "type": "music", "desc": "Fast-paced track" },
	{ "id": "music_retro",   "name": "Retro Mode",      "cost": 15,  "type": "music", "desc": "8-bit style music" },
	# Materials — change ball physics
	{ "id": "mat_rubber",       "name": "Rubber Ball",  "cost": 20,  "type": "material", "desc": "High grip, low bounce" },
	{ "id": "mat_metal",        "name": "Metal Ball",   "cost": 30,  "type": "material", "desc": "Heavy, keeps momentum" },
	{ "id": "mat_bouncy",       "name": "Bouncy Ball",  "cost": 25,  "type": "material", "desc": "High bounce, slippery" },
]

const TAB_SKINS     := 0
const TAB_THEMES    := 1
const TAB_MUSIC     := 2
const TAB_MATERIALS := 3

@onready var tab_bar:     TabBar     = $Panel/Margin/VBox/TabBar
@onready var grid:        GridContainer = $Panel/Margin/VBox/Scroll/Grid
@onready var coin_lbl:     Label      = $Panel/Margin/VBox/CoinLabel
@onready var close_btn:   Button     = $Panel/Margin/VBox/HBox/CloseBtn

var current_tab: int = 0
var _loadout_lbl: Label

func _ready() -> void:
	close_btn.pressed.connect(_on_close)
	tab_bar.tab_changed.connect(_on_tab_changed)
	visible = false
	_setup_loadout_label()
	_refresh()

func open(start_tab: int = -1) -> void:
	visible = true
	if start_tab >= 0 and start_tab < tab_bar.tab_count:
		tab_bar.current_tab = start_tab
		current_tab = start_tab
	_refresh()

func _pretty_name(id: String) -> String:
	for item: Dictionary in SHOP_ITEMS:
		if item["id"] == id:
			return item["name"]
	return id

func _setup_loadout_label() -> void:
	_loadout_lbl = Label.new()
	_loadout_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	$Panel/Margin/VBox.add_child(_loadout_lbl)
	$Panel/Margin/VBox.move_child(_loadout_lbl, 2)

func _on_close() -> void:
	visible = false

func _on_tab_changed(idx: int) -> void:
	current_tab = idx
	_refresh()

func _refresh() -> void:
	coin_lbl.text = "🪙  %d" % GameManager.coins

	var parts: Array[String] = []
	var skin := LevelManager.get_equipped_skin()
	if not skin.is_empty(): parts.append("Skin: %s" % _pretty_name(skin))
	var eq_theme := LevelManager.get_equipped_theme()
	if not eq_theme.is_empty(): parts.append("Theme: %s" % _pretty_name(eq_theme))
	var mat := LevelManager.get_equipped_material()
	if not mat.is_empty(): parts.append("Material: %s" % _pretty_name(mat))
	var music := LevelManager.get_equipped_music()
	if not music.is_empty(): parts.append("Music: %s" % _pretty_name(music))
	if parts.is_empty():
		_loadout_lbl.text = "Loadout: Default"
	else:
		_loadout_lbl.text = "Equipped: " + "  |  ".join(parts)

	for child: Node in grid.get_children():
		grid.remove_child(child)
		child.queue_free()

	var filter_type := ""
	match current_tab:
		TAB_SKINS:     filter_type = "skin"
		TAB_THEMES:    filter_type = "theme"
		TAB_MUSIC:     filter_type = "music"
		TAB_MATERIALS: filter_type = "material"

	for item: Dictionary in SHOP_ITEMS:
		if item["type"] != filter_type:
			continue
		var btn := _create_item_button(item)
		grid.add_child(btn)

func _create_item_button(item: Dictionary) -> Button:
	var btn := Button.new()
	var owned := _is_owned(item)
	var equipped := _is_equipped(item)

	var action_text := ""
	var tooltip := ""
	if equipped:
		action_text = "✓ EQUIPPED"
		tooltip = "Currently active. Click to re-equip."
	elif owned:
		action_text = "OWNED — Click to Equip"
		tooltip = "You own this. Click to equip it."
	else:
		action_text = "🪙 %d — Click to Buy" % item["cost"]
		tooltip = "Buy this item for %d coins." % item["cost"]

	btn.text = "%s\n%s\n%s" % [item["name"], action_text, item["desc"]]
	btn.tooltip_text = tooltip
	btn.custom_minimum_size = Vector2(180, 100)
	btn.disabled = false

	if equipped:
		btn.add_theme_color_override("font_color", Color(0.35, 1.0, 0.35))
	elif owned:
		btn.add_theme_color_override("font_color", Color(0.5, 0.8, 1.0))

	if owned:
		btn.pressed.connect(_on_equip.bind(item))
	else:
		btn.pressed.connect(_on_buy.bind(item))

	return btn

func _is_owned(item: Dictionary) -> bool:
	match item["type"]:
		"skin", "theme", "material":
			return LevelManager.has_shop_item(item["id"])
		"music":
			return LevelManager.is_music_unlocked(item["id"])
	return false

func _is_equipped(item: Dictionary) -> bool:
	match item["type"]:
		"skin":     return LevelManager.get_equipped_skin() == item["id"]
		"theme":    return LevelManager.get_equipped_theme() == item["id"]
		"material": return LevelManager.get_equipped_material() == item["id"]
		"music":    return LevelManager.get_equipped_music() == item["id"]
	return false

func _on_buy(item: Dictionary) -> void:
	if not GameManager.spend_coins(item["cost"]):
		coin_lbl.text = "🪙  %d  (NOT ENOUGH COINS!)" % GameManager.coins
		return

	if get_node_or_null("/root/AudioManager") != null:
		AudioManager.play_sfx("bought")

	match item["type"]:
		"skin", "theme", "material":
			LevelManager.buy_shop_item(item["id"])
		"music":
			LevelManager.unlock_music(item["id"])

	_refresh()

func _on_equip(item: Dictionary) -> void:
	match item["type"]:
		"skin":
			LevelManager.equip_skin(item["id"])
		"theme":
			LevelManager.equip_theme(item["id"])
		"material":
			LevelManager.equip_material(item["id"])
		"music":
			LevelManager.equip_music(item["id"])
			LevelManager.set_music_mode("track")
			if get_node_or_null("/root/AudioManager") != null:
				AudioManager.set_playback_mode("track")
				AudioManager.set_single_track(item["id"].replace("music_", ""))
			_on_play_music(item)
	_refresh()

func _on_play_music(item: Dictionary) -> void:
	# Preview the music track (bypasses mode resolution)
	var track_key: String = item["id"].replace("music_", "")
	if get_node_or_null("/root/AudioManager") != null:
		AudioManager.play_music(track_key, 0.5, true)
