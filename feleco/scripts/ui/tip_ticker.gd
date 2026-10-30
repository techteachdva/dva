class_name TipTicker
extends PanelContainer

# A slim strip that fades through tips, rules, code facts and trivia.

const HOLD: float = 20.0
const FADE: float = 0.45

var hold: float = HOLD
var start_delay: float = 0.0
var _floor: float = HOLD

var font_size: int = 16
var _label: RichTextLabel
var _order: Array = []
var _timer: float = 0.0

func _ready() -> void:
	_floor = maxf(hold, HOLD)
	process_mode = Node.PROCESS_MODE_ALWAYS
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.09, 0.125, 0.102, 0.82)
	sb.border_color = Color(0.902, 0.765, 0.416, 0.4)
	sb.set_border_width_all(1)
	sb.set_corner_radius_all(16)
	sb.content_margin_left = 18
	sb.content_margin_right = 18
	sb.content_margin_top = 4
	sb.content_margin_bottom = 4
	add_theme_stylebox_override("panel", sb)
	_label = RichTextLabel.new()
	_label.bbcode_enabled = true
	_label.fit_content = true
	_label.scroll_active = false
	_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_label.add_theme_font_size_override("normal_font_size", font_size)
	_label.add_theme_font_size_override("bold_font_size", font_size)
	add_child(_label)
	_order = FelecoChangelog.TIPS.duplicate()
	_order.shuffle()
	_timer = -start_delay
	if start_delay <= 0.0:
		_show_next()
	else:
		_label.modulate.a = 0.0

func _process(delta: float) -> void:
	_timer += delta
	if _label.modulate.a <= 0.01 and _label.text.is_empty() and _timer >= 0.0:
		_show_next()
		_label.modulate.a = 1.0
		_timer = 0.0
	if _timer >= hold:
		_timer = 0.0
		var tw := create_tween()
		tw.tween_property(_label, "modulate:a", 0.0, FADE)
		tw.tween_callback(_show_next)
		tw.tween_property(_label, "modulate:a", 1.0, FADE)

func _show_next() -> void:
	if _order.is_empty():
		_order = FelecoChangelog.TIPS.duplicate()
		_order.shuffle()
	var tip: String = _order.pop_front()
	var cut: int = tip.find(":")
	var body: String = tip.substr(cut + 1).strip_edges()
	var words: int = body.split(" ", false).size()
	# Long rules need more than a fixed glance. Short ones still linger.
	hold = maxf(_floor, float(words) * 0.85 + 6.0)
	var tag: String = tip.substr(0, cut)
	var colors := {"Tip": "#8fd18a", "Rule": "#e6c36a", "Code": "#8ec5ff", "Meta": "#e79bc0"}
	_label.text = "[center][color=%s][b]%s[/b][/color]  %s[/center]" % [colors.get(tag, "#e6c36a"), tag.to_upper(), body]
