# Physix — Core Memory Seed

> **Purpose:** This file is auto-injected at the start of every Claude Code session in this project. It contains sacred constants, architecture facts, and design rules that must never be violated without explicit user approval.
> **Last updated:** 2026-05-11
> **Engine:** Godot 4.6.2, GL Compatibility renderer, JoltPhysics3D

---

## 1. Project Identity

- **Game:** Physix — physics-based ball-rolling game for middle school students.
- **Structure:** 6 worlds x 6 levels + 6 bonus levels = 42 total.
- **Main scene:** `res://scenes/main.tscn` (persistent root; levels loaded as children under `$World`).
- **Viewport:** 1280x720, exclusive fullscreen, stretch mode `canvas_items`, aspect `expand`.
- **Physics:** JoltPhysics3D, 60 Hz.
- **Ball:** `RigidBody3D`, `contact_monitor=true`, `max_contacts_reported=4`, `can_sleep=false`.

---

## 2. Sacred Physics Parameters

These create the "feel." Do **not** change without redesigning all levels.


| Parameter                | Value                                | File                    |
| ------------------------ | ------------------------------------ | ----------------------- |
| `max_forward_speed`      | 50.0 (ramps from base 32.0)          | `scripts/player.gd:14`  |
| `base_max_forward_speed` | 20.0                                 | `scripts/player.gd:30`  |
| `forward_push`           | 5.0                                  | `scripts/player.gd:13`  |
| `base_forward_push`      | 7.0                                  | `scripts/player.gd:31`  |
| `speed_ramp_rate`        | 1.2 (ramps to 1.6x base over time)   | `scripts/player.gd:18`  |
| `gravity_scale`          | 1.20                                 | `scripts/player.gd:52`  |
| `steer_force`            | 26.0                                 | `scripts/player.gd:4`   |
| `max_lateral_speed`      | 16.0                                 | `scripts/player.gd:5`   |
| `jump_impulse`           | 3.0                                  | `scripts/player.gd:6`   |
| `jump_hold_force`        | 55.0                                 | `scripts/player.gd:7`   |
| `jump_hold_time_max`     | 0.10                                 | `scripts/player.gd:8`   |
| `jump_max_velocity`      | 9.5                                  | `scripts/player.gd:9`   |
| `jump_release_mult`      | 0.25 (cut velocity on early release) | `scripts/player.gd:10`  |
| `jump_min_hold_time`     | 0.04                                 | `scripts/player.gd:11`  |
| `jump_buffer_time`       | 0.08                                 | `scripts/player.gd:12`  |
| `coyote_time`            | 0.10                                 | `scripts/player.gd:15`  |
| `DEATH_Y`                | -100.0                               | `scripts/player.gd:296` |


### Derived physics rules

- **Speed ramp:** `max_forward_speed` moves toward `base * 1.6` at `speed_ramp_rate * delta * 2.0`.
- **Slope compensation:** forward force is projected onto ground normal. Downhill boost = `clampf(normal.z * 2.2, -0.40, 0.55)`.
- **Lane centering:** when not steering and on ground, gentle pull toward segment center (`offset * 2.0` deadband at 0.35).
- **Air drag:** `-linear_velocity.x * 1.2`, `-linear_velocity.z * 0.3` when airborne.

---

## 3. Autoloads & Responsibilities


| Name            | Script                                | Role                                                                                          |
| --------------- | ------------------------------------- | --------------------------------------------------------------------------------------------- |
| `GameManager`   | `scripts/autoloads/game_manager.gd`   | Runtime state: score, lives, coins, total_stars, per-level tracking, star/rank calculation.   |
| `LevelManager`  | `scripts/autoloads/level_manager.gd`  | Save/load (`user://physix_save.dat`), unlock logic, shop ownership, coin persistence, medals. |
| `AudioManager`  | `scripts/autoloads/audio_manager.gd`  | Music + SFX, buses, volume, loop/random/track modes, fade tweens.                             |
| `GhostManager`  | `scripts/autoloads/ghost_manager.gd`  | Records ghosts at 10 Hz, saves/loads to `user://ghosts/`. Max 1200 samples (~120s).           |
| `GhostAnalyzer` | `scripts/autoloads/ghost_analyzer.gd` | Auto-patches level JSONs based on ghost metrics.                                              |
| `TestHarness`   | `scripts/test_harness.gd`             | Automated bot test runner for all 42 levels. Timeout 90s per level.                           |


### Save data keys

`unlocked`, `stars`, `ranks`, `best_times`, `coins_collected`, `shop_items`, `equipped_skin/theme/material/music`, `buffs`, `medals`, `music_mode`, `music_loop`, `bonuses`.

---

## 4. Level JSON Schema

File path: `res://levels/{world}-{level}.json`

```json
{
  "name": "Level Name",
  "slope": 12,
  "par_time": 22,
  "segments": [
    {"z0": 0, "z1": -50, "w": 12, "x": 0, "y": 0, "ramp": -0.5, "jump": false, "ice": false}
  ],
  "coins": [{"z": -25, "x": 0, "y": 2.2}],
  "finish_z": -260,
  "checkpoints": [-115, -185],
  "obstacles": [
    {"kind": "checkpoint", "z": -115, "x": 0},
    {"kind": "speed_boost", "z": -60, "x": 0, "strength": 14.0},
    {"kind": "brake_pad", "z": -60, "x": 0, "strength": 8.0},
    {"kind": "gravity", "z": -100, "x": 0, "type": 1, "multiplier": 2.0, "length": 20.0},
    {"kind": "wind", "z": -120, "x": 0, "force": 15.0, "direction": [1,0,0], "length": 20.0},
    {"kind": "move", "z": -140, "x": 0, "axis": [0,0,1], "distance": 6.0, "speed": 3.0},
    {"kind": "ice", "z": -160, "x": 0, "length": 12.0, "width": 7.5},
    {"kind": "magnet", "z": -180, "x": 0, "magnet_type": "attract", "strength": 8.0, "length": 10.0},
    {"kind": "spike", "z": -200, "x": 0, "width": 6.0, "length": 2.0},
    {"kind": "bumper", "z": -220, "x": 0, "force": 20.0},
    {"kind": "hoop_bonus", "z": -230, "x": 0, "y": 2.5, "boost": 28.0},
    {"kind": "hoop_cp", "z": -240, "x": 0, "y": 2.5}
  ],
  "medal_times": {"bronze": 20.0, "silver": 14.0, "gold": 10.0}
}
```

### Segment fields


| Field      | Type  | Meaning                                                  |
| ---------- | ----- | -------------------------------------------------------- |
| `z0`, `z1` | float | Start/end Z (forward = more negative)                    |
| `w`        | float | Track width: 5 (hard) to 12 (highway)                    |
| `x`        | float | Lateral offset                                           |
| `y`        | float | Elevation above slope baseline                           |
| `ramp`     | float | Height change: -3 (steep downhill) to +3 (uphill)        |
| `jump`     | bool  | Auto-ramp launch pad (overrides to 2.5 if flat/positive) |
| `ice`      | bool  | Low-friction surface                                     |


### Obstacle `kind` values

`checkpoint`, `speed_boost`, `brake_pad`, `gravity` (type 0=BOOST,1=REDUCE,2=REVERSE,3=ZERO), `wind`, `move`, `ice`, `magnet`, `spike`, `bumper`, `hoop_bonus`, `hoop_cp`.

---

## 5. The Three Pillars of Design

1. **Momentum Economics** — Speed must be earned, readable, conserved, and tested. Never place cheap traps in high-speed sections.
2. **Slope-First Geometry** — Slopes are the primary mechanic. Flat (`ramp=0`) is a **rest zone**, not the default.
3. **Modular, Validated Generation** — Assemble levels from ~15 playtested modules. Validate every module with the bot (90%+ success) before production use.

### Roller Coaster Rhythm Cycle

Every level must repeat this 2-3 times:

```
BUILD-UP (Tension) -> RELEASE (Speed) -> REST (Breathing Room) -> REPEAT
```


| Phase    | Geometry                           | Feel                     |
| -------- | ---------------------------------- | ------------------------ |
| Build-Up | `ramp > 0`, `w = 5-7`, ice/gravity | Slow, careful, tense     |
| Release  | `ramp < -2`, `w = 9-12`, gap/boost | Fast, exhilarating, flow |
| Rest     | `ramp = 0`, `w = 10`, no obstacles | Calm, recover, breathe   |


### Anti-Patterns (Never Do)

- Obstacles placed within Track geometry.
- Too many obstacles placed too close together.
- Checkpoint hoops within Track or obstacle geometry.
- Random zigzags, uniform flatness, narrow everywhere.
- Gaps without speed setup (pre-gap downhill or boost).
- Checkpoints at top of ramps (respawn with 0 speed = death).
- Walls on both sides of fast sections.
- Blind jumps (landing must be visible 1.5+ seconds before takeoff).
- Mixing all mechanics at once (one new mechanic per world; synthesis only in W6).

---

## 5.5 Research Synthesis — What Makes Ball-Rolling Fun

 distilled from *Super Monkey Ball*, *Marble Madness*, and *Trackmania*.

### The 30-Second Rule (SMB)

- Every level should be completable in ~30–60 seconds at normal speed.
- Short loops = "just one more try" addiction. A 4-minute track is too long for arcade replayability.
- In Physix: target **par_time 20–35s** for bonus levels, **35–55s** for main levels.

### Architectural Precision (SMB + Marble Madness)

- Treat every segment as a **structural object** with deliberate angles, not arbitrary terrain.
- Elevation (heightmap thinking) dictates momentum. The ball's path is physics, not animation.
- In Physix: every `ramp` value must serve the speed profile. No decorative flatness.

### Speed Is Relative (Trackmania)

- A track at max speed 100% of the time feels **dull**. Mix slow (uphill/narrow) with fast (downhill/wide).
- Corners are "natural brakes" — use `ramp > 0` and `w` narrowing to force deceleration without killing flow.
- In Physix: follow the roller-coaster rhythm strictly. Never more than 2 consecutive segments of the same speed class.

### Illusion of Speed (Trackmania)

- Tunnels, arches, and close-proximity walls make the player **feel** faster than they are.
- Wide open sky = feels slow even at high speed.
- In Physix: use `w = 6–8` tunnels after highways, or low overhangs (future feature), to amplify perceived velocity.

### Risk vs. Reward Paths (SMB Warp Goals)

- Every level should have at least one **harder route** that offers more coins or a faster line.
- The safe path is automatic; the risky path is the skill check.
- In Physix: place 20–30% of coins on outer edges, high ledges, or inside bumper fields. Never make the main path depend on these coins.

### Low-Speed Viability (Trackmania)

- Every gap, turn, and obstacle must be **doable from a checkpoint respawn** (low speed).
- But it must also be **pleasant at high speed** for players hunting gold medals.
- In Physix: test every module with the bot at both base speed (32) and ramped speed (48). If the bot can't clear a gap at 32, the gap is unfair.

### Uphill = Hard, Downhill = Payoff (Trackmania + Marble Madness)

- Uphill sections are the most complex part of any track. They require precision and punish mistakes.
- Downhill sections are the reward. They should feel like release, not danger.
- In Physix: `ramp > 0` sections should be short (1–2 segments) and followed immediately by a downhill or boost. Never chain 3+ uphill segments.

### Minimalism & Readability (Marble Madness)

- Clean visuals so players can **read slopes** and anticipate momentum shifts.
- Avoid visual noise near critical jumps or turns.
- In Physix: keep coin clusters and obstacles away from jump takeoffs. The 1.5-second visibility rule applies to geometry, not just landing zones.

---

## 6. Module Database (Approved Archetypes)


| Module           | Signature                                  | Constraints                             |
| ---------------- | ------------------------------------------ | --------------------------------------- |
| **Highway**      | `w=10-12`, `ramp=-0.5`, long Z span        | Must be followed by build-up or gap     |
| **Funnel**       | `w=10->7->5->7->10`                        | Narrowest point gets coin or checkpoint |
| **Ski Jump**     | `ramp=-3->0`, gap at end                   | Preceded by uphill or boost pad         |
| **Switchback**   | `x` oscillates, `w=6-8`                    | Gaps only at inflection points          |
| **Half-Pipe**    | Banked walls (`bank=30-45deg`)             | `w >= 8`                                |
| **Corkscrew**    | Progressive `rotation.z` over 4-6 segments | Needs sustained speed                   |
| **Bumper Arena** | `w=14`, diamond bumper grid                | Coins in ricochet paths                 |
| **Step-Up**      | `y` increments by 1.0 per segment          | Too slow = roll backward                |
| **Gravity Well** | `gravity=reverse` in a bowl                | Wide enough to escape                   |
| **Wind Tunnel**  | `wind_force=20-26`                         | Counter-steer required                  |
| **Ice S-Curve**  | `ice=true`, smooth `x` shifts              | Risk coins on outer edge                |


### World Assembly Templates

- **W1 (Beginner):** `Highway -> Funnel -> Ski Jump`
- **W2 (Ice):** `Ice S-Curve -> Funnel -> Ski Jump`
- **W3 (Gravity):** `Step-Up -> Gravity Well -> Highway`
- **W4 (Bumper):** `Bumper Arena -> Switchback -> Bumper Arena`
- **W5 (Wind):** `Wind Tunnel -> Switchback -> Wind Tunnel`
- **W6 (Mastery):** `Half-Pipe -> Corkscrew -> Step-Up -> Bumper Arena -> Ski Jump`

---

## 7. Checkpoint & Coin Rules

### Checkpoints

- Place **after** hard sections, **in rest zones** (wide, flat, no obstacles).
- Never in narrow sections (`w < 7`).
- One checkpoint per rhythm cycle.

### Coins

- 20-30% on **risk paths** (outer edges, high ledges, inside bumper fields).
- Never after speed sections with no reaction time.
- Never where missing the coin means unavoidable death.

---

## 8. World Progression


| World | Name              | Color                     | Unlock Stars | Concept               |
| ----- | ----------------- | ------------------------- | ------------ | --------------------- |
| 1     | Beginner's Slope  | `Color(0.20, 0.78, 0.35)` | 0            | Gravity & Motion      |
| 2     | Friction Falls    | `Color(0.20, 0.55, 0.90)` | 6            | Friction & Momentum   |
| 3     | Gravity Gulch     | `Color(0.90, 0.60, 0.10)` | 18           | Variable Gravity      |
| 4     | Momentum Mountain | `Color(0.80, 0.15, 0.15)` | 36           | Collisions & Energy   |
| 5     | Quantum Peaks     | `Color(0.70, 0.10, 0.90)` | 54           | Wind & Fluid Dynamics |
| 6     | The Sixth Force   | `Color(0.10, 0.80, 0.85)` | 72           | Magnetism & Polarity  |


### Unlock rule

To unlock next world: **at least 2 stars on every level** in the current world.

### Star rating

- 1 star = finish
- 2 stars = collect at least half the coins
- 3 stars = collect every coin

### Rank ladder

`F -> D -> C -> B -> A -> S -> S+`

---

## 9. Architecture & Scene Loading

- `Main` (`scripts/main.gd`) is a persistent singleton root. Levels are loaded as children under `$World`, **not** via `change_scene_to_file()`. This keeps `AudioManager` alive.
- `Main.instance` static reference is set in `_ready()`.
- Level scenes are at `res://scenes/levels/world_{n}/level_{n}_{m}.tscn`.
- Bonus scenes are at `res://scenes/levels/bonus/bonus_{n}.tscn`.

### Level generation (`scripts/level_generator.gd`)

- `@tool` script attached to `TrackRoot`.
- Auto-detects baked children (`StaticBody3D` named `Seg_`*). If present, skips regeneration and only applies materials.
- Reads `world_number` and `level_number` from parent `GameLevel`.
- `_build_runway()` creates 600-unit infinite runway past finish for sunset roll.

### Material application (`scripts/track_builder.gd`)

- Shared material cache (`static var _mat_cache`).
- Tags via `set_meta("mat_type", "...")`: `track`, `wall`, `danger`, `boost`, `ice`, `moving`, `checkpoint`, `finish`, `wind`, `gravity`.
- Theme overrides: `theme_neon`, `theme_nature`, `theme_space`.

---

## 10. Camera System (`scripts/game_level.gd`)

```gdscript
CAM_BASE_FOV   = 70.0      CAM_MAX_FOV   = 85.0
CAM_BASE_OFFSET = Vector3(0.0, 5.5, 14.0)
CAM_MAX_OFFSET  = Vector3(0.0, 7.5, 20.0)
CAM_BASE_LOOK   = Vector3(0.0, 0.5, -22.0)
CAM_MAX_LOOK    = Vector3(0.0, 1.0, -35.0)
CAM_SMOOTH      = 9.0
CAM_FOV_SMOOTH  = 4.0
```

- Speed ratio curve: `pow(speed_ratio, 1.7)`.
- **Finale mode:** On finish, camera locks for `FINALE_DURATION = 4.0` seconds. `FINALE_CAM_RISE = Vector3(0.0, 4.5, 12.0)`.

---

## 11. Shaders


| Shader          | Path                                    | Type          | Purpose                                                                                                           |
| --------------- | --------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------- |
| `lava_lamp_sky` | `assets/shaders/lava_lamp_sky.gdshader` | `spatial`     | Sky sphere. 3D FBM noise on `VERTEX` direction. `render_mode unshaded, cull_front`. **No `depth_test_disabled`**. |
| `lava_lamp_2d`  | `assets/shaders/lava_lamp_2d.gdshader`  | `canvas_item` | UI / world map backdrop. Same blob logic + `rainbow_mode` + bottom vignette.                                      |


### Uniforms

- `base_color` (Color)
- `speed` (float, 0-1)
- `rainbow_mode` (bool, 2D only)

### Sky sphere tints (`scripts/sky_sphere.gd`)

```gdscript
WORLD_COLORS = {
  1: Color(1.0, 0.55, 0.1),   # warm amber
  2: Color(0.2, 0.7, 1.0),     # ice blue
  3: Color(0.7, 0.2, 1.0),     # gravity purple
  4: Color(1.0, 0.2, 0.2),     # bumper red
  5: Color(0.2, 0.9, 0.6),     # wind teal
  6: Color(1.0, 0.9, 0.3),     # mastery gold
}
```

---

## 12. Input Map


| Action        | Keys             |
| ------------- | ---------------- |
| `steer_left`  | A / Left Arrow   |
| `steer_right` | D / Right Arrow  |
| `jump`        | Space / Up Arrow |
| `brake`       | S / Down Arrow   |
| `pause`       | Escape           |


---

## 13. Shop & Equipment

### Permanent unlocks

- **Skins:** `skin_gold`, `skin_neon`, `skin_crystal` (cosmetic albedo/emission).
- **Themes:** `theme_neon`, `theme_nature`, `theme_space` (track/wall tint).
- **Music:** `chill`, `action`, `retro` (locked by default).
- **Materials:** `mat_rubber` (friction 0.9, bounce 0.05, mass 1.2), `mat_metal` (0.35/0.15/2.0), `mat_bouncy` (0.15/0.65/0.7).

### Consumable buffs

- `buff_double_jump` (3 charges)
- `buff_magnet` (3 charges)
- `buff_shield` (1 charge, consumed on death)
- `buff_speed` (1 charge, +20% max speed)

---

## 14. Bot Controller (`scripts/bot_controller.gd`)

- Attached as child of `Player`.
- **Predictive jump:** velocity-scaled trigger ~0.22s before gap edge. Single-frame tap (`_jump_tap`) prevents floating.
- **Ice steering:** gain reduced to 0.4x.
- **Speed management:** brakes if off-target + too fast, or narrow landing.
- **Look-ahead:** 18.0 units.
- **Gap detection:** 8.0 units (metadata + raycast fallback).

---

## 15. Ghost System (`scripts/autoloads/ghost_manager.gd`)

- Records at **10 Hz** (`SAMPLE_INTERVAL = 0.1`).
- Stores: `t`, `px/py/pz`, `rx/ry/rz/rw`, `vx/vy/vz`, `steer`, `jump`, `brake`, `dead`.
- Max 1200 samples (~120s).
- Saves to `user://ghosts/w{world}_l{level}.json`.
- Only overwrites if new time is better.

---

## 16. Test Harness (`scripts/test_harness.gd`)

- Entry: `TestHarness.start_test_run()`.
- Iterates all 36 main + 6 bonus levels.
- Timeout: `LEVEL_TIMEOUT_SEC = 90.0`.
- Attaches bot, logs pass/fail/timeout/deaths/coins.
- Results saved to `user://test_results.json`.
- Gives bot 99 lives.

---

## 17. Cheat Codes (Main Menu)

Type in main menu:

- `jilly` — unlock all levels
- `coins` — +100 coins
- `lives` — +100 lives

---

## 18. Key File Tree

```
scripts/
  autoloads/
    audio_manager.gd
    game_manager.gd
    ghost_analyzer.gd
    ghost_manager.gd
    level_manager.gd
  obstacles/
    bumper.gd, checkpoint.gd, gravity_zone.gd, hoop.gd,
    ice_patch.gd, magnet_zone.gd, moving_platform.gd,
    obstacle_base.gd, spike_trap.gd, speed_boost.gd,
    tutorial_trigger.gd, wind_zone.gd
  bot_controller.gd
  game_level.gd
  ghost_ball.gd
  hud.gd
  level_editor.gd
  level_generator.gd
  level_serializer.gd
  main.gd
  main_menu.gd
  player.gd
  shop.gd
  sky_sphere.gd
  test_harness.gd
  track_builder.gd
  world_map.gd
  world_map_node.gd
scenes/
  main.tscn, main_menu.tscn, world_map.tscn,
  game_level.tscn, sky_sphere.tscn, level_editor.tscn
  levels/world_1/level_1_1.tscn ... world_6/level_6_6.tscn
  levels/bonus/bonus_1.tscn ... bonus_6.tscn
  obstacles/ (checkpoint, bumper, wind_zone, gravity_zone, etc.)
  ui/shop_panel.tscn, ui/world_map_node.tscn
  player/player.tscn, player/ghost_ball.tscn
levels/
  1-1.json ... 6-6.json
assets/shaders/
  lava_lamp_sky.gdshader
  lava_lamp_2d.gdshader
```

---

## 19. Recent Fixes & Gotchas

- **Sky shader seam:** Fixed by sampling noise on `VERTEX` direction vector instead of `atan`-based UVs.
- **Sky overdraw:** Removed `depth_test_disabled` from spatial shader so it doesn't draw over geometry.
- **Bot floating:** Fixed with single-frame `_jump_tap` flag and `_airborne_time` guard.
- **Ghost quaternion crash:** Added `.normalized()` before `slerp()` in `ghost_ball.gd`.
- **Analyzer corruption:** Added minimum 30 samples + 3s play time guards; stores `original_z0/z1` before modifying segments.
- **Array type mismatch:** JSON arrays need `_to_dict_array()` helper; `as Array[Dictionary]` fails on untyped JSON.
- **Camera panning:** Right-click pan uses `_input` (before UI nodes steal it) and `get_viewport().get_mouse_position()` (screen-space) to avoid feedback loops.
- **Menu staggered reveal:** `_animate_intro()` uses `create_tween().set_parallel(false)` with `base_delay=0.35`, `stagger=0.10`.

---

## 20. Design Workflow (From CLAUDE.md)

When designing levels, follow the Structured Decomposition Pipeline:

```
1. Design Intent      -> Write a sentence.
2. Constraint Extract -> Derive segment params.
3. Module Selection   -> Pick from approved module database.
4. Layout Generation  -> Assemble segments with speed profile.
5. Validation         -> Bot test: Can it clear? Is checkpoint valid?
6. Repair             -> Adjust module constraints, not segment numbers.
7. Integration        -> Only now add to LEVELS dictionary / JSON.
```

**Bot-as-Validator:** Only mark a module "approved" after 90%+ bot success rate. If the bot fails, adjust **module constraints**, not individual segment numbers.