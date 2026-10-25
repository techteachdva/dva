class_name BetBook
extends RefCounted

# Ecosystem Roulette: the bet catalogue, its odds, and how each bet is
# decided. See docs/design/betting_table.md. A bet is a Dictionary:
# {id, type, target, label, sprite, mult, stake, state, payout, meta, live}
# where state is "open", "won" or "lost".

const EDGE: float = 0.05
const MIN_MULT: float = 1.05
const MAX_P: float = 0.9
const OFFER_ELDER: bool = false
const MAX_MULT: float = 60.0
const FLOOD_LINES: Array[int] = [20, 30, 40, 50]

# [faction key (as in get_creature_counts), sprite species, label]
const FACTIONS: Array = [
	["sheep", "sheep", "Sheep"], ["wolves", "wolf", "Wolves"], ["humans", "human", "Humans"],
	["falcons", "falcon", "Falcons"], ["robins", "robin", "Robins"], ["boars", "boar", "Boars"],
	["rabbits", "rabbit", "Rabbits"], ["worms", "worm", "Worms"], ["fish", "fish", "Fish"],
]
const GUILDS: Dictionary = {
	"grazers": ["sheep", "rabbits", "boars"],
	"predators": ["wolves", "humans", "falcons"],
	"decomposers": ["worms", "mushrooms"],
}
const GUILD_ART: Dictionary = {"grazers": "sheep", "predators": "wolf", "decomposers": "mushroom"}

# How well a faction turns a head start into a crowd by the end of a run.
# Placeholder priors until the offline odds table exists (spec §7).
const STRENGTH: Dictionary = {
	"sheep": 1.0, "wolves": 0.9, "humans": 0.8, "falcons": 0.9, "robins": 0.8,
	"boars": 0.8, "rabbits": 1.4, "worms": 0.7, "fish": 2.0, "mushrooms": 1.0,
}
const FRAGILITY: Dictionary = {
	"sheep": 0.25, "wolves": 0.25, "humans": 0.35, "falcons": 0.2, "robins": 0.45,
	"boars": 0.35, "rabbits": 0.15, "worms": 0.35, "fish": 0.05,
}
const BOOM_P: Dictionary = {
	"sheep": 0.3, "wolves": 0.35, "humans": 0.2, "falcons": 0.4, "robins": 0.25,
	"boars": 0.25, "rabbits": 0.6, "worms": 0.3, "fish": 0.75,
}
# Lifespans live in Clock.LIFESPAN_DAYS (days of sun and moon). SAFETY is how
# often a creature of the species avoids being killed before age catches it.
const SAFETY: Dictionary = {
	"sheep": 0.6, "wolf": 0.8, "human": 0.85, "falcon": 0.85, "robin": 0.6,
	"boar": 0.8, "rabbit": 0.5, "worm": 0.4, "fish": 0.6,
}
const FLOOD_P: Array[float] = [0.4, 0.25, 0.14, 0.08]

static func plural(species: String) -> String:
	for f: Array in FACTIONS:
		if f[1] == species or f[0] == species:
			return f[0]
	return species

static func sprite_of(faction: String) -> String:
	for f: Array in FACTIONS:
		if f[0] == faction:
			return f[1]
	return faction

static func label_of(faction: String) -> String:
	for f: Array in FACTIONS:
		if f[0] == faction:
			return f[2]
	return faction.capitalize()

# Fair odds less the house edge, always rounded down so no bet ever pays
# better than fair. Short odds step in 0.05s, long odds in halves and wholes.
# A bet likelier than MAX_P is not offered at all (see catalogue).
static func mult_for(p: float) -> float:
	var m: float = (1.0 - EDGE) / clampf(p, 0.001, MAX_P)
	var step: float = 0.05 if m < 2.0 else (0.5 if m < 10.0 else 1.0)
	return clampf(floorf(m / step + 0.0001) * step, MIN_MULT, MAX_MULT)

# Largest head count wins, mushrooms excluded. "" on a tie or an empty valley.
static func leader(counts: Dictionary) -> String:
	var best: String = ""
	var best_n: int = 0
	var tie: bool = false
	for f: Array in FACTIONS:
		var n: int = int(counts.get(f[0], 0))
		if n > best_n:
			best = f[0]
			best_n = n
			tie = false
		elif n == best_n and n > 0:
			tie = true
	return "" if tie else best

static func guild_total(guild: String, counts: Dictionary) -> float:
	var t: float = 0.0
	for k: String in GUILDS[guild]:
		t += float(counts.get(k, 0)) * (0.5 if k == "mushrooms" else 1.0)
	return t

static func guild_leader(counts: Dictionary) -> String:
	var best: String = ""
	var best_n: float = 0.0
	for g: String in GUILDS.keys():
		var t: float = guild_total(g, counts)
		if t > best_n:
			best = g
			best_n = t
	return best

# Share of the end-of-run crowd each faction is likely to own.
static func faction_odds(counts: Dictionary) -> Dictionary:
	var w: Dictionary = {}
	var total: float = 0.0
	for f: Array in FACTIONS:
		var x: float = pow(float(counts.get(f[0], 0)) * float(STRENGTH[f[0]]), 1.3)
		w[f[0]] = x
		total += x
	for k: String in w.keys():
		w[k] = 0.02 if total <= 0.0 else clampf(w[k] / total, 0.02, 0.95)
	return w

# Chance a creature of this species is alive `days` from now, given its age.
# days and age are in days of sun and moon. Before a run starts the age is
# unknown: founders start somewhere in the first half of life, so -1 means
# "assume a quarter of the way".
static func survive_p(species: String, days: float, age: float = -1.0) -> float:
	var life: float = float(Clock.LIFESPAN_DAYS.get(species, 4.0))
	if age < 0.0:
		age = life * 0.25
	var reach: float = age + days
	if reach > life * 1.5 * 2.5:
		return 0.0
	var past: float = maxf(0.0, reach - 0.75 * life)
	return clampf(float(SAFETY.get(species, 0.7)) * exp(-days / (life * 4.0)) * exp(-past / (0.45 * life)), 0.0, 0.97)

static func _bet(id: String, type: String, target: String, label: String, sprite: String, p: float, live: bool, meta: Dictionary = {}) -> Dictionary:
	return {
		"id": id, "type": type, "target": target, "label": label, "sprite": sprite,
		"p": p, "mult": mult_for(p), "stake": 0, "state": "open", "payout": 0,
		"meta": meta, "live": live, "available": p > 0.0 and p <= MAX_P,
		"reason": "Too likely to price" if p > MAX_P else "",
	}

# Every bet on offer. counts: current (or starting) head counts. roster:
# named creatures [{name, species, age?}]. run_days: run length. day: today.
# stats: a BetTracker snapshot, or {} before the run.
static func catalogue(counts: Dictionary, roster: Array, run_days: float, day: float = 0.0, stats: Dictionary = {}) -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	var left: float = maxf(1.0, run_days - day)
	var odds := faction_odds(counts)
	for f: Array in FACTIONS:
		out.append(_bet("faction:" + f[0], "faction", f[0], f[2], f[1], odds[f[0]], false))
	var gw: Dictionary = {}
	var gt: float = 0.0
	for g: String in GUILDS.keys():
		var x: float = 0.0
		for k: String in GUILDS[g]:
			x += float(odds.get(k, 0.0)) if k != "mushrooms" else 0.06
		gw[g] = x
		gt += x
	for g: String in GUILDS.keys():
		out.append(_bet("guild:" + g, "guild", g, g.capitalize(), GUILD_ART[g], clampf(gw[g] / maxf(gt, 0.01) * 0.92, 0.03, 0.9), false))
	var fal: float = float(odds["falcons"])
	var rob: float = float(odds["robins"])
	out.append(_bet("duel:falcons", "duel", "falcons", "Falcons beat Robins", "falcon", clampf(fal / (fal + rob) * 0.96, 0.05, 0.92), false))
	out.append(_bet("duel:robins", "duel", "robins", "Robins beat Falcons", "robin", clampf(rob / (fal + rob) * 0.96, 0.05, 0.92), false))
	# Fish: the Flood Toll.
	var toll: int = int(stats.get("flood_toll", 0))
	for i: int in FLOOD_LINES.size():
		var line: int = FLOOD_LINES[i]
		var p: float = FLOOD_P[i] * clampf(left / Clock.STANDARD_DAYS, 0.25, 1.6)
		if toll >= line:
			p = 0.0
		var b := _bet("flood:%d" % line, "flood", str(line), "%d+ fish" % line, "fish", minf(p, 0.9), true, {"line": line})
		if toll >= line:
			b["reason"] = "Already happened"
		out.append(b)
	# Per-faction specials.
	var extinct: Dictionary = stats.get("extinct_day", {})
	var start: Dictionary = stats.get("start", counts)
	for f: Array in FACTIONS:
		var n: int = maxi(1, int(counts.get(f[0], 0)))
		var pe: float = float(FRAGILITY[f[0]]) * clampf(8.0 / float(n), 0.25, 1.6) * clampf(left / Clock.STANDARD_DAYS, 0.3, 1.5)
		var be := _bet("extinct:" + f[0], "extinct", f[0], "%s die out" % f[2], f[1], 0.0 if extinct.has(f[0]) else clampf(pe, 0.02, 0.85), true)
		if extinct.has(f[0]):
			be["reason"] = "Already extinct"
		out.append(be)
		var s0: int = maxi(1, int(start.get(f[0], n)))
		out.append(_bet("boom:" + f[0], "boom", f[0], "%s double" % f[2], f[1], clampf(float(BOOM_P[f[0]]) * clampf(left / Clock.STANDARD_DAYS, 0.3, 1.3), 0.03, 0.9), true, {"from": s0}))
		out.append(_bet("phoenix:" + f[0], "phoenix", f[0], "%s phoenix" % f[2], f[1], clampf(pe * 0.12, 0.01, 0.2), true, {"from": s0}))
		# Ending on exactly one is a knife-edge: likelier for the fragile.
		out.append(_bet("lone:" + f[0], "lone", f[0], "Last %s standing" % f[1], f[1], clampf(pe * 0.3, 0.02, 0.18) if f[0] != "fish" else 0.015, false))
	out.append(_bet("wipeout", "wipeout", "", "Total wipeout", "worm", 0.03, true))
	# Upset: the three long shots on the faction board, as one bet.
	var start_odds := faction_odds(start)
	var ranked: Array = start_odds.keys()
	ranked.sort_custom(func(a, b): return float(start_odds[a]) < float(start_odds[b]))
	var dogs: Array = ranked.slice(0, 3)
	var p_up: float = 0.0
	for k in dogs:
		p_up += float(odds.get(k, 0.0))
	var names: PackedStringArray = []
	for k in dogs:
		names.append(label_of(k))
	out.append(_bet("upset", "upset", dogs[0], "Upset", sprite_of(dogs[0]), clampf(p_up, 0.03, 0.5), false, {"dogs": dogs, "names": ", ".join(names)}))
	out.append(_bet("floodfeast", "floodfeast", "falcons", "Flood & Feast", "falcon", 0.03, false))
	# Named creatures: the single numbers.
	var dead: Dictionary = stats.get("named_dead", {})
	for r: Dictionary in roster:
		var sp: String = r["species"]
		var key: String = "%s|%s" % [r["name"], sp]
		var who: Dictionary = {"name": r["name"], "species": sp, "role": r.get("role", ""), "female": r.get("sex", "") == "female"}
		var age: float = float(r.get("age", -1.0))
		var ps: float = 0.0 if dead.has(key) else survive_p(sp, left, age)
		var sb := _bet("survivor:" + key, "survivor", key, r["name"], sp, ps, false, who)
		if dead.has(key):
			sb["reason"] = "Already dead"
		elif ps <= 0.0:
			sb["reason"] = "Can't live %d more days" % int(left)
		out.append(sb)
		# Dies early: falls within the first half of what is left of the run.
		# (Dying at all is near certain in long runs, so it is no bet.)
		var half: float = left * 0.5
		var pd: float = 0.0 if dead.has(key) else clampf(1.0 - survive_p(sp, half, age), 0.03, 0.97)
		var db := _bet("doomed:" + key, "doomed", key, r["name"], sp, pd, true, who.merged({"by_day": day + half}))
		if dead.has(key):
			db["reason"] = "Already dead"
		out.append(db)
		# Elder (outlive your kind) was cut from the table to keep it on one
		# screen: it overlapped Lives. Judging still supports old saved bets.
		var life: float = float(Clock.LIFESPAN_DAYS.get(sp, 4.0))
		var elder_day: float = life * 1.25
		if OFFER_ELDER and run_days >= elder_day and not dead.has(key):
			var pel: float = survive_p(sp, maxf(0.0, elder_day - age), age) * 0.5
			if pel > 0.0:
				out.append(_bet("elder:" + key, "elder", key, "%s, elder" % r["name"], sp, minf(pel, 0.4), true, who.merged({"age_needed": elder_day})))
	return out

# Late bets pay less: the closer to the end, the bigger the tax.
static func live_mult(mult: float, progress: float) -> float:
	return maxf(1.1, floorf(mult * (1.0 - 0.5 * clampf(progress, 0.0, 1.0)) * 2.0) / 2.0)

# Decides a bet. Returns 1 won, -1 lost, 0 still open. final: the run is over.
static func judge(bet: Dictionary, counts: Dictionary, stats: Dictionary, final: bool) -> int:
	var t: String = bet["target"]
	match String(bet["type"]):
		"faction":
			if final:
				return 1 if leader(counts) == t else -1
		"guild":
			if final:
				return 1 if guild_leader(counts) == t else -1
		"duel":
			if final:
				var other: String = "robins" if t == "falcons" else "falcons"
				return 1 if int(counts.get(t, 0)) > int(counts.get(other, 0)) else -1
		"flood":
			if int(stats.get("flood_toll", 0)) >= int(bet["meta"]["line"]):
				return 1
			if final:
				return -1
		"extinct":
			if stats.get("extinct_day", {}).has(t):
				return 1
			if final:
				return -1
		"boom":
			if int(stats.get("peak", {}).get(t, 0)) >= 2 * int(bet["meta"].get("from", 1)):
				return 1
			if final:
				return -1
		"phoenix":
			if stats.get("extinct_day", {}).has(t) and int(counts.get(t, 0)) >= int(bet["meta"].get("from", 1)):
				return 1
			if final:
				return -1
		"lone":
			if final:
				return 1 if int(counts.get(t, 0)) == 1 else -1
		"wipeout":
			if int(stats.get("max_extinct_at_once", 0)) >= 3:
				return 1
			if final:
				return -1
		"upset":
			if final:
				return 1 if Array(bet["meta"].get("dogs", [t])).has(leader(counts)) else -1
		"floodfeast":
			if final:
				return 1 if int(stats.get("flood_toll", 0)) >= 30 and leader(counts) == "falcons" else -1
		"survivor":
			if stats.get("named_dead", {}).has(t):
				return -1
			if final:
				return 1
		"doomed":
			var by: float = float(bet["meta"].get("by_day", INF))
			if stats.get("named_dead", {}).has(t):
				return 1 if float(stats["named_dead"][t]) <= by else -1
			if final or float(stats.get("day", 0.0)) > by:
				return -1
		"elder":
			if stats.get("named_dead", {}).has(t):
				return -1
			if float(stats.get("named_age", {}).get(t, 0.0)) >= float(bet["meta"]["age_needed"]):
				return 1
			if final:
				return -1
	return 0

static func table_limit(gc: Node) -> int:
	var lim: int = 30
	match String(gc.current_mode):
		"campaign": lim = 20 + int(gc.campaign_era) * 10
		"challenge": lim = 15 + int(gc.challenge_level) * 5
	if gc.owned_upgrades.get("side_eye", false):
		lim += 10
	return lim
