# Research: Physics-Based Ball Rolling Games in Godot

Date: 2026-05-10

## Open-Source Godot Projects

### Primary Reference: `thearst3rd/godot4-marble-game`
- **URL:** https://github.com/thearst3rd/godot4-marble-game
- **Stars:** 5 | **License:** MIT | **Godot:** 4.1
- **Key Mechanics:** `RigidBody3D` marble physics inspired by *Marble Blast*. Intentionally emulates diagonal movement.
- **Best For:** Using as a foundation or reading to see how Godot 4 `RigidBody3D` ball physics are tuned.

### `PaigePalisade/GodotMonkeyBallDemonstration`
- **URL:** https://github.com/PaigePalisade/GodotMonkeyBallDemonstration
- **Description:** A *Super Monkey Ball*-style demo showing rolling ball mechanics.
- **Best For:** Understanding Monkey Ball-style tilted-world camera/control relationships.

### `MechanicalFlower/Marble`
- **URL:** https://github.com/MechanicalFlower/Marble
- **Stars:** 13 | **License:** MIT | **Godot:** 4.4
- **Key Mechanics:** Procedural marble races, real-time ranking, normal and elimination modes.
- **Best For:** Procedural race/track generation logic and spectator/race architecture.

### `HarshNarayanJha/marble_momentum`
- **URL:** https://github.com/HarshNarayanJha/marble_momentum
- **Play:** https://harshnarayanjha.itch.io/marble-momentum
- **Key Mechanics:** Adjustable slopes, toggleable fans, domino chain reactions.
- **Best For:** Level component interactivity (fans, adjustable slopes) and physics puzzle design.

### `Veraball/veraball`
- **URL:** https://github.com/Veraball/veraball
- **Stars:** 44 | **License:** MIT
- **Note:** Features boost mechanics based on rolling speed.
- **Best For:** Speed/boost system design.

### `ComfortFoodGames/godot-marble-tilt-maze`
- **URL:** https://github.com/ComfortFoodGames/godot-marble-tilt-maze
- **Description:** Physics-based tilt maze where you tilt the board to guide a marble.
- **Play:** https://comfort-food-games.itch.io/godot-marble-tilt-maze
- **Best For:** Alternative control schemes.

### `christinec-dev/GodotEndlessRunner`
- **URL:** https://github.com/christinec-dev/GodotEndlessRunner
- **Description:** Full Godot 4 3D endless runner called *Dock & Roll* with procedural obstacles.
- **Best For:** Procedural level block recycling.

### `lemilonkh/godot-curve-spawner`
- **URL:** https://github.com/lemilonkh/godot-curve-spawner
- **Description:** Godot 4.5+ addon that spawns scenes along a `Path3D` curve.
- **Best For:** Procedurally placing obstacles/collectibles along curved tracks.

## Game Design Articles & Tutorials

### Video: "Create a 3D Marble Game in Godot 4" by Shuntoon
- **URL:** https://www.youtube.com/watch?v=SdJplQOYXrs
- **Includes:** Project files at https://github.com/Shuntoon/Marble3D_Project_FIles
- **Covers:** `RigidBody3D` player setup, `CSGBox3D` environments, camera rig.

### Written: "Let's Roll" — Godot Academy
- **URL:** https://godotacademy.io/post/lets-roll
- **Covers:** `GridMap` + MeshLibrary, angular velocity rolling, PhysicsMaterial tweaks, DeathZones, VictoryZones.

### Written: 3D Road Generator with Bezier Curves (Beau Seymour)
- **Article:** https://www.seemore.games/how-to-make-roads-with-bezier-curves/
- **Covers:** `Path3D` + `CSGPolygon` track extrusion, `SurfaceTool`.

## Notable Godot Games on Itch.io

### `Gravosphere: First Drop` — Perfect Flow Studios
- **URL:** https://perfect-flow-studios.itch.io/gravosphere
- **Details:** 50+ levels, gravity boost mechanic, medals, speedrun mode.

### `The Drop` — Coderman64
- **URL:** https://coderman64.itch.io/the-drop
- **Details:** Steampunk Marble Madness inspired. **HTML5/browser build available**.

### `Globe Rush` — Cascadia
- **URL:** https://ursacascadia.itch.io/globe-rush
- **Details:** Super Monkey Ball inspired, controller + touch support.

### `3D Physics Based Marble Platformer` (Demo) — Skoe
- **URL:** https://scottretjr.itch.io/marble-game-demo
- **Devlog:** https://scottretjr.itch.io/marble-game-demo/devlog/211671/3d-physics-based-marble-platformer
- **Covers:** Dealing with collision seams (highly relevant).

## Best Practices for Godot 4 3D Physics Games

### A. Collision Seam Problem (Critical)
Rolling spheres hit "ghost bumps" at internal edges between adjacent collision shapes.
- **Issue:** https://github.com/godotengine/godot/issues/50463
- **Solutions:**
  1. Merge floor colliders into one large `BoxShape`
  2. Use Godot Jolt plugin with Internal Edge Removal
  3. Avoid trimesh for flat floors
  4. Increase physics tick rate (60→120/240 Hz)

### B. 3D Performance
- Use occlusion culling, Mesh LOD, Visibility Ranges
- Use `MultiMesh` for repeated objects
- Bake static lighting
- Minimize transparent objects

### C. Level Architecture
**Recommended: Main + World + Persistent Managers**
- Keep persistent `Main` scene with `World` (level container) and `GUI`
- Swap levels by adding/removing children under `World`
- Use Custom Resources (`StageInfo`, `WorldInfo`) for level data
- Use `ResourceLoader.load_threaded_*` for background loading

### D. Web Export
- Use **Godot 4.5+** for WASM thread pool deadlock fix
- Test threaded vs single-threaded builds
- Use async loading to avoid stutters
- Enable Brotli/gzip compression on server
- Keep physics conservative (primitive colliders, avoid cylinders)

## Recommendations for Physix

| Physix Feature | Recommended Approach |
|---|---|
| **Ball Controller** | Study `thearst3rd/godot4-marble-game` for `RigidBody3D` tuning |
| **42-Level Architecture** | Use Custom Resources + `Main/World/GUI` pattern |
| **Procedural Tracks** | Combine `Path3D` + `SurfaceTool` for mesh generation |
| **Collision Seam Fix** | Merge floor colliders OR switch to Godot Jolt |
| **Web Deployment** | Godot 4.5+, test threaded + single-threaded |
| **Performance** | Occlusion Culling, Mesh LOD, MultiMesh, baked lighting |
| **Level Design** | Reference *Gravosphere* (medals) and *The Drop* (browser) |
