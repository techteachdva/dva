class_name GuideTour
extends Control

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")

# A short guided film on the real Food Web page: a cursor clicks the actual
# creature, opens the actual Markov diagram and the Traits page.

signal done

var guide: FieldGuide
var _cursor := Vector2(640, 360)
var _caption: Label
var _stop: bool = false

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	z_index = 80
	_caption = FelecoUiScript.label("", 24, Color.WHITE)
	# Along the bottom: every page keeps its own title at the top.
	_caption.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_caption.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_caption.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_caption.offset_bottom = -14.0
	_caption.add_theme_color_override("font_outline_color", Color.BLACK)
	_caption.add_theme_constant_override("outline_size", 8)
	add_child(_caption)
	var skip := Button.new()
	skip.text = "Skip"
	skip.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	skip.offset_left = -130.0
	skip.offset_top = 12.0
	skip.offset_right = -16.0
	skip.offset_bottom = 54.0
	skip.pressed.connect(_finish)
	add_child(skip)
	_run.call_deferred()

func _process(_delta: float) -> void:
	queue_redraw()

func _draw() -> void:
	var c: Vector2 = _cursor
	draw_colored_polygon(PackedVector2Array([c, c + Vector2(0, 30), c + Vector2(8, 23), c + Vector2(19, 21)]), Color.WHITE)
	draw_polyline(PackedVector2Array([c, c + Vector2(0, 30), c + Vector2(8, 23), c + Vector2(19, 21), c]), Color.BLACK, 2.0, true)

func _say(text: String) -> bool:
	if _stop:
		return false
	_caption.text = text
	await get_tree().create_timer(maxf(2.2, text.split(" ", false).size() * 0.36 + 1.0), true, false, true).timeout
	return not _stop

func _go(to: Vector2) -> void:
	var tw := create_tween().set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN_OUT)
	tw.tween_property(self, "_cursor", to, 0.7)
	await tw.finished

func _run() -> void:
	await get_tree().process_frame
	if not await _say("This is the Food Web: who eats whom in your valley."):
		return
	await _go(guide.screen_spot("wolf"))
	if _stop:
		return
	guide.focus_species("wolf")
	if not await _say("Click a creature for what it eats, what eats it, and when it is about."):
		return
	guide.focus_species("wolf")
	if not await _say("Click it again: this is how it decides. Every state and what moves it."):
		return
	var graph: Node = guide.find_child("MarkovGraph*", true, false)
	if graph == null:
		for c: Node in guide.get_children():
			if c is MarkovGraph:
				graph = c
	if graph != null:
		graph.queue_free()
	guide.focus_species("")
	await _go(guide.mind_button_spot())
	if _stop:
		return
	guide.open_mind_page()
	if not await _say("This button shows how Traits, Memories and Dreams change each creature."):
		return
	await _say("Open a creature's card in the valley, and press Vault to read its dream.")
	guide.close_mind_page()
	await _say("You can come back here any time. The button is on the right.")
	_finish()

func _finish() -> void:
	if _stop:
		return
	_stop = true
	guide.close_mind_page()
	done.emit()
	queue_free()
