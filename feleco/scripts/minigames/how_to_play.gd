class_name HowToPlay
extends RefCounted

# The "How to play" card every campaign game shows the first time it starts
# (and again from its How to play button): the goal in one line, then a few
# numbered steps in plain words.

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")

const GAMES: Dictionary = {
	"golf": ["Seedling Golf", "Grow the strongest plant by finding the spot with the best light, water and soil.", [
		"PUTT: press on the seed, drag BACK (like a slingshot) and let go. The further you pull, the harder the flick.",
		"Land the seed in a dark planting hole. Rocks bounce it, puddles wash it back (+1 stroke), arrows push it.",
		"Not every hole is equal! Turn on Sense Light, Sense Water and Sense Soil to see where each is good. Yellow, blue and brown = good.",
		"WATER: drag back from the cloud to flick raindrops. Drops that stop close to your seedling give it water.",
		"LIGHT: tap the dark leafy blobs to trim the shade over your seedling. You only get a few snips.",
		"Press Grow! Your plant is ranked F to S. The WEAKEST of light, water and soil holds it back, so balance all three.",
	]],
	"brawl": ["Predator Brawl", "Knock out every rival hunter, then beat the golden Dire champion.", [
		"Pick a fighter: Wolf (fast), Mountain Lion (strong) or Falcon (jumps three times).",
		"A / D to move, W to jump, hold S to block. J is a quick punch, K a big punch, L your special move.",
		"Press J J K fast for a FINISHER combo.",
		"Landing hits fills your blue meter. Specials cost a quarter of it.",
		"When the meter turns gold, EVOLVE: tap Down, Forward, Down, Forward, then L. You turn Dire: bigger, golden and much stronger for a while. RAMPAGE!",
		"Win two rounds to beat a rival. Esc pauses.",
	]],
	"race": ["Stampede Sprint", "Win the race by typing fast and carefully.", [
		"Pick a runner. Each one has a different top speed and stride.",
		"Words appear in the middle of the screen. Type them! Every correct letter is a stride forward.",
		"Spaces count too. Letters you've typed turn green.",
		"A wrong key makes you STUMBLE and slows you down. Accuracy beats panic!",
		"The words get longer near the finish: first single words, then whole lines the creatures say.",
		"Finish in the top 3 to unlock the next, faster race.",
	]],
	"dominion": ["Valley Dominion", "Own the most tiles of the valley when winter comes (after 12 turns).", [
		"You are one of four clans. Your tiles have your colour; the number is how many of your clan live there.",
		"To move: click one of YOUR tiles, then click a tile right next to it. Half the clan on your tile moves there.",
		"An empty tile becomes yours. Moving into a RIVAL's tile starts a fight: the bigger group usually wins. Forests and huts help defenders.",
		"You get 3 moves a turn. Then press End turn.",
		"At the end of each turn your clan eats. Tiles grow food (meadows in spring, forests in summer and autumn). Extra food makes more clan; too little and they starve.",
		"Use your clan's special power once a turn (the gold button). Hover a tile to see its food.",
	]],
}

static func seen(node: Node, key: String) -> bool:
	var gc: Node = node.get_node_or_null("/root/GameConfig")
	return gc != null and gc.record("howto", key) != null

# Shows the card over `parent`. Calls `done` when the player closes it.
static func show(parent: Control, key: String, done: Callable = Callable()) -> void:
	var info: Array = GAMES[key]
	var shade := ColorRect.new()
	shade.color = Color(0, 0, 0, 0.6)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	shade.z_index = 50
	parent.add_child(shade)
	var card := PanelContainer.new()
	card.set_anchors_preset(Control.PRESET_CENTER)
	card.grow_horizontal = Control.GROW_DIRECTION_BOTH
	card.grow_vertical = Control.GROW_DIRECTION_BOTH
	card.custom_minimum_size = Vector2(760, 0)
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.06, 0.09, 0.07, 0.98)
	sb.border_color = FelecoUiScript.GOLD
	sb.set_border_width_all(3)
	sb.set_corner_radius_all(18)
	for side in [SIDE_LEFT, SIDE_RIGHT, SIDE_TOP, SIDE_BOTTOM]:
		sb.set_content_margin(side, 26)
	card.add_theme_stylebox_override("panel", sb)
	shade.add_child(card)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 10)
	card.add_child(col)
	col.add_child(FelecoUiScript.heading("How to play: %s" % info[0], 32, FelecoUiScript.GOLD))
	var goal := FelecoUiScript.label("GOAL: " + String(info[1]), 20, Color(0.7, 1.0, 0.6))
	goal.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	col.add_child(goal)
	var n: int = 1
	for step: String in info[2]:
		var l := FelecoUiScript.label("%d.  %s" % [n, step], 18, FelecoUiScript.CREAM)
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		col.add_child(l)
		n += 1
	var go := Button.new()
	go.text = "Got it, let's play!"
	go.theme_type_variation = "PrimaryButton"
	go.custom_minimum_size = Vector2(0, 54)
	go.pressed.connect(func() -> void:
		var gc: Node = parent.get_node_or_null("/root/GameConfig")
		if gc != null:
			gc.set_record("howto", key, true)
		shade.queue_free()
		if done.is_valid():
			done.call())
	col.add_child(go)

# A "How to play" button for a select screen.
static func button(parent: Control, host: Control, key: String) -> Button:
	var b := Button.new()
	b.text = "How to play"
	b.custom_minimum_size = Vector2(200, 48)
	b.pressed.connect(func() -> void: show(host, key))
	parent.add_child(b)
	return b
