extends RefCounted
class_name EditorUiStyles

const THEME_PATH := "res://assets/themes/editor_theme.tres"


static func apply_flat_style(style: StyleBoxFlat, bg: Color, border: Color, width: int = 1, radius: int = 4) -> void:
	style.bg_color = bg
	style.border_width_left = width
	style.border_width_top = width
	style.border_width_right = width
	style.border_width_bottom = width
	style.border_color = border
	style.corner_radius_top_left = radius
	style.corner_radius_top_right = radius
	style.corner_radius_bottom_left = radius
	style.corner_radius_bottom_right = radius


func load_theme() -> Theme:
	return load(THEME_PATH) as Theme


func style_tool_button(btn: Button) -> void:
	btn.theme_type_variation = "EditorToolButton"


func set_tool_button_active(btn: Button, active: bool) -> void:
	btn.theme_type_variation = "EditorToolButtonActive" if active else "EditorToolButton"


func style_mode_button(btn: Button) -> void:
	btn.theme_type_variation = "EditorModeButton"


func highlight_mode_button(btn: Button, active: bool) -> void:
	btn.theme_type_variation = "EditorModeActive" if active else "EditorModeButton"
	if active:
		btn.add_theme_color_override("font_color", Color(1.0, 0.92, 0.35, 1.0))
	else:
		btn.remove_theme_color_override("font_color")


func style_cam_button(btn: Button) -> void:
	btn.theme_type_variation = "EditorCamButton"


func style_timeline_button(btn: Button, selected: bool) -> void:
	btn.theme_type_variation = "EditorTimelineButtonActive" if selected else "EditorTimelineButton"
	if selected:
		btn.add_theme_color_override("font_color", Color(1.0, 0.85, 0.2, 1.0))
	else:
		btn.remove_theme_color_override("font_color")
