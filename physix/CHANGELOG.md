# Physix Development Changelog

A historical highlights reel of all major changes made to the Physix project.

---

## Overview

Physix is a Godot 4.6 physics-based ball-rolling game originally built for middle school students. The game features 6 worlds x 6 levels (36 main levels) + 6 bonus levels, a world map progression system, a full shop with cosmetics and buffs, and procedural level generation.

**Current version: 0.4.0**

---

## Phase 1: Core Game Architecture

### Foundation

- **Game engine**: Godot 4.6 with GL Compatibility rendering
- **Physics**: RigidBody3D ball rolling on flat tracks along the -Z axis
- **Player mechanics**: Steering (A/D or arrows), jump (space/up), forward momentum, coyote time, double-jump buff support
- **Star rating system**: Coin-based — 1 star = finish, 2 stars = 3+ coins, 3 stars = all coins
- **Rank system**: F → D → C → B → A → S → S+ based on time, coins, obstacles, deaths

### Autoload Systems

- `GameManager` — Global game state (score, lives, coins, stars, active buffs, level tracking)
- `LevelManager` — Save/load progression, world definitions, shop data, coin persistence, medal tracking
- `AudioManager` — SFX and music playback

### World Definitions (6 Worlds)


| World | Name              | Theme Color | Unlock Stars | Concept               |
| ----- | ----------------- | ----------- | ------------ | --------------------- |
| 1     | Beginner's Slope  | Green       | 0            | Gravity & Motion      |
| 2     | Friction Falls    | Blue        | 6            | Friction & Momentum   |
| 3     | Gravity Gulch     | Orange      | 18           | Variable Gravity      |
| 4     | Momentum Mountain | Red         | 36           | Collisions & Energy   |
| 5     | Quantum Peaks     | Purple      | 54           | Wind & Fluid Dynamics |
| 6     | The Sixth Force   | Cyan        | 72           | Magnetism & Polarity  |


---

## Phase 2: Level Design & Scaling

### Coin Placement

- Standardized all levels to contain **6 coins** placed along the track
- Coins are tracked per-level in save data with persistent collection state

### Track Geometry

- Tracks use BoxMesh/BoxShape3D with large Z sizes
- `TrackRoot` node positioned at `-size/2` so track spans from z=0 to z=-size
- Wall sub-resources (`WallMesh`, `WallShape`) define boundary collisions

### Level Length Scaling (~30-second gameplay)

To ensure each level takes roughly 30 seconds to complete, 7 single-segment levels were scaled to 2x Z-length:


| Level | Original Size | Scaled Size |
| ----- | ------------- | ----------- |
| 1-1   | 450           | 900         |
| 1-2   | 540           | 1080        |
| 2-1   | 510           | 1020        |
| 2-2   | 570           | 1140        |
| 3-1   | 680           | 1360        |
| 3-2   | 800           | 1600        |
| 4-1   | 720           | 1440        |


Player speed parameters: `max_forward_speed=32.0`, `forward_push=7.0`, `speed_ramp_rate=1.2` (ramps to 1.6x base over time).

### Repair Scripts (`.tscn` corruption fixes)

A series of Python repair scripts were created to fix scaling-induced corruption in Godot text scene files:

- `repair_and_scale.py` — Fixed syntax and scaled `level_1_1.tscn`
- `scale_remaining.py` — Scaled worlds 3-4 (introduced prefix corruption)
- `fix_trackroot.py` — Fixed double-scaled `TrackRoot` z in 4 files
- `fix_new_corruption.py` — Fixed prefix corruption in 3 newly scaled files, changed `WallShp` refs to `WallShape`
- `validate_scaled.py` — Validation script for scaled files

Key fixes included:

- Restored missing `[sub_resource` prefixes on same-line size declarations
- Fixed dropped closing `)` from Vector3/Transform3D lines
- Corrected `WallShp` references to point to existing `WallShape` sub-resource
- Validated TrackRoot z positions against `-track_size/2.0`

---

## Phase 3: Shop System

### Save Data Extension

Added to `LevelManager.save_data`:

- `shop_items` — Dictionary of owned items `{item_id: true}`
- `equipped_skin` / `equipped_theme` / `equipped_material` / `equipped_music` — Strings
- `unlocked_music` — Dictionary of unlocked tracks
- `buffs` — Dictionary `{buff_id: count}`

### Shop Categories

#### Cosmetics — Sphere Skins


| ID             | Name         | Cost | Effect                   |
| -------------- | ------------ | ---- | ------------------------ |
| `skin_gold`    | Gold Ball    | 50   | Golden albedo + emission |
| `skin_neon`    | Neon Ball    | 75   | Cyan glow                |
| `skin_crystal` | Crystal Ball | 100  | Transparent blue         |


#### Cosmetics — Level Themes


| ID             | Name        | Cost | Effect                    |
| -------------- | ----------- | ---- | ------------------------- |
| `theme_neon`   | Neon Nights | 50   | Purple/cyan track & walls |
| `theme_nature` | Nature      | 75   | Green/brown track & walls |
| `theme_space`  | Space       | 100  | Dark track with starfield |


#### Music Tracks


| ID             | Name        | Cost |
| -------------- | ----------- | ---- |
| `music_chill`  | Chill Mode  | 30   |
| `music_action` | Action Mode | 30   |
| `music_retro`  | Retro Mode  | 50   |


#### Mechanical Buffs


| ID                 | Name        | Cost | Effect            | Charges |
| ------------------ | ----------- | ---- | ----------------- | ------- |
| `buff_double_jump` | Double Jump | 40   | `max_jumps = 2`   | 3       |
| `buff_magnet`      | Coin Magnet | 30   | Attract radius 2x | 3       |
| `buff_shield`      | Shield      | 50   | Prevent one death | 1       |
| `buff_speed`       | Speed Boost | 25   | +20% max speed    | 1       |


### Player Integration

- `_apply_skin()` — Changes ball albedo, emission, metallic, roughness based on equipped skin
- `_apply_material()` — Swaps physics material (friction/bounce/mass) for rubber, metal, or bouncy
- `_apply_magnet()` — Pulls coins toward player when `buff_magnet` is active in `GameManager.active_buffs`
- Buff application at level start: `game_level._apply_buffs()` consumes buffs from `LevelManager` and applies them

### Track Builder Integration

- `themed_track_material(theme)` / `themed_wall_material(theme)` override track/wall colors
- `_apply_materials()` recursively applies materials based on `metadata/mat_type`
- `finish_material()` is bright green with emission for finish zones

---

## Phase 4: Bonus Coin Rush Levels

### Design

- 6 bonus levels (`bonus_1.tscn` through `bonus_6.tscn`)
- Long straight tracks with 60 coins and 12 speed boost pads
- Very short par times (~25 seconds)
- No obstacles — pure coin collection at high speed
- Rewards: coins + lives upon completion

### Dynamic Generation (`bonus_level.gd`)

- Extends `game_level.gd`
- Generates floor, walls, coins, boost pads, and finish zone at runtime
- Applies materials through `TrackRoot._apply_materials()`
- `SpeedBoost` class with `boost_strength = 22.0`

### World Map Integration

- Bonus nodes appear as "B" hexes on the world map
- Unlock condition: complete all 6 levels in a world
- Completed bonuses show gold checkmark; uncompleted show lock

---

## Phase 5: World Map Visual Overhaul

### Problem

The world map suffered from extreme visual chaos: all 6 worlds visible simultaneously, overlapping world region hex outlines, paths crossing everywhere, and no focal point.

### Solution

1. **Camera Focus**: Camera now zooms to `2.0x` and pans to center only the selected world cluster (~6-7 nodes visible at once instead of 42+)
2. **Dynamic Camera Target**: Camera target is the midpoint between the world center and the selected node, ensuring bonus/edge nodes stay on-screen
3. **World Region Simplification**: Removed overlapping hex outlines for all 6 worlds. Now only a very subtle tinted circle is drawn for the active world
4. **Path Filtering**: Only draws paths within the selected world or directly touching it. Cross-world bridges fade to 28% opacity
5. **Node Visibility**: Nodes from distant worlds are hidden; adjacent worlds ghost at 8% opacity for spatial context
6. **Grid Localization**: Background dot grid now renders only around the active world instead of the entire map
7. **Camera Limits Expanded**: `(-400, -300)` to `(2000, 1200)` to accommodate zoomed-in camera panning

### Node Layout (Hex Clusters)

Worlds arranged in a 3×2 honeycomb grid:

- Row 1: Worlds 1 (top-left), 3 (top-center), 5 (top-right)
- Row 2: Worlds 2 (bottom-left), 4 (bottom-center), 6 (bottom-right)
- Bonus nodes sit above/below each cluster

---

## Phase 6: Polish & Quality-of-Life

### Fullscreen at Start

- Added `window/size/mode=3` (exclusive fullscreen) to `project.godot`
- Viewport remains 1280×720 with `canvas_items` stretch mode

### Green Finish Zones

- `track_builder.gd` assigns bright green emission material to all `FinishZone` meshes
- Visual clarity for level endpoints

### Shop UI Fixes

- Buff items remain buyable even after purchase (charges-based system)
- Proper buy/equip/save/load wiring verified end-to-end

---

## Phase 7: UI Overhaul, Music Menu & Serializer Fixes

### World Map Redesign — Giant Hexagon Layout

The world map was completely restructured from a scattered 3×2 grid into one cohesive giant hexagon:

- **Layout**: 6 worlds arranged in a hexagonal ring around center (960, 540)
  - World 1 at top, then clockwise: W2 top-right, W3 bottom-right, W4 bottom, W5 bottom-left, W6 top-left
  - Each world cluster contains 6 level nodes in a small hex + 1 bonus node
- **Bonus inner ring**: All 6 bonus nodes sit in an inner hex ring connected to each other and to their parent world via spoke paths
- **Camera behavior**: Camera stays centered on `MAP_CENTER` with gentle `CAM_NUDGE = 0.18` toward selected node — no zooming, no panning across clusters
- **Path drawing**: All paths drawn at once (within-world rings, world-to-bonus spokes, bonus inner ring, and cross-world bridges)
- **World region tint**: Subtle hex outlines for all worlds; active world gets a soft tinted wash

### Left Sidebar (`SidebarPanel`)

Added a persistent left sidebar to the world map HUD:

- **Ball Preview**: Circular `Panel` with `StyleBoxFlat` colored to match equipped skin (gold, neon, crystal)
- **Lives Label**: "❤  xN" showing current lives from `GameManager.lives`
- **Coins Label**: "🪙  xN" showing total coins from `GameManager.coins`
- **Stars Label**: "⭐ N" showing total stars from `GameManager.total_stars`
- **Music Button**: Opens the music selection popup

### Bottom Fact Bar (`FactPanel`)

Added a bottom-center fact panel displaying random physics facts:

- 16 rotating facts covering Newton's laws, friction, gravity, momentum, wind, energy, raycasting, and game design trivia
- Facts display with a "💡" prefix

### Music Selection Popup (`MusicPanel`)

Added an in-world-map music picker:

- Lists all 9 tracks: 6 world themes (always unlocked) + 3 bonus tracks (`chill`, `action`, `retro`) that respect `LevelManager.is_music_unlocked()`
- Locked tracks show with a "🔒" icon and are disabled
- Equipped track shows with a "✓" checkmark
- Selecting a track calls `LevelManager.equip_music()` and plays it immediately via `AudioManager`

### Pause Menu — Return to World Map

- Added **Resume** and **Return to World Map** buttons to `HUD/PausePanel` in `game_level.tscn`
- `hud.gd` handles both: resume unpauses the tree; return changes scene to `res://scenes/world_map.tscn`

### Shop Button Fix

- Fixed `ShopBtn` being cut off in the top-right corner of the world map
- Anchor offsets corrected: `offset_left = -160`, `offset_right = -12`

### Level Serializer Compatibility Fix

- Removed `PackedByteArray.decompress_dynamic()` usage (not available in all Godot 4 builds)
- Replaced gzip compression with pure **Marshalls base64** encoding:
  - Export: `JSON.stringify(data)` → `to_utf8_buffer()` → `Marshalls.raw_to_base64()`
  - Import: `Marshalls.base64_to_raw()` → `get_string_from_utf8()` → `JSON.parse_string()`
- This ensures level codes work across all Godot 4.x versions

### GDScript Variant Inference Fixes

- Fixed `Cannot infer the type of 'is_active' variable` in `world_map.gd` by casting `world` to `int` explicitly: `var is_active: bool = (int(world) == selected_world)`
- Fixed `Cannot infer the type of 'is_unlocked' variable` by extracting `bool(track["locked"])` to an intermediate `locked` variable before the `not`/`or` expression

### Other Fixes

- Added `window/size/mode=3` to `project.godot` for exclusive fullscreen at startup

---

## Key Files Reference


| System          | File                                                              |
| --------------- | ----------------------------------------------------------------- |
| Player          | `scripts/player.gd`                                               |
| World Map       | `scripts/world_map.gd` + `scenes/world_map.tscn`                  |
| World Map Node  | `scripts/world_map_node.gd` + `scenes/ui/world_map_node.tscn`     |
| Shop            | `scripts/shop.gd` + `scenes/ui/shop_panel.tscn`                   |
| Game Level      | `scripts/game_level.gd` + `scenes/game_level.tscn`                |
| Bonus Level     | `scripts/bonus_level.gd` + `scenes/levels/bonus/bonus_level.tscn` |
| Track Builder   | `scripts/track_builder.gd`                                        |
| Level Manager   | `scripts/autoloads/level_manager.gd`                              |
| Game Manager    | `scripts/autoloads/game_manager.gd`                               |
| Audio Manager   | `scripts/autoloads/audio_manager.gd`                              |
| Level Generator | `scripts/level_generator.gd`                                      |


---

## Known Patterns & Decisions

- `**.tscn` text scenes**: The project uses Godot's text-based scene format extensively. Scaling scripts must be careful with regex matching to avoid stripping prefixes or dropping closing parentheses.
- **Physics scaling**: Godot does NOT support scaling physics bodies. All collision shape sizes are modified via shape resource extents, never node scale.
- **Save format**: JSON serialized to `user://physix_save.dat` with automatic corruption backup.
- **Shop consumables vs permanent**: Skins/themes/music are permanent unlocks. Buffs are consumable charges. Materials are permanent but affect physics properties.

---

## Phase 8: Track Elevation & Ramp Rotation Fix

### Elevation Data for All Levels

All 36 main levels and 6 bonus levels were updated with elevation data in `scripts/level_generator.gd` and `scripts/bonus_level.gd`:

- `**y`**: Global elevation offset above the natural TrackRoot slope
- `**ramp**`: Height change across a segment (creates smooth hills/valleys)
- `**jump**`: Auto-ramp that launches the player at 2.5 units height

The `current_y` variable tracks segment-to-segment continuity automatically when `y` is omitted.

### Critical Ramp Rotation Bug Fix

The bot test suite revealed players falling through track gaps at z≈-42 (first ramp boundary). Root cause: ramp rotation was applied with the wrong sign.

- **Before**: `body.rotation = Vector3(-ramp_angle, 0, 0)` — created downward discontinuities
- **After**: `body.rotation = Vector3(ramp_angle, 0, 0)` — segments now connect smoothly into hills
- Same fix applied to wall rotations in both `level_generator.gd` and `bonus_level.gd`

### Bonus Level Update

Bonus tracks now feature a wavy sine-wave hill profile instead of flat floors, with coins and boost pads placed at matching heights. Track root is gently sloped at `-8°` for a coin-rush feel.

---

## Phase 9: Music System Overhaul

### New Playback Modes

`AudioManager` now supports three playback modes:

- **Default** — Each scene plays its hard-coded track (menu music on main menu, `world_1` on world 1 levels, etc.)
- **Track** — A single user-selected track plays everywhere (set by choosing a specific song)
- **Random Play All** — Shuffles all available tracks and advances to the next when each finishes

### Loop Toggle

A dedicated **Loop: ON/OFF** button was added to the music panel. When ON, tracks repeat indefinitely. When OFF, playback stops at track end (or advances to the next track in Random mode). Saved to `LevelManager.save_data` under `music_loop`.

### UI Changes

- **Music Panel** (`scenes/world_map.tscn`): Expanded height to fit new controls
- **World Map** (`scripts/world_map.gd`): Added Default, Loop toggle, and Random Play All buttons above the track list
- **Main Menu** (`scripts/main_menu.gd`): Syncs saved `music_mode` and `loop_enabled` settings on load
- **Shop** (`scripts/shop.gd`): Equipping a music track now properly switches AudioManager to Track mode
- **AudioManager** (`scripts/autoloads/audio_manager.gd`): Added `_resolve_track()`, `_build_playlist()`, `_on_track_finished()`, and a `force` parameter for shop previews

### Save Data Extension

`LevelManager.save_data` now stores:

- `music_mode` — `"default"`, `"track"`, or `"random"`
- `music_loop` — `true`/`false`

---

## Phase 10: Game Master Design Audit & Critical Fixes

### Game Master Level Design Recommendations

Applied professional level design feedback to improve world pacing, differentiation, and risk/reward:

- **5-2 "Platform Peril" → "Gust Bridge"**: Complete redesign as a pure wind level. Removed platforms, ice, and gravity. Added escalating crosswinds (force 20→26) with a single bumper and brake pad for control.
- **3-5 coin differentiation**: Widened lateral gaps (x: ±2.5) and increased verticality (y: up to 4.5) compared to 3-4, creating a more challenging gravity gauntlet feel.
- **4-4 & 3-4 wind removal**: Verified neither level contains wind zones (4-4 uses bumpers + moving platform; 3-4 uses gravity + speed boost), keeping wind exclusive to World 5.
- **Risk/reward coins**: Added high-value off-path coins to:
  - **4-1**: x=2.5, y=4.0 near bumper cluster
  - **5-1**: x=-2.5, y=4.5 inside the wind tunnel
  - **6-6**: x=3, y=4.5 near magnet zones

### Rank Algorithm Fix

Fixed the B-rank gate in `game_manager.gd`:

- **Before**: `time_ratio > 1.2 or coin_ratio < 0.6 or obstacle_ratio < 0.5 or deaths > 0` — a single death instantly demoted to B
- **After**: `time_ratio > 1.2 or coin_ratio < 0.6 or obstacle_ratio < 0.5` — deaths are already penalized in A-rank and below

### Other Level Tweaks

- **6-1 par_time**: 24.0 → 38.0 (more generous for a World 6 level)
- **1-4 checkpoint**: Moved from z=-160 to z=-130 (earlier safety net)
- **5-3 rename**: "The Final Exam" → "Crosswind" (thematic consistency)

### Critical Godoty Audit Fixes

- **Player velocity mutations**: Replaced direct `linear_velocity` scaling with `apply_central_force()` / `apply_central_impulse()` for air drag and braking
- **Shared material bug**: Added `.duplicate()` before editing material properties in `_apply_skin()` to prevent mutating shared resources
- **Zone ref-counting leaks**: Added `_force_reset()` to gravity, wind, and magnet zones so they properly reset on player respawn
- **Race condition**: Moved `finish_zone` lookup from `@onready` to `_ready()` with `await get_tree().process_frame` for levels built by `LevelGenerator`
- **Editor test runner**: Replaced uncancellable `SceneTreeTimer` with a reusable `Timer` node; respawn now uses `set_deferred()`

---

## Phase 11: Star Rating Overhaul & Level Editor Fix

### Star Rating Simplified

Stars are now purely coin-based — fair, transparent, and tied directly to player skill:

- **1 star** = Finish the level
- **2 stars** = Collect at least half the coins
- **3 stars** = Collect every single coin (gold star)

Removed: time gates, obstacle-clear requirements, death penalties, and average-speed checks from star calculation.

### World Unlock Reworked

To advance to the next world, you must now earn **at least 2 stars on every level** in the current world. This replaces the old global star-total system and gives players a clear per-level goal.

### "Collected # of 1 Coin" Bug Fixed

`game_level.gd` and `editor_test_runner.gd` were using `maxi(total_coins, 1)`, forcing the UI to show "1 coin" even in coinless levels. Both now report the true coin count. Breakdown text safely falls back to `maxi(total_coins, 1)` only for display formatting.

### Tutorial Objective Added

World 1-1 opening hint now reads: *"Welcome to Physix! Steer with LEFT/RIGHT, jump with SPACE. Collect every coin to earn 3 gold stars and unlock new worlds!"*

### Level Editor Improvements

Addressed the "click anywhere = place at the end" bug and made the editor actually usable:

- **Physics raycast placement**: Ray now hits the actual floor/wall collision shapes instead of an infinite mathematical plane
- **Track bounds clamping**: Fallback plane clamps placement to within the track width/length
- **Placement ghost**: Semi-transparent preview follows the cursor when a tool is active
- **Default track length**: Reduced from 300 to 150 for faster iteration
- **Track dimension controls**: Width and Length spin boxes + Rebuild Floor button added to the palette
- **Ghost cleanup**: Ghost vanishes when switching tools, selecting, or mousing over UI

### Gravity Amplified

Player gravity increased by 25% (`gravity_scale` 1.0 → 1.25) for a weightier, more responsive fall feel. Reset logic in gravity zones and player respawn updated to match.

---

## Phase 12: Level Design Archetype Overhaul

Based on research into *Marble Madness* and *Super Monkey Ball* level design principles, six signature levels were completely redesigned to replace flat, linear "straight track with stuff on it" layouts with spatially interesting set pieces.

### Research-Driven Design Principles Applied

- **Elevation-based traversal** — slope and height are primary mechanics, not visual dressing
- **Progressive constriction** — track width narrows as difficulty escalates (Downhill archetype)
- **Hairpin / switchback turns** — dramatic x-shifts force momentum management
- **Pinball chambers** — bumper placement creates ricochet fields rather than serving as speed bumps
- **Risk/reward branching** — coins placed at the outer edge of curves and in wide scatter patterns
- **Pace breaking** — alternating wide safe zones and tight choke points

### Redesigned Levels


| Level | Old Name       | New Name               | Archetype           | Key Change                                                                                |
| ----- | -------------- | ---------------------- | ------------------- | ----------------------------------------------------------------------------------------- |
| 1-5   | Slope Gauntlet | **Switchback Squeeze** | Switchback / Zigzag | Track now zigzags x=0 → 3 → -3 → 3 → -2 with width dropping to 5                          |
| 2-4   | Glacier Drop   | **Glacier Spiral**     | Ice Spiral          | Continuous S-curve on ice with outer-edge coins that are easy to slide past               |
| 4-2   | Pinball Palace | **Pinball Palace**     | Pinball Chamber     | Wide arena (w=14) with bumpers in diamond pattern; coins scattered inside ricochet field  |
| 4-4   | Ricochet Run   | **Ricochet Run**       | Bouncer Corridor    | Narrow corridors (w=5-6) with alternating side bumpers creating a forced bounce path      |
| 5-5   | Whirlwind      | **Whirlwind**          | Wind Spiral         | Switchback geometry with alternating crosswind directions at each curve                   |
| 6-4   | Polarity Shift | **Polarity Shift**     | Magnet Switchback   | Attract/repel magnets alternate with switchback curves, pulling/pushing the ball sideways |


### Coin Placement Philosophy Shift

- **Before**: Coins lined up along the center path at y=2.2–3.5, trivial to collect
- **After**: Coins sit at the apex of turns, on the outer edge of ice curves, inside bumper fields, and at the end of magnet arcs — requiring skill or risk to reach

### Remaining Levels

The other 30 levels still follow the older linear format. Future passes should apply these archetypes more broadly, especially to Worlds 3 (gravity verticality) and 6 (magnet-driven curves).

---

## Future Opportunities

- Multi-segment level scaling (12 remaining levels not yet scaled)
- Additional world map backgrounds per world theme
- Shader-based visual effects for themes
- Particle effects on coin collection
- Leaderboard integration for S+ ranks

---

## Phase 13: Hazards & Hoops — Real Danger and Momentum Gates

### Spike Traps

Added a new hazard type that punishes sloppy play:

- `**scripts/obstacles/spike_trap.gd`** — `SpikeTrap` extends `ObstacleBase`
- **Behavior**: On contact, the player enters a **stun state** (`_stunned = true`) for `0.35s`. Velocity is zeroed. When the stun expires, `died.emit()` is called, costing one life and triggering respawn.
- **Shield interaction**: `buff_shield` does NOT block spikes — it only prevents the final death call, but the stun still applies (you're vulnerable while frozen).
- **Visual**: Bright red emissive danger material assigned via `track_builder.gd`
- **Placement**: Spike patches span a configurable `width` and `length` across the track surface

### Hoop System — Two Modes, One Obstacle

A single `Hoop` class (`scripts/obstacles/hoop.gd`) with two modes creates both progression gates and skill rewards:


| Mode           | Kind              | Color     | Effect                                                            | Required?                                                            |
| -------------- | ----------------- | --------- | ----------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Checkpoint** | `hoop_checkpoint` | Green     | Registers as a passed hoop                                        | Yes — level cannot be finished until all checkpoint hoops are passed |
| **Bonus**      | `hoop_bonus`      | Cyan/Blue | Grants forward impulse (`boost_strength`, default 18) + 250 score | No — optional risk/reward                                            |


- **Finish zone validation**: `game_level.gd` blocks finish if `level_total_hoops > 0` and `level_hoops_passed < level_total_hoops`, showing a hint: *"Jump through all hoops first!"*
- **GameManager tracking**: `set_total_hoops()` and `pass_hoop()` track per-level progress
- **Visual**: Square ring made of 4 emissive bars (green for checkpoint, cyan for bonus)

### Player Stun State

`scripts/player.gd` added stun handling in `_physics_process()`:

- During stun, input is ignored and physics simulation is frozen
- `hit_spikes(stun_duration)` zeros linear and angular velocity, plays death SFX, and starts the timer

### Level Integration

**Spikes added to 6 gauntlet levels:**

- 1-3, 2-5, 3-5, 4-5, 5-4, 6-5 (4–5 spikes each, placed on flat or ice segments)

**Hoops added to 15 levels across all worlds:**

- **Checkpoint hoops** placed at progression gates (mid-level turns, after gaps, before final stretches)
- **Bonus hoops** placed over gaps, in jump arcs, and inside wide bumper/ice chambers
- Levels updated: 1-3, 1-4, 1-5, 2-3, 2-4, 2-6, 3-2, 3-5, 4-3, 4-5, 5-3, 5-6, 6-3, 6-5, 6-6

### Editor Support

`scripts/level_editor.gd` palette expanded:

- `spike` — place spike traps with width/length controls
- `hoop_bonus` — place speed-boost hoops
- `hoop_cp` — place required checkpoint hoops

---

## Phase 14: Full Level Redesign, Bot Overhaul & Baked Scene Workflow

### Level Design — All 36 Base Levels Redesigned

The entire `LEVELS` dictionary in `scripts/level_generator.gd` was regenerated with significantly more demanding geometry to replace flat, linear tracks with active navigation challenges:

- **Alternating lateral offsets** (x: ±2 to ±3) creating S-curves, zigzags, and switchbacks
- **Multiple jump gaps per level** — World 1 uses gentle 12–14 unit gaps; World 6 uses brutal 18–20 unit gaps
- **Narrower sections** (w: 5–8) forcing precise steering
- **Elevation changes** via ramps and vertical drops
- **World-themed obstacle density** increases progressively across worlds 1–6

### Bot Controller Overhaul

`scripts/bot_controller.gd` was rewritten to handle the redesigned levels:

- **Adaptive steering gain**: `steer_gain * clampf(1.0 + absf(dx) * 0.2, 1.0, 2.5)` — turns harder when far off target
- **Air steering boost**: 1.4x steer multiplier when `on_ground` is false
- **3-ray gap detection** (`_check_gap_ahead`):
  1. Primary ray toward target X (catches curved gaps)
  2. Fallback ray straight ahead (near-edge safety)
  3. Deep-drop ray at -8.0 Y (landings far below)
- **Refined braking**: triggers when `absf(dx) > 2.5 AND vel.length() > 14.0` for precise landings
- **Ground-check before jump**: prevents air-jumps

### Baked Scene Hand-Editing Workflow

Addressed the core problem that hand-edited `.tscn` levels were overwritten at runtime by the generator:

- `level_generator.gd:_ready()` now **auto-detects baked children** — if TrackRoot already contains `StaticBody3D`/`Area3D`/`Node3D` children, it skips regeneration entirely
- `_apply_materials_to_level()` extracted and called in both code-generated and baked-node paths, so track colors, finish green, and theme materials apply regardless of build path
- `game_level.gd` fixed to find coins and finish zones even when Godot renames baked nodes to `@Area3D@XXXX`:
  - `_find_finish_zone()` scans for `Area3D` containing a mesh with `mat_type == "finish"`
  - `_connect_coins()` and `_spin_coins()` scan all descendants for `Area3D`s named `"Coin*"`
  - New helper `_find_all_recursive()` provides full subtree traversal

### World Map Navigation Fix

Fixed broken arrow-key navigation on the hexagonal world map:

- **Position-based navigation**: `_navigate()` now uses screen-space angles and distances instead of world/level number arithmetic. Only candidates within 75 degrees of the pressed direction are considered
- **WASD support**: `steer_left`/`steer_right` (A/D) and `brake` (S) work alongside arrow keys; W supported for Up
- **Launch restricted**: Removed `jump` (Space) from launching — only `ui_accept` (Enter) or clicking a node starts a level
- **Input consumption**: All handled key events call `get_viewport().set_input_as_handled()`

### Bug Fixes

- `**project.godot`**: Added missing `AudioManager` autoload entry
- `**game_manager.gd**`: Fixed `INTEGER_DIVISION` warning on `total_coins / 2` by using `total_coins / 2.0`

---

## Phase 15: Ghost System, AI-Driven Design & Physics Feel Overhaul

### Ghost Replay System

- `**scripts/autoloads/ghost_manager.gd**` — Records player position, rotation, velocity, and inputs at 10 Hz. Saves to `user://ghosts/w{world}_l{level}.json`. Only saves if the run is a new best time.
- `**scripts/ghost_ball.gd**` — Replays saved ghost data with linear interpolation and quaternion slerp. Stops 2 seconds after the final sample. Quaternions are normalized before slerp to prevent engine crashes.
- **Integration**: `game_level.gd` starts recording on level start, stops on finish/death, and spawns a ghost ball if prior data exists.

### Speed-Driven Camera

`game_level.gd:_follow_camera()` now reacts to ball speed:

- **FOV**: 70° → 85° as speed increases (non-linear `pow(speed_ratio, 1.7)` curve)
- **Offset**: Pulls back from `(0, 5.5, 14)` to `(0, 7.5, 20)` at max speed
- **Look target**: Extends forward from `z=-22` to `z=-35`
- Smoothing: FOV uses `lerp` at 4.0 rate; position/look uses 9.0 rate

### Variable Jump Mechanics

`scripts/player.gd` completely rebuilt the jump system:

- `**jump_impulse = 3.0`** — tiny initial pop; tap gives a micro-hop
- `**jump_hold_force = 55.0**` / `**jump_hold_time_max = 0.10**` — snappy full charge in 6 frames
- `**jump_release_mult = 0.25**` — early release (tap) cuts upward velocity to 25%
- `**jump_buffer_time = 0.08**` — press before landing, jump fires on touchdown
- `**jump_min_hold_time = 0.03**` — ~2 frames threshold separating "tap" from "hold"
- **Single-frame tap logic** in `_handle_input()`: press triggers `_is_extending_jump`, hold timer starts; release before 0.03s applies the multiplier cut

### Slope-Force Compensation (Slope/Trackmania Research)

`_push_forward()` in `scripts/player.gd` now projects forward force onto the slope plane:

- Uses ground-ray collision normal to compute `force_dir`
- Downhill gravity assist: up to **+55% push bonus** on steep downhills
- Uphill reduction: up to **-40% push penalty** on steep climbs
- Speed clamp uses projected forward direction, not raw world-Z

### Lane Centering (Rolling Sky Research)

`_apply_lane_centering()` in `scripts/player.gd`:

- When on ground and not actively steering, gentle drift toward the current segment's center X
- **0.35-unit deadband** — close to center = no interference
- Force is subtle (`offset * 2.0`) so it feels forgiving, not autopilot

### Spring-Smoothed Speed Ramp

Replaced linear `+= speed_ramp_rate * delta` with `move_toward()` to target max speed:

- More natural acceleration curve (easing in, not robot-stepping)
- Same 1.6x ceiling, smoother feel

### Bot Controller Fixes

`scripts/bot_controller.gd`:

- **Single-frame jump tap** (`_jump_tap`) — bot presses jump for exactly 1 frame, then forces release. Prevents floating/overshooting.
- **Airborne time tracker** (`_airborne_time`) — bot refuses to jump if airborne > 0.05s, preventing coyote-time double jumps.
- **Velocity-scaled gap timing** — computes `time_to_gap = dist / speed` and triggers ~0.22s before the edge instead of a fixed 8-unit distance.
- **Raycast look distance scaled to speed** (`clampf(speed * 0.35, 4.0, 14.0)`).

### GhostAnalyzer — AI-Driven Level Redesign

`**scripts/autoloads/ghost_analyzer.gd`** — New autoload that turns player ghost data into concrete level edits:


| Metric                                | Threshold           | Redesign Action                                       |
| ------------------------------------- | ------------------- | ----------------------------------------------------- |
| `lateral_variance < 1.8`              | Track too straight  | Injects S-curve + gap mid-level                       |
| `speed_cv < 0.25`                     | Speed never changes | Splits longest flat stretch into uphill→downhill ramp |
| `death_cluster` (2+ deaths at same Z) | Unfair chokepoint   | Adds checkpoint 15m before, widens track to 10+ units |
| `coin_rate < 0.5`                     | Coins unreachable   | Pulls coins closer to racing line, lowers Y           |
| `coin_rate > 0.95`                    | Coins too easy      | Pushes coins to edges for risk/reward                 |


- **HUD button**: "Analyze Ghost" appears in debug builds (next to "Run Bot Test"). Clicking it runs `GhostAnalyzer.analyze_and_redesign(world, level)` and prints a report.
- **Console workflow**: Play → click "Analyze Ghost" → play redesigned level → repeat until metrics are green.

### HUD Improvements

- **Speed bar now shows ft/s** instead of meaningless percentage. `MPS_TO_FPS = 3.28084` conversion, label overlay on the ProgressBar.

### Test Harness Fixes

`scripts/test_harness.gd`:

- Per-level stat reset so each test is independent
- 90-second timeout per level (`LEVEL_TIMEOUT_SEC`) with `_on_level_timeout()`
- Proper bot cleanup between levels (removes old `BotController` before adding new)
- Uses `physics_frame` + `process_frame` await for level initialization

### Cheat Codes (Debug)

`scripts/main_menu.gd` — type these on the main menu:

- `**coins`** → `+100 coins`, saves progress, shows floating label
- `**lives**` → `+100 lives`, saves progress, shows floating label
- Existing `jilly` cheat still unlocks all levels.

### Level Generator Robustness

- `_to_dict_array()` helper converts untyped JSON arrays to `Array[Dictionary]` for GDScript typed function parameters
- Fixed `as Array[Dictionary]` runtime cast failures

### Research on Similar Games

Investigated source code and physics breakdowns for:

- **Rolling Sky** — Original Unity C# source found (`Porygon-Axolotl/Rolling-Sky-1.0.0-Public`). Key findings: spring-smoothed speed, lane-centering elastic camera, scripted kinematic jumps.
- **Slope** — Compiled WebGL only, but community discussions revealed slope-plane projection technique.
- **MechanicalFlower/Marble** — Godot 4 MIT-licensed marble racer. Chase camera at fixed 4.0 distance, `RigidBody3D` with `set_linear_velocity()`, procedural piece snapping.

Actionable implementations: slope-force compensation, lane centering, spring-smoothed speed ramp.

---

---

## Phase 16: Factory Pattern, Secret World & Physics Feel 2.0

*Date: May 12, 2026 | Version: 0.3.0*

### Modular Level Factory

`**scripts/level_factory.gd`** — Complete procedural level generation pipeline replacing hand-crafted JSON dictionaries:

- **6 Layout Types**: `STRAIGHTAWAY`, `WIDE_TO_SMALL`, `SMALL_TO_WIDE`, `CURVES`, `HILLS`, `COMBINATION`
- **Obstacle DR Budget**: `budget = 5 + (world - 1) * 3 + (level - 1) * 2` — magnets (5), wind (4), spikes (3), bumpers/gravity (2), speed_boost/brake_pad (-1)
- **World Bias**: Themed obstacle pools per world (World 1 excludes gravity/magnets/wind)
- **Interest Scoring**: Segments scored by jumps (+40), ramps (+10-20), narrow width (+8-15), x-shifts (+10); obstacles placed greedily on highest-interest segments
- **Hexagonal Hoops**: 6 checkpoint hoops per level with sequential boost (20→24→28→32→36→40), placed via `segment_at_z()` to ensure correct surface height
- **World 1 Beginner Rules**: Hoops clustered at `t = 0.18 + i*0.11`, first 3 on right (offset +1.0 to +2.0), last 3 on left (offset -2.0 to -1.0), lower clearance (1.5-2.2), no CURVES layout

### Player Feel Overhaul

`**scripts/player.gd`**:

- **Tighter steering**: `steer_force` 28 → 38, `max_lateral_speed` 10 → 14
- **Slower speed ramp**: `speed_ramp_rate` 1.2 → 0.7 for gradual build to max speed
- **Slam attack**: Press S/Down/Brake while airborne → downward impulse (18.0), sustain force (90.0N), bounce on landing (7.0), resets jump count
- **Improved brake**: Strong lateral friction (4.8x) + reverse drag (4.0x) when on ground; slam takes priority over brake when airborne
- **Air drag**: Reduced 1.2 → 0.6 for more controllable mid-air steering
- **Forward input**: W/UP increases push by 1.35x
- **Slope-force compensation**: Projects forward push onto ground plane using raycast normal; downhill boost up to +55%, uphill penalty up to -40%

### Camera & Visual Effects

`**scripts/game_level.gd`**:

- **Light speed effect**: Triggered at speed ratio ≥ 0.92 — FOV 70→108°, Z offset surge -14, look-ahead surge -28, camera roll up to 0.12rad
- **Boost camera surge**: Temporary FOV spike (+22°), Z pullback (-10), look-ahead extension (-18) with exponential decay
- **Dust particles**: `land_particles.restart()` on slam bounce landing

### Obstacles

- **Wind zones** (`scripts/obstacles/wind_zone.gd`): Force reduced 22→14, gentle `sin` oscillation (sway_speed=0.8, sway_amplitude=0.9)
- **Gravity zones** (`scripts/obstacles/gravity_zone.gd`): Smooth 0.3s tween transitions, dramatic entry impulses per zone type, transparent alpha 0.12 material, particle bursts on entry/exit
- **Breakable pots** (`scripts/obstacles/breakable_pot.gd`): Break via slam or falling fast (vy < -3.0), spawn coin with tween upward animation, particle shard burst. Bonus levels only.
- **Hex hoop mesh** (`scripts/level_generator.gd`): `_build_hex_hoop_mesh()` replaces torus with 6-sided ring

### UI/UX

- **Retry button**: Added to pause menu (`hud.gd`)
- **Medal badges**: Styled color-coded panels on win screen — Fearless (red), First Try (green), Perfect Path (gold), Speed Demon (blue)
- **Physics facts**: Linger time increased to 6.0s
- **Composite star rating** (`game_manager.gd`): 3 stars = all hoops + time ≤ 1.2x par + deaths ≤ 1; 2 stars = half hoops + time ≤ 1.5x par
- **Speed bar**: Displays ft/s with `MPS_TO_FPS = 3.28084`

### Secret World S-1

- **"jilly" cheat**: Unlocks secret world node on world map and main menu
- **S-1 placement**: Outside inner hex ring between bonus B-4 and world 4
- **Factory integration**: `LevelFactory.generate(0, 1)` produces `levels/S-1.json` using World 1 logic by default

### Ghost Analyzer 2.0

`**scripts/autoloads/ghost_analyzer.gd`**:

- **Module Database**: Maps diagnosed issues (low lateral variance, flat speed profile, death clusters, etc.) to recommended factory layouts
- **6-metric diagnosis**: Lateral variance, speed CV, death clusters, coin rate, checkpoint distribution, completion rate
- **Regeneration**: Calls factory with forced layout override based on diagnosis
- **Speed profile validation**: Checks gap impossibility and speed bleed across segments

### Bug Fixes

- **Slam brake drag**: Fixed sign error that launched ball forward instead of braking (`-linear_velocity.z * 4.0`)
- **GDScript warnings**: Fixed `CONFUSABLE_LOCAL_DECLARATION` in `world_map.gd`, `UNUSED_PARAMETER` in `breakable_pot.gd` and `gravity_zone.gd`
- **Type inference**: Fixed `Cannot infer the type of "a" variable` in `hud.gd` by explicitly typing action arrays

---

## Phase 17: Fun Feedback & Game Feel

### Core Philosophy

**Speed × Challenge**: Every physics interaction must have immediate visual/audio feedback. The player should *feel* their momentum, their mistakes, and their triumphs.

### Camera Shake (`scripts/autoloads/camera_shaker.gd`)

New autoload providing weighted impact feedback via perlin-randomized camera offset:

- **Slam bounce landing**: `shake(0.18, 0.35)` — heavy crunch on slam recovery
- **Normal landing**: `shake(0.10, 0.12)` — subtle grounding feedback
- **Spike stun → death**: `shake(0.22, 0.28)` — disorienting freeze before respawn
- **Fall death**: `shake(0.25, 0.30)` — dramatic finality
- **Bumper hit**: `shake(0.12, 0.22)` — playful ricochet jolt

### Speed Trail Particles (`scenes/player/player.tscn`)

Streak particles activate when `speed_ratio > 0.55`:

- **32 particles** with box-mesh streaks aligned to velocity
- **Color shift**: cyan (0.55 speed) → white (1.0 speed) via alpha blend
- **Velocity scaling**: `initial_velocity` ranges 2.0→8.0 based on speed ratio
- **Emission sphere**: 0.35 radius centered on ball rear
- Auto-toggles off below threshold or when airborne

### Screen Flash Vignette (`scripts/autoloads/screen_flash.gd` + `assets/shaders/screen_flash_vignette.gdshader`)

Edge-only radial flash using custom canvas_item shader — **center stays clear**, periphery blooms:

- **Boost pad**: White vignette (`Color(1,1,1,0.35)`, 0.25s fade)
- **Spike stun**: Red vignette (`Color(1,0.15,0.05,0.45)`, 0.35s fade) — damage feedback
- **Hoop pass**: Green vignette (`Color(0.1,1,0.3,0.25)`, 0.20s fade) — checkpoint reward
- Shader: `smoothstep(radius-softness, radius, dist)` with `radius=1.2`, `softness=0.6`
- Bug fix: Reversed smoothstep parameters so flash appears on edges instead of center

### HitStop (`scripts/autoloads/hit_stop.gd`)

Momentary `Engine.time_scale` freeze for impact weight:

- **Slam landing**: `freeze(0.06, 0.08)` — 60ms at 8% speed = crunchy bounce
- **Bumper hit**: `freeze(0.04, 0.12)` — 40ms micro-pause on ricochet
- **Spike stun**: `freeze(0.08, 0.10)` — 80ms freeze before velocity zeroed
- Extends existing freezes if a heavier impact overlaps; auto-restores `time_scale = 1.0`

### Coin Sparkle (`scripts/game_level.gd`)

10-particle gold burst on every coin pickup:

- **Sphere emission** (radius 0.15), upward spread 120°
- **Velocity**: 2.0→5.0 m/s, gravity -8.0
- **Scale**: 0.04→0.1 box mesh, lifetime 0.35s
- **Auto-cleanup**: `queue_free()` after 0.5s via tween callback
- Plays alongside existing "coin" SFX

### Hoop Playability

- **1.5× size increase**: Collision radius `1.2 → 1.8`, tube radius `0.15 → 0.225`
- Makes checkpoint passes more forgiving for beginners while still requiring intentional steering

### World 1 Obstacle Purity

- **Fixed bias contamination**: Removed `gravity` from World 1 pool (was erroneously present)
- **Locked fallback**: `_fallback_pool(world)` ensures 25% fallback draws only world-appropriate obstacles
  - W1: speed_boost, brake_pad, bumper, spike
  - W3+: gravity unlocked
  - W4+: wind unlocked
  - W6+: magnet unlocked
- **Regenerated all 1-1 through 1-6** with corrected pools — no gravity/wind/magnet in beginner levels

### Files Added/Modified

- **New**: `scripts/autoloads/camera_shaker.gd`, `scripts/autoloads/hit_stop.gd`, `scripts/autoloads/screen_flash.gd`, `scenes/autoloads/screen_flash.tscn`, `assets/shaders/screen_flash_vignette.gdshader`
- **Modified**: `scripts/player.gd`, `scripts/game_level.gd`, `scripts/obstacles/bumper.gd`, `scripts/obstacles/hoop.gd`, `scripts/level_generator.gd`, `scripts/level_factory.gd`, `scripts/regen_world1.py`, `scenes/player/player.tscn`, `project.godot`

## Phase 18: Half-Pipe Prototype & Agency Fixes

### Half-Pipe Prototype (`scenes/levels/prototype_halfpipe.tscn`)

New standalone prototype level exploring half-pipe geometry as a potential World 6 mechanic:

- **Semi-cylindrical track segments**: Procedurally generated concave surface using `SurfaceTool` with inward-facing normals
- **Trimesh collision**: `ConcavePolygonShape3D` built from mesh faces for accurate ball-wall interaction
- **Wall rails**: Invisible collision boxes at the rim (theta=0 and theta=PI) to prevent the ball from flying off
- **4 segments, 6 rings**: Rings placed at varying wall heights to encourage lateral momentum play
- **Camera banking**: Prototype camera rolls up to 0.25 rad based on player's lateral offset from center
- **Builder utility**: `scripts/halfpipe_builder.gd` with `build_segment()`, `world_pos()`, and rail generation

**How to play**: Open `scenes/levels/prototype_halfpipe.tscn` in Godot and press F6. The ball should naturally roll up and down the curved walls. Rings on the walls reward lateral speed builds.

### Lane Centering Removal (`scripts/player.gd`)

- **Disabled `_apply_lane_centering()`**: The automatic drift toward track center has been removed
- **Rationale**: The gentle pull (2.0N offset force) infringed on player agency — staying on the track is now entirely the player's responsibility
- **Impact**: Steering is now fully manual on all track types; mistakes (falling off edges) are player-driven, not autopilot-corrected

### Files Added/Modified

- **New**: `scripts/halfpipe_builder.gd`, `scripts/prototype_halfpipe.gd`, `scenes/levels/prototype_halfpipe.tscn`
- **Modified**: `scripts/player.gd` (lane centering disabled), `scripts/game_level.gd` (camera init + clamp fixes)

## Phase 19: AAA Slam Mechanics Redesign

### Philosophy

A slam should feel like a **ground-pound super-move**: anticipation → rocket descent → devastating impact → elastic recovery. Every phase has visual, audio, and haptic feedback.

### 4-Phase State Machine (`scripts/player.gd`)

Replaced the single `_slamming` boolean with `SlamState { NONE, WINDUP, DESCENT, IMPACT }`.

#### Phase 1: WINDUP (0.09s)

- **Ball stretch**: Mesh scales to `(0.85, 1.35, 0.85)` — the ball elongates vertically
- **Charge particles**: 24 purple particles gather inward (`SlamChargeParticles`)
- **Screen flash**: Purple/white vignette via `ScreenFlash.flash_slam()`
- **HitStop**: 50ms freeze at 4% speed — the world holds its breath
- **Upward velocity cut**: Any upward motion is zeroed so the slam is immediate

#### Phase 2: DESCENT

- **Rocket impulse**: Downward impulse increased `18.0 → 32.0`
- **Sustain force**: Increased `90.0 → 150.0` — ball accelerates downward faster than gravity
- **Ball stretch**: Mesh scales to `(0.7, 1.5, 0.7)` — even more elongated during fall
- **Descent trail**: 40 orange streak particles (`SlamTrailParticles`) stream downward
- **Forward push disabled**: No horizontal acceleration during slam — pure vertical violence
- **Speed trail disabled**: Normal speed streaks turn off during slam

#### Phase 3: IMPACT

- **HitStop**: 120ms freeze at 3% speed — the heaviest pause in the game
- **Camera shake**: `shake(0.28, 0.55)` — the biggest shake in the game
- **Screen flash**: White boost-flash on impact
- **Ball squash**: Mesh snaps to `(1.45, 0.45, 1.45)` — the ball pancakes on the ground
- **Bounce impulse**: Increased `7.0 → 14.0` — the ball rockets back up
- **Shockwave ring**: Expanding golden torus mesh spawned at impact point, fades over 0.45s
- **Particles**: Jump particles + land particles both fire on impact
- **Mesh recovery**: After 0.12s hold, ball tweens back to normal scale over 0.18s with `TRANS_BACK`

#### Phase 4: RECOVERY

- State returns to `NONE`
- Slam cooldown: 0.4s (up from 0.3s to prevent spam)
- Forward push resumes
- All particles reset

### New Player Particles (`scenes/player/player.tscn`)

- **SlamChargeParticles**: 24 particles, sphere emission radius 0.6, inward velocity -3.0 to -1.0, purple color
- **SlamTrailParticles**: 40 particles, sphere emission radius 0.4, downward velocity 4.0 to 10.0, orange streak boxes

### Constants Changed


| Constant      | Before | After | Reason                           |
| ------------- | ------ | ----- | -------------------------------- |
| SLAM_IMPULSE  | 18.0   | 32.0  | Rocket-like descent speed        |
| SLAM_BOUNCE   | 7.0    | 14.0  | Double the recovery height       |
| SLAM_SUSTAIN  | 90.0   | 150.0 | Heavier fall acceleration        |
| Slam cooldown | 0.3s   | 0.4s  | Prevent spam, respect the windup |


## Phase 20: Slam Polish & Breakable Pots

### Slam Feel Tuning (Post-Playtest)

After playtesting revealed the Phase 19 slam felt like an "earthquake" and was "WAY TOO DRAMATIC," every parameter was systematically reduced toward **snappy minimalism**:


| Parameter                   | Phase 19 (Dramatic)            | Final (Snappy)                              |
| --------------------------- | ------------------------------ | ------------------------------------------- |
| `SLAM_WINDUP`               | 0.09s                          | **0.02s** (barely perceptible)              |
| `SLAM_IMPULSE`              | 32.0                           | **24.0**                                    |
| `SLAM_BOUNCE`               | 14.0                           | **8.0**                                     |
| `SLAM_SUSTAIN`              | 150.0                          | **110.0**                                   |
| HitStop                     | 120ms @ 3%                     | **20ms @ 12%**                              |
| Camera shake                | `shake(0.28, 0.55)`            | `**shake(0.05, 0.08)`**                     |
| Mesh squash                 | `(1.45, 0.45, 1.45)` for 0.12s | `**(1.12, 0.78, 1.12)` for 0.03s**          |
| Recovery tween              | `TRANS_BACK` over 0.18s        | `**TRANS_QUINT` over 0.05s**                |
| Windup/descent mesh stretch | Elongation tweens              | **Removed entirely** — ball stays round     |
| Shockwave scale             | 2.5× over 0.45s                | **2.0× over 0.15s**                         |
| Shockwave fade              | 0.45s                          | **0.12s**                                   |
| Slam cooldown               | 0.4s                           | **0.35s**                                   |
| Screen flash                | `flash_slam()` at 0.18 alpha   | `**flash_slam()` at 0.18** / impact at 0.15 |


**Design outcome**: The slam is now a **tool**, not a cutscene. The player presses down, drops fast, bounces, and is back in control within ~0.1s. Visual feedback is barely-there — a micro-squash, a tiny shake, a quick ring — letting the *gameplay* (resetting jump count, breaking pots) be the reward.

### Breakable Pots in Bonus Levels

`**scripts/level_factory.gd`** now generates breakable pots:

- `**"pot": 1` added to `OBSTACLE_DR**` — cheap enough to place many without consuming the hazard budget
- `**"pot"` added to `_fallback_pool()**` — available in all worlds as a basic reward obstacle
- `**_make_obstacle("pot", ...)**` returns a pot with a slight lateral offset (`±w*0.35`) and `score_value = 15`
- **Bonus/Secret level scatter pass**: When `world == 0`, the factory iterates every segment and places a pot every ~10m along the track, skipping positions within 5m of existing obstacles. This fills secret gauntlet levels with smashable coin pots.
- `**scripts/level_generator.gd`** already had `_build_breakable_pot(z, x)` at runtime; the factory now actually outputs `"pot"` obstacle dictionaries so they appear in generated levels.

### Slam Anti-Spam & Floor-Clipping Fix

Playtesting revealed slam could be chain-spammed by holding S, causing the player to clip through the floor and die:

**Root causes**:

1. `Input.is_key_pressed(KEY_S)` allowed **held-key retriggering** — every frame where the player was airborne and cooldown expired, slam fired again
2. Cooldown was only **0.35s**, shorter than the bounce arc (~1.3s), so by the time the player descended from the bounce, slam was available again
3. **No minimum height guard** — slam could fire when the player was only 0.1m above ground, and the -24 impulse rocketed them through collision

**Fixes** (`scripts/player.gd`):

- **Input**: Changed to `is_action_just_pressed("brake")` only — slam is now a deliberate press, not a hold
- **Cooldown**: Increased `0.35s → 1.0s` — longer than the full bounce arc, preventing chain-slamming entirely
- **Height guard**: Before starting windup, abort if `ground_ray.is_colliding() and (global_position.y - ground_point.y) < 2.5`. The slam is blocked when the ground is within 2.5 units, eliminating the clipping window

### Destruction Plugin Pots (`scenes/obstacles/breakable_pot.tscn` + `scripts/obstacles/breakable_pot.gd`)

Pots were too small and broke with a weak particle puff. Rebuilt with the Jummit Destruction plugin for satisfying physical breakage:

- **4× size increase**: CylinderMesh `top_radius 0.45 → 1.80`, `bottom_radius 0.35 → 1.40`, `height 0.7 → 2.8` — pots are now impossible to miss
- **Fragment scene** (`scenes/obstacles/pot_fragments.tscn`): 12 shard MeshInstance3Ds with BoxMesh fragments and pot-colored StandardMaterial3D assigned directly to the mesh resource (required for the plugin's fade effect)
- **Destruction node**: Added to the pot scene with `fragmented = PotFragments`, `fade_delay = 1.5`, `shrink_delay = 1.5`, `animation_length = 2.5`
- **1–10 instant coins**: `randi_range(1, 10)` calls to `GameManager.add_coin()` the instant the pot breaks — no physics coins, no waiting
- **Visual coin burst**: 12 fake gold coin meshes burst outward in a hemisphere (`TRANS_QUINT` outward, `TRANS_BACK` shrink-to-zero), independent scene-tree tweens so they survive the pot being freed
- **Slam detection fix**: Replaced broken `player.get("_slamming")` with `int(player._slam_state) != 0` to match the new enum state machine
- **Factory clamp**: Pot placement offset is now clamped to `w/2 - 2.0` so the 1.8-radius pot never clips through track walls

### Greek Urn Pots

Pots looked like potted plants, not pottery. Rebuilt as classical urns:

- **Multi-piece mesh**: Belly body (`top_radius 2.2`, `bottom_radius 1.6`, `height 1.8`), narrow neck, flared rim, tapered foot, and two torus handles
- **Ceramic material**: `roughness 0.35`, `metallic 0.05`, warmer albedo `Color(0.78, 0.55, 0.32)`
- **Shard fragments**: Mix of `PrismMesh` and `BoxMesh` for pottery-like breakage shapes, matching urn color
- **Factory clamp**: Updated to `w/2 - 2.3` for the wider urn radius

### Reverse Brake (`scripts/player.gd`)

When on ground and holding brake with near-zero forward speed, the ball now slowly rolls backward:

```gdscript
elif linear_velocity.z >= -2.0:
    apply_central_force(Vector3(0.0, 0.0, forward_push * 0.45))
```

### GDScript Warning Cleanup

Fixed all compiler warnings across the codebase:

- `game_manager.gd`: Prefixed unused `obstacles`, `max_speed` params; prefixed unused `hoop_ratio`
- `level_factory.gd`: Renamed shadowed `name`→`level_name`; prefixed `_level`, `_prev_ramp_sign`, `_budget`, `_world`
- `ghost_analyzer.gd`: Renamed all shadowed `name`→`layout_name`/`level_name`
- `hit_stop.gd`: Removed unused `_pending_time_scale`
- `breakable_pot.gd`: Prefixed `_player` param

### Holographic Level Dive Transition

New fullscreen transition when launching any level from the world map:

- `**assets/shaders/level_dive_transition.gdshader**` — `canvas_item` shader with:
  - **Lava-lamp metaballs**: 3-layered simplex-noise blobs with palette cycling derived from the hex's `world_color`
  - **Holographic scanlines**: Horizontal sine-wave lines at 400 px frequency
  - **Chromatic aberration**: RGB channel split that intensifies during the dive
  - **Expansion mask**: Grows from the hex's screen position outward via `smoothstep(progress)`
  - **Edge glow ring**: Bright ring at the mask boundary for portal-like feel
  - **Grid overlay**: Subtle holographic grid that fades in with progress
- `**scripts/level_dive_transition.gd`** + `**scenes/ui/level_dive_transition.tscn**` — CanvasLayer controller:
  - `start(hex_screen_pos, hex_color, callback)` — tweens `progress 0→0.85` over 1.0s (expansion), calls level load callback at full coverage, then `0.85→1.0` over 0.4s (reveal)
- `**scripts/world_map.gd**` — All three launch paths (`_launch`, `_launch_bonus`, `_launch_secret`) now use the transition:
  - Camera zooms subtly to **1.8×** (down from aggressive 3.5×) and pans toward the hex over 0.9s
  - Hex scales to 1.4× with `TRANS_BACK`
  - After 0.25s delay, the dive transition starts from the hex's screen-space position
  - Fallback fade path preserved for missing nodes

### Files Added/Modified

- **New**: `scenes/obstacles/pot_fragments.tscn`, `assets/shaders/level_dive_transition.gdshader`, `scripts/level_dive_transition.gd`, `scenes/ui/level_dive_transition.tscn`
- **Modified**: `scripts/player.gd` (slam anti-spam, descent velocity cap, proximity auto-impact, reverse brake, `elif`→`else` fix), `scripts/level_factory.gd` (pot DR, fallback pool, `_make_obstacle` pot case, bonus scatter pass, track-bounds clamp, GDScript warnings), `scripts/obstacles/breakable_pot.gd` (destruction plugin, instant coins, slam enum fix, GDScript warnings), `scenes/obstacles/breakable_pot.tscn` (Greek urn mesh, Destruction node), `scripts/world_map.gd` (holographic dive transition integration), `scripts/autoloads/game_manager.gd` (GDScript warnings), `scripts/autoloads/ghost_analyzer.gd` (GDScript warnings), `scripts/autoloads/hit_stop.gd` (removed unused var)

---

## Phase 21: Level Editor Completeness, Custom Levels & Web Export

*Date: May 15, 2026 | Version: 0.3.0*

### Modular Track Segment Editor

The level editor was completely overhauled from a single flat floor into a **segment-based track builder** inspired by Polytrack:

- **3 Editor Modes**: `TRACK`, `OBSTACLE`, `CHECKPOINT` — switch via top-center toggle buttons
- **Segment Timeline**: Bottom UI shows every body segment as a numbered button; click to apply a track type
- **9 Segment Types**: `straight`, `ramp_up`, `ramp_down`, `gap`, `ice`, `narrow`, `wide`, `bank_left`, `bank_right`
- **Sacred Structure Enforcement**: Editor automatically prepends a 30-unit opening runway and appends a 30-unit closing runway + finish zone; only body segments are editable
- **Default Side View**: Camera yaw=90°, pitch=10° for a left-to-right track profile
- **Track Surface Snapping**: All placement (obstacles, coins, hoops) raycasts down to find the track surface Y and snaps to it

### Hoop System — Editor Integration

- **3 Height Tiers**: `ground` (+0.2m), `mid` (+1.5m), `high` (+3.0m)
- Palette buttons: "Ground Hoop", "Mid Hoop", "High Hoop" — each places a `hoop.tscn` with correct `hoop_type`
- Ghost preview shows a semi-transparent torus at the snapped height before placement

### Level Serialization — Shareable Text Codes

- `**scripts/level_serializer.gd`** extended to export/import the new rich segment format (`{"type": "straight", "length": 20, ...}`)
- **Compact export**: `JSON.stringify(data)` → `to_utf8_buffer()` → `Marshalls.raw_to_base64()`
- **Import validation**: Detects version prefix `px1`, parses segments and hoops, rebuilds finish zone
- **Hoop scene**: New `scenes/obstacles/hoop.tscn` with auto-generated `CollisionShape3D` + `MeshInstance3D` if children are missing

### Custom Level Loader

- `**scenes/custom_level_loader.tscn`** + `**scripts/custom_level_loader.gd**` — Paste a level code, validate Base64, parse JSON, and play immediately
- **Paste button**: Reads system clipboard into the code text box
- **Play button**: Stores parsed data in `GameManager.editor_test_data`, sets `_custom_level` meta flag, and loads the editor test runner

### Main Menu Integration

- **New button**: "Load Custom Level" (📋 icon) inserted between Continue and Editor in `main_menu.tscn`
- **Main menu script** (`scripts/main_menu.gd`): Added `_on_custom_level()` callback that fades to `Main.instance.load_custom_level_loader()`
- **Editor test runner** (`scripts/editor_test_runner.gd`): Added `_return_to_origin()` helper — returns to **main menu** when `GameManager.get_meta("_custom_level", false)` is true, otherwise returns to the editor

### Parse Error Fixes

Fixed multiple GDScript parse errors introduced during the overhaul:

- `**level_factory.gd`**: Removed undeclared `_prev_z1` assignments (3 occurrences); cleaned up unused `__prev_z1`
- `**main_menu.gd**`: Fixed tab indentation mismatch on `options_btn` @onready line; fixed button icon Dictionary keying (`btn.name` Strings instead of Object references)
- `**world_map.gd**`: Fixed `options_btn` path from `/SidebarPanel/OptionsBtn` to `$UI/SidebarPanel/OptionsBtn`; fixed malformed `.get_node_or_null` / `.add_child` / `/OptionsPanel.open()` shorthand; moved `path_anim_offset` declaration before all functions
- `**editor_test_runner.gd**`: Removed duplicate `var _respawning` / `var _timer` declarations that were placed after functions instead of with other member variables
- `**level_editor.gd**`: Moved `var _ghost_node` declaration from inside `_process()` scope to the top-level member variables
- `**track_builder.gd**`: Extracted `reduce_motion` check from `static func track_material()` / `wall_material()` into new static helper `_is_reduce_motion()` that safely accesses the autoload via `Engine.get_main_loop().root.get_node_or_null("LevelManager")`
- `**options_panel.gd**`: Changed `_set_anchors_preset()` to `set_anchors_preset()`
- `**level_serializer.gd**`: Replaced `if node is hoop_script:` (illegal local-variable type check) with duck-typing (`node.has_method("set_hoop_type")`)

### Web Export & Deployment

- **Godot 4.6.2 Web Export**: Exported `physix.html` + `physix.js` + `physix.wasm` + `physix.pck` (59MB) + audio worklets + icons
- **Vercel deployment**: Placed in `dva/src/site/physix/` so Eleventy's `addPassthroughCopy("src/site/physix")` copies it into `dist/physix/` during build
- **COOP/COEP headers**: Added `/physix/(.*)` block to `vercel.json` with `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` — required for Godot's SharedArrayBuffer
- **Permalink fix**: Changed `src/site/notes/Physix.md` permalink from `/physix/` to `/notes/physix/` to prevent Eleventy from overwriting the game `index.html`
- **Emoji fix**: Replaced non-BMP emoji (`📋` U+1F4CB, `🛒` U+1F6D2, `⚙` U+2699) with BMP-safe alternatives (`▼` U+25BC, `★` U+2605, `≡` U+2261) so they render in the Godot web export

### Title & Button Layout Fixes

- **Button order**: Options now sits above Quit in both `_menu_buttons` array and `main_menu.tscn` VBox
- **Title positioning**: Moved both `TitleLabel` and `TitleLabelStatic` to `offset_top = 10` so the title sits near the top with ~12px headroom, not overlapping the tagline/buttons
- **Button height**: Reduced from 68px back to 52px in `_style_buttons()` to prevent the VBox from growing too tall and pushing into the title

### New Files

- `scripts/custom_level_loader.gd`
- `scenes/custom_level_loader.tscn`
- `scripts/ui/options_panel.gd`
- `scenes/ui/options_panel.tscn`
- `scenes/obstacles/hoop.tscn`

---

## Phase 22: Lives Economy, Checkpoint Stars, Countdown & Polish

*Date: May 17, 2026 | Version: 0.4.0*

### Lives, Session Save & Game Over

- **Session persistence on Continue**: Coins, lives, total stars, and game-over state sync between `GameManager` and `LevelManager.save_data` (`player_coins`, `player_lives`, `session_game_over`)
- **Lives matter again**: Falling off the track costs a life; pause-menu **Retry** spends one life (button label shows `−1 life`)
- **Game Over at 0 lives**: In-level game-over panel and main-menu game-over flow; **Continue** from main menu restores the saved session
- **World map launch guard**: Cannot start a level with 0 lives (`_require_lives_to_launch` on world map)
- **Respawn** still resumes immediately without a second countdown

### Shop & Economy (World Map Only)

- **Shop removed from main menu** — `ShopBtn` deleted from `main_menu.tscn`; shop is only on the world map (`Shop / Inventory`)
- **Supplies tab**: Extra life (10 coins), world keys (50–100 coins by world) to unlock the next locked world without full star requirements
- `**unlock_world_with_key()`** + `WORLD_KEY_COSTS` in `LevelManager`
- **Game Over → Shop**: Main menu / in-level game over can set `open_shop_on_map` meta and route to the world map shop
- **Music unlock fix**: Shop IDs like `music_chill` normalize to track IDs (`chill`) so purchased tracks appear in the Music panel
- **Shop UI**: Card layout, tab icons via `GameIcons` / `assets/icons/`

### Stars, Times & Results Screen

- **Stars from checkpoint hoops only** — `GameManager.calculate_star_rating()`: 3★ = all 6 hoops, 2★ = ≥⅔ hoops, 1★ = finished
- **Medals removed** from awarding, save data, HUD complete panel, and world map display
- **Fastest time**: Saved per level only when all six checkpoints are cleared on that run
- **Complete screen**: Run time, personal best, and **New Fastest Time!** when applicable; incomplete runs show personal best only if one exists
- **World map nodes**: Best time label under star display on level nodes

### Level Start Countdown (3 → 2 → 1 → GO!)

- `**hud.run_start_countdown()`**: Prominent center overlay with dim backdrop; tip stays visible in `IntroPanel` at top
- **Player frozen** until GO (`is_running` false; `player._should_freeze_physics()` respects parent level)
- **SFX**: `menu_select` on 3/2/1, `boost` on GO; **camera shake** on GO via `CameraShaker`
- Replaces the old 6-second idle wait before gameplay
- **Bot tests** (`tools/bot_player.gd`): Wait for `level.is_running` instead of a fixed 4s timer

### Gameplay Tips (`scripts/gameplay_facts.gd`)

- **Single source of truth** for tips shown on world map (`Did you know? …`) and level intro (`Tip: …`)
- **Shuffle-bag rotation** per save: `LevelManager.facts_queue` — each tip appears once before any repeat; queue reshuffles when empty; cleared on **Reset progress**
- **Updated copy**: Six checkpoint hoops, speed burst on pass, lives/retry/shop, world keys, stars/times, momentum design, secrets, Phil/Godot backstory, sensational spelling (“Physix”), `jilly` world-map hint, Purple Worm Escape origin, etc.

### Lava Lamp Sky & World Lighting

- `**LevelVisuals`**: Reduced ambient energy and saturation, disabled `fog_sky_affect`, softer glow (higher HDR threshold, lower bloom) so world tint no longer washes out the sky
- `**lava_lamp_sky.gdshader**`: Deeper oil background, sharper blob masks, `color_contrast` + `wash_guard` uniforms, emission only on hot cores (not full-sky bloom)
- `**LevelVisuals.configure_sky_material()**` — central sky tuning from `sky_sphere.gd`

### Checkpoint Hoops

- **Speed burst halved** on factory-generated hoops (`HOOP_BOOSTS`: 10–20, down from 20–40) so chaining hoops is less overwhelming

### Finale & HUD

- **Finale duration**: 3.5s (was 7s) after crossing the finish plane
- **Complete panel**: Centered layout for time / best-time labels (`_layout_complete_label`)

### Main Menu Intro Animation

- **≤2 second reveal**: Buttons gently fade in top-to-bottom (no slide/rotate); title/tagline/backdrop overlap in parallel
- Stagger auto-calculated so the last of 7 buttons finishes at ~2.0s

### GDScript & Parse Fixes

- `world_map.gd`: Removed `await` from `-> bool` helper (parse error)
- `level_manager.gd`: Renamed loop variable `_key` → `level_key` (shadowing warning)
- `level_generator.gd` / `level_factory.gd`: Unused variable warnings cleaned up

### Files Added/Modified

- **New**: `scripts/gameplay_facts.gd`
- **Modified**: `scripts/autoloads/level_manager.gd`, `scripts/autoloads/game_manager.gd`, `scripts/game_level.gd`, `scripts/hud.gd`, `scripts/world_map.gd`, `scripts/world_map_node.gd`, `scripts/main_menu.gd`, `scripts/shop.gd`, `scripts/sky_sphere.gd`, `scripts/level_visuals.gd`, `scripts/player.gd`, `assets/shaders/lava_lamp_sky.gdshader`, `scenes/main_menu.tscn`, `scenes/sky_sphere.tscn`, `tools/bot_player.gd`, `scripts/level_factory.gd`

## Phase 23: Web Export Audio, Safari Fix & UI Polish

*Date: May 17, 2026 | Version: 0.4.0*

### Web Audio Export Fixes

- `export_presets.cfg`: Enabled `variant/thread_support=true` and `variant/extensions_support=true` — required for Godot 4.6 AudioWorklet mixer
- `web/custom_shell.html`: Custom HTML shell with AudioContext wrapper that runs BEFORE `physix.js` loads, tracking all created contexts in `window.__godotAudioContexts` and resuming them on first user gesture
- `scripts/autoloads/audio_manager.gd`: Removed `_audio_unlocked` gate and `_input()` handler — audio unlock is now fully handled by the browser shell

### Safari Compatibility

- Custom shell detects Safari/iOS and threaded builds, showing a friendly error message: "Safari cannot run this build (threading). Use Chrome or Firefox..."
- Runtime error handlers catch `pthread` and `Out of bounds` errors to show the same guidance

### Emoji Cleanup

- Replaced all non-BMP Unicode symbols with ASCII or BMP-safe alternatives across player-facing UI:
  - `hud.gd`: `❤ → "Lives:"`, `🪙 → "$"`, `★/☆ → "*"`
  - `world_map.gd`: `🛒 → "Shop"`, `💡 → "Did you know?"`, `🔒 → "[LOCKED]"`
  - `shop.gd`: `✓ → "EQUIPPED"`
  - `options_panel.gd`: `⚙ → "Options"`
  - `game_level.tscn` / `level_*.tscn` default labels: `❤  x3 → x3`, `☆☆☆ → ---`
  - `ice_patch.tscn`: `❄ ICE → ICE`
- Rationale: Godot's web font atlas (Iomanoid/Orange Kid) does not include emoji glyphs, causing boxes on web export

### 9-Point Snap System (Level Editor)

- `scripts/level_editor.gd`: Added `SNAP_LATERAL := 4.0`, `SNAP_VERTICAL := 2.0`, and `SNAP_DIRS` array with 9 directions (UL, U, UR, L, M, R, DL, D, DR)
- Segment data structure now stores `"x"` and `"y"` keys for deterministic placement
- `_rebuild_track()` uses `seg.get("x", 0.0)` and `seg.get("y", current_y)` for continuity

### World Map Sidebar Button Restructure

- `scenes/world_map.tscn`: Moved `ShopBtn` from `UI` root into `UI/SidebarPanel`, positioned between `MusicBtn` and `OptionsBtn`
- All three sidebar buttons (`Music`, `Shop`, `Options`) now use `GameIcons.get_menu_texture()` for 128×128 procedural icons
- Removed `icon` ExtResource references from `.tscn` — icons are assigned dynamically in `_populate_sidebar()` to avoid missing resource errors
- `MusicPanel` title: `🎵 Select Music Track → Select Music Track`; close button: `✕ → Close`

### Shop Key Icon

- `scripts/autoloads/game_icon_painter.gd`: `_paint_shop_key()` redesigned from credit card to a gold key shape (bow ring + shaft + bit teeth)

### Options Menu Quit Button

- `scripts/ui/options_panel.gd`: Added `"Quit Game"` button below Close

### Start Wall Fix

Fixed the invisible barrier behind the player start so it actually prevents backward falls:

- **Root cause**: `_build_start_wall()` in `scripts/level_generator.gd` placed the wall at `z=5.0` — far enough behind the start that the player rolled off the track edge before ever hitting it. Additionally, baked `.tscn` levels skipped `_build_level()` entirely and never received a start wall.
- **Position fix**: Wall moved from `z=5.0` to `z=0.5` — right behind the ball's spawn point
- **Thickness fix**: Box Z-size increased from `0.5` to `1.0` to prevent physics tunneling at low speeds
- **Width fix**: Box X-size increased from `14.0` to `16.0` to cover wider opening segments
- **Height fix**: Wall center lowered from `y=3.0` to `y=2.0` so the bottom edge sits below the sloped track surface even on steep openings
- **Baked scene coverage**: `_ready()` now calls `_build_start_wall()` inside the `has_baked` branch before returning, ensuring hand-edited levels also get the barrier

### Files Added/Modified

- **New**: `web/custom_shell.html`
- **Modified**: `scripts/world_map.gd`, `scenes/world_map.tscn`, `scripts/autoloads/game_icon_painter.gd`, `scripts/ui/options_panel.gd`, `scripts/autoloads/audio_manager.gd`, `scenes/obstacles/ice_patch.tscn`, `scripts/test_harness.gd`, `export_presets.cfg`

---

## Phase 24: Theme Fixes, Hoop Guarantee & Ice Physics Overhaul

*Date: May 18, 2026 | Version: 0.4.1*

### Theme Visual Fixes

- **Neon Nights (`theme_neon`)**: Tron-style horizon grid on ground plane with static grid (removed scroll), night sky with deep blue wash
- **Nature (`theme_nature`)**: Grass track texture (`assets/themes/grass_track.png`) with lush green tiling; walls use vector treeline graphic (`assets/themes/treeline_wall.png`) with clean transparent top half and proper UV scaling
- **Space (`theme_space`)**: Starfield sky with nebula and comets via `lava_lamp_sky.gdshader` mode 2
- **Default Theme reset**: Shop now offers a free "Default Theme" button that calls `LevelManager.equip_theme("")` to reset to default visuals

### Checkpoint Hoop Guarantee

Completely rewrote `_build_hoops()` in `scripts/level_factory.gd` to guarantee **exactly 6 hoops per level**:

- **Placement order**: Hoops are now placed **before** obstacles so they get priority real estate; obstacle generation respects hoop safe zones (`_build_obstacles` seeds `placed_obs` with hoop positions)
- **Dense candidate sampling**: Generates multiple candidates per valid body segment (~every 10m) instead of one per segment, then greedily picks highest-scoring candidates that are at least `min_hoop_spacing` apart
- **Aggressive nudge fallback**: When a hoop's X position is blocked by obstacles, tries Z nudges of ±2 through ±30 and retries X up to 5 times per nudge
- **Nuclear segment fallback**: If greedy placement leaves gaps, iterates every remaining valid body segment and places hoops there with spacing enforcement
- **Tier distribution preserved**: Every level still has at least 1 of each tier (ground/mid/high), with world-specific distributions (W1=balanced, W6=mostly high)
- **Legacy fallback**: `_build_hoops_legacy()` updated with wider nudge ranges and more X retries for short/odd levels

### World Signature Mechanic Guarantee

Every level now contains **at least one** of its world's signature obstacle:

- **World 3**: gravity
- **World 4**: wind
- **World 5**: wind
- **World 6**: magnet

Implementation: `_build_obstacles()` checks `has_signature` and forces `kind = signature_kind` on the first valid placement. `_fallback_pool()` only returns the current world's mechanic + basics (no bleed-through from previous worlds). Removed old 25% fallback draw that could place wind in World 3 or gravity in World 5.

### Ice Physics Overhaul

Ice segments now feel **slippery, zippy, and fun** instead of barely different from normal track:

- **Detection**: `_check_ice()` in `scripts/player.gd` uses the ground ray to read `physics_material_override.friction` on the collided body; friction below `0.02` triggers ice mode
- **Steering**: `steer_force` multiplied by **1.7×** — you can really carve left and right on ice
- **Forward push**: `forward_push` multiplied by **1.45×** — pressing forward on ice accelerates harder
- **Speed cap**: `target_speed` multiplied by **1.25×** — ice lets you exceed normal max speed
- **Lateral cap**: `max_lateral_speed` multiplied by **1.6×** — you can drift sideways much faster
- **Coast drag**: Rolling resistance reduced to **12%** of normal on ice — speed bleeds extremely slowly, preserving momentum
- **Gas ramp**: `target_max` also boosted by 1.25× on ice so the speed ceiling rises with throttle

### Bonus Level Save Fix

`scripts/tools/run_regen_worlds_3_4.gd` and `run_regen_worlds_5_6.gd` now call `LevelFactory.save_bonus_to_file()` instead of `save_to_file(world, 0, ...)`, ensuring bonus levels are saved as `B-{world}.json` instead of `{world}-0.json`.

### Level Regeneration

All Worlds 3-6 levels (3-1 through 6-6) and bonus levels (B-3 through B-6) were regenerated with the corrected factory. Every audited level passes:
- Exactly 6 checkpoint hoops
- At least 1 signature obstacle from its world
- No cross-world mechanic bleed-through

### Files Added/Modified

- **New**: `assets/themes/treeline_wall.png`, `assets/themes/grass_track.png`
- **Modified**: `scripts/level_factory.gd` (hoop guarantee, signature mechanic, dense sampling, nuclear fallback), `scripts/player.gd` (ice detection, ice steering/push/speed/drag multipliers), `scripts/track_builder.gd` (nature theme textures with UV scaling), `scripts/level_visuals.gd` (theme sky params, RefCounted-safe node lookup), `scripts/shop.gd` (free Default Theme button), `scripts/tools/run_regen_worlds_3_4.gd`, `scripts/tools/run_regen_worlds_5_6.gd` (bonus save fix)

---

*Last updated: May 18, 2026*