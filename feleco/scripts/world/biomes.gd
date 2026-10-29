class_name Biomes
extends RefCounted

# The valley's three mini-ecosystems (4.7, The Mountain is Due):
#   RIVERBANK  within a few metres of the river: lush, trees and bushes
#   PLAINS     the open meadow floor: grass richest here, sparse trees
#   MOUNTAIN   the highlands ringing the meadow: thin grass, conifers
# Each species has home biomes; creatures drift back toward them (see
# MarkovAgent._update_herd) and are born and placed there.

const RIVERBANK: String = "riverbank"
const PLAINS: String = "plains"
const MOUNTAIN: String = "mountain"
const ALL: Array[String] = [RIVERBANK, PLAINS, MOUNTAIN]
# Riverbank: this close to the water's edge.
const BANK_REACH: float = 9.0
# Mountain homes run up the lower peaks. Past this, the slopes get too steep
# to settle and creatures drift back toward the saddles.
const OUTER_BAND: float = ValleyTerrain.WALK_RADIUS - 8.0

# species -> home biomes.
const HOMES: Dictionary = {
	"goat": [MOUNTAIN], "lion": [MOUNTAIN],
	"bear": [RIVERBANK, PLAINS, MOUNTAIN], "human": [RIVERBANK, PLAINS, MOUNTAIN], "mouse": [RIVERBANK, PLAINS, MOUNTAIN],
	"beetle": [RIVERBANK, PLAINS], "deer": [PLAINS, RIVERBANK], "falcon": [MOUNTAIN, PLAINS],
	"sheep": [PLAINS], "rabbit": [PLAINS, RIVERBANK], "wolf": [PLAINS, MOUNTAIN],
	"boar": [RIVERBANK, PLAINS], "robin": [RIVERBANK, PLAINS], "worm": [RIVERBANK],
	"fish": [RIVERBANK], "mushroom": [RIVERBANK, PLAINS],
}
# How rich the grass can grow in each biome (a share of the full density).
const GRASS_CAP: Dictionary = {RIVERBANK: 0.6, PLAINS: 1.0, MOUNTAIN: 0.16}

static var valley: ValleyTerrain = null

# Where the highlands begin: a ragged line, not a ruled circle. Bays of
# meadow reach up between the knolls and spurs of hill run down.
static func mountain_edge(x: float, z: float) -> float:
	var a: float = atan2(z, x)
	return ValleyTerrain.FLOOR_RADIUS + 2.0 + 5.0 * sin(a * 3.0 + 1.3) + 3.0 * sin(a * 7.0 + 0.4) + 1.5 * sin(a * 13.0 + 2.2)

static func at(x: float, z: float) -> String:
	if sqrt(x * x + z * z) > mountain_edge(x, z):
		return MOUNTAIN
	if valley != null and valley.river != null and valley.river._distance_to_bed(x, z) < BANK_REACH:
		return RIVERBANK
	return PLAINS

static func homes(species: String) -> Array:
	return HOMES.get(species, ALL)

static func fits(species: String, x: float, z: float) -> bool:
	return homes(species).has(at(x, z))

# Grass thins gradually up into the hills (an 8 m blend across the edge,
# broken up by a little noise) instead of stopping dead at a circle.
static func grass_cap(x: float, z: float) -> float:
	var r: float = sqrt(x * x + z * z)
	var edge: float = mountain_edge(x, z)
	var low: float = float(GRASS_CAP[RIVERBANK]) if valley != null and valley.river != null and valley.river.across_distance(x, z) < BANK_REACH else float(GRASS_CAP[PLAINS])
	var jitter: float = sin(x * 0.7 + z * 1.3) * cos(x * 1.1 - z * 0.6) * 3.0
	var t: float = smoothstep(edge - 4.0, edge + 4.0, r + jitter)
	return lerpf(low, float(GRASS_CAP[MOUNTAIN]), t)

# A random spot in one of the species' home biomes (the river kept clear).
static func random_point(species: String, director: SimulationDirector) -> Vector3:
	var h: Array = homes(species)
	for i: int in 40:
		var r: float
		if h == [MOUNTAIN]:
			r = randf_range(ValleyTerrain.FLOOR_RADIUS + 4.0, OUTER_BAND)
		elif not h.has(MOUNTAIN):
			r = sqrt(randf()) * (ValleyTerrain.FLOOR_RADIUS - 3.0)
		else:
			r = sqrt(randf()) * OUTER_BAND
		var a: float = randf() * TAU
		var p := Vector3(cos(a) * r, 0.0, sin(a) * r)
		if species == "fish" and valley != null and valley.river != null:
			return valley.river.random_point()
		if fits(species, p.x, p.z):
			return director.dry_land(p)
	return director.dry_land(Vector3(randf_range(-20, 20), 0, randf_range(-20, 20)))

# Which way a creature out of its homes should drift (unit-ish, flat), or zero.
static func pull(species: String, pos: Vector3) -> Vector3:
	if species == "fish" or species == "mushroom":
		return Vector3.ZERO
	var b: String = at(pos.x, pos.z)
	var h: Array = homes(species)
	var flat := Vector3(pos.x, 0.0, pos.z)
	var out: Vector3 = flat.normalized() if flat.length_squared() > 0.01 else Vector3.RIGHT
	# Mountain creatures live up IN the highlands, not pressed against the
	# foot of the peaks: past the outer band, drift back toward the middle.
	if b == MOUNTAIN and flat.length() > OUTER_BAND:
		return -out
	if h.has(b):
		return Vector3.ZERO
	if b == MOUNTAIN:
		# Too high: back down to the meadow (or the river, if that's home).
		if h.has(RIVERBANK) and not h.has(PLAINS) and valley != null and valley.river != null:
			var c: Vector3 = valley.river.sample(pos.x, pos.z).closest
			return Vector3(c.x - pos.x, 0.0, c.z - pos.z).normalized()
		return -out
	if h.has(MOUNTAIN) and not h.has(PLAINS) and not h.has(RIVERBANK):
		return out
	if h.has(RIVERBANK) and valley != null and valley.river != null:
		var c2: Vector3 = valley.river.sample(pos.x, pos.z).closest
		return Vector3(c2.x - pos.x, 0.0, c2.z - pos.z).normalized()
	# On the riverbank but meant for the open plains: step away from the water.
	if valley != null and valley.river != null:
		var c3: Vector3 = valley.river.sample(pos.x, pos.z).closest
		var away := Vector3(pos.x - c3.x, 0.0, pos.z - c3.z)
		return away.normalized() if away.length_squared() > 0.01 else out
	return Vector3.ZERO
