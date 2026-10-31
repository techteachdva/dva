class_name SeasonBook
extends RefCounted

# The Seasonal Sprites: which one wakes in which season, what its arrival
# says, and what claiming the first one earns.

const SPAWN_COUNT: int = 5
# season -> [species, notification].
const EVENTS: Dictionary = {
	"Spring": ["fairy", "Spring Has Sprung!"],
	"Summer": ["sunfolk", "Summer Is Heating Up!"],
	"Autumn": ["scarecrow", "Autumn has fallen over the Valley."],
	"Winter": ["snowman", "Winter entombs you."],
}
# id -> [name, cursor id, achievement, colour].
const SPRITES: Dictionary = {
	"fairy": ["Flower Fairy", "fairy", "Fairy Friend", Color(0.98, 0.55, 0.8)],
	"sunfolk": ["Sunflowerfolk", "sunflower", "Child of the Sun", Color(0.98, 0.8, 0.2)],
	"scarecrow": ["Jack-o'-Scarecrow", "pumpkin", "Harvest Horror", Color(0.95, 0.5, 0.12)],
	"snowman": ["Snowperson", "snowflake", "Cold Shoulder", Color(0.8, 0.92, 1.0)],
}

static func color(id: String) -> Color:
	return SPRITES[id][3]

static func is_sprite(id: String) -> bool:
	return SPRITES.has(id)

# Damage with no armour and no ceremony: a snowball really does just 1.
static func hurt(target: Node3D, amount: float) -> void:
	if target == null or not is_instance_valid(target) or target.get("health") == null:
		return
	var left: float = float(target.get("health")) - amount
	target.set("health", left)
	if left <= 0.0 and target.has_method("die"):
		target.die()

# The first claim of each kind earns its achievement and cursor for good.
static func on_claim(gc: Node, id: String, at: Vector3) -> void:
	if gc == null or not is_sprite(id):
		return
	var row: Array = SPRITES[id]
	if gc.record("achievement", id) == null:
		gc.set_record("achievement", id, true)
		FXManager.show_dramatic_text(at + Vector3.UP * 3.0, "Achievement: %s!" % row[2], row[3])
	if Cosmetics.grant(gc, row[1]):
		FXManager.show_dramatic_text(at + Vector3.UP * 4.5, "Unlocked: %s cursor!" % row[0], row[3])
