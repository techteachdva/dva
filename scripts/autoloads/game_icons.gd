extends Node
## Central icon loader. PNGs in res://assets/icons/ with procedural fallback (HTML5-safe).

const _Painter := preload("res://scripts/autoloads/game_icon_painter.gd")

const ICON_DIR := "res://assets/icons/"
const BAKE_VERSION := 6

const PATHS: Dictionary = {
	"heart": ICON_DIR + "heart.png",
	"star": ICON_DIR + "star.png",
	"star_empty": ICON_DIR + "star_empty.png",
	"coin": ICON_DIR + "coin.png",
	"lock": ICON_DIR + "lock.png",
	"music_note": ICON_DIR + "menu_music.png",
	"shop_key": ICON_DIR + "shop_key.png",
	"life_plus": ICON_DIR + "life_plus.png",
	"skin_ball": ICON_DIR + "skin_ball.png",
	"theme_paint": ICON_DIR + "theme_paint.png",
	"mat_rubber": ICON_DIR + "mat_rubber.png",
	"mat_metal": ICON_DIR + "mat_metal.png",
	"mat_bouncy": ICON_DIR + "mat_bouncy.png",
}

const MENU_PATHS: Dictionary = {
	"play": ICON_DIR + "menu_play.png",
	"resume": ICON_DIR + "menu_continue.png",
	"custom": ICON_DIR + "menu_custom.png",
	"editor": ICON_DIR + "menu_editor.png",
	"credits": ICON_DIR + "menu_credits.png",
	"shop": ICON_DIR + "menu_shop.png",
	"options": ICON_DIR + "menu_options.png",
	"quit": ICON_DIR + "menu_quit.png",
	"music": ICON_DIR + "menu_music.png",
}

const MENU_BTN_KEYS: Dictionary = {
	"PlayBtn": "play",
	"ContinueBtn": "resume",
	"LoadCustomBtn": "custom",
	"EditorBtn": "editor",
	"CreditsBtn": "credits",
	"ShopBtn": "shop",
	"OptionsBtn": "options",
	"QuitBtn": "quit",
	"MusicBtn": "music",
}

var _textures: Dictionary = {}
var _menu_textures: Dictionary = {}


func _ready() -> void:
	if OS.has_feature("editor"):
		_bake_all_pngs()
	for key: String in PATHS.keys():
		_textures[key] = _load_or_make(key)
	for key: String in MENU_PATHS.keys():
		_menu_textures[key] = _load_menu_or_make(key)


func get_texture(kind: String) -> Texture2D:
	if _textures.has(kind):
		return _textures[kind]
	var tex := _load_or_make(kind)
	_textures[kind] = tex
	return tex


func get_menu_texture(btn_name: String) -> Texture2D:
	var key: String = MENU_BTN_KEYS.get(btn_name, "")
	if key.is_empty():
		return null
	return get_menu_icon(key)


func get_menu_icon(kind: String) -> Texture2D:
	if _menu_textures.has(kind):
		return _menu_textures[kind]
	var tex := _load_menu_or_make(kind)
	_menu_textures[kind] = tex
	return tex


func _load_or_make(kind: String) -> Texture2D:
	var path: String = PATHS.get(kind, "")
	if not path.is_empty() and ResourceLoader.exists(path):
		var loaded: Texture2D = load(path) as Texture2D
		if loaded != null:
			return loaded
	return ImageTexture.create_from_image(_Painter.make_image(kind))


func _load_menu_or_make(kind: String) -> Texture2D:
	var path: String = MENU_PATHS.get(kind, "")
	if not path.is_empty() and ResourceLoader.exists(path):
		var loaded: Texture2D = load(path) as Texture2D
		if loaded != null:
			return loaded
	return ImageTexture.create_from_image(_Painter.make_menu_image(kind))


func _bake_all_pngs() -> void:
	var version_path := ICON_DIR + ".bake_version"
	var stored := ""
	if FileAccess.file_exists(version_path):
		stored = FileAccess.get_file_as_string(version_path).strip_edges()
	var force_all := stored != str(BAKE_VERSION)
	for kind: String in PATHS.keys():
		var res_path: String = PATHS[kind]
		if not force_all and FileAccess.file_exists(res_path):
			continue
		_save_png(res_path, _Painter.make_image(kind))
	for kind: String in MENU_PATHS.keys():
		var res_path: String = MENU_PATHS[kind]
		if not force_all and FileAccess.file_exists(res_path):
			continue
		_save_png(res_path, _Painter.make_menu_image(kind))
	if force_all:
		_save_text(version_path, str(BAKE_VERSION))


func _save_png(res_path: String, img: Image) -> void:
	var abs_path := ProjectSettings.globalize_path(res_path)
	DirAccess.make_dir_recursive_absolute(abs_path.get_base_dir())
	var err := img.save_png(abs_path)
	if err == OK:
		print("[GameIcons] Wrote ", res_path)
	else:
		push_warning("[GameIcons] Could not write %s (error %d)" % [res_path, err])


func _save_text(res_path: String, text: String) -> void:
	var abs_path := ProjectSettings.globalize_path(res_path)
	DirAccess.make_dir_recursive_absolute(abs_path.get_base_dir())
	var f := FileAccess.open(abs_path, FileAccess.WRITE)
	if f:
		f.store_string(text)
