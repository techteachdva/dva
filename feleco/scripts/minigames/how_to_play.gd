class_name HowToPlay
extends RefCounted

# The "How to play" card every campaign game shows the first time it starts
# (and again from its How to play button): the goal in one line, then a few
# numbered steps in plain words.

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")

const GAMES: Dictionary = {
	"golf": ["Seedling Golf", "Plant your seed, water it, and grow it to the sun.", [
		"PUTT: drag BACK from the seed and let go. Sink it in the cup with the flag.",
		"Hills roll the seed away, bowls pull it in, bumpers bounce it, water costs a stroke.",
		"WATER: hold the mouse (or Space) to rain. Let go in the GREEN band.",
		"GROW: click a glowing cell (or arrow keys) to stretch up, left or right. Reach the SUN before your moves run out. Sunbeams are bonus.",
		"A par putt and perfect watering each give you an extra move. Graded S to F.",
	]],
	"brawl": ["Predator Brawl", "Knock out every rival, then the golden champion.", [
		"A / D move, W jump, hold S block. J light, K heavy, L special.",
		"COMBOS are three keys in a row (D = down, F = toward the rival, B = away). The list is always on the left of the screen.",
		"Try D D K for a low sweep that goes under blocks!",
		"Hits fill your meter. When it turns GOLD, press ENTER to EVOLVE: bigger, golden and stronger.",
		"Win two rounds to beat a rival. Esc pauses.",
	]],
	"race": ["Stampede Sprint", "Type to run. Win the race!", [
		"Type the letters in the box. The gold cursor shows your NEXT key.",
		"Spaces count: when you see the space bar, press SPACE.",
		"Wrong keys make you stumble. Accuracy beats speed!",
		"Top 3 unlocks the next, faster race. Esc pauses.",
	]],
	"sweep": ["Mycelium Sweep", "Grow your mycelium from the centre out to the edge.", [
		"Click a glowing cell next to your mycelium to grow into it.",
		"A number shows how many ROCKS touch that cell: the cells beside it in its ring, the one inward, and the two outward.",
		"Small mushroom dots show corpses nearby. Corpses give Nutrient Points (NP).",
		"Right-click (or Flag mode, F) to mark a rock. Hit 3 rocks and the level fails.",
		"Reach the outer ring to clear the level. Keep digging for NP, then press Finish.",
	]],
	"dominion": ["Valley Dominion", "Have the biggest clan after winter.", [
		"Click one of your glowing tiles, then a YELLOW tile: half your clan moves there. 3 moves a turn, then End turn.",
		"Empty tiles become yours. Moving onto a rival starts a fight: the numbers show who's stronger.",
		"Green bars are food. Your clan eats every turn, so keep it where food is.",
		"Winter comes after 12 turns and almost nothing grows: fill the forests before then.",
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
