class_name Schemes
extends RefCounted

# Schemes: the link between betting and playing. Every power says which
# links of the food web it helps (or hurts), every bet says how you could
# tip it, and when you act in favour of an open bet (a power that helps it,
# or a rampage won by one of its creatures) that bet pays more. Thinking
# ahead pays: bet, then make it happen.

const SCHEME_STEP: float = 0.1
const RAMPAGE_STEP: float = 0.15
const SCHEME_CAP: float = 0.4

# power id -> [what it does, groups it helps, groups it hurts, bet types it can cause].
const POWERS: Dictionary = {
	"bloom": ["Grass, fruit and moss surge at once.", ["producer", "herbivore"], [], ["golden"]],
	"stampede": ["Herds bolt and heal: hunters miss their prey.", ["herbivore"], ["carnivore"], []],
	"predator_call": ["More of your champion's kind arrive.", ["champion"], [], []],
	"feast": ["Every omnivore eats its fill and heals.", ["omnivore"], ["herbivore"], []],
	"rot_rain": ["Mushrooms, worms and beetles spring up.", ["decomposer"], [], ["goldloop"]],
	"rain": ["Grass grows fast for a day; falcons hunt blind.", ["producer", "herbivore", "decomposer"], [], []],
	"drought": ["The meadow bakes for a day and a half.", ["carnivore"], ["producer", "herbivore"], ["drought"]],
	"flood": ["The river rises; fish left on land die.", ["decomposer"], ["herbivore"], ["flood"]],
	"eclipse": ["Night falls at once: hunters feast.", ["carnivore"], ["herbivore"], []],
}
const POWER_NAMES: Dictionary = {
	"bloom": "Bloom", "stampede": "Stampede", "predator_call": "Call Kin", "feast": "Feast",
	"rot_rain": "Rot Rain", "rain": "Rain", "drought": "Drought", "flood": "Flood", "eclipse": "Eclipse",
}

# The food-web group a bet is about, and whether it wants that group up (1)
# or down (-1). 0: the bet isn't about a group.
static func _bet_group(bet: Dictionary) -> Array:
	var t: String = String(bet.get("type", ""))
	var g: String = String(bet.get("target", ""))
	match t:
		"top", "gboom":
			return [g, 1]
		"gextinct":
			return [g, -1]
		"order":
			var rank: Array = bet.get("meta", {}).get("rank", [])
			return [String(rank[0]) if not rank.is_empty() else "", 1]
		"starter", "survivor":
			return [SpeciesDB.group_of(String(bet.get("meta", {}).get("species", ""))), 1]
	return ["", 0]

# Does this power push this bet towards winning?
static func helps(power: String, bet: Dictionary, champion_group: String = "") -> bool:
	if not POWERS.has(power):
		return false
	var p: Array = POWERS[power]
	var t: String = String(bet.get("type", ""))
	if (p[3] as Array).has(t):
		return true
	var bg: Array = _bet_group(bet)
	if String(bg[0]).is_empty():
		return false
	var up: Array = (p[1] as Array).duplicate()
	if up.has("champion"):
		up.append(champion_group)
	return (up.has(bg[0]) and int(bg[1]) > 0) or ((p[2] as Array).has(bg[0]) and int(bg[1]) < 0)

# The powers that would help a bet, by name.
static func powers_for(bet: Dictionary, champion_group: String = "") -> Array[String]:
	var out: Array[String] = []
	for id: String in POWERS.keys():
		if helps(id, bet, champion_group):
			out.append(POWER_NAMES[id])
	return out

# One line under every bet: how to tip it your way.
static func tip(bet: Dictionary) -> String:
	var names := powers_for(bet)
	var bg: Array = _bet_group(bet)
	var t: String = String(bet.get("type", ""))
	var parts: Array[String] = []
	if not names.is_empty():
		parts.append(", ".join(names))
	if not String(bg[0]).is_empty() and int(bg[1]) > 0 and bg[0] != "producer":
		parts.append("rampage a golden %s" % SpeciesDB.GROUP_LABEL.get(bg[0], "creature").to_lower().trim_suffix("s"))
	if t == "drought":
		return "Tip it: the Drought power causes one. Bet, then cast it!"
	if t == "flood":
		return "Tip it: the Flood power strands fish on the banks."
	if parts.is_empty():
		return ""
	return "Tip it: " + " or ".join(parts) + " (each adds +10% to this bet)."

# A power was used: every open bet it helps pays a little more.
static func on_power(gc: Node, power: String, champion_group: String = "") -> Array[String]:
	var boosted: Array[String] = []
	if gc == null:
		return boosted
	for bet: Dictionary in gc.bets:
		if bet.get("state", "") == "open" and helps(power, bet, champion_group):
			var before: float = float(bet.get("scheme", 0.0))
			bet["scheme"] = minf(before + SCHEME_STEP, SCHEME_CAP)
			if float(bet["scheme"]) > before:
				boosted.append(String(bet.get("label", "")))
	return boosted

# A rampage was won: bets backing that creature's group pay more.
static func on_rampage(gc: Node, species: String) -> Array[String]:
	var boosted: Array[String] = []
	if gc == null:
		return boosted
	var g: String = SpeciesDB.group_of(species)
	for bet: Dictionary in gc.bets:
		var bg: Array = _bet_group(bet)
		if bet.get("state", "") == "open" and bg[0] == g and int(bg[1]) > 0:
			bet["scheme"] = minf(float(bet.get("scheme", 0.0)) + RAMPAGE_STEP, SCHEME_CAP)
			boosted.append(String(bet.get("label", "")))
	return boosted

static func payout(bet: Dictionary) -> int:
	return int(round(float(bet["stake"]) * float(bet["mult"]) * (1.0 + float(bet.get("scheme", 0.0)))))

# --- Plans: worked strategies for the betting table --------------------------

# offers: id -> offer. Returns up to three plans:
# {title, why, bets: [[id, coins]], powers: [names]}.
static func plans(offers: Dictionary, budget: int, full: bool) -> Array:
	var tops: Array = []
	for g: String in SpeciesDB.GROUPS:
		var o: Dictionary = offers.get("top:" + g, {})
		if not o.is_empty() and o.get("available", false):
			tops.append(o)
	if tops.is_empty():
		return []
	tops.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return float(a["p"]) > float(b["p"]))
	var out: Array = []
	var fav: Dictionary = tops[0]
	var stake: int = clampi(budget / 3, 2, 10)
	out.append({
		"title": "Safe: back the favourite",
		"why": "The %s start fullest, so they're the most likely to end on top. Small payout (x%.1f), but it usually comes in. Good for learning." % [SpeciesDB.GROUP_LABEL[fav["target"]], float(fav["mult"])],
		"bets": [[fav["id"], stake]],
		"powers": powers_for(fav),
	})
	# The schemer: an underdog you can push with powers and rampages.
	var dog: Dictionary = {}
	for o: Dictionary in tops:
		if o == fav:
			continue
		if float(o["p"]) >= 0.1 and float(o["p"]) <= 0.35 and not powers_for(o).is_empty():
			dog = o
			break
	if dog.is_empty() and tops.size() > 1:
		dog = tops[1]
	if not dog.is_empty():
		var bets: Array = [[dog["id"], stake]]
		var boom: Dictionary = offers.get("gboom:" + String(dog["target"]), {})
		if full and not boom.is_empty() and boom.get("available", false):
			bets.append([boom["id"], maxi(stake / 2, 1)])
		out.append({
			"title": "Schemer: back an underdog, then tip it",
			"why": "The %s pay x%.1f. Not likely on their own, but every power that helps them adds +10%% to the payout AND pushes the valley their way. Cast them early." % [SpeciesDB.GROUP_LABEL[dog["target"]], float(dog["mult"])],
			"bets": bets,
			"powers": powers_for(dog),
		})
	if full:
		var dr: Dictionary = offers.get("drought", {})
		if not dr.is_empty() and dr.get("available", false):
			out.append({
				"title": "Long shot: make it happen yourself",
				"why": "A drought pays x%.1f. You can cause one: bring the Drought power and cast it. Droughts hurt grazers, so it helps hunters too." % float(dr["mult"]),
				"bets": [[dr["id"], maxi(stake / 2, 2)]],
				"powers": ["Drought"],
			})
	return out
