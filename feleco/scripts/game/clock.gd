class_name Clock
extends RefCounted

# Feleco's sense of time. See docs/design/day_night_cycle.md.
#
# Two knobs set the pace of a run:
#   SECONDS_PER_DAY  how long one sun-and-moon day lasts at 1x.
#   LIFE_PACE        how fast life happens (hunger, breeding, ageing, grass,
#                    power timers) relative to real time. Creatures still move
#                    at full speed; only their lives are slowed.
# Lifespans and bet odds are set in days, so either knob can be retuned
# without touching any species.

# Sim seconds per day. Runs start at 1x (2 min days): students found 2x
# too fast to follow. 2x takes one real minute a day, 4x 30 seconds.
const SECONDS_PER_DAY: float = 120.0
const DAYLIGHT: float = 0.5
const TWILIGHT: float = 10.0
const LIFE_PACE: float = 0.2
const BIO_PER_DAY: float = SECONDS_PER_DAY * LIFE_PACE

# [label, days]. A run is one compressed year: each season is a quarter of it.
# Three days a season by default; the faster years are for quicker play.
const RUNS: Array = [["Sprint", 4.0], ["Fast", 8.0], ["Standard", 12.0]]
const STANDARD_DAYS: float = 12.0
const SPEEDS: Array[float] = [1.0, 2.0, 4.0]
const DEFAULT_SPEED: float = 1.0

# Real minutes a run of `days` takes at a given speed.
static func run_minutes(days: float, speed: float = DEFAULT_SPEED) -> float:
	return days * SECONDS_PER_DAY / speed / 60.0

const LIFESPAN_DAYS: Dictionary = {
	# Close to the lifespans the ecosystem was first balanced on (now in days):
	# longer lives here made predators boom (see scripts/dev/run_sims.py).
	"human": 5.0, "falcon": 3.75, "boar": 3.5, "sheep": 3.5, "wolf": 3.25,
	"robin": 3.0, "mushroom": 2.5, "worm": 2.0, "rabbit": 1.75, "fish": 1.75,
}

# Lifespan in the life-time units agents age in.
static func lifespan(species: String) -> float:
	var days: float = float(LIFESPAN_DAYS.get(species, SpeciesDB.row(species).get("days", 4.0)))
	return days * BIO_PER_DAY

static func run_label(days: float) -> String:
	for r: Array in RUNS:
		if is_equal_approx(float(r[1]), days):
			return r[0]
	return "%d days" % int(days)

# 1 at noon, 0 at midnight, with a TWILIGHT-second blend at dawn and dusk.
# day_len: the lit share of the day (perks can stretch it).
static func daylight_at(seconds_into_day: float, day_len: float = DAYLIGHT) -> float:
	var t: float = fposmod(seconds_into_day, SECONDS_PER_DAY)
	var lit: float = SECONDS_PER_DAY * day_len
	var half: float = TWILIGHT * 0.5
	if t < half:
		return 0.5 + 0.5 * (t / half)
	if t < lit - half:
		return 1.0
	if t < lit + half:
		return 1.0 - (t - (lit - half)) / TWILIGHT
	if t < SECONDS_PER_DAY - half:
		return 0.0
	return 0.5 * (t - (SECONDS_PER_DAY - half)) / half

# How far through the lit part of the day we are (0 at dawn, 1 at dusk);
# the sun's arc follows it. At night it runs again for the moon.
static func arc_at(seconds_into_day: float, day_len: float = DAYLIGHT) -> float:
	var t: float = fposmod(seconds_into_day, SECONDS_PER_DAY)
	var lit: float = SECONDS_PER_DAY * day_len
	if t < lit:
		return t / lit
	return (t - lit) / (SECONDS_PER_DAY - lit)
