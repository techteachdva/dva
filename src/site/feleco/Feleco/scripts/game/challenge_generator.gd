class_name ChallengeGenerator
extends RefCounted

const SPECIES: Array[String] = ["sheep", "wolf", "human", "falcon", "robin", "boar", "worm", "rabbit"]

static func generate_level(level: int) -> Dictionary:
	# Level 0 = very easy, Level 20+ = very hard
	var rng := RandomNumberGenerator.new()
	rng.randomize()

	var counts: Dictionary = {}
	var total: int = 20 + level * 5
	var bias: float = clampf(1.0 - level * 0.04, 0.05, 1.0)  # How obvious the correct bet is

	if level == 0:
		# Tutorial: obvious wolf dominance
		counts = {
			"sheep": 10, "wolf": 40, "human": 5, "falcon": 2,
			"robin": 4, "boar": 3, "worm": 8, "spore": 4,
			"bet": "wolf",
		}
		return counts

	if level == 1:
		# Still easy: heavy sheep advantage
		counts = {
			"sheep": 50, "wolf": 5, "human": 3, "falcon": 2,
			"robin": 4, "boar": 2, "worm": 6, "spore": 4,
			"bet": "sheep",
		}
		return counts

	# Pick a target species to be the "correct" bet
	var target: String = SPECIES[rng.randi() % SPECIES.size()]

	# Allocate population budget across species
	var remaining: int = total
	for sp: String in SPECIES:
		if sp == target:
			continue
		if sp == "worm":
			# Worms are filler; give them a chunk
			counts[sp] = rng.randi() % (total / 5) + 4
		else:
			counts[sp] = rng.randi() % (total / 3) + 2
		remaining -= counts[sp]

	# Give target species an advantage based on bias
	var target_min: int = int(total * (0.35 + bias * 0.25))
	counts[target] = maxi(target_min, remaining)

	# Ensure spores exist
	counts["spore"] = rng.randi() % 6 + 2
	counts["bet"] = target

	# Post-process: clamp to reasonable bounds
	for sp: String in counts.keys():
		if sp == "bet":
			continue
		counts[sp] = clampi(counts[sp], 2, 120)

	return counts
