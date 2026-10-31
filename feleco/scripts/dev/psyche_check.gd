extends Node

# Dev: every event, the Vault's limit, sway and a fulfilled dream.
func _ready() -> void:
	await get_tree().process_frame
	var world: Node = load("res://scenes/world.tscn").instantiate()
	get_tree().root.add_child(world)
	get_tree().current_scene = world
	await get_tree().create_timer(4.0).timeout
	var sim: SimulationDirector = world.get_node("World")
	var a: MarkovAgent = get_tree().get_first_node_in_group("sheep")
	var m: Psyche = a.mind()
	print("TAGS ", m.tags, " dream ", m.dream, " | ", m.sentence())
	var life: float = a._lifespan
	var goal: String = Psyche.DREAMS[m.dream][1]
	m.dreamed = true
	for i: int in 70:
		m.note(goal)
	print("FULFIL done ", m.dreams_done, " life x", a._lifespan / life)
	for i: int in 400:
		for e: String in Psyche.EVENTS:
			m.note(e, "x")
	print("VAULT ", m.vault.size(), " bias ", m.bias)
	var mods := {"Flee": 0.5}
	m.sway(mods)
	print("SWAY ", mods)
	await get_tree().create_timer(12.0).timeout
	var filled: int = 0
	for d: AgentData in sim._agent_registry:
		if d.node is MarkovAgent and d.node.psyche != null and not d.node.psyche.vault.is_empty():
			filled += 1
	print("LIVE vaults ", filled, " of ", sim._agent_registry.size(), " fps ", Engine.get_frames_per_second())
	print(m.report().left(300))
	get_tree().quit()
