extends RefCounted
class_name EditorUiLayout

# Applies responsive anchors to scene-based editor UI shells.

static func apply(root: LevelEditor) -> void:
	var vp_size: Vector2 = root.get_viewport().get_visible_rect().size
	var m := EditorDefinitions.UI_MARGIN
	var top := EditorDefinitions.UI_TOP_BAR
	var pal_w := EditorDefinitions.UI_PALETTE_WIDTH
	var props_w := EditorDefinitions.UI_PROPS_WIDTH
	var timeline_h := EditorDefinitions.UI_TIMELINE_HEIGHT

	if root.palette_scroll:
		root.palette_scroll.set_anchors_preset(Control.PRESET_TOP_LEFT)
		root.palette_scroll.offset_left = m
		root.palette_scroll.offset_top = top
		root.palette_scroll.offset_right = m + pal_w
		root.palette_scroll.offset_bottom = vp_size.y - timeline_h - m

	if root.props_panel_root:
		root.props_panel_root.set_anchors_preset(Control.PRESET_TOP_RIGHT)
		root.props_panel_root.offset_left = -props_w - m
		root.props_panel_root.offset_top = top
		root.props_panel_root.offset_right = -m
		root.props_panel_root.offset_bottom = minf(top + 380.0, vp_size.y - timeline_h - m)

	if root.seg_timeline_panel:
		root.seg_timeline_panel.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
		root.seg_timeline_panel.offset_left = pal_w + m * 2.0
		root.seg_timeline_panel.offset_right = -(props_w + m * 2.0)
		root.seg_timeline_panel.offset_top = -timeline_h
		root.seg_timeline_panel.offset_bottom = -m

	if root.code_panel:
		root.code_panel.set_anchors_preset(Control.PRESET_CENTER)
		root.code_panel.offset_left = -400.0
		root.code_panel.offset_top = -220.0
		root.code_panel.offset_right = 400.0
		root.code_panel.offset_bottom = 220.0

	if root.mode_buttons_container:
		root.mode_buttons_container.set_anchors_preset(Control.PRESET_CENTER_TOP)
		root.mode_buttons_container.offset_left = -200.0
		root.mode_buttons_container.offset_right = 200.0
		root.mode_buttons_container.offset_top = 50.0
		root.mode_buttons_container.offset_bottom = 82.0
