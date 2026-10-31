extends Node

# Dev: every menu screen, for glass and button clashes.
func _ready() -> void:
	var out: String = OS.get_cmdline_user_args()[0]
	await get_tree().process_frame
	get_tree().current_scene = null
	for n: String in ["ui/main_menu", "ui/field_guide", "ui/setup_board", "ui/greenhouse_shop", "ui/campaign_setup", "ui/challenge_setup", "ui/quest_board", "ui/betting_table", "ui/tuning_lab", "minigames/predator_brawl", "minigames/seed_golf", "minigames/stampede_sprint", "minigames/mycelium_sweep", "minigames/valley_dominion"]:
		get_tree().change_scene_to_file("res://scenes/%s.tscn" % n)
		await get_tree().create_timer(1.6).timeout
		get_viewport().get_texture().get_image().save_png("%s/%s.png" % [out, n.get_file()])
		print("SEEN ", n)
	get_tree().quit()
