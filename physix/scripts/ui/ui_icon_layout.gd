extends RefCounted
class_name UiIconLayout

const ICON_SIZE := Vector2(30, 30)


static func configure_icon_rect(icon: TextureRect, kind: String, size: Vector2 = ICON_SIZE) -> void:
	icon.custom_minimum_size = size
	icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	icon.texture = GameIcons.get_texture(kind)


static func ensure_texture_child(parent: Control, node_name: String, kind: String, size: Vector2 = ICON_SIZE) -> TextureRect:
	var existing := parent.get_node_or_null(node_name)
	if existing is TextureRect:
		configure_icon_rect(existing, kind, size)
		return existing
	if existing != null:
		existing.queue_free()
	var icon := TextureRect.new()
	icon.name = node_name
	icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	configure_icon_rect(icon, kind, size)
	parent.add_child(icon)
	parent.move_child(icon, 0)
	return icon


static func stat_label_with_icon(parent: Control, label: Label, kind: String, text: String) -> void:
	label.text = text
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	var icon := ensure_texture_child(parent, "%sIcon" % kind.capitalize(), kind)
	icon.anchor_left = 0.5
	icon.anchor_right = 0.5
	icon.anchor_top = 0.0
	icon.offset_left = -ICON_SIZE.x * 0.5
	icon.offset_right = ICON_SIZE.x * 0.5
	icon.offset_top = 6.0
	icon.offset_bottom = 6.0 + ICON_SIZE.y
	label.offset_top = ICON_SIZE.y + 4.0
