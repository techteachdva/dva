extends Node3D

@export var level_name:   String = "Level"
@export var world_number: int    = 1
@export var level_number: int    = 1
@export var par_time:     float  = 45.0
@export var use_checkpoints: bool = true

# ── Randomized educational facts ──────────────────────────────────────────────
# Middle-school-appropriate facts drawn from physics, game dev, AI/coding,
# and behind-the-scenes design. Shown at the start of every level.

const FACTS: Array[String] = [
	# Physics & Science (20)
	"Newton's First Law: an object in motion stays in motion — that's why your ball keeps rolling even when you stop pushing!",
	"Friction is a force that slows things down. Ice patches have almost zero friction, just like real ice!",
	"Gravity pulls everything toward Earth's center at 9.8 m/s². In Physix, gravity zones can change that pull!",
	"Momentum = mass × velocity. A heavier metal ball has more momentum and is harder to stop.",
	"Elastic collisions transfer kinetic energy. When you hit a bumper, your ball bounces with almost the same speed!",
	"Action and reaction: every force has an equal and opposite partner. When you push the ball, it pushes back on the track!",
	"Wind is just fast-moving air molecules pushing on objects. Wind zones apply a constant sideways force!",
	"Potential energy becomes kinetic energy as you roll downhill. The higher you start, the faster you go!",
	"Terminal velocity happens when air resistance equals gravity. Real skydivers stop accelerating around 120 mph!",
	"Centripetal force keeps you moving in a circle. Without it, you'd fly off in a straight line!",
	"The coefficient of restitution measures bounciness. A bouncy ball has a high COR, rubber has a low one!",
	"Work = force × distance. Pushing your ball farther does more work and builds more speed!",
	"Power is how fast work gets done. A speed boost pad adds power to your ball instantly!",
	"Inertia is an object's resistance to changing speed. Heavy metal balls have more inertia than light ones!",
	"A vector has both direction and magnitude. Your ball's velocity is a 3D vector pointing where it's going!",
	"The normal force keeps you from falling through the floor. It's the floor pushing back up!",
	"Torque is a twisting force. When your ball spins, friction creates torque that makes it rotate!",
	"Fluid dynamics studies how liquids and gases move. Wind zones use simplified fluid force!",
	"Chaos theory says tiny changes make huge differences. Two runs that start almost the same can end totally differently!",
	"Superposition means forces add together. Gravity + wind + bumper = one big net force on your ball!",

	# Game Development & Computer Science (15)
	"Godot 4 uses a physics engine to simulate forces every frame — that's 60 calculations per second!",
	"3D games use X, Y, and Z axes. In Physix, Z is forward, X is sideways, and Y is up!",
	"Raycasting shoots an invisible laser to check what's below the ball. That's how the game knows if you're on the ground!",
	"Collision shapes are invisible boxes and spheres around objects. They tell the physics engine what can hit what!",
	"Delta time makes movement smooth on any computer. It measures exactly how long each frame took!",
	"Linear interpolation (lerp) smoothly moves the camera. It blends two positions instead of jumping!",
	"A scene graph is a tree of nodes. The TrackRoot holds all the track pieces as children!",
	"Shaders and materials control how things look. The ball's skin changes its color, glow, and shininess!",
	"State machines track what the player is doing. The game knows if you're jumping, falling, or on the ground!",
	"Particle systems create sparkles and dust. They're made of tiny images that fade out over time!",
	"Audio buses separate music from sound effects. You can turn down music without turning down jump sounds!",
	"The level editor saves levels as tiny text strings using compression. You can copy-paste a whole level!",
	"Base64 encoding turns binary numbers into letters and numbers you can share with friends!",
	"The game uses JSON to store your progress. It's a text format that both humans and computers can read!",
	"Version control tracks every change to the code. It's like a time machine for the game's files!",

	# AI & Coding (15)
	"Large Language Models read millions of books and websites to learn patterns. They predict what words come next!",
	"Prompt engineering is asking AI questions clearly. Better instructions = better code and answers!",
	"AI can write game code, but humans design the fun. The AI is the brush; Phil Carroll is the artist!",
	"Machine learning finds patterns in data. It's how AI learned that balls bounce and gravity pulls down!",
	"Tokens are chunks of text that AI reads. A paragraph might be 100 tokens; a whole book is millions!",
	"AI-assisted coding is called 'vibe coding' when you describe what you want and the AI writes it for you!",
	"Hallucinations are when AI makes up fake facts. That's why human designers always double-check the code!",
	"Claude (the AI that helped build this) was trained on diverse data — games, science, math, and stories!",
	"An algorithm is just a step-by-step recipe. The star-rating algorithm checks your speed, coins, and deaths!",
	"Compression makes files smaller. The level codes use gzip to squeeze a whole level into a few lines!",
	"Neural networks are loosely inspired by brains. They have layers of connected nodes that recognize patterns!",
	"Debugging means finding and fixing mistakes. Even AI-written code has bugs that need human eyes!",
	"Open-source means sharing code freely. Godot is open-source, so anyone can study how it works!",
	"Iteration means trying, failing, and improving. This game was built through hundreds of AI-human conversations!",
	"Autocomplete predicts what you'll type next. AI coding tools are like super-powered autocomplete for whole functions!",

	# Meet the Maker — Phil Carroll aka DM Zemo (10)
	"Physix was designed by Phil Carroll, also known as DM Zemo. He believes games should teach while they entertain!",
	"The game started as a simple slope idea and grew into five worlds through AI-assisted design sessions!",
	"Phil studied interactive storytelling and game psychology from legends like Sid Meier and Will Wright!",
	"Every level teaches one physics concept. World 1 is gravity, World 2 is friction, and World 5 combines everything!",
	"The 'Unholy Alliance' is a game design idea: the player and designer secretly work together to create fun!",
	"Phil's blog at powerwordskill.com explores game design, psychology, and how AI changes creativity!",
	"The game uses 'gain framing' — showing rewards instead of punishments — because science says it feels better!",
	"The level editor was inspired by Polytrack, a game where players share levels through copy-paste codes!",
	"Each world's color theme matches its physics concept: blue for ice, purple for gravity, green for nature!",
	"The ball's skins aren't just cosmetic — metal changes physics! Real designers blend looks with mechanics!",
]

var elapsed_time:   float   = 0.0
var is_running:     bool    = false
var checkpoint_pos: Vector3
var start_pos: Vector3

const CAM_BASE_FOV:       float   = 70.0
const CAM_MAX_FOV:        float   = 85.0
const CAM_BASE_OFFSET:    Vector3 = Vector3(0.0, 3.5, 14.0)
const CAM_MAX_OFFSET:     Vector3 = Vector3(0.0, 5.0, 20.0)
const CAM_BASE_LOOK:      Vector3 = Vector3(0.0, 0.0, -22.0)
const CAM_MAX_LOOK:       Vector3 = Vector3(0.0, 0.0, -35.0)
const CAM_SMOOTH:         float   = 9.0
const CAM_FOV_SMOOTH:     float   = 4.0

# Boost camera surge — temporary FOV spike and camera pullback
const BOOST_FOV_SURGE:    float   = 22.0
const BOOST_OFFSET_SURGE: Vector3 = Vector3(0.0, 0.0, -10.0)
const BOOST_LOOK_SURGE:   Vector3 = Vector3(0.0, 0.0, -18.0)
const BOOST_DECAY:        float   = 6.0

# Light speed surge — triggered when speed bar is nearly full
const LIGHT_FOV:          float   = 108.0
const LIGHT_OFFSET_SURGE: Vector3 = Vector3(0.0, 0.0, -14.0)
const LIGHT_LOOK_SURGE:   Vector3 = Vector3(0.0, 0.0, -28.0)
const LIGHT_ROLL_MAX:     float   = 0.12
const LIGHT_THRESHOLD:    float   = 0.92
const LIGHT_SMOOTH:       float   = 3.5

var _boost_surge: float = 0.0
var _light_speed: float = 0.0
var _smoothed_offset: Vector3 = CAM_BASE_OFFSET
var _smoothed_look: Vector3 = CAM_BASE_LOOK

@onready var player:        RigidBody3D = $Player
@onready var camera:        Camera3D    = $Camera3D
@onready var hud:           CanvasLayer = $HUD
var finish_zone:   Area3D      = null
@onready var respawn_timer: Timer       = $RespawnTimer

# Cached node lookups to avoid repeated recursive searches
var _coins_node: Node = null

var _ghost_node: MeshInstance3D = null

# Finale / sunset-roll state
var _in_finale: bool = false
var _finale_cam_pos: Vector3 = Vector3.ZERO
var _finale_look: Vector3 = Vector3.ZERO
const FINALE_DURATION: float = 4.0
const FINALE_CAM_RISE: Vector3 = Vector3(0.0, 4.5, 12.0)
const FINALE_LOOK: Vector3 = Vector3(0.0, 0.0, -400.0)

func _ghost_mgr() -> Node:
	return get_node_or_null("/root/GhostManager")

func _find_finish_zone() -> Area3D:
	var found := _find_node_recursive(self, "FinishZone")
	if found is Area3D:
		return found
	# Fallback: baked scenes may have renamed the Area3D, so look for
	# an Area3D containing a MeshInstance3D with finish metadata.
	for child: Node in _find_all_recursive(self):
		if child is Area3D:
			for sub: Node in child.get_children():
				if sub is MeshInstance3D and sub.get_meta("mat_type", "") == "finish":
					return child
	return null

signal level_completed(stars: int, time: float)
signal level_failed()

func _ready() -> void:
	start_pos = player.global_position
	checkpoint_pos = start_pos
	player.died.connect(_on_player_died)
	player.checkpoint_reached.connect(_on_checkpoint_reached)
	player.boosted.connect(_on_player_boosted)
	respawn_timer.timeout.connect(_on_respawn_timeout)
	GameManager.game_over.connect(_on_game_over)
	hud.pause_action.connect(_on_pause_action)
	# Snap camera to a sane starting position so it never starts far behind
	_smoothed_offset = CAM_BASE_OFFSET
	_smoothed_look = CAM_BASE_LOOK
	camera.global_position = start_pos + CAM_BASE_OFFSET
	camera.look_at(start_pos + CAM_BASE_LOOK, Vector3.UP)
	await get_tree().process_frame
	finish_zone = _find_finish_zone()
	if finish_zone != null:
		finish_zone.body_entered.connect(_on_finish_entered)
	_coins_node = _find_node_recursive(self, "Coins")
	_connect_coins()
	GameManager.start_level()
	_count_obstacles()
	_count_hoops()
	_spawn_catcher_rails()
	if get_node_or_null("/root/AudioManager") != null:
		AudioManager.play_music("world_%d" % world_number)
	_spawn_ghost()
	_show_physics_fact()
	_spawn_sky_sphere()

func _spawn_sky_sphere() -> void:
	var sky: Node = preload("res://scenes/sky_sphere.tscn").instantiate()
	sky.world_number = world_number
	sky.follow_target = player
	add_child(sky)

func _show_level_tutorial() -> void:
	_connect_tutorial_triggers()
	# Fallback tutorial hints for Level 1 of each world
	if level_number != 1:
		return
	var hint := ""
	match world_number:
		1:
			hint = "Welcome to Physix! Steer with LEFT/RIGHT, jump with SPACE. Collect every coin to earn 3 gold stars and unlock new worlds!"
		2:
			hint = "Friction Falls: once a glacier's highway, now a test of nerve. Ice patches remember every tremble — steer like you mean it."
		3:
			hint = "Gravity Gulch bends the rules. Purple = heavy, Cyan = light, Red = reverse, Yellow = zero G. Trust the fall."
		4:
			hint = "Momentum Mountain never stands still. Wind shoves, platforms drift, and hesitation is the only real enemy. Keep rolling."
		5:
			hint = "Quantum Peaks: every force you faced, gathered in one place. The mountain saved its best trick for last. Show it what you learned."
	if not hint.is_empty():
		hud.show_tutorial_hint(hint, 5.0)

func _connect_tutorial_triggers() -> void:
	for child: Node in get_children():
		_connect_tutorial_recursive(child)

func _connect_tutorial_recursive(node: Node) -> void:
	if node.has_signal("hint_triggered"):
		node.hint_triggered.connect(_on_tutorial_hint)
		node.hint_dismissed.connect(_on_tutorial_dismiss)
	for child: Node in node.get_children():
		_connect_tutorial_recursive(child)

func _on_tutorial_hint(text: String, duration: float) -> void:
	hud.show_tutorial_hint(text, duration)

func _on_tutorial_dismiss() -> void:
	hud.hide_tutorial_hint()

func _count_obstacles() -> void:
	GameManager.level_total_coins = _count_coins()
	GameManager.level_total_obstacles = get_tree().get_nodes_in_group("obstacles").size()

func _count_coins() -> int:
	if _coins_node == null:
		return 0
	var count := 0
	for child: Node in _coins_node.get_children():
		if child is Area3D:
			count += 1
	return count

func _count_hoops() -> void:
	var hoops := get_tree().get_nodes_in_group("hoops")
	var count := 0
	for hoop: Node in hoops:
		if hoop is Hoop:
			count += 1
	GameManager.set_total_hoops(count)

func _spawn_catcher_rails() -> void:
	# Catcher rails are invisible safety nets only — level_generator builds proper per-segment walls.
	# Width adapts to the widest possible track so the catcher always covers the edges.
	var half_width: float = 7.0  # covers all track widths up to w=14 (bumper arena)
	var track_root: Node = _find_node_recursive(self, "TrackRoot")
	if track_root == null:
		track_root = self
	for side: int in [-1, 1]:
		var catcher := Area3D.new()
		catcher.name = "CatcherRail%s" % ("L" if side == -1 else "R")
		catcher.position = Vector3(side * (half_width + 0.8), -1.2, 0.0)
		catcher.gravity_space_override = Area3D.SPACE_OVERRIDE_DISABLED
		catcher.monitorable = false
		track_root.add_child(catcher)
		var shape := CollisionShape3D.new()
		var box := BoxShape3D.new()
		box.size = Vector3(1.0, 4.0, 3000.0)
		shape.shape = box
		catcher.add_child(shape)
		catcher.body_entered.connect(_on_catcher_entered)

func _on_catcher_entered(body: Node3D) -> void:
	if body != player:
		return
	# Gentle redirect toward center with soft upward lift
	var push_x: float = -player.global_position.x * 0.8
	player.apply_central_impulse(Vector3(push_x, 3.5, 0.0))
	# Also kill lateral velocity to prevent repeated bounces
	player.linear_velocity.x *= 0.3


func _connect_coins() -> void:
	var coin_nodes: Array[Area3D] = []
	if _coins_node != null:
		for child: Node in _coins_node.get_children():
			if child is Area3D:
				coin_nodes.append(child)
	else:
		# Fallback: baked scenes may rename the Coins container, so
		# scan every descendant for Area3Ds whose name starts with "Coin".
		for child: Node in _find_all_recursive(self):
			if child is Area3D and child.name.begins_with("Coin"):
				coin_nodes.append(child)
	var idx := 0
	for coin: Area3D in coin_nodes:
		coin.add_to_group("coins")
		if level_number == 0:
			# Bonus levels: coins are one-time collectibles
			if LevelManager.is_coin_collected(world_number, level_number, idx):
				coin.visible = false
				coin.monitoring = false
			else:
				coin.body_entered.connect(_on_coin_collected.bind(coin, idx))
		else:
			# Main levels: coins respawn every run for easy grinding
			coin.visible = true
			coin.monitoring = true
			coin.body_entered.connect(_on_coin_collected.bind(coin, idx))
		idx += 1

func _find_node_recursive(root: Node, name_: String) -> Node:
	if root.name == name_:
		return root
	for child: Node in root.get_children():
		var found := _find_node_recursive(child, name_)
		if found != null:
			return found
	return null

func _find_all_recursive(root: Node) -> Array[Node]:
	var out: Array[Node] = [root]
	for child: Node in root.get_children():
		out.append_array(_find_all_recursive(child))
	return out

func _process(delta: float) -> void:
	_follow_camera(delta)
	_spin_coins(delta)
	if is_running:
		elapsed_time += delta
		if finish_zone != null and player.global_position.z < finish_zone.global_position.z:
			_on_finish_entered(player)
		var gm := _ghost_mgr()
		if gm != null:
			var steer := Input.get_axis("steer_left", "steer_right")
			var jumping := Input.is_action_pressed("jump")
			var braking := Input.is_action_pressed("brake")
			var dead: bool = player.get("_dead") if player.get("_dead") != null else false
			gm.record_sample(player.global_position, player.global_basis.get_rotation_quaternion(), player.linear_velocity, steer, jumping, braking, dead, delta)
		if _ghost_node != null:
			_ghost_node.update_time(elapsed_time)
		GameManager.add_speed_sample(player.linear_velocity.length())
		hud.update_timer(elapsed_time)
		hud.update_speed(player.linear_velocity.length(), player.max_forward_speed)
		hud.update_hoops(GameManager.level_hoops_passed, GameManager.level_total_hoops)

func _spin_coins(delta: float) -> void:
	var coin_nodes: Array[Node] = []
	if _coins_node != null:
		coin_nodes = _coins_node.get_children()
	else:
		for child: Node in _find_all_recursive(self):
			if child is Area3D and child.name.begins_with("Coin"):
				coin_nodes.append(child)
	for child: Node in coin_nodes:
		if child is Area3D and child.visible:
			for sub: Node in child.get_children():
				if sub is MeshInstance3D:
					sub.rotate_y(delta * 3.0)
					break

func _follow_camera(delta: float) -> void:
	if _in_finale:
		# Sunset roll: camera locks behind finish, watches ball shrink into horizon
		camera.fov = lerpf(camera.fov, 60.0, CAM_FOV_SMOOTH * delta)
		camera.global_position = camera.global_position.lerp(_finale_cam_pos, CAM_SMOOTH * delta * 0.5)
		camera.look_at(_finale_look, Vector3.UP)
		return

	# Decay boost surge
	if _boost_surge > 0.0:
		_boost_surge = maxf(0.0, _boost_surge - BOOST_DECAY * delta)

	# Speed ratio: 0 = stopped, 1 = absolute max possible speed
	var fwd_speed := absf(player.linear_velocity.z)
	var max_possible: float = player.base_max_forward_speed * 1.6 * player._boost_mult
	var speed_ratio: float = clampf(fwd_speed / max_possible, 0.0, 1.0)
	# Non-linear curve: first 50% of max speed gets ~30% of the effect
	var curve: float = pow(speed_ratio, 1.7)

	# Light speed ramp: activates when speed bar is nearly full
	var light_target: float = 1.0 if speed_ratio >= LIGHT_THRESHOLD else 0.0
	_light_speed = lerpf(_light_speed, light_target, LIGHT_SMOOTH * delta)

	# Apply boost surge + light speed to FOV and camera offsets
	var reduce_motion: bool = get_node_or_null("/root/LevelManager") != null and LevelManager.get_setting("reduce_motion", false)
	var surge_curve: float = pow(_boost_surge, 0.7)
	var light_curve: float = pow(_light_speed, 0.6)
	var target_fov: float = lerpf(CAM_BASE_FOV, CAM_MAX_FOV, curve)
	var target_offset := CAM_BASE_OFFSET.lerp(CAM_MAX_OFFSET, curve)
	var target_look := CAM_BASE_LOOK.lerp(CAM_MAX_LOOK, curve)
	if not reduce_motion:
		target_fov += BOOST_FOV_SURGE * surge_curve
		# Light speed adds massive FOV zoom
		target_fov = lerpf(target_fov, LIGHT_FOV, light_curve)
		target_offset += BOOST_OFFSET_SURGE * surge_curve
		target_offset = target_offset.lerp(target_offset + LIGHT_OFFSET_SURGE, light_curve)
		target_look += BOOST_LOOK_SURGE * surge_curve
		target_look = target_look.lerp(target_look + LIGHT_LOOK_SURGE, light_curve)
	camera.fov = lerpf(camera.fov, target_fov, CAM_FOV_SMOOTH * delta)

	# Smooth offset independently so speed changes don't jolt the camera
	var offset_smooth_weight: float = clampf(3.2 * delta, 0.0, 1.0)
	_smoothed_offset = _smoothed_offset.lerp(target_offset, offset_smooth_weight)
	_smoothed_look = _smoothed_look.lerp(target_look, offset_smooth_weight)

	var target := player.global_position + _smoothed_offset
	var look_target := player.global_position + _smoothed_look
	# Camera position follow — slightly more responsive than offset smoothing
	var cam_weight: float = clampf(CAM_SMOOTH * delta, 0.0, 1.0)
	camera.global_position = camera.global_position.lerp(target, cam_weight)
	# Compose screenshake on top of follow position
	if get_node_or_null("/root/CameraShaker") != null:
		camera.global_position += CameraShaker.shake_offset
	# Guard look_at against singularity (camera too close to look target)
	if camera.global_position.distance_squared_to(look_target) > 0.01:
		camera.look_at(look_target, Vector3.UP)

func _spawn_ghost() -> void:
	var gm := _ghost_mgr()
	if gm == null or not gm.has_ghost(world_number, level_number):
		return
	var g_data: Dictionary = gm.load_ghost(world_number, level_number)
	var samples: Array[Dictionary] = []
	var raw: Variant = g_data.get("samples", [])
	if raw is Array:
		samples.assign(raw)
	if samples.is_empty():
		return
	var ghost := MeshInstance3D.new()
	ghost.name = "GhostBall"
	var mesh := SphereMesh.new()
	ghost.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.2, 0.6, 1.0, 0.35)
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.metallic = 0.4
	mat.roughness = 0.2
	mat.emission_enabled = true
	mat.emission = Color(0.1, 0.4, 0.9, 1.0)
	mat.emission_energy_multiplier = 1.2
	ghost.material_override = mat
	ghost.set_script(preload("res://scripts/ghost_ball.gd"))
	ghost.start_ghost(samples)
	add_child(ghost)
	_ghost_node = ghost

func _show_physics_fact() -> void:
	var fact: String = FACTS[randi() % FACTS.size()]
	hud.show_intro(fact)
	var timer := get_tree().create_timer(6.0)
	await timer.timeout
	if not is_inside_tree():
		return
	hud.hide_intro()
	is_running = true
	var gm_rec := _ghost_mgr()
	if gm_rec != null:
		gm_rec.start_recording()
	_show_level_tutorial()

func _on_finish_entered(body: Node3D) -> void:
	if body != player or not is_running or _in_finale:
		return
	is_running = false
	if get_node_or_null("/root/AudioManager") != null:
		AudioManager.play_sfx("complete")

	var gm_stop := _ghost_mgr()
	if gm_stop != null:
		gm_stop.stop_recording()

	# ── Sunset roll: lock camera and watch the ball roll into the horizon ──
	_in_finale = true
	if finish_zone != null:
		_finale_cam_pos = finish_zone.global_position + FINALE_CAM_RISE
		_finale_look    = finish_zone.global_position + FINALE_LOOK
	else:
		_finale_cam_pos = player.global_position + FINALE_CAM_RISE
		_finale_look    = player.global_position + FINALE_LOOK

	await get_tree().create_timer(FINALE_DURATION).timeout
	if not is_inside_tree():
		return

	# ── Calculate results after the dramatic roll ──
	var total_coins := GameManager.level_total_coins
	var stars := GameManager.calculate_star_rating(
		elapsed_time, GameManager.level_coins, total_coins,
		GameManager.level_obstacles_cleared, GameManager.level_deaths, par_time,
		player.max_forward_speed
	)
	var rank := GameManager.calculate_rank(
		elapsed_time, GameManager.level_coins, total_coins,
		GameManager.level_obstacles_cleared, GameManager.level_total_obstacles, GameManager.level_deaths, par_time
	)

	# Report bot results
	var bot := _get_bot()
	if bot != null:
		bot.report_run_result(true, elapsed_time)

	# Medals
	var medals: Array[String] = []
	if use_checkpoints and not GameManager.checkpoint_used:
		medals.append("Fearless")
		LevelManager.award_medal(world_number, level_number, "no_checkpoint")
	if GameManager.level_deaths == 0:
		medals.append("First Try")
		LevelManager.award_medal(world_number, level_number, "first_try")
	if GameManager.perfect_path_eligible and GameManager.level_coins >= total_coins and GameManager.level_obstacles_cleared >= GameManager.level_total_obstacles and elapsed_time <= par_time:
		medals.append("Perfect Path")
		LevelManager.award_medal(world_number, level_number, "perfect_path")
	if GameManager.get_avg_speed() >= player.max_forward_speed * 0.75:
		medals.append("Speed Demon")
		LevelManager.award_medal(world_number, level_number, "speed_demon")

	var is_new_best := LevelManager.set_best_time(world_number, level_number, elapsed_time)
	if is_new_best:
		print("New best time for %d-%d: %.2f" % [world_number, level_number, elapsed_time])
		var gm_save := _ghost_mgr()
		if gm_save != null:
			gm_save.save_ghost(world_number, level_number, elapsed_time)
	LevelManager.complete_level(world_number, level_number, stars, rank)
	if level_number == 0:
		LevelManager.complete_bonus(world_number)
	level_completed.emit(stars, elapsed_time)
	var breakdown := ""
	if level_number == 0:
		breakdown = "Coins: %d of %d collected" % [GameManager.level_coins, maxi(total_coins, 1)]
	if GameManager.level_obstacles_cleared > 0:
		breakdown += "\nObstacles cleared: %d" % GameManager.level_obstacles_cleared
	if elapsed_time <= par_time:
		breakdown += "\nBeat par time!"
	elif elapsed_time <= par_time * 1.5:
		breakdown += "\nWithin time limit"
	hud.show_level_complete(stars, elapsed_time, rank, breakdown, medals)
	var action: String = await hud.level_complete_action
	match action:
		"retry":
			_restart_level()
		"world_map":
			Main.instance.load_world_map()
		"quit":
			get_tree().quit()

func _on_pause_action(action: String) -> void:
	match action:
		"retry":
			_restart_level()

func _restart_level() -> void:
	if world_number == 0:
		Main.instance.load_secret_level(world_number, level_number)
	elif level_number == 0:
		Main.instance.load_bonus_level(world_number)
	else:
		Main.instance.load_level(world_number, level_number)

func _on_player_boosted(_surge: float, _duration: float) -> void:
	_boost_surge = 1.0

func _on_player_died() -> void:
	if not is_running:
		return
	var gm_died := _ghost_mgr()
	if gm_died != null:
		gm_died.stop_recording()
	var bot := _get_bot()
	if bot != null:
		bot.on_player_died(player.global_position)
	is_running = false
	GameManager.lose_life()
	if GameManager.lives > 0:
		respawn_timer.start()

func _on_respawn_timeout() -> void:
	_reset_all_zones()
	player.reset_to(_get_respawn_pos())
	# Reset camera smoothing so it doesn't maintain a far offset after respawn
	_smoothed_offset = CAM_BASE_OFFSET
	_smoothed_look = CAM_BASE_LOOK
	camera.global_position = player.global_position + CAM_BASE_OFFSET
	is_running = true

func _reset_all_zones() -> void:
	for node: Node in get_tree().get_nodes_in_group("obstacles"):
		if node.has_method("_force_reset"):
			node._force_reset()

func _get_respawn_pos() -> Vector3:
	if use_checkpoints:
		var pos := checkpoint_pos
		# Raycast straight down to find the track surface so we never spawn
		# inside or below the floor. Also snap X to the segment centre in
		# case the checkpoint was placed off-track.
		var space_state := get_world_3d().direct_space_state
		var query := PhysicsRayQueryParameters3D.new()
		query.from = pos + Vector3.UP * 4.0
		query.to = pos + Vector3.DOWN * 10.0
		query.collision_mask = 1
		query.collide_with_areas = false
		var result := space_state.intersect_ray(query)
		if result.has("position"):
			var hit: Vector3 = result["position"]
			pos.y = hit.y + player.get_ball_radius() + 0.05
			var collider := result.get("collider", null) as Node3D
			if collider != null and collider.name.begins_with("Seg_"):
				pos.x = collider.position.x
		return pos
	return start_pos

func _on_checkpoint_reached(pos: Vector3) -> void:
	checkpoint_pos = pos
	if use_checkpoints and not GameManager.checkpoint_used:
		GameManager.checkpoint_used = true
	if get_node_or_null("/root/AudioManager") != null:
		AudioManager.play_sfx("checkpoint")
	var bot := _get_bot()
	if bot != null:
		bot.on_checkpoint_reached()

func _get_bot() -> Node:
	var bot := player.get_node_or_null("BotController")
	if bot != null and bot.has_method("report_run_result"):
		return bot
	return null

func _on_game_over() -> void:
	is_running = false
	var gm_over := _ghost_mgr()
	if gm_over != null:
		gm_over.stop_recording()
	level_failed.emit()
	hud.show_game_over()
	if get_node_or_null("/root/AudioManager") != null:
		AudioManager.stop_music()
	var timer := get_tree().create_timer(3.0)
	await timer.timeout
	if not is_inside_tree():
		return
	Main.instance.load_main_menu()

func _on_coin_collected(body: Node3D, coin: Area3D, coin_index: int) -> void:
	if body != player or not coin.visible:
		return
	coin.visible = false
	if is_instance_valid(coin):
		coin.set_deferred("monitoring", false)
	GameManager.add_coin()
	LevelManager.collect_coin(world_number, level_number, coin_index)
	if get_node_or_null("/root/AudioManager") != null:
		AudioManager.play_sfx("coin")
	_spawn_coin_sparkle(coin.global_position)

func _spawn_coin_sparkle(pos: Vector3) -> void:
	var particles := GPUParticles3D.new()
	particles.position = pos
	particles.amount = 10
	particles.lifetime = 0.35
	particles.one_shot = true
	particles.explosiveness = 0.9
	var mat := ParticleProcessMaterial.new()
	mat.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
	mat.emission_sphere_radius = 0.15
	mat.direction = Vector3.UP
	mat.spread = 120.0
	mat.initial_velocity_min = 2.0
	mat.initial_velocity_max = 5.0
	mat.scale_min = 0.04
	mat.scale_max = 0.1
	mat.color = Color(1.0, 0.85, 0.1, 0.9)
	mat.gravity = Vector3(0.0, -8.0, 0.0)
	particles.process_material = mat
	var mesh := BoxMesh.new()
	mesh.size = Vector3(0.05, 0.05, 0.05)
	particles.draw_pass_1 = mesh
	add_child(particles)
	particles.emitting = true
	var tw := create_tween()
	tw.tween_callback(particles.queue_free).set_delay(0.5)
