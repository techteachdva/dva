extends Control

# ── Shop data ─────────────────────────────────────────────────────────────────

const SHOP_ITEMS: Array[Dictionary] = [
	{ "id": "supply_life", "name": "Extra Life", "cost": 10, "type": "consumable", "icon": "life_plus",
		"desc": "Adds 1 life to your current run." },
	{ "id": "skin_gold", "name": "Gold Ball", "cost": 15, "type": "skin", "icon": "skin_ball",
		"desc": "A shiny golden sphere." },
	{ "id": "skin_neon", "name": "Neon Ball", "cost": 25, "type": "skin", "icon": "skin_ball",
		"desc": "Glowing cyan sphere." },
	{ "id": "skin_crystal", "name": "Crystal Ball", "cost": 35, "type": "skin", "icon": "skin_ball",
		"desc": "Transparent blue crystal." },
	{ "id": "theme_default", "name": "Default Theme", "cost": 0, "type": "theme", "icon": "theme_paint",
		"desc": "Classic look. Resets to the standard theme." },
	{ "id": "theme_neon", "name": "Neon Nights", "cost": 15, "type": "theme", "icon": "theme_paint",
		"desc": "Purple and cyan track lighting." },
	{ "id": "theme_nature", "name": "Nature", "cost": 25, "type": "theme", "icon": "theme_paint",
		"desc": "Green and brown track." },
	{ "id": "theme_space", "name": "Space", "cost": 35, "type": "theme", "icon": "theme_paint",
		"desc": "Dark track with stars." },
	{ "id": "music_chill", "name": "Chill Mode", "cost": 10, "type": "music", "icon": "music_note",
		"desc": "Relaxing background track." },
	{ "id": "music_action", "name": "Action Mode", "cost": 10, "type": "music", "icon": "music_note",
		"desc": "Fast-paced track." },
	{ "id": "music_retro", "name": "Retro Mode", "cost": 15, "type": "music", "icon": "music_note",
		"desc": "8-bit style music." },
	{ "id": "mat_rubber", "name": "Rubber Ball", "cost": 20, "type": "material", "icon": "mat_rubber",
		"desc": "High grip, low bounce." },
	{ "id": "mat_metal", "name": "Metal Ball", "cost": 30, "type": "material", "icon": "mat_metal",
		"desc": "Heavy, keeps momentum." },
	{ "id": "mat_bouncy", "name": "Bouncy Ball", "cost": 25, "type": "material", "icon": "mat_bouncy",
		"desc": "High bounce, slippery." },
]

const TAB_SUPPLIES  := 0
const TAB_SKINS     := 1
const TAB_THEMES    := 2
const TAB_MUSIC     := 3
const TAB_MATERIALS := 4

const TAB_TYPES: Array[String] = ["consumable", "skin", "theme", "music", "material"]

@onready var tab_bar: TabBar = $Panel/Margin/VBox/TabBar
@onready var grid: GridContainer = $Panel/Margin/VBox/Scroll/Grid
@onready var coin_lbl: Label = $Panel/Margin/VBox/CoinLabel
@onready var close_btn: Button = $Panel/Margin/VBox/HBox/CloseBtn
@onready var panel: Panel = $Panel

var current_tab: int = 0
var _loadout_lbl: Label
var _lives_lbl: Label

func _ready() -> void:
	close_btn.pressed.connect(_on_close)
	tab_bar.tab_changed.connect(_on_tab_changed)
	_ensure_tab_titles()
	visible = false
	_apply_panel_style()
	_style_header()
	_setup_loadout_label()
	_refresh()

func _ensure_tab_titles() -> void:
	var titles := ["Supplies", "Skins", "Themes", "Music", "Materials"]
	for i: int in range(mini(titles.size(), tab_bar.tab_count)):
		tab_bar.set_tab_title(i, titles[i])

func _apply_panel_style() -> void:
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.05, 0.07, 0.12, 0.98)
	style.border_color = Color(0.35, 0.72, 0.95, 0.95)
	style.border_width_left = 3
	style.border_width_top = 3
	style.border_width_right = 3
	style.border_width_bottom = 3
	style.corner_radius_top_left = 16
	style.corner_radius_top_right = 16
	style.corner_radius_bottom_left = 16
	style.corner_radius_bottom_right = 16
	style.shadow_color = Color(0.0, 0.0, 0.0, 0.45)
	style.shadow_size = 8
	panel.add_theme_stylebox_override("panel", style)
	mouse_filter = Control.MOUSE_FILTER_STOP

func _style_header() -> void:
	var title: Label = $Panel/Margin/VBox/Title
	title.text = "SHOP"
	title.add_theme_font_size_override("font_size", 30)
	title.add_theme_color_override("font_color", Color(0.92, 0.96, 1.0))
	var coin_row := HBoxContainer.new()
	coin_row.name = "CoinRow"
	coin_row.alignment = BoxContainer.ALIGNMENT_CENTER
	coin_row.add_theme_constant_override("separation", 10)
	$Panel/Margin/VBox.add_child(coin_row)
	$Panel/Margin/VBox.move_child(coin_row, 2)
	var coin_icon := TextureRect.new()
	UiIconLayout.configure_icon_rect(coin_icon, "coin", Vector2(28, 28))
	coin_row.add_child(coin_icon)
	$Panel/Margin/VBox.remove_child(coin_lbl)
	coin_row.add_child(coin_lbl)
	coin_lbl.add_theme_font_size_override("font_size", 22)
	coin_lbl.add_theme_color_override("font_color", Color(1.0, 0.88, 0.35))
	_lives_lbl = Label.new()
	_lives_lbl.name = "LivesLabel"
	_lives_lbl.add_theme_font_size_override("font_size", 18)
	_lives_lbl.add_theme_color_override("font_color", Color(1.0, 0.55, 0.6))
	coin_row.add_child(_lives_lbl)

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
	_loadout_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_loadout_lbl.add_theme_font_size_override("font_size", 14)
	_loadout_lbl.add_theme_color_override("font_color", Color(0.75, 0.82, 0.92))
	$Panel/Margin/VBox.add_child(_loadout_lbl)
	$Panel/Margin/VBox.move_child(_loadout_lbl, 3)

func _on_close() -> void:
	visible = false

func _on_tab_changed(idx: int) -> void:
	current_tab = idx
	_refresh()

func _supply_items() -> Array[Dictionary]:
	var items: Array[Dictionary] = []
	for item: Dictionary in SHOP_ITEMS:
		if item["type"] == "consumable":
			items.append(item)
	var next_world := LevelManager.get_next_locked_world()
	if next_world > 0:
		var wd: Dictionary = LevelManager.WORLDS.get(next_world, {})
		items.append({
			"id": "world_key_%d" % next_world,
			"name": "World Key",
			"cost": LevelManager.get_world_key_cost(next_world),
			"type": "world_key",
			"icon": "shop_key",
			"desc": "Unlocks %s (World %d)." % [wd.get("name", "next world"), next_world],
			"world": next_world,
		})
	return items

func _refresh() -> void:
	coin_lbl.text = "%d" % GameManager.coins
	if _lives_lbl:
		_lives_lbl.text = "  |  Lives: %d" % GameManager.lives
	_update_loadout()
	_clear_grid()
	var filter_type := TAB_TYPES[current_tab] if current_tab < TAB_TYPES.size() else ""
	if filter_type == "consumable":
		for item: Dictionary in _supply_items():
			grid.add_child(_create_item_card(item))
	else:
		for item: Dictionary in SHOP_ITEMS:
			if item["type"] != filter_type:
				continue
			grid.add_child(_create_item_card(item))

func _update_loadout() -> void:
	var parts: Array[String] = []
	var skin := LevelManager.get_equipped_skin()
	if not skin.is_empty():
		parts.append("Skin: %s" % _pretty_name(skin))
	var eq_theme := LevelManager.get_equipped_theme()
	if eq_theme.is_empty():
		parts.append("Theme: Default")
	else:
		parts.append("Theme: %s" % _pretty_name(eq_theme))
	var mat := LevelManager.get_equipped_material()
	if not mat.is_empty():
		parts.append("Material: %s" % _pretty_name(mat))
	var music := LevelManager.get_equipped_music()
	if not music.is_empty():
		parts.append("Music: %s" % _pretty_name(music))
	if parts.is_empty():
		_loadout_lbl.text = "Equipped: defaults"
	else:
		_loadout_lbl.text = "Equipped: " + "  |  ".join(parts)

func _clear_grid() -> void:
	for child: Node in grid.get_children():
		grid.remove_child(child)
		child.queue_free()

func _icon_for_item(item: Dictionary) -> Texture2D:
	if item.get("type", "") == "music":
		return GameIcons.get_menu_texture("MusicBtn")
	var kind: String = item.get("icon", "coin")
	return GameIcons.get_texture(kind)

func _create_item_card(item: Dictionary) -> PanelContainer:
	var card := PanelContainer.new()
	card.custom_minimum_size = Vector2(220, 128)
	var card_style := StyleBoxFlat.new()
	card_style.bg_color = Color(0.09, 0.11, 0.16, 0.95)
	card_style.border_color = Color(0.28, 0.42, 0.58, 0.85)
	card_style.border_width_left = 2
	card_style.border_width_top = 2
	card_style.border_width_right = 2
	card_style.border_width_bottom = 2
	card_style.corner_radius_top_left = 10
	card_style.corner_radius_top_right = 10
	card_style.corner_radius_bottom_left = 10
	card_style.corner_radius_bottom_right = 10
	card_style.content_margin_left = 10
	card_style.content_margin_top = 8
	card_style.content_margin_right = 10
	card_style.content_margin_bottom = 8
	card.add_theme_stylebox_override("panel", card_style)

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	card.add_child(row)

	var icon_rect := TextureRect.new()
	icon_rect.custom_minimum_size = Vector2(56, 56)
	icon_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icon_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	var tex := _icon_for_item(item)
	if tex:
		icon_rect.texture = tex
	row.add_child(icon_rect)

	var text_col := VBoxContainer.new()
	text_col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	text_col.add_theme_constant_override("separation", 4)
	row.add_child(text_col)

	var owned := _is_owned(item)
	var equipped := _is_equipped(item)
	var name_lbl := Label.new()
	name_lbl.text = item["name"]
	name_lbl.add_theme_font_size_override("font_size", 18)
	if equipped:
		name_lbl.add_theme_color_override("font_color", Color(0.45, 1.0, 0.55))
	elif owned:
		name_lbl.add_theme_color_override("font_color", Color(0.55, 0.82, 1.0))
	else:
		name_lbl.add_theme_color_override("font_color", Color(0.95, 0.96, 1.0))
	text_col.add_child(name_lbl)

	var action_lbl := Label.new()
	action_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	action_lbl.add_theme_font_size_override("font_size", 14)
	if equipped:
		action_lbl.text = "EQUIPPED"
		action_lbl.add_theme_color_override("font_color", Color(0.4, 0.95, 0.5))
	elif owned and item["type"] not in ["consumable", "world_key"]:
		action_lbl.text = "Owned — tap to equip"
		action_lbl.add_theme_color_override("font_color", Color(0.5, 0.78, 0.95))
	elif item["type"] == "world_key":
		action_lbl.text = "$%d — unlocks next world" % item["cost"]
		action_lbl.add_theme_color_override("font_color", Color(1.0, 0.82, 0.3))
	else:
		action_lbl.text = "$%d — tap to buy" % item["cost"]
		action_lbl.add_theme_color_override("font_color", Color(1.0, 0.82, 0.3))
	text_col.add_child(action_lbl)

	var desc_lbl := Label.new()
	desc_lbl.text = item.get("desc", "")
	desc_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	desc_lbl.add_theme_font_size_override("font_size", 12)
	desc_lbl.add_theme_color_override("font_color", Color(0.62, 0.68, 0.78))
	text_col.add_child(desc_lbl)

	var buy_btn := Button.new()
	buy_btn.text = "Buy" if not owned or item["type"] in ["consumable", "world_key"] else "Equip"
	buy_btn.custom_minimum_size = Vector2(72, 32)
	if owned and item["type"] not in ["consumable", "world_key"]:
		buy_btn.pressed.connect(_on_equip.bind(item))
	else:
		buy_btn.pressed.connect(_on_buy.bind(item))
	text_col.add_child(buy_btn)

	return card

func _is_owned(item: Dictionary) -> bool:
	if item["id"] == "theme_default":
		return true
	match item["type"]:
		"skin", "theme", "material":
			return LevelManager.has_shop_item(item["id"])
		"music":
			return LevelManager.is_music_unlocked(item["id"])
		"world_key":
			return false
		"consumable":
			return false
	return false

func _is_equipped(item: Dictionary) -> bool:
	match item["type"]:
		"skin":
			return LevelManager.get_equipped_skin() == item["id"]
		"theme":
			if item["id"] == "theme_default":
				return LevelManager.get_equipped_theme().is_empty()
			return LevelManager.get_equipped_theme() == item["id"]
		"material":
			return LevelManager.get_equipped_material() == item["id"]
		"music":
			return LevelManager.get_equipped_music() == LevelManager.music_track_id(item["id"])
	return false

func _on_buy(item: Dictionary) -> void:
	if not GameManager.spend_coins(item["cost"]):
		coin_lbl.text = "%d  (NOT ENOUGH COINS!)" % GameManager.coins
		return
	if get_node_or_null("/root/AudioManager") != null:
		AudioManager.play_sfx("bought")
	match item["type"]:
		"skin", "theme", "material":
			LevelManager.buy_shop_item(item["id"])
		"music":
			LevelManager.unlock_music(item["id"])
		"consumable":
			if item["id"] == "supply_life":
				GameManager.add_life()
		"world_key":
			var world: int = int(item.get("world", 0))
			if world > 0:
				LevelManager.unlock_world_with_key(world)
	LevelManager.save_progress()
	_refresh()

func _on_equip(item: Dictionary) -> void:
	match item["type"]:
		"skin":
			LevelManager.equip_skin(item["id"])
		"theme":
			if item["id"] == "theme_default":
				LevelManager.equip_theme("")
			else:
				LevelManager.equip_theme(item["id"])
		"material":
			LevelManager.equip_material(item["id"])
		"music":
			var track_id := LevelManager.music_track_id(item["id"])
			LevelManager.equip_music(track_id)
			LevelManager.set_music_mode("track")
			if get_node_or_null("/root/AudioManager") != null:
				AudioManager.set_playback_mode("track")
				AudioManager.set_single_track(track_id)
				AudioManager.play_music(track_id, 0.5, true)
	_refresh()
