class_name RareLooks
extends RefCounted

# Rare coats that spawn on their own. Each one is a whole brand: every body
# part already has its colour, hide, size and shape. Nothing is mixed.

const CHANCE: float = 0.045
const INHERIT: float = 0.5

static func roll(data: AgentData, parent: Node = null) -> void:
	if data == null or data.species.is_empty() or data.species == "mushroom" or not data.brand.is_empty():
		return
	if parent is MarkovAgent and (parent as MarkovAgent)._data != null:
		var inherited: String = str((parent as MarkovAgent)._data.brand.get("name", ""))
		if not inherited.is_empty() and randf() < INHERIT and _by_name(inherited) >= 0:
			_apply(data, _by_name(inherited))
			return
	if randf() > CHANCE:
		return
	_apply(data, randi() % _PRESETS.size())

static func _by_name(n: String) -> int:
	for i: int in _PRESETS.size():
		if _PRESETS[i]["name"] == n:
			return i
	return -1

static func _apply(data: AgentData, index: int) -> void:
	var src: Dictionary = _PRESETS[index]
	data.brand = (src["brand"] as Dictionary).duplicate(true)
	data.brand_slot = 0
	BrandBook.ensure(data)
	if data.node != null:
		FXManager.show_floating_text(data.node.global_position + Vector3.UP * 2.0, str(data.brand["name"]), Color(0.85, 0.8, 1.0))

static func _brand(name: String, school: String, colors: Array, texture: int, size: float, shapes: Array) -> Dictionary:
	var parts := {}
	for i: int in BrandBook.PARTS.size():
		parts[BrandBook.PARTS[i]] = {
			"color": colors[i],
			"texture": texture,
			"size": size,
			"shape": int(shapes[i]),
		}
	return {"name": name, "brand": {"name": name, "school": school, "parts": parts}}

# legs, tail, belly, back, neck, head, crown
static var _PRESETS: Array[Dictionary] = [
	_brand("Starfallen", "light", [
		Color(0.95, 0.9, 0.7), Color(1.0, 0.95, 0.8), Color(0.98, 0.96, 0.9),
		Color(0.75, 0.85, 1.0), Color(1.0, 0.9, 0.55), Color(1.0, 0.98, 0.9), Color(1.0, 0.92, 0.45),
	], 3, 0.62, [0, 0, 0, 3, 0, 2, 6]),
	_brand("Nightglass", "dark", [
		Color(0.08, 0.04, 0.1), Color(0.2, 0.05, 0.16), Color(0.05, 0.02, 0.06),
		Color(0.12, 0.08, 0.16), Color(0.45, 0.06, 0.1), Color(0.55, 0.1, 0.16), Color(0.7, 0.15, 0.2),
	], 5, 0.7, [1, 4, 5, 1, 4, 1, 6]),
	_brand("Halo", "light", [
		Color(0.96, 0.96, 0.98), Color(0.9, 0.92, 1.0), Color(1.0, 1.0, 0.98),
		Color(0.85, 0.88, 0.95), Color(1.0, 0.9, 0.6), Color(1.0, 1.0, 1.0), Color(1.0, 0.88, 0.4),
	], 0, 0.5, [0, 0, 0, 3, 0, 0, 6]),
	_brand("Thorn", "dark", [
		Color(0.12, 0.16, 0.08), Color(0.05, 0.04, 0.03), Color(0.18, 0.14, 0.08),
		Color(0.1, 0.18, 0.08), Color(0.08, 0.06, 0.04), Color(0.4, 0.08, 0.06), Color(0.75, 0.7, 0.55),
	], 7, 0.58, [0, 1, 5, 1, 0, 0, 6]),
	_brand("Moonwing", "light", [
		Color(0.75, 0.85, 0.95), Color(0.85, 0.9, 1.0), Color(0.92, 0.95, 1.0),
		Color(0.7, 0.82, 0.98), Color(0.8, 0.88, 1.0), Color(0.95, 0.97, 1.0), Color(0.8, 0.9, 1.0),
	], 1, 0.66, [0, 0, 2, 3, 2, 2, 6]),
	_brand("Embergut", "dark", [
		Color(0.18, 0.1, 0.08), Color(0.08, 0.04, 0.03), Color(0.55, 0.18, 0.06),
		Color(0.22, 0.1, 0.06), Color(0.1, 0.05, 0.04), Color(0.85, 0.3, 0.08), Color(1.0, 0.45, 0.1),
	], 6, 0.6, [1, 4, 2, 1, 4, 1, 6]),
]
