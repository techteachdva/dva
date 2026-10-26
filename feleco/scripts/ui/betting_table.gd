class_name BettingTable
extends Control

# Ecosystem Roulette. Every run starts here, and the HUD's Bets button opens
# it again mid-run (live = true) at re-priced odds. Coins come out of the pot
# in the bottom-right corner: drag them onto a box, or pick a chip size and
# tap boxes. Long-press or right-click a box to take its coins back.
# The felt is a strip of pages: two side by side on a desktop, one at a time
# (swipe left and right) on phones and tablets.
# See docs/design/betting_table.md.

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")
const PAGES: Array[String] = ["The Order", "Long shots"]
const CHIPS: Array[int] = [1, 5, 10]
const MAX_PER_BOX: int = 20
# Starters are drawn from these (whichever are switched on for the run).
const ROSTER_SPECIES: Array[String] = ["sheep", "rabbit", "deer", "goat", "wolf", "lion", "falcon", "human", "bear", "boar", "robin", "worm", "beetle"]
const STARTERS: int = 3
const FELT := Color(0.12, 0.27, 0.17, 1)
const FELT_EDGE := Color(0.33, 0.22, 0.12, 1)

signal closed

var live: bool = false
var tracker: BetTracker = null

var _gc: Node
var _offers: Dictionary = {}  # id -> offer
var _pending: Dictionary = {}  # id -> coins
var _history: Array = []  # [id, coins] in the order placed, for Undo
var _boxes: Dictionary = {}  # id -> BetBox
var _chip: int = 1
var _chip_buttons: Array = []
var _compact: bool = false
var _pager: Control
var _strip: HBoxContainer
var _pages: Array[Control] = []
var _page: int = 0
var _per_view: int = 2
var _dots: HBoxContainer
var _page_title: Label
var _pot: CoinPot
var _slip: Label
var _info: Label
var _start: Button
var _toast: Label
var _swipe_from: Vector2 = Vector2.ZERO
var _swipe_base: float = 0.0
var _swipe_down: bool = false
var _swiping: bool = false
var _strip_tween: Tween
# The player's ranking for the Order bets, best first.
var _rank: Array = []
var _rank_rows: VBoxContainer

func _ready() -> void:
	_gc = get_node("/root/GameConfig")
	if live:
		process_mode = Node.PROCESS_MODE_ALWAYS
	set_anchors_preset(Control.PRESET_FULL_RECT)
	if not get_parent() is Control:
		# Over the valley the table hangs off the HUD's CanvasLayer, which has
		# no rect for anchors to fill; size it to the screen by hand.
		_fill_viewport()
		get_viewport().size_changed.connect(_fill_viewport)
	_compact = FelecoUiScript.is_compact(self)
	_per_view = 1
	if not live:
		_ensure_roster()
		# A broke player still gets to play: the house stakes three coins.
		if _gc.eco_points < 3:
			_gc.eco_points = 3
	_build_offers()
	_build_ui()
	if live:
		FelecoUiScript.dress_hud(self)
	else:
		FelecoUiScript.dress_menu(self)
	_refresh()

func _fill_viewport() -> void:
	position = Vector2.ZERO
	size = get_viewport_rect().size

# ------------------------------------------------------------------
# Offers
# ------------------------------------------------------------------
func _ensure_roster() -> void:
	if not _gc.spawn_roster.is_empty():
		return
	# Three starters from three different species that are in the valley,
	# each with rolled stats and the trait that hints at its chances.
	var pool: Array = []
	for sp: String in ROSTER_SPECIES:
		if not _gc.disabled_species.has(sp):
			pool.append(sp)
	pool.shuffle()
	var used: Dictionary = {}
	for i: int in mini(STARTERS, pool.size()):
		var sp: String = pool[i]
		var sex: String = "male" if randf() < 0.5 else "female"
		var nm: String = NameGenerator.generate(sp, sex)
		var tries: int = 0
		while used.has(nm) and tries < 20:
			nm = NameGenerator.generate(sp, sex)
			tries += 1
		used[nm] = true
		_gc.spawn_roster.append(BetBook.roll_starter(sp, sex, nm))

func _start_counts() -> Dictionary:
	return {
		"sheep": _gc.sheep_count, "wolves": _gc.wolf_count, "humans": _gc.human_count,
		"falcons": _gc.falcon_count, "robins": _gc.robin_count, "boars": _gc.boar_count,
		"rabbits": _gc.rabbit_count, "worms": _gc.worm_count, "fish": _gc.fish_count,
		"mushrooms": _gc.spore_count,
	}

# Expected group fill at the start, from the setup counts (see
# SimulationDirector.get_group_scores for the live version).
func _start_scores() -> Dictionary:
	var counts := _start_counts()
	for id: String in SpeciesDB.NEW_SPECIES:
		counts[SpeciesDB.plural(id)] = 0 if _gc.disabled_species.has(id) else int(_gc.extra_counts.get(id, SpeciesDB.row(id).get("start", 0)))
	var out: Dictionary = {}
	var producers: float = float(_gc.grass_density) * 4096.0 * 0.4 / 8.0 + float(_gc.tree_count) * 3.0 + float(_gc.bush_count) * 1.5
	out["producer"] = producers / SimulationDirector.PRODUCER_HOLD
	for g: String in SpeciesDB.GROUPS:
		if g == "producer":
			continue
		var members := SpeciesDB.members(g)
		var total: float = 0.0
		for id: String in members:
			var key := SpeciesDB.plural(id)
			var hold: float = SimulationDirector.MUSHROOM_HOLD if id == "mushroom" else float(SimulationDirector.HOLD_CAPACITY.get(key, 10.0))
			total += float(counts.get(key, 0)) / hold
		out[g] = total / maxf(1.0, float(members.size()))
	return out

func _build_offers() -> void:
	var stats: Dictionary = {}
	var day: float = 0.0
	var scores: Dictionary
	var roster: Array = []
	for r: Dictionary in _gc.spawn_roster:
		if r.get("starter", false):
			roster.append(r.duplicate())
	if live and tracker != null:
		stats = tracker.stats
		day = tracker.director.get_day()
		scores = tracker.director.get_group_scores()
		for r: Dictionary in roster:
			r["age"] = float(stats["named_age"].get("%s|%s" % [r["name"], r["species"]], -1.0))
	else:
		scores = _start_scores()
	if _rank.is_empty():
		_rank = BetBook.default_ranking(BetBook.group_weights(scores))
	var scenario: Dictionary = ChallengeScenarios.featured_bet(_gc.scenario_id) if _gc.current_mode == "challenge" else {}
	var offers := BetBook.catalogue3(scores, roster, float(_gc.time_limit), day, stats, scenario, _rank)
	_scores = scores
	var progress: float = tracker.progress() if (live and tracker != null) else 0.0
	for o: Dictionary in offers:
		if live:
			o["mult"] = BetBook.live_mult(float(o["mult"]), progress)
		_offers[o["id"]] = o

func _offer(id: String) -> Dictionary:
	return _offers.get(id, {})

var _scores: Dictionary = {}

# Move a group up one place in the player's ranking and re-price the Order bets.
func _rank_up(group: String) -> void:
	var i: int = _rank.find(group)
	if i <= 0:
		return
	_rank[i] = _rank[i - 1]
	_rank[i - 1] = group
	var w := BetBook.group_weights(_scores)
	for id: String in ["order:exact", "order:top3"]:
		var o := _offer(id)
		if o.is_empty():
			continue
		var depth: int = int(o["meta"]["depth"])
		o["meta"]["rank"] = _rank.duplicate()
		o["p"] = BetBook.order_p(w, _rank, depth)
		o["mult"] = BetBook.mult_for(float(o["p"]))
		if live and tracker != null:
			# Late bets pay less, re-ranked or not.
			o["mult"] = BetBook.live_mult(float(o["mult"]), tracker.progress())
		o["available"] = float(o["p"]) <= BetBook.MAX_P
		if _boxes.has(id):
			_boxes[id].reprice()
	_fill_rank_rows()

func _fill_rank_rows() -> void:
	if _rank_rows == null:
		return
	for c in _rank_rows.get_children():
		c.queue_free()
	for i: int in _rank.size():
		var g: String = _rank[i]
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 6)
		var num := FelecoUiScript.heading("%d." % (i + 1), 16, FelecoUiScript.GOLD)
		num.custom_minimum_size = Vector2(22, 0)
		row.add_child(num)
		var swatch := ColorRect.new()
		swatch.color = SpeciesDB.GROUP_COLOR[g]
		swatch.custom_minimum_size = Vector2(12, 12)
		swatch.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		row.add_child(swatch)
		var nm := FelecoUiScript.heading(SpeciesDB.GROUP_LABEL[g], 16, FelecoUiScript.CREAM)
		nm.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(nm)
		var up := Button.new()
		up.text = "Up"
		up.theme_type_variation = "GhostButton"
		up.custom_minimum_size = Vector2(56, 40 if _compact else 30)
		up.disabled = i == 0
		up.tooltip_text = "Move %s up one place." % SpeciesDB.GROUP_LABEL[g]
		up.pressed.connect(_rank_up.bind(g))
		row.add_child(up)
		_rank_rows.add_child(row)

# Screen 1: who ends the year fullest, the full order, and the starters.
func _order_section(col: VBoxContainer, compact_cols: int) -> void:
	_sublabel(col, "Fullest at year's end")
	var tops := _grid(col, compact_cols)
	for g: String in SpeciesDB.GROUPS:
		_add_box(tops, "top:" + g, BetBox.MINI if not _compact else BetBox.SMALL, "", Vector2(96, 92) if not _compact else Vector2.ZERO)
	_sublabel(col, "Your order (best first)")
	_rank_rows = VBoxContainer.new()
	_rank_rows.add_theme_constant_override("separation", 2)
	col.add_child(_rank_rows)
	_fill_rank_rows()
	var orders := HBoxContainer.new()
	orders.add_theme_constant_override("separation", 6)
	col.add_child(orders)
	_add_box(orders, "order:top3", BetBox.ZONE, "Top three")
	_add_box(orders, "order:exact", BetBox.ZONE, "Exact order")

func _starter_section(col: VBoxContainer) -> void:
	_sublabel(col, "Starters: still alive on the day shown")
	var flow := HFlowContainer.new()
	flow.add_theme_constant_override("h_separation", 8)
	flow.add_theme_constant_override("v_separation", 8)
	col.add_child(flow)
	var survive_icon: Texture2D = load("res://assets/icons/survive.svg")
	for r: Dictionary in _gc.spawn_roster:
		if not r.get("starter", false):
			continue
		var key: String = "%s|%s" % [r["name"], r["species"]]
		if not _offers.has("survivor:" + key):
			continue
		var card := VBoxContainer.new()
		card.add_theme_constant_override("separation", 2)
		card.custom_minimum_size = Vector2(150 if not _compact else 200, 0)
		var head := HBoxContainer.new()
		head.add_theme_constant_override("separation", 4)
		card.add_child(head)
		var art := TextureRect.new()
		art.texture = _roster_texture(r)
		art.custom_minimum_size = Vector2(40, 40)
		art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		head.add_child(art)
		var names := VBoxContainer.new()
		names.add_theme_constant_override("separation", 0)
		head.add_child(names)
		var nm := FelecoUiScript.heading(String(r["name"]), 15, FelecoUiScript.CREAM)
		names.add_child(nm)
		var trait_info: Dictionary = r.get("trait", {})
		var tr := FelecoUiScript.label("%s %s" % [String(trait_info.get("name", "")), SpeciesDB.one(r["species"])], 13, FelecoUiScript.GOLD)
		tr.tooltip_text = String(trait_info.get("hint", ""))
		tr.mouse_filter = Control.MOUSE_FILTER_STOP
		names.add_child(tr)
		var line: int = int(_offer("survivor:" + key).get("meta", {}).get("by_day", 0))
		_add_box(card, "survivor:" + key, BetBox.ZONE, "Lives to day %d" % line, Vector2.ZERO, survive_icon)
		flow.add_child(card)

# Screen 2: long shots.
func _longshot_section(col: VBoxContainer) -> void:
	var matrix := _grid(col, 3, 4)
	matrix.add_child(Control.new())
	for h: String in ["Loses a species", "Doubles"]:
		var l := FelecoUiScript.heading(h, 13, FelecoUiScript.MIST)
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		l.custom_minimum_size = Vector2(110, 0)
		matrix.add_child(l)
	for g: String in SpeciesDB.GROUPS:
		var nm := FelecoUiScript.heading(SpeciesDB.GROUP_LABEL[g], 15, SpeciesDB.GROUP_COLOR[g].lightened(0.2))
		nm.custom_minimum_size = Vector2(120, 0)
		matrix.add_child(nm)
		_add_box(matrix, "gextinct:" + g, BetBox.CELL, "", Vector2(110, 34 if _compact else 30))
		_add_box(matrix, "gboom:" + g, BetBox.CELL, "", Vector2(110, 34 if _compact else 30))
	_sublabel(col, "Events")
	var ev := _grid(col, 2, 6)
	_add_box(ev, "drought", BetBox.ZONE, "Drought", Vector2.ZERO, load("res://assets/icons/famine.svg") if ResourceLoader.exists("res://assets/icons/famine.svg") else null)
	_add_box(ev, "flood:30", BetBox.ZONE, "Flood: 30+ fish", Vector2.ZERO, FelecoUiScript.species_texture("fish"))
	_add_box(ev, "golden", BetBox.ZONE, "%d golden finds" % BetBook.GOLDEN_LINE)
	_add_box(ev, "goldloop", BetBox.ZONE, "Gold to soil", Vector2.ZERO, FelecoUiScript.species_texture("beetle"))
	var sc := ChallengeScenarios.featured_bet(_gc.scenario_id) if _gc.current_mode == "challenge" else {}
	if not sc.is_empty():
		_sublabel(col, "This year's question")
		_add_box(col, "scenario:" + str(sc["id"]), BetBox.ZONE, str(sc["label"]))

# ------------------------------------------------------------------
# Layout
# ------------------------------------------------------------------
func _build_ui() -> void:
	var bg := ColorRect.new()
	bg.name = "BG"
	bg.color = Color(0.05, 0.07, 0.06, 0.92) if live else FelecoUiScript.INK
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(bg)

	var margin := MarginContainer.new()
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	var pad: Vector4 = _safe_margins()
	margin.add_theme_constant_override("margin_left", int(pad.x))
	margin.add_theme_constant_override("margin_top", int(pad.y))
	margin.add_theme_constant_override("margin_right", int(pad.z))
	margin.add_theme_constant_override("margin_bottom", int(pad.w))
	add_child(margin)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 10)
	margin.add_child(column)

	# Header: back, title, run line.
	var header := HBoxContainer.new()
	column.add_child(header)
	var back := Button.new()
	back.text = "Close" if live else "Back"
	back.icon = load("res://assets/icons/back.svg")
	back.theme_type_variation = "GhostButton"
	back.custom_minimum_size = Vector2(120 if not _compact else 104, 56 if _compact else 48)
	back.pressed.connect(_on_back)
	header.add_child(back)
	var titles := VBoxContainer.new()
	titles.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	titles.add_theme_constant_override("separation", 0)
	header.add_child(titles)
	var title := FelecoUiScript.heading("Ecosystem Roulette" if not live else "Live Bets", 30 if _compact else 34, FelecoUiScript.GOLD)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	titles.add_child(title)
	var sub := FelecoUiScript.label(_run_line(), 16, FelecoUiScript.MIST)
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sub.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	titles.add_child(sub)
	var guide := Button.new()
	guide.text = "How to bet"
	guide.theme_type_variation = "GhostButton"
	guide.custom_minimum_size = back.custom_minimum_size
	guide.pressed.connect(_open_guide)
	header.add_child(guide)

	# The felt: a rounded table edge, wood rail around green baize.
	var felt := PanelContainer.new()
	felt.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var felt_box := StyleBoxFlat.new()
	felt_box.bg_color = FELT
	felt_box.border_color = FELT_EDGE
	felt_box.set_border_width_all(6)
	felt_box.set_corner_radius_all(28)
	felt_box.shadow_color = Color(0, 0, 0, 0.45)
	felt_box.shadow_size = 10
	for side in [SIDE_LEFT, SIDE_RIGHT, SIDE_TOP, SIDE_BOTTOM]:
		felt_box.set_content_margin(side, 12 if _compact else 10)
	felt.add_theme_stylebox_override("panel", felt_box)
	column.add_child(felt)
	if _compact:
		_build_pages(felt)
	else:
		_build_board(felt)

	column.add_child(_build_dock())

	_toast = FelecoUiScript.label("", 18, FelecoUiScript.INK)
	_toast.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var toast_box := StyleBoxFlat.new()
	toast_box.bg_color = FelecoUiScript.GOLD
	toast_box.set_corner_radius_all(14)
	toast_box.content_margin_left = 16
	toast_box.content_margin_right = 16
	toast_box.content_margin_top = 6
	toast_box.content_margin_bottom = 6
	_toast.add_theme_stylebox_override("normal", toast_box)
	_toast.set_anchors_preset(Control.PRESET_CENTER_TOP)
	_toast.position.y = 90
	_toast.modulate.a = 0.0
	_toast.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_toast)

# ------------------------------------------------------------------
# The board: every bet on one screen (desktop, laptop, iPad)
# ------------------------------------------------------------------
# Laid out once at a design size and scaled to fit the felt, so the whole
# table is always visible and keeps its proportions on any screen.
const BOARD_SIZE := Vector2(1250, 540)
const SPECIAL_COLS: Array = [["extinct", "Dies out"], ["boom", "Doubles"], ["phoenix", "Phoenix"], ["lone", "Last one"]]
var _board_holder: Control
var _board: HBoxContainer

func _build_board(felt: Control) -> void:
	_board_holder = Control.new()
	_board_holder.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_board_holder.custom_minimum_size = BOARD_SIZE * 0.5
	felt.add_child(_board_holder)
	_board = HBoxContainer.new()
	_board.add_theme_constant_override("separation", 12)
	_board.size = BOARD_SIZE
	_board_holder.add_child(_board)
	var order := _board_panel("The Order", "Which link of the food web ends the year fullest? Each group is scored by how full it is: every species against what the valley can hold of it. Rank all five for the big payouts. Starters: three named creatures with rolled stats; the trait hints at their chances.", 1.2)
	_order_section(order, 5)
	_starter_section(order)
	_longshot_section(_board_panel("Long shots", "A group loses a species, or a group doubles: these pay the moment they happen. Gold to soil: gold from a golden plant passes all the way to a decomposer.", 1.0))
	_board_holder.resized.connect(_fit_board)
	_fit_board.call_deferred()

func _fit_board() -> void:
	var avail: Vector2 = _board_holder.size
	if avail.x <= 0.0 or avail.y <= 0.0:
		return
	# Never smaller than what the content needs, so nothing is ever clipped.
	var design: Vector2 = BOARD_SIZE.max(_board.get_combined_minimum_size())
	var k: float = minf(avail.x / design.x, avail.y / design.y)
	if OS.is_debug_build() and OS.get_cmdline_user_args().has("--measure"):
		var mins: PackedStringArray = []
		for c: Control in _board.get_children():
			mins.append(str(c.get_combined_minimum_size()))
		print("BOARD min=", _board.get_combined_minimum_size(), " panels=", mins, " avail=", avail, " k=", k)
	_board.size = design
	_board.scale = Vector2(k, k)
	_board.position = ((avail - design * k) * 0.5).floor()

func _board_panel(title: String, hint: String, stretch: float) -> VBoxContainer:
	var panel := PanelContainer.new()
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.size_flags_stretch_ratio = stretch
	var box := StyleBoxFlat.new()
	box.bg_color = Color(0.0, 0.0, 0.0, 0.16)
	box.border_color = Color(0.902, 0.765, 0.416, 0.35)
	box.set_border_width_all(1)
	box.set_corner_radius_all(16)
	box.set_content_margin(SIDE_LEFT, 10)
	box.set_content_margin(SIDE_RIGHT, 10)
	box.set_content_margin(SIDE_TOP, 6)
	box.set_content_margin(SIDE_BOTTOM, 8)
	panel.add_theme_stylebox_override("panel", box)
	_board.add_child(panel)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 6)
	panel.add_child(col)
	var head := HBoxContainer.new()
	col.add_child(head)
	head.add_child(FelecoUiScript.heading(title, 20, FelecoUiScript.GOLD))
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(spacer)
	head.add_child(_help_badge(hint))
	return col

# A small gold "?" that explains a whole section on hover (or tap).
func _help_badge(text: String) -> Control:
	var b := Label.new()
	b.text = "?"
	b.tooltip_text = text
	b.mouse_filter = Control.MOUSE_FILTER_STOP
	b.mouse_default_cursor_shape = Control.CURSOR_HELP
	b.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	b.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	b.custom_minimum_size = Vector2(24, 24)
	b.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	b.add_theme_font_override("font", FelecoUiScript.font("bold"))
	b.add_theme_font_size_override("font_size", 15)
	b.add_theme_color_override("font_color", FelecoUiScript.INK)
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(FelecoUiScript.GOLD.r, FelecoUiScript.GOLD.g, FelecoUiScript.GOLD.b, 0.85)
	sb.set_corner_radius_all(12)
	b.add_theme_stylebox_override("normal", sb)
	return b

func _sublabel(parent: Control, text: String) -> void:
	var l := FelecoUiScript.heading(text, 14, FelecoUiScript.CREAM)
	l.modulate = Color(1, 1, 1, 0.75)
	parent.add_child(l)

func _grid(parent: Control, cols: int, gap: int = 6) -> GridContainer:
	var g := GridContainer.new()
	g.columns = cols
	g.add_theme_constant_override("h_separation", gap)
	g.add_theme_constant_override("v_separation", gap)
	parent.add_child(g)
	return g

func _board_rules(col: VBoxContainer) -> void:
	var factions := _grid(col, 3)
	for f: Array in BetBook.FACTIONS:
		_add_box(factions, "faction:" + f[0], BetBox.MINI, "", Vector2(104, 86))
	_sublabel(col, "Guilds")
	var guilds := _grid(col, 3)
	for g: String in BetBook.GUILDS.keys():
		_add_box(guilds, "guild:" + g, BetBox.MINI, "", Vector2(104, 86))
	_sublabel(col, "Bird duel")
	var duel := _grid(col, 2)
	_add_box(duel, "duel:falcons", BetBox.ZONE, "Falcons win", Vector2(159, 40), FelecoUiScript.species_texture("falcon"))
	_add_box(duel, "duel:robins", BetBox.ZONE, "Robins win", Vector2(159, 40), FelecoUiScript.species_texture("robin"))

func _board_creatures(col: VBoxContainer) -> void:
	var grid := _grid(col, 2, 8)
	grid.add_theme_constant_override("v_separation", 5)
	var survive_icon: Texture2D = load("res://assets/icons/survive.svg")
	var die_icon: Texture2D = load("res://assets/icons/die.svg")
	var elder_icon: Texture2D = load("res://assets/icons/crown.svg")
	for r: Dictionary in _gc.spawn_roster:
		var key: String = "%s|%s" % [r["name"], r["species"]]
		if not _offers.has("survivor:" + key):
			continue
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 6)
		row.custom_minimum_size = Vector2(0, 56)
		row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var art := TextureRect.new()
		art.texture = _roster_texture(r)
		art.custom_minimum_size = Vector2(38, 44)
		art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		art.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		art.tooltip_text = _roster_title(r)
		row.add_child(art)
		var right := VBoxContainer.new()
		right.add_theme_constant_override("separation", 2)
		right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(right)
		var name_row := HBoxContainer.new()
		name_row.add_theme_constant_override("separation", 4)
		right.add_child(name_row)
		var nm := FelecoUiScript.heading(_roster_title(r, true), 14, FelecoUiScript.CREAM)
		nm.clip_text = true
		nm.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		# A clipping label has no width of its own: it must fill the row.
		nm.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		name_row.add_child(_sex_icon(r))
		name_row.add_child(nm)
		var zones := HBoxContainer.new()
		zones.add_theme_constant_override("separation", 4)
		right.add_child(zones)
		_add_box(zones, "survivor:" + key, BetBox.ZONE, "", Vector2(72, 30), survive_icon)
		_add_box(zones, "doomed:" + key, BetBox.ZONE, "", Vector2(72, 30), die_icon)
		if _offers.has("elder:" + key):
			_add_box(zones, "elder:" + key, BetBox.ZONE, "", Vector2(60, 30), elder_icon)
		grid.add_child(row)

# The sprite cell for this creature's kind and sex, as it looks in the valley.
static func _is_female(r: Dictionary) -> bool:
	return bool(r.get("female", false)) or r.get("sex", "") == "female"

static func _roster_texture(r: Dictionary) -> Texture2D:
	return FelecoUiScript.species_texture(r["species"], Roles.role_index(String(r.get("role", ""))), _is_female(r))

static func _roster_title(r: Dictionary, short: bool = false) -> String:
	var kind: String = Roles.display_name(r["species"], String(r.get("role", "")))
	# Sex is shown as an icon beside the name (see _sex_icon): the web build has
	# no font with the male and female signs.
	if short:
		return String(r["name"])
	return "%s, %s %s" % [r["name"], "female" if _is_female(r) else "male", kind.to_lower()]

static func _sex_icon(r: Dictionary, px: float = 14.0) -> TextureRect:
	var t := TextureRect.new()
	var f: bool = _is_female(r)
	t.texture = load("res://assets/icons/female.svg" if f else "res://assets/icons/male.svg")
	t.modulate = Color(1.0, 0.62, 0.78) if f else Color(0.56, 0.77, 1.0)
	t.custom_minimum_size = Vector2(px, px)
	t.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	t.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	t.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	t.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return t

func _board_specials(col: VBoxContainer) -> void:
	_sublabel(col, "Flood Toll")
	var flood := _grid(col, 5, 5)
	for line: int in BetBook.FLOOD_LINES:
		_add_box(flood, "flood:%d" % line, BetBox.MINI, "%d+" % line, Vector2(62, 62))
	_add_box(flood, "floodfeast", BetBox.MINI, "Feast", Vector2(62, 62))
	# The roulette grid: a row per species, a column per special.
	var matrix := _grid(col, 1 + SPECIAL_COLS.size(), 4)
	matrix.add_theme_constant_override("v_separation", 3)
	matrix.add_child(Control.new())
	for c: Array in SPECIAL_COLS:
		var h := FelecoUiScript.heading(c[1], 13, FelecoUiScript.MIST)
		h.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		h.custom_minimum_size = Vector2(70, 0)
		matrix.add_child(h)
	for f: Array in BetBook.FACTIONS:
		var art := TextureRect.new()
		art.texture = FelecoUiScript.species_texture(f[1])
		art.custom_minimum_size = Vector2(34, 30)
		art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		art.tooltip_text = f[2]
		matrix.add_child(art)
		for c: Array in SPECIAL_COLS:
			var id: String = "%s:%s" % [c[0], f[0]]
			if _offers.has(id):
				_add_box(matrix, id, BetBox.CELL, "", Vector2(70, 30))
			else:
				matrix.add_child(Control.new())
	var shots := HBoxContainer.new()
	shots.add_theme_constant_override("separation", 6)
	col.add_child(shots)
	var upset := _offer("upset")
	_add_box(shots, "upset", BetBox.ZONE, "Upset", Vector2(0, 34), FelecoUiScript.species_texture(String(upset.get("sprite", "sheep"))))
	_add_box(shots, "wipeout", BetBox.ZONE, "Total wipeout", Vector2(0, 34), load("res://assets/icons/meteor.svg"))

# Phones held upright: the felt is a strip of pages you swipe through.
func _build_pages(felt: Control) -> void:
	var felt_col := VBoxContainer.new()
	felt_col.add_theme_constant_override("separation", 6)
	felt.add_child(felt_col)
	var nav := HBoxContainer.new()
	nav.alignment = BoxContainer.ALIGNMENT_CENTER
	felt_col.add_child(nav)
	nav.add_child(_nav_button("‹", -1))
	_page_title = FelecoUiScript.heading("", 22, FelecoUiScript.CREAM)
	_page_title.custom_minimum_size.x = 220
	_page_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	nav.add_child(_page_title)
	_dots = HBoxContainer.new()
	_dots.add_theme_constant_override("separation", 6)
	nav.add_child(_dots)
	nav.add_child(_nav_button("›", 1))
	_pager = Control.new()
	_pager.clip_contents = true
	_pager.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_pager.mouse_filter = Control.MOUSE_FILTER_PASS
	felt_col.add_child(_pager)
	_strip = HBoxContainer.new()
	_strip.add_theme_constant_override("separation", 0)
	_pager.add_child(_strip)
	var p1 := VBoxContainer.new()
	_order_section(p1, 3)
	_starter_section(p1)
	_add_page(p1)
	var p2 := VBoxContainer.new()
	_longshot_section(p2)
	_add_page(p2)
	for i: int in PAGES.size():
		var dot := ColorRect.new()
		dot.custom_minimum_size = Vector2(10, 10)
		dot.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		_dots.add_child(dot)
	_pager.resized.connect(_layout_pages)
	_layout_pages.call_deferred()

func _safe_margins() -> Vector4:
	var base: float = 14.0 if _compact else 28.0
	var pad := Vector4(base, 12.0, base, 12.0)
	# Notches and home bars: keep everything inside the display's safe area.
	if OS.has_feature("mobile"):
		var screen: Vector2i = DisplayServer.screen_get_size()
		var safe: Rect2i = DisplayServer.get_display_safe_area()
		var vp: Vector2 = get_viewport_rect().size
		if screen.x > 0 and screen.y > 0:
			var k := Vector2(vp.x / screen.x, vp.y / screen.y)
			pad.x = maxf(pad.x, safe.position.x * k.x)
			pad.y = maxf(pad.y, safe.position.y * k.y)
			pad.z = maxf(pad.z, (screen.x - safe.end.x) * k.x)
			pad.w = maxf(pad.w, (screen.y - safe.end.y) * k.y)
	return pad

func _run_line() -> String:
	var mode: String = String(_gc.current_mode).capitalize()
	var days: int = int(_gc.time_limit)
	var line := "%s  ·  %d days  ·  table limit %d EP" % [mode, days, BetBook.table_limit(_gc)]
	if live and tracker != null:
		line = "Day %d of %d  ·  late bets pay less  ·  decided bets are locked" % [int(tracker.director.get_day()), days]
	return line

func _nav_button(text: String, dir: int) -> Button:
	var b := Button.new()
	b.text = text
	b.theme_type_variation = "GhostButton"
	b.custom_minimum_size = Vector2(64 if _compact else 52, 52 if _compact else 40)
	b.add_theme_font_size_override("font_size", 28)
	b.pressed.connect(func() -> void: _go_page(_page + dir))
	return b

func _add_page(content: Control) -> void:
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var pad := MarginContainer.new()
	pad.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	for side: String in ["left", "right"]:
		pad.add_theme_constant_override("margin_" + side, 8)
	pad.add_child(content)
	content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(pad)
	_strip.add_child(scroll)
	_pages.append(scroll)

func _section(parent: Control, title: String, hint: String = "") -> HFlowContainer:
	var head := FelecoUiScript.heading(title, 20, FelecoUiScript.GOLD)
	parent.add_child(head)
	if not hint.is_empty():
		var h := FelecoUiScript.label(hint, 15, FelecoUiScript.MIST)
		h.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		parent.add_child(h)
	var flow := HFlowContainer.new()
	flow.add_theme_constant_override("h_separation", 12 if _compact else 10)
	flow.add_theme_constant_override("v_separation", 12 if _compact else 10)
	parent.add_child(flow)
	return flow

func _page_rules() -> Control:
	var col := VBoxContainer.new()
	var factions := _section(col, "Largest population at the end", "Straight up: pick the species with the most living members when the run ends.")
	for f: Array in BetBook.FACTIONS:
		_add_box(factions, "faction:" + f[0], BetBox.LARGE)
	var guilds := _section(col, "Guilds", "Grazers: sheep, rabbits, boars. Predators: wolves, humans, falcons. Decomposers: worms and mushrooms. Robins and fish are the house zero.")
	for g: String in BetBook.GUILDS.keys():
		_add_box(guilds, "guild:" + g, BetBox.LARGE)
	var duel := _section(col, "Bird duel", "More falcons or more robins at the end? A tie goes to the house.")
	_add_box(duel, "duel:falcons", BetBox.LARGE)
	_add_box(duel, "duel:robins", BetBox.LARGE)
	return col

func _page_creatures() -> Control:
	var col := VBoxContainer.new()
	var flow := _section(col, "Named creatures", "The single numbers. Lives pays if it is alive at the end; Dies early pays the moment it falls in the first half.")
	for r: Dictionary in _gc.spawn_roster:
		var key: String = "%s|%s" % [r["name"], r["species"]]
		if not _offers.has("survivor:" + key):
			continue
		var card := PanelContainer.new()
		card.custom_minimum_size = Vector2(176 if _compact else 156, 0)
		var inner := VBoxContainer.new()
		inner.add_theme_constant_override("separation", 4)
		card.add_child(inner)
		var art := TextureRect.new()
		art.texture = _roster_texture(r)
		art.custom_minimum_size = Vector2(0, 72 if _compact else 60)
		art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		art.mouse_filter = Control.MOUSE_FILTER_IGNORE
		inner.add_child(art)
		var nm := FelecoUiScript.heading(_roster_title(r), 15, FelecoUiScript.CREAM)
		nm.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		nm.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		inner.add_child(nm)
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 6)
		inner.add_child(row)
		_add_box(row, "survivor:" + key, BetBox.ZONE, "Lives")
		_add_box(row, "doomed:" + key, BetBox.ZONE, "Dies early")
		if _offers.has("elder:" + key):
			_add_box(inner, "elder:" + key, BetBox.ZONE, "Elder")
		flow.add_child(card)
	return col

func _page_fish() -> Control:
	var col := VBoxContainer.new()
	var toll: int = int(tracker.stats.get("flood_toll", 0)) if tracker != null else 0
	var flow := _section(col, "The Flood Toll", "How many fish die on dry land after the floods recede? The count runs all game and each box pays the moment its line is crossed. Spring melt floods the river on its own; your Flood power helps.%s" % ("" if not live else "  Toll so far: %d." % toll))
	for line: int in BetBook.FLOOD_LINES:
		_add_box(flow, "flood:%d" % line, BetBox.LARGE)
	var fish := _section(col, "Fish specials")
	for id: String in ["faction:fish", "extinct:fish", "boom:fish", "lone:fish"]:
		_add_box(fish, id, BetBox.LARGE)
	var feast := _section(col, "Parlay")
	_add_box(feast, "floodfeast", BetBox.LARGE)
	return col

func _page_specials() -> Control:
	var col := VBoxContainer.new()
	var props := _section(col, "Long shots", "Upset: the smallest starting species ends the biggest. Total wipeout: three species gone at once.")
	_add_box(props, "upset", BetBox.LARGE)
	_add_box(props, "wipeout", BetBox.LARGE)
	for kind: Array in [["extinct", "Dies out", "Pays the moment the last one falls."], ["boom", "Doubles", "Pays the moment it reaches twice its starting number."], ["phoenix", "Phoenix", "Dies out, then climbs back to its starting number."], ["lone", "Last one standing", "The run ends with exactly one alive."]]:
		var flow := _section(col, kind[1], kind[2])
		for f: Array in BetBook.FACTIONS:
			if f[0] == "fish":
				continue
			_add_box(flow, "%s:%s" % [kind[0], f[0]], BetBox.SMALL)
	return col

func _add_box(parent: Control, id: String, size_kind: int, caption: String = "", min_size: Vector2 = Vector2.ZERO, icon: Texture2D = null) -> void:
	var offer := _offer(id)
	if offer.is_empty():
		return
	var box := BetBox.new()
	box.table = self
	box.offer = offer
	box.size_kind = size_kind
	box.caption = caption
	box.compact = _compact
	box.min_size = min_size
	box.icon = icon
	parent.add_child(box)
	_boxes[id] = box

func _build_dock() -> Control:
	var dock := PanelContainer.new()
	var row: BoxContainer = VBoxContainer.new() if _compact else HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	dock.add_child(row)

	var dock_box := StyleBoxFlat.new()
	dock_box.bg_color = Color(0.07, 0.09, 0.08, 0.96)
	dock_box.border_color = Color(FelecoUiScript.GOLD.r, FelecoUiScript.GOLD.g, FelecoUiScript.GOLD.b, 0.3)
	dock_box.set_border_width_all(1)
	dock_box.set_corner_radius_all(18)
	dock_box.set_content_margin(SIDE_LEFT, 16)
	dock_box.set_content_margin(SIDE_RIGHT, 10)
	dock_box.set_content_margin(SIDE_TOP, 6)
	dock_box.set_content_margin(SIDE_BOTTOM, 6)
	dock.add_theme_stylebox_override("panel", dock_box)

	# The slip: what is on the felt, and the details of whatever is under the cursor.
	var slip_col := VBoxContainer.new()
	slip_col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	slip_col.alignment = BoxContainer.ALIGNMENT_CENTER
	slip_col.add_theme_constant_override("separation", 0)
	row.add_child(slip_col)
	_slip = FelecoUiScript.label("", 17, FelecoUiScript.GOLD)
	_slip.add_theme_font_override("font", FelecoUiScript.font("bold"))
	_slip.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	slip_col.add_child(_slip)
	_info = FelecoUiScript.label("", 14, FelecoUiScript.MIST)
	_info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_info.custom_minimum_size = Vector2(0, 40)
	_info.max_lines_visible = 2
	slip_col.add_child(_info)
	var tools := HBoxContainer.new()
	tools.add_theme_constant_override("separation", 6)
	tools.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_child(tools)
	for spec: Array in [["Undo", _undo], ["Clear", _clear], ["Repeat", _repeat]]:
		if live and spec[0] == "Repeat":
			continue
		var b := Button.new()
		b.text = spec[0]
		b.theme_type_variation = "GhostButton"
		b.custom_minimum_size = Vector2(0 if _compact else 84, 56 if _compact else 44)
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL if _compact else Control.SIZE_FILL
		b.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		b.add_theme_font_size_override("font_size", 16)
		b.pressed.connect(spec[1])
		tools.add_child(b)

	var action := HBoxContainer.new()
	action.add_theme_constant_override("separation", 10)
	action.alignment = BoxContainer.ALIGNMENT_END
	row.add_child(action)
	var chips := HBoxContainer.new()
	chips.add_theme_constant_override("separation", 6)
	action.add_child(chips)
	for v: int in CHIPS:
		var chip := ChipButton.new()
		chip.table = self
		chip.value = v
		chip.custom_minimum_size = Vector2(60, 60) if _compact else Vector2(50, 50)
		chip.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		chips.add_child(chip)
		_chip_buttons.append(chip)
	_start = Button.new()
	_start.theme_type_variation = "PrimaryButton"
	_start.custom_minimum_size = Vector2(190 if not _compact else 0, 64 if _compact else 56)
	_start.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_start.size_flags_horizontal = Control.SIZE_EXPAND_FILL if _compact else Control.SIZE_FILL
	_start.add_theme_font_size_override("font_size", 22)
	_start.add_theme_font_override("font", FelecoUiScript.font("heading"))
	_start.pressed.connect(_on_start)
	action.add_child(_start)
	# The pot sits bottom-right, under the right thumb.
	_pot = CoinPot.new()
	_pot.table = self
	_pot.custom_minimum_size = Vector2(112, 88) if _compact else Vector2(112, 70)
	action.add_child(_pot)
	return dock

# ------------------------------------------------------------------
# Pages and swiping
# ------------------------------------------------------------------
func _max_page() -> int:
	return maxi(0, _pages.size() - _per_view)

func _page_width() -> float:
	return _pager.size.x / float(_per_view)

func _layout_pages() -> void:
	if _pager == null:
		return
	var w: float = _page_width()
	for p: Control in _pages:
		p.custom_minimum_size = Vector2(w, _pager.size.y)
	_strip.size = Vector2(w * _pages.size(), _pager.size.y)
	_strip.position.x = -_page * w
	_update_nav()

func _go_page(i: int) -> void:
	_page = clampi(i, 0, _max_page())
	if _strip_tween != null:
		_strip_tween.kill()
	_strip_tween = create_tween().set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	_strip_tween.tween_property(_strip, "position:x", -_page * _page_width(), 0.25)
	_update_nav()

func _update_nav() -> void:
	var names: Array[String] = []
	for i: int in _per_view:
		if _page + i < PAGES.size():
			names.append(PAGES[_page + i])
	_page_title.text = "  ·  ".join(names)
	for i: int in _dots.get_child_count():
		var on: bool = i >= _page and i < _page + _per_view
		(_dots.get_child(i) as ColorRect).color = FelecoUiScript.GOLD if on else Color(1, 1, 1, 0.25)

# A horizontal drag anywhere on the felt pages the table; a tap still
# reaches the box under the finger.
func _input(event: InputEvent) -> void:
	if not is_visible_in_tree() or _pager == null:
		return
	if event is InputEventMouseButton and (event as InputEventMouseButton).button_index == MOUSE_BUTTON_LEFT:
		var mb := event as InputEventMouseButton
		if mb.pressed:
			if _pager.get_global_rect().has_point(mb.position) and get_viewport().gui_get_drag_data() == null:
				_swipe_down = true
				_swiping = false
				_swipe_from = mb.position
				_swipe_base = _strip.position.x
		elif _swipe_down:
			_swipe_down = false
			if _swiping:
				_swiping = false
				var dx: float = mb.position.x - _swipe_from.x
				var step: int = 0
				if absf(dx) > _page_width() * 0.18:
					step = -1 if dx > 0.0 else 1
				_go_page(_page + step)
				for box: BetBox in _boxes.values():
					box.cancel_press()
				get_viewport().set_input_as_handled()
	elif event is InputEventMouseMotion and _swipe_down:
		var mm := event as InputEventMouseMotion
		var d: Vector2 = mm.position - _swipe_from
		if not _swiping and absf(d.x) > 22.0 and absf(d.x) > absf(d.y) * 1.3:
			_swiping = true
			if _strip_tween != null:
				_strip_tween.kill()
		if _swiping:
			var lo: float = -_max_page() * _page_width()
			var x: float = _swipe_base + d.x
			# Rubber-band past the first and last page.
			if x > 0.0:
				x *= 0.35
			elif x < lo:
				x = lo + (x - lo) * 0.35
			_strip.position.x = x
			get_viewport().set_input_as_handled()
	elif event is InputEventKey and (event as InputEventKey).pressed and not (event as InputEventKey).echo:
		match (event as InputEventKey).keycode:
			KEY_LEFT: _go_page(_page - 1)
			KEY_RIGHT: _go_page(_page + 1)
			KEY_ESCAPE: _on_back()

func is_swiping() -> bool:
	return _swiping

# ------------------------------------------------------------------
# Coins
# ------------------------------------------------------------------
func pending_total() -> int:
	var t: int = 0
	for v in _pending.values():
		t += int(v)
	return t

func coins_free() -> int:
	var limit_left: int = BetBook.table_limit(_gc) - (_gc.staked_total() if live else 0) - pending_total()
	return maxi(0, mini(int(_gc.eco_points) - pending_total(), limit_left))

func chip() -> int:
	return _chip

func set_chip(v: int) -> void:
	_chip = v
	for c in _chip_buttons:
		c.queue_redraw()

# Coins a drag from the pot or a chip carries.
func take_for_drag(v: int) -> int:
	return mini(v, coins_free())

func coins_on(id: String) -> int:
	return int(_pending.get(id, 0))

func add_coins(box: BetBox, n: int = -1) -> void:
	if n < 0:
		n = _chip
	var id: String = box.offer["id"]
	if not box.offer.get("available", true):
		_flash(String(box.offer.get("reason", "That bet is closed.")))
		return
	n = mini(n, mini(coins_free(), MAX_PER_BOX - coins_on(id)))
	if n <= 0:
		if coins_on(id) >= MAX_PER_BOX:
			_flash("That box is full (%d coins)." % MAX_PER_BOX)
		elif int(_gc.eco_points) - pending_total() <= 0:
			_flash("The pot is empty.")
		else:
			_flash("Table limit reached.")
		return
	_pending[id] = coins_on(id) + n
	_history.append([id, n])
	box.bump()
	_refresh()

func remove_coins(box: BetBox, all: bool) -> void:
	var id: String = box.offer["id"]
	var have: int = coins_on(id)
	if have <= 0:
		return
	var n: int = have if all else 1
	_pending[id] = have - n
	if _pending[id] <= 0:
		_pending.erase(id)
	_history.append([id, -n])
	_refresh()

func _undo() -> void:
	if _history.is_empty():
		return
	var last: Array = _history.pop_back()
	var id: String = last[0]
	var v: int = coins_on(id) - int(last[1])
	if v <= 0:
		_pending.erase(id)
	else:
		_pending[id] = v
	_refresh()

func _clear() -> void:
	_pending.clear()
	_history.clear()
	_refresh()

func _repeat() -> void:
	for b: Dictionary in _gc.last_bets:
		var id: String = b.get("id", "")
		if _boxes.has(id):
			add_coins(_boxes[id], int(b.get("coins", 0)))

func _refresh() -> void:
	for id: String in _boxes.keys():
		_boxes[id].set_coins(coins_on(id))
	var n: int = _pending.size()
	var stake: int = pending_total()
	var best: float = 0.0
	for id: String in _pending.keys():
		best += float(_pending[id]) * float(_offer(id).get("mult", 1.0))
	if n == 0:
		_slip.text = "No bets yet  ·  %d EP in the pot" % coins_free()
	else:
		_slip.text = "%d bet%s  ·  %d EP on the felt  ·  best case +%d EP  ·  odds lock when placed" % [n, "" if n == 1 else "s", stake, int(round(best))]
	show_info(null)
	if live:
		_start.text = "Place bets" if n > 0 else "Back to the valley"
	else:
		_start.text = "Start run" if n > 0 else "Watch only"
	if _pot != null:
		_pot.queue_redraw()

# The dock's second line explains whatever box is under the cursor; with
# nothing hovered it says how to play.
func show_info(box: BetBox) -> void:
	if _info == null:
		return
	if box != null:
		var line: String = "%s:  %s" % [box._title(), box.details().replace("\n", "  ·  ")]
		if box.coins > 0:
			line += "  ·  %d on it, pays %d" % [box.coins, int(round(box.coins * float(box.offer["mult"])))]
		_info.text = line
		_info.add_theme_color_override("font_color", FelecoUiScript.CREAM)
		return
	_info.add_theme_color_override("font_color", FelecoUiScript.MIST)
	if _compact:
		_info.text = "Drag coins onto a box, or tap a box. Swipe for more."
	else:
		_info.text = "Drag coins from the pot onto any box. Hover a box to see what it pays."

func _flash(text: String) -> void:
	_toast.text = text
	_toast.reset_size()
	_toast.position.x = (size.x - _toast.size.x) * 0.5
	var tw := create_tween()
	_toast.modulate.a = 1.0
	tw.tween_interval(1.4)
	tw.tween_property(_toast, "modulate:a", 0.0, 0.4)

# ------------------------------------------------------------------
# Commit
# ------------------------------------------------------------------
func _commit() -> void:
	for id: String in _pending.keys():
		_gc.place_bet(_offer(id), int(_pending[id]))
	_gc.save_meta()

func _on_start() -> void:
	_commit()
	if live:
		_close()
		return
	_gc.last_bets.clear()
	for id: String in _pending.keys():
		_gc.last_bets.append({"id": id, "coins": _pending[id]})
	# The champion (gold rim, kin powers) follows the biggest faction stake.
	if _gc.current_mode == "sandbox":
		var top: String = ""
		var top_n: int = 0
		for id: String in _pending.keys():
			if id.begins_with("faction:") and int(_pending[id]) > top_n:
				top_n = int(_pending[id])
				top = id.substr(8)
		if not top.is_empty():
			_gc.player_bet = BetBook.label_of(top)
	_gc.side_bet_entity = {}
	for b: Dictionary in _gc.bets:
		if b["type"] in ["survivor", "doomed", "starter"]:
			_gc.side_bet_entity = {"name": b["meta"]["name"], "species": b["meta"]["species"], "bet_type": "die" if b["type"] == "doomed" else "survive"}
			break
	if _gc.current_mode == "sandbox":
		# Campaign and challenge setups already applied them.
		_gc.apply_upgrades()
	_gc.save_meta()
	get_tree().change_scene_to_file("res://scenes/world.tscn")

func _on_back() -> void:
	if live:
		_close()
		return
	match String(_gc.current_mode):
		"campaign": get_tree().change_scene_to_file("res://scenes/ui/campaign_setup.tscn")
		"challenge": get_tree().change_scene_to_file("res://scenes/ui/challenge_setup.tscn")
		_: get_tree().change_scene_to_file("res://scenes/ui/setup_board.tscn")

func _close() -> void:
	closed.emit()
	queue_free()

# ------------------------------------------------------------------
# The guide: every bet in a sentence (the mobile stand-in for hover cards)
# ------------------------------------------------------------------
const GUIDE: Array = [
	["coin", "How to play", "Drag coins from the pot onto a box, or pick a chip and tap boxes. Right-click or long-press a box to take coins back. A win pays your coins times the box's odds."],
	["deer", "The Order", "Producers, Herbivores, Omnivores, Carnivores, Decomposers: which ends the year fullest? Each group is scored by how full it is, every species against what the valley can hold."],
	["lion", "Your order", "Rank all five with the Up buttons, then bet on the top three or the exact order. The odds change as you rearrange."],
	["survive", "Starters", "Three named creatures with rolled health, speed and appetite. The trait hints at their chances. Lives: still alive at year's end."],
	["die", "Loses a species", "Any species in that group dies out. Pays at once."],
	["survive", "Doubles", "The group gets twice as full as it started. Pays at once."],
	["fish", "Events", "A drought strikes, 30 fish die stranded after floods, ten golden finds, or gold passing from a golden plant all the way to a decomposer."],
	["beetle", "This year's question", "In Challenge mode, each scenario asks its own question."],
	["coin", "Live bets", "During a run, the Bets button pauses the valley and reopens this table at today's odds. Late bets pay less, and decided bets are locked."],
]

func _open_guide() -> void:
	var shade := ColorRect.new()
	shade.color = Color(0, 0, 0, 0.6)
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	shade.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(shade)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	shade.add_child(center)
	var panel := PanelContainer.new()
	var vp: Vector2 = get_viewport_rect().size
	panel.custom_minimum_size = Vector2(minf(vp.x - 32.0, 860.0), minf(vp.y - 48.0, 640.0))
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.08, 0.11, 0.09, 0.98)
	sb.border_color = FelecoUiScript.GOLD
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(22)
	for side in [SIDE_LEFT, SIDE_RIGHT, SIDE_TOP, SIDE_BOTTOM]:
		sb.set_content_margin(side, 18)
	panel.add_theme_stylebox_override("panel", sb)
	center.add_child(panel)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 10)
	panel.add_child(col)
	var head := HBoxContainer.new()
	col.add_child(head)
	var t := FelecoUiScript.heading("How to bet", 28, FelecoUiScript.GOLD)
	t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(t)
	var done := Button.new()
	done.text = "Got it"
	done.theme_type_variation = "PrimaryButton"
	done.custom_minimum_size = Vector2(120, 52)
	done.pressed.connect(shade.queue_free)
	head.add_child(done)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	col.add_child(scroll)
	var list := GridContainer.new()
	list.columns = 1 if _compact else 2
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	list.add_theme_constant_override("h_separation", 22)
	list.add_theme_constant_override("v_separation", 12)
	scroll.add_child(list)
	for g: Array in GUIDE:
		var row := HBoxContainer.new()
		row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_theme_constant_override("separation", 10)
		var art := TextureRect.new()
		var key: String = g[0]
		if key == "coin":
			art = TextureRect.new()
			art.texture = _coin_texture()
		elif SpriteGenerator.SPECIES.has(key):
			art.texture = FelecoUiScript.species_texture(key)
		else:
			art.texture = load("res://assets/icons/%s.svg" % key)
		art.custom_minimum_size = Vector2(44, 40)
		art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		art.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
		row.add_child(art)
		var text := VBoxContainer.new()
		text.add_theme_constant_override("separation", 0)
		text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(text)
		text.add_child(FelecoUiScript.heading(g[1], 18, FelecoUiScript.CREAM))
		var body := FelecoUiScript.label(g[2], 15, FelecoUiScript.MIST)
		body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		body.custom_minimum_size.x = 300 if not _compact else 0
		text.add_child(body)
		list.add_child(row)
	if live:
		FelecoUiScript.dress_hud(shade)

static var _coin_tex: Texture2D

static func _coin_texture() -> Texture2D:
	if _coin_tex == null:
		var img := Image.create(64, 64, false, Image.FORMAT_RGBA8)
		for y: int in 64:
			for x: int in 64:
				var d: float = Vector2(x - 31.5, y - 31.5).length()
				var c := Color(0, 0, 0, 0)
				if d < 30.0:
					c = FelecoUiScript.GOLD_DEEP
				if d < 25.0:
					c = FelecoUiScript.GOLD
				if absf(d - 18.0) < 1.6:
					c = Color(0.75, 0.58, 0.22)
				img.set_pixel(x, y, c)
		_coin_tex = ImageTexture.create_from_image(img)
	return _coin_tex

# ------------------------------------------------------------------
# The nudge: until the first coin lands, a ghost coin keeps arcing from the
# pot onto the felt, showing what to do without a word.
# ------------------------------------------------------------------
var _hint: Control
var _hint_t: float = -1.5
var _hint_target: Vector2 = Vector2.ZERO
var _hint_done: bool = false

func _process(delta: float) -> void:
	if _hint == null:
		_hint = Control.new()
		_hint.set_anchors_preset(Control.PRESET_FULL_RECT)
		_hint.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_hint.draw.connect(_draw_hint)
		add_child(_hint)
	if _hint_done or not _pending.is_empty() or not _gc.bets.is_empty() and not live:
		_hint_done = _hint_done or not _pending.is_empty()
		if _hint.visible:
			_hint.visible = false
		return
	_hint.visible = true
	_hint_t += delta
	if _hint_t > 2.6:
		_hint_t = 0.0
		var picks: Array = _boxes.values().filter(func(b: BetBox) -> bool: return b.is_visible_in_tree() and b.offer.get("available", true) and b.size_kind != BetBox.CELL)
		if not picks.is_empty():
			var b: BetBox = picks[randi() % picks.size()]
			_hint_target = b.get_global_rect().get_center()
	_hint.queue_redraw()

func _draw_hint() -> void:
	if _pot == null or _hint_t < 0.0 or _hint_t > 1.4 or _hint_target == Vector2.ZERO:
		return
	var a: Vector2 = _pot.get_global_rect().get_center() - _hint.get_global_rect().position
	var b: Vector2 = _hint_target - _hint.get_global_rect().position
	var t: float = clampf(_hint_t / 1.1, 0.0, 1.0)
	var e: float = t * t * (3.0 - 2.0 * t)
	var lift: float = -120.0 * sin(e * PI)
	var p: Vector2 = a.lerp(b, e) + Vector2(0, lift)
	var alpha: float = clampf(1.4 - _hint_t, 0.0, 1.0) * 0.85
	_hint.modulate.a = alpha
	# A dotted trail, then the coin itself with a little hand-like pointer.
	for i: int in 6:
		var tt: float = maxf(0.0, e - float(i + 1) * 0.06)
		var q: Vector2 = a.lerp(b, tt) + Vector2(0, -120.0 * sin(tt * PI))
		_hint.draw_circle(q, 3.0, Color(1.0, 0.86, 0.45, 0.5 - i * 0.07))
	BettingTable.draw_coin(_hint, p, 15.0, 1.0)

# ------------------------------------------------------------------
# Pieces
# ------------------------------------------------------------------
static func draw_coin(ci: CanvasItem, c: Vector2, r: float, glow: float = 0.0) -> void:
	if glow > 0.0:
		ci.draw_circle(c, r * 1.55, Color(1.0, 0.85, 0.4, 0.12 * glow))
		ci.draw_circle(c, r * 1.25, Color(1.0, 0.85, 0.4, 0.22 * glow))
	ci.draw_circle(c + Vector2(0, r * 0.18), r, Color(0.38, 0.27, 0.08))
	ci.draw_circle(c, r, FelecoUiScript.GOLD_DEEP)
	ci.draw_circle(c, r * 0.84, FelecoUiScript.GOLD)
	ci.draw_arc(c, r * 0.62, 0.0, TAU, 20, Color(0.75, 0.58, 0.22), maxf(1.0, r * 0.1), true)
	ci.draw_circle(c + Vector2(-r * 0.3, -r * 0.32), r * 0.22, Color(1.0, 0.97, 0.8, 0.85))

class CoinPot extends Control:
	var table: BettingTable

	func _ready() -> void:
		mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
		tooltip_text = "Your Eco Points. Drag coins out, or tap to switch chip size."

	func _process(_delta: float) -> void:
		queue_redraw()

	func _draw() -> void:
		var free: int = table.coins_free()
		var w: float = size.x
		var h: float = size.y
		var glow: float = 0.6 + 0.4 * sin(Time.get_ticks_msec() * 0.004)
		# A woven basket with a heap of glowing coins.
		var rim_y: float = h * 0.52
		var heap: int = mini(free, 24)
		for i: int in heap:
			var a: float = float(i) * 2.39996
			var rr: float = sqrt(float(i) / 24.0) * w * 0.34
			var p := Vector2(w * 0.5 + cos(a) * rr, rim_y - 4.0 - float(i % 5) * 1.5 + sin(a) * rr * 0.25)
			BettingTable.draw_coin(self, p, 9.0, glow if i == heap - 1 else 0.0)
		var basket := PackedVector2Array([Vector2(w * 0.1, rim_y), Vector2(w * 0.9, rim_y), Vector2(w * 0.78, h * 0.8), Vector2(w * 0.22, h * 0.8)])
		draw_colored_polygon(basket, Color(0.45, 0.3, 0.16))
		for k: int in 3:
			var y: float = lerpf(rim_y + 5.0, h * 0.78, float(k) / 3.0)
			draw_line(Vector2(w * 0.14 + k * 3.0, y), Vector2(w * 0.86 - k * 3.0, y), Color(0.3, 0.19, 0.09), 2.0)
		draw_line(Vector2(w * 0.08, rim_y), Vector2(w * 0.92, rim_y), Color(0.6, 0.42, 0.22), 4.0)
		var f := FelecoUiScript.font("bold")
		var txt := "%d EP" % free
		var tw: float = f.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 18).x
		draw_string(f, Vector2((w - tw) * 0.5, h - 2.0), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 18, FelecoUiScript.GOLD)

	func _gui_input(event: InputEvent) -> void:
		var mb := event as InputEventMouseButton
		if mb != null and mb.button_index == MOUSE_BUTTON_LEFT and not mb.pressed:
			var i: int = BettingTable.CHIPS.find(table.chip())
			table.set_chip(BettingTable.CHIPS[(i + 1) % BettingTable.CHIPS.size()])
			table._flash("Chip size: %d" % table.chip())

	func _get_drag_data(_at: Vector2) -> Variant:
		var n: int = table.take_for_drag(table.chip())
		if n <= 0:
			return null
		set_drag_preview(CoinStack.make(n))
		return {"coins": n}

class ChipButton extends Control:
	var table: BettingTable
	var value: int = 1

	func _ready() -> void:
		mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
		tooltip_text = "Chip of %d. Tap to use it, or drag it onto a box." % value

	func _draw() -> void:
		var r: float = minf(size.x, size.y) * 0.4
		var c: Vector2 = size * 0.5
		if table.chip() == value:
			draw_circle(c, r * 1.22, Color(1, 0.9, 0.5, 0.35))
		BettingTable.draw_coin(self, c, r)
		var f := FelecoUiScript.font("bold")
		var txt := str(value)
		var fs: int = int(r * 0.95)
		var ts: Vector2 = f.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, fs)
		draw_string(f, Vector2(c.x - ts.x * 0.5, c.y + fs * 0.36), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color(0.3, 0.2, 0.05))

	func _gui_input(event: InputEvent) -> void:
		var mb := event as InputEventMouseButton
		if mb != null and mb.button_index == MOUSE_BUTTON_LEFT and not mb.pressed:
			table.set_chip(value)

	func _get_drag_data(_at: Vector2) -> Variant:
		var n: int = table.take_for_drag(value)
		if n <= 0:
			return null
		set_drag_preview(CoinStack.make(n))
		return {"coins": n}

class CoinStack extends Control:
	var count: int = 1

	static func make(n: int) -> CoinStack:
		var s := CoinStack.new()
		s.count = n
		s.size = Vector2(48, 60)
		s.position = Vector2(-24, -40)
		return s

	func _draw() -> void:
		var shown: int = mini(count, 5)
		for i: int in shown:
			BettingTable.draw_coin(self, Vector2(24, 44 - i * 5), 14.0, 1.0 if i == shown - 1 else 0.0)
		if count > 1:
			var f := FelecoUiScript.font("bold")
			draw_string(f, Vector2(38, 18), "×%d" % count, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, FelecoUiScript.CREAM)

class BetBox extends PanelContainer:
	const LARGE: int = 0  # phone pages: big sprite card
	const SMALL: int = 1  # phone pages: smaller sprite card
	const ZONE: int = 2  # a strip: icon, caption, odds in one line
	const MINI: int = 3  # board: sprite card sized by the caller
	const CELL: int = 4  # board: a roulette cell that shows only its odds

	var table: BettingTable
	var offer: Dictionary
	var size_kind: int = LARGE
	var caption: String = ""
	var compact: bool = false
	var min_size: Vector2 = Vector2.ZERO
	var icon: Texture2D = null
	var coins: int = 0
	var _pressing: bool = false
	var _press_t: float = 0.0
	var _long_fired: bool = false
	var _hover: bool = false
	var _drop_hover: bool = false
	var _stack: Control
	var _mult: Label
	var _style: StyleBoxFlat

	func _ready() -> void:
		mouse_filter = Control.MOUSE_FILTER_STOP
		mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
		match size_kind:
			LARGE: custom_minimum_size = Vector2(148, 150) if compact else Vector2(128, 132)
			SMALL: custom_minimum_size = Vector2(120, 124) if compact else Vector2(104, 108)
			ZONE: custom_minimum_size = Vector2(0, 64 if compact else 52)
		if min_size != Vector2.ZERO:
			custom_minimum_size = min_size
		if size_kind == ZONE:
			size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_style = StyleBoxFlat.new()
		_style.set_corner_radius_all(8 if size_kind == CELL else (10 if size_kind == ZONE else 12))
		var pad: int = 2 if size_kind == CELL else (4 if size_kind in [ZONE, MINI] else 6)
		for side in [SIDE_LEFT, SIDE_RIGHT, SIDE_TOP, SIDE_BOTTOM]:
			_style.set_content_margin(side, pad)
		add_theme_stylebox_override("panel", _style)
		var big_font: int = 14 if size_kind in [ZONE, CELL] else 16
		if size_kind == ZONE or size_kind == CELL:
			_build_strip(big_font)
		else:
			_build_card()
		_stack = Control.new()
		_stack.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_stack.set_anchors_preset(Control.PRESET_FULL_RECT)
		_stack.draw.connect(_draw_stack)
		add_child(_stack)
		mouse_entered.connect(_on_enter)
		mouse_exited.connect(_on_exit)
		tooltip_text = details()
		if not offer.get("available", true):
			modulate = Color(1, 1, 1, 0.38)
			if size_kind == CELL or size_kind == ZONE:
				_mult.text = "—"
			else:
				_mult.text = String(offer.get("reason", "")) if not String(offer.get("reason", "")).is_empty() else "Closed"
				_mult.add_theme_color_override("font_color", FelecoUiScript.MIST)
				_mult.add_theme_font_size_override("font_size", 12)
		else:
			_mult.text = "×%s" % _fmt(float(offer["mult"]))
		_restyle()

	func _build_card() -> void:
		var col := VBoxContainer.new()
		col.add_theme_constant_override("separation", 0)
		col.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(col)
		var art := TextureRect.new()
		art.texture = FelecoUiScript.species_texture(offer["sprite"])
		art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		art.size_flags_vertical = Control.SIZE_EXPAND_FILL
		art.mouse_filter = Control.MOUSE_FILTER_IGNORE
		col.add_child(art)
		var text: String = caption if not caption.is_empty() else String(offer["label"])
		var name_lbl := FelecoUiScript.heading(text, 14 if size_kind == MINI else 16, FelecoUiScript.CREAM)
		name_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		name_lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
		if size_kind == MINI:
			# Name and odds share one line under the sprite.
			var row := HBoxContainer.new()
			row.alignment = BoxContainer.ALIGNMENT_CENTER
			row.add_theme_constant_override("separation", 5)
			row.mouse_filter = Control.MOUSE_FILTER_IGNORE
			col.add_child(row)
			row.add_child(name_lbl)
			_mult = _odds_label(14)
			row.add_child(_mult)
		else:
			name_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			col.add_child(name_lbl)
			_mult = _odds_label(15)
			col.add_child(_mult)

	func _build_strip(font_size: int) -> void:
		var row := HBoxContainer.new()
		row.alignment = BoxContainer.ALIGNMENT_CENTER
		row.add_theme_constant_override("separation", 4)
		row.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(row)
		if icon != null:
			var art := TextureRect.new()
			art.texture = icon
			art.custom_minimum_size = Vector2(18, 18) if caption.is_empty() else Vector2(34, 28)
			art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
			art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
			art.mouse_filter = Control.MOUSE_FILTER_IGNORE
			var t: String = String(offer["type"])
			if t in ["doomed", "extinct"]:
				art.modulate = Color(1.0, 0.72, 0.65)
			elif t in ["survivor", "elder", "starter"]:
				art.modulate = Color(0.8, 1.0, 0.75)
			row.add_child(art)
		if not caption.is_empty():
			var name_lbl := FelecoUiScript.heading(caption, font_size if not compact else 17, FelecoUiScript.CREAM)
			name_lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
			row.add_child(name_lbl)
		_mult = _odds_label(font_size)
		row.add_child(_mult)

	func _odds_label(fs: int) -> Label:
		var l := FelecoUiScript.label("", fs, FelecoUiScript.GOLD)
		l.add_theme_font_override("font", FelecoUiScript.font("bold"))
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		l.mouse_filter = Control.MOUSE_FILTER_IGNORE
		return l

	func _fmt(m: float) -> String:
		var r: float = snappedf(m, 0.05)
		if absf(r - roundf(r)) < 0.001:
			return str(int(roundf(r)))
		if absf(r * 10.0 - roundf(r * 10.0)) < 0.001:
			return "%.1f" % r
		return "%.2f" % r

	# The full story of this bet, for the tooltip and the dock's info line.
	func details() -> String:
		var p: float = float(offer.get("p", 0.0))
		var head: String = describe()
		if not offer.get("available", true):
			return "%s\n%s." % [head, String(offer.get("reason", "Closed"))]
		var when: String = "  Settles the moment it happens." if offer.get("live", false) else "  Settles at the end of the run."
		return "%s\nPays ×%s, about %d%% likely.%s" % [head, _fmt(float(offer["mult"])), int(round(p * 100.0)), when]

	func describe() -> String:
		var t: String = offer["target"]
		match String(offer["type"]):
			"faction": return "%s have the largest population when the run ends." % BetBook.label_of(t)
			"guild":
				var who: PackedStringArray = []
				for k: String in BetBook.GUILDS[t]:
					who.append(k)
				return "The %s guild (%s) has the largest combined headcount at the end." % [t, ", ".join(who)]
			"duel": return "%s outnumber %s at the end. A tie goes to the house." % [BetBook.label_of(t), BetBook.label_of("robins" if t == "falcons" else "falcons")]
			"flood": return "Flood Toll: %s fish die on dry land after floods recede, over the whole run." % t
			"extinct": return "%s reach zero at any point in the run." % BetBook.label_of(t)
			"boom": return "%s reach twice their starting number." % BetBook.label_of(t)
			"phoenix": return "%s die out, then climb back to their starting number." % BetBook.label_of(t)
			"lone": return "The run ends with exactly one of the %s alive." % BetBook.label_of(t).to_lower()
			"wipeout": return "Total wipeout: three species are extinct at the same time."
			"upset": return "One of the three long shots (%s) ends with the largest population." % offer["meta"].get("names", BetBook.label_of(t))
			"floodfeast": return "Flood & Feast: the Flood Toll reaches 30 and falcons end with the largest population."
			"survivor": return "Still alive when the run ends."
			"starter": return "Still alive on day %d. Trait: %s, %s." % [int(offer["meta"].get("by_day", 0.0)), String(offer["meta"].get("trait", {}).get("name", "")), String(offer["meta"].get("trait", {}).get("hint", ""))]
			"doomed": return "Dies by day %d, the first half of the run." % int(offer["meta"].get("by_day", 0.0))
			"elder": return "%s the %s lives to %d days old, outliving its kind." % [offer["meta"]["name"], String(offer["meta"]["species"]).capitalize(), int(offer["meta"]["age_needed"])]
			"top": return "%s end the year as the fullest group in the food web." % SpeciesDB.GROUP_LABEL[t]
			"order":
				var names: PackedStringArray = []
				for g in offer["meta"]["rank"].slice(0, int(offer["meta"]["depth"])):
					names.append(SpeciesDB.GROUP_LABEL[g])
				return "The groups finish in this order: %s." % ", ".join(names)
			"gextinct": return "Any species among the %s dies out." % SpeciesDB.GROUP_LABEL[t].to_lower()
			"gboom": return "The %s get twice as full as they started." % SpeciesDB.GROUP_LABEL[t].to_lower()
			"drought": return "A drought strikes this year."
			"golden": return "%s golden finds: golden grass, berries, apples or star moss eaten." % t
			"goldloop": return "Gold passes from a golden plant up the food web and back down to a decomposer."
			"scenario": return String(offer["label"]) + "."
		return String(offer["label"])

	func reprice() -> void:
		if not offer.get("available", true):
			_mult.text = "—"
		else:
			_mult.text = "×%s" % _fmt(float(offer["mult"]))
		tooltip_text = details()

	# Hover card: the creature, what wins, how likely, and what a stake returns.
	func _make_custom_tooltip(_for_text: String) -> Object:
		var panel := PanelContainer.new()
		var sb := StyleBoxFlat.new()
		sb.bg_color = Color(0.07, 0.1, 0.08, 0.97)
		sb.border_color = _accent()
		sb.set_border_width_all(2)
		sb.set_corner_radius_all(14)
		for side in [SIDE_LEFT, SIDE_RIGHT, SIDE_TOP, SIDE_BOTTOM]:
			sb.set_content_margin(side, 12)
		panel.add_theme_stylebox_override("panel", sb)
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 12)
		panel.add_child(row)
		var art := TextureRect.new()
		art.texture = BettingTable._roster_texture(offer["meta"]) if offer["meta"].has("female") else FelecoUiScript.species_texture(offer["sprite"])
		art.custom_minimum_size = Vector2(72, 72)
		art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		art.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
		if String(offer["type"]) in ["extinct", "doomed", "wipeout"]:
			art.flip_v = true
		row.add_child(art)
		var col := VBoxContainer.new()
		col.add_theme_constant_override("separation", 4)
		row.add_child(col)
		var title := FelecoUiScript.heading(_title(), 18, FelecoUiScript.GOLD)
		title.custom_minimum_size = Vector2(280, 0)
		title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		col.add_child(title)
		var what := FelecoUiScript.label(describe(), 15, FelecoUiScript.CREAM)
		what.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		what.custom_minimum_size = Vector2(280, 0)
		col.add_child(what)
		if not offer.get("available", true):
			var why := String(offer.get("reason", ""))
			col.add_child(FelecoUiScript.label(why if not why.is_empty() else "Closed", 14, FelecoUiScript.CLAY))
			return panel
		# A likelihood bar: how much of the bar is lit is the chance it lands.
		var p: float = clampf(float(offer.get("p", 0.0)), 0.0, 1.0)
		var bar := ColorRect.new()
		bar.color = Color(1, 1, 1, 0.1)
		bar.custom_minimum_size = Vector2(0, 8)
		var fill := ColorRect.new()
		fill.color = _accent().lerp(FelecoUiScript.GOLD, 0.4)
		fill.anchor_bottom = 1.0
		fill.anchor_right = maxf(p, 0.02)
		bar.add_child(fill)
		col.add_child(bar)
		var m: float = float(offer["mult"])
		col.add_child(FelecoUiScript.label("About %d%% likely  ·  pays ×%s" % [maxi(1, int(round(p * 100.0))), _fmt(m)], 14, FelecoUiScript.MIST))
		var stake: int = maxi(coins, table.chip())
		var ex := FelecoUiScript.label("%d coin%s pays back %d EP" % [stake, "" if stake == 1 else "s", int(round(stake * m))], 15, FelecoUiScript.GOLD)
		ex.add_theme_font_override("font", FelecoUiScript.font("bold"))
		col.add_child(ex)
		col.add_child(FelecoUiScript.label("Pays the moment it happens." if offer.get("live", false) else "Judged when the run ends.", 13, FelecoUiScript.MIST))
		return panel

	func _title() -> String:
		var t: String = offer["target"]
		match String(offer["type"]):
			"faction": return "%s rule the valley" % BetBook.label_of(t)
			"guild": return "%s guild" % t.capitalize()
			"duel": return "Bird duel: %s" % BetBook.label_of(t)
			"flood": return "Flood Toll %s+" % t
			"extinct": return "%s die out" % BetBook.label_of(t)
			"boom": return "%s double" % BetBook.label_of(t)
			"phoenix": return "%s phoenix" % BetBook.label_of(t)
			"lone": return "Last of the %s" % BetBook.label_of(t).to_lower()
			"survivor": return "%s lives" % BettingTable._roster_title(offer["meta"])
			"starter": return "%s lives to day %d" % [offer["meta"]["name"], int(offer["meta"].get("by_day", 0.0))]
			"doomed": return "%s dies early" % BettingTable._roster_title(offer["meta"])
			"elder": return "%s, elder" % offer["meta"]["name"]
			"top": return "%s on top" % SpeciesDB.GROUP_LABEL[t]
			"gextinct": return "%s lose a species" % SpeciesDB.GROUP_LABEL[t]
			"gboom": return "%s double" % SpeciesDB.GROUP_LABEL[t]
		return String(offer["label"])

	func _accent() -> Color:
		match String(offer["type"]):
			"extinct", "doomed", "wipeout", "gextinct", "drought": return FelecoUiScript.CLAY
			"top": return SpeciesDB.GROUP_COLOR.get(String(offer["target"]), Color(0.42, 0.58, 0.44))
			"golden", "goldloop": return FelecoUiScript.GOLD
			"gboom": return FelecoUiScript.LEAF
			"boom", "survivor", "elder", "phoenix": return FelecoUiScript.LEAF
			"flood", "floodfeast": return Color(0.4, 0.66, 0.9)
		return Color(0.42, 0.58, 0.44)

	func _restyle() -> void:
		var accent: Color = _accent()
		var lit: bool = _hover or _drop_hover
		_style.border_color = FelecoUiScript.GOLD if (lit or coins > 0) else Color(accent.r, accent.g, accent.b, 0.85)
		var base := Color(0.05, 0.14, 0.08, 0.92)
		if coins > 0:
			base = Color(0.16, 0.2, 0.09, 0.95)
		if lit:
			base = Color(0.12, 0.25, 0.14, 0.97)
		_style.bg_color = base
		_style.set_border_width_all(2 if (coins > 0 or lit) else 1)

	func _on_enter() -> void:
		_hover = true
		_restyle()
		table.show_info(self)

	func _on_exit() -> void:
		_hover = false
		_drop_hover = false
		_restyle()
		table.show_info(null)

	func set_coins(n: int) -> void:
		coins = n
		_restyle()
		_stack.queue_redraw()

	func bump() -> void:
		pivot_offset = size * 0.5
		var tw := create_tween()
		tw.tween_property(self, "scale", Vector2(1.07, 1.07), 0.07)
		tw.tween_property(self, "scale", Vector2.ONE, 0.14).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)

	func cancel_press() -> void:
		_pressing = false
		_long_fired = true

	func _draw_stack() -> void:
		if coins <= 0:
			return
		var small: bool = size_kind in [ZONE, CELL]
		if small:
			# Strips are too short for a stack: one glowing chip sits on the
			# top-right corner with the count on its face.
			var c := Vector2(size.x - 3.0, 1.0)
			var g: float = 0.6 + 0.4 * sin(Time.get_ticks_msec() * 0.005)
			BettingTable.draw_coin(_stack, c, 10.0, g)
			var bf := FelecoUiScript.font("bold")
			var bt := str(coins)
			var bs: Vector2 = bf.get_string_size(bt, HORIZONTAL_ALIGNMENT_LEFT, -1, 13)
			_stack.draw_string(bf, c + Vector2(-bs.x * 0.5, 4.5), bt, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(0.3, 0.2, 0.05))
			return
		var shown: int = mini(coins, 5)
		var r: float = 7.5 if small else 10.0
		var step: float = 2.5 if small else 3.5
		var base := Vector2(size.x - r - 4.0, size.y * 0.5 + float(shown - 1) * step * 0.5) if small else Vector2(size.x - r - 5.0, r + 6.0 + float(shown - 1) * step)
		var glow: float = 0.6 + 0.4 * sin(Time.get_ticks_msec() * 0.005)
		for i: int in shown:
			BettingTable.draw_coin(_stack, base - Vector2(0, i * step), r, glow if i == shown - 1 else 0.0)
		var f := FelecoUiScript.font("bold")
		var txt := str(coins)
		var fs: int = 13 if small else 15
		var ts: Vector2 = f.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, fs)
		var top_y: float = base.y - float(shown - 1) * step
		var at := Vector2(base.x - ts.x * 0.5, top_y + fs * 0.36)
		_stack.draw_string_outline(f, at, txt, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, 4, Color(0.25, 0.16, 0.04))
		_stack.draw_string(f, at, txt, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color(1.0, 0.97, 0.85))

	func _process(delta: float) -> void:
		if coins > 0:
			_stack.queue_redraw()
		if _pressing and not _long_fired:
			_press_t += delta
			if _press_t >= 0.45:
				_long_fired = true
				table.remove_coins(self, true)

	func _gui_input(event: InputEvent) -> void:
		var mb := event as InputEventMouseButton
		if mb == null:
			return
		if mb.button_index == MOUSE_BUTTON_RIGHT and mb.pressed:
			table.remove_coins(self, mb.shift_pressed)
			accept_event()
		elif mb.button_index == MOUSE_BUTTON_LEFT:
			if mb.pressed:
				_pressing = true
				_press_t = 0.0
				_long_fired = false
			else:
				var tap: bool = _pressing and not _long_fired and not table.is_swiping()
				_pressing = false
				if tap:
					table.add_coins(self)
			accept_event()

	func _can_drop_data(_at: Vector2, data: Variant) -> bool:
		var ok: bool = data is Dictionary and (data as Dictionary).has("coins") and offer.get("available", true)
		if ok != _drop_hover:
			_drop_hover = ok
			_restyle()
		return ok

	func _drop_data(_at: Vector2, data: Variant) -> void:
		_drop_hover = false
		table.add_coins(self, int(data["coins"]))
