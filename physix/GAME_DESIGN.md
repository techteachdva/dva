# Physix — Game Design Document

## Concept
A physics-based slope game for middle school students. The player rolls a ball down
procedurally hand-crafted slopes navigating obstacles that each teach a real physics concept.
Inspired by *Slopes* (online flash game) but with a world map, level progression, and a
rich obstacle vocabulary.

---

## Controls
| Action        | Key (default)         |
|---------------|-----------------------|
| Steer left    | A / Left Arrow        |
| Steer right   | D / Right Arrow       |
| Jump          | Space / Up Arrow      |
| Brake         | S / Down Arrow        |
| Pause         | Escape                |

---

## World Map (Super Mario World Style)
- Five worlds, each introducing a new physics concept
- Worlds laid out in rows; levels laid out in columns within each row
- Levels unlock left-to-right; worlds unlock by earning enough stars
- Player icon slides between nodes; Enter/click launches the level

| World | Name               | Physics Concept          | Levels | Unlock Stars |
|-------|--------------------|--------------------------|--------|--------------|
| 1     | Beginner's Slope   | Gravity & Motion         | 4      | 0            |
| 2     | Friction Falls     | Friction & Momentum      | 4      | 6            |
| 3     | Gravity Gulch      | Variable Gravity         | 4      | 15           |
| 4     | Momentum Mountain  | Collisions & Energy      | 4      | 27           |
| 5     | Quantum Peaks      | All Forces Combined      | 3      | 40           |

---

## Scoring & Stars
Each level awards 1–3 stars based on:
- ★ Finish the level
- ★★ Finish under par time + collect 5+ coins
- ★★★ Finish under fast time + collect 8+ coins + clear 3+ obstacles

Stars unlock new worlds. Score is tracked globally (speed bonuses, combos, coins).

---

## Obstacle Vocabulary

| Obstacle        | Physics Concept            | Behaviour |
|-----------------|---------------------------|-----------|
| **Speed Boost** | Impulse / KE               | Fires the ball in a set direction |
| **Brake Pad**   | Friction / deceleration    | Sharply reduces velocity |
| **Bumper**      | Elastic collision / N3L    | Bounces ball away from centre |
| **Gravity Zone**| Variable gravity           | Boosts, reduces, reverses, or zeroes g |
| **Wind Zone**   | Applied force / drag       | Continuous or gust sideways force |
| **Ice Patch**   | Low-friction surface       | Near-zero friction terrain segment |
| **Moving Platform** | Relative velocity      | Platform moving along a path |
| **Checkpoint**  | Progress marker            | Saves respawn position, awards points |

---

## Level Design Guidelines
- Every level scene inherits `game_level.gd`
- Set `physics_fact` in the Inspector → shown as a 3-second tip at level start
- Place obstacles as children of `ObstacleRoot`
- Place terrain as children of `TerrainRoot`
- `FinishZone` triggers level completion
- Camera follows the Player node automatically

---

## Project Structure
```
Physix/
├── project.godot
├── icon.svg
├── GAME_DESIGN.md          ← this file
├── scenes/
│   ├── main_menu.tscn
│   ├── world_map.tscn
│   ├── game_level.tscn     ← base template (duplicate for new levels)
│   ├── player/
│   │   └── player.tscn
│   ├── levels/
│   │   ├── world_1/        ← level_1_1.tscn … level_1_4.tscn
│   │   ├── world_2/
│   │   ├── world_3/
│   │   ├── world_4/
│   │   └── world_5/
│   ├── obstacles/          ← individual obstacle scenes (to be built)
│   └── ui/
│       └── world_map_node.tscn
├── scripts/
│   ├── autoloads/
│   │   ├── game_manager.gd
│   │   └── level_manager.gd
│   ├── player.gd
│   ├── game_level.gd
│   ├── world_map.gd
│   ├── world_map_node.gd
│   ├── main_menu.gd
│   ├── hud.gd
│   └── obstacles/
│       ├── obstacle_base.gd
│       ├── gravity_zone.gd
│       ├── speed_boost.gd
│       ├── bumper.gd
│       ├── wind_zone.gd
│       ├── ice_patch.gd
│       ├── moving_platform.gd
│       └── checkpoint.gd
├── resources/levels/
└── assets/{sprites,sounds,fonts}
```

---

## Next Steps (in order)
2. Assign placeholder sprites/collision shapes to the Player scene
3. Build obstacle scenes (one `.tscn` per obstacle type referencing its `.gd`)
4. Design levels 1-2 through 1-4 by duplicating `level_1_1.tscn`
5. Add particle materials to GPUParticles2D nodes
6. Create AnimationPlayer clips for UI transitions
7. Add background music and SFX
