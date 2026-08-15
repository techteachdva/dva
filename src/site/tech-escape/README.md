# TECH ESCAPE

A first-person 3D horror-escape game for the middle school Tech Lab. It is 9:47 PM,
the doors are locked, and something is skittering between the tables. Answer the
questions on four glowing Chromebooks to earn four pieces of an encrypted code,
crack each piece in a decryption scramble, print a key on the 3D printer, and get out.

Built to run on a school Chromebook in Chrome: no build step, no dependencies, no
network calls, and a vendored copy of three.js so it works on a locked-down or
offline network.

## How to Run

1. Open `index.html` in Chrome.
2. That's it. Plain HTML/CSS/JS modules.

> ES modules are blocked over `file://` in most browsers. If you open the file
> directly and get a blank screen, serve the folder instead:
>
> ```bash
> cd tech-escape
> python -m http.server 8000
> # then visit http://localhost:8000
> ```

On the live site it is served at `/tech-escape/` (see the passthrough copy entry in
`.eleventy.js`).

## Controls

| Key             | Action                                              |
| --------------- | --------------------------------------------------- |
| W A S D         | Move                                                 |
| Mouse           | Look (click the canvas to lock the pointer)          |
| SHIFT           | Sprint (drains stamina)                              |
| **C** or **CTRL** | **Crouch / crawl (toggle)** - the only way under a desk |
| F               | Flashlight on / off                                  |
| E               | Use a Chromebook, the printer, or the exit door      |
| ESC             | Pause, settings, controls                            |

Crouch is a **toggle**, not a hold, so it never fights the sprint key and nobody has
to keep a finger on CTRL while steering. Touch devices get an on-screen CROUCH button.

## Core Mechanics

- **Four Chromebooks, four code pieces.** Each terminal quizzes you on real Middle
  School Technology content. Wrong answers make noise, and noise brings company.
- **Decryption scramble.** A Memory-style matching minigame reveals each code fragment.
- **The 3D printer** takes all four pieces, prints a key, and the exit door opens.
- **Hot Cheetos** are health. **Batteries** are flashlight fuel. **Stamina** limits sprinting.

### Hiding requires crawling

Desks are **solid**. You cannot walk through one, and you cannot walk under one.
The gap under a desk is shorter than a standing body, so the only way in is to crouch:

- Standing collision body: **1.75 units** tall.
- Crouched collision body: **0.90 units** tall.
- Tabletop slab occupies **1.00 to 1.24 units**.

Because the crouched body is shorter than the underside of the slab, crouching lets
you pass; standing does not. There is no trigger volume and no scripted "hide" action -
hiding is simply the physical consequence of being crouched under a desk.

While crouched you move at **1.65 u/s** (walking is 4.1, sprinting is 7.0), your camera
drops, your view pitch is restricted, and you breathe and scuff audibly. Standing up
with a desk overhead is **refused** rather than allowed to shove you through the
tabletop; you have to crawl out first.

Desks that can hide you are marked with **glowing cyan tape** along the underside edge.
Chromebook workstations, server racks, and tubs are solid at every height - no crawling
under those.

Mice are treated as too tall to fit under a desk, so hiding actually works against them.

### The flashlight is a weapon - but only against viruses

The two enemy types are deliberately opposites:

- **Evil computer mice** are *attracted* to your flashlight. Light makes them worse.
  The counter is hiding under a desk.
- **Ghostly viruses** phase through walls and cannot be out-cornered, but they are
  *burned* by the beam.

Hold the beam on a virus and it recoils, flickers, and its whine climbs in pitch.
Hold it long enough and the virus **glitches**: it stutters violently, screeches, the
screen tears into RGB channel split and static, and it teleports far across the lab.
It is dazed for a moment, then re-acquires you and comes back. **It is a reprieve,
never a kill.**

Current tuning (all in `js/config.js` under `VIRUS`):

| Value                     | Setting  | Why                                                        |
| ------------------------- | -------- | ---------------------------------------------------------- |
| `burnCharge`              | 0.55 s   | Sustained beam contact needed to trigger the glitch         |
| `burnGrace`               | 0.35 s   | Beam may slip off this long without losing progress         |
| `glitchStutter`           | 0.45 s   | Violent jitter before it vanishes                           |
| `glitchTeleportMinCells`  | 8 cells  | Minimum path distance of the destination (~35 world units)  |
| `glitchCooldown`          | 3.2 s    | Before the same virus can be glitched again (no stunlocking) |
| `glitchReacquire`         | 1.4 s    | Dazed wander time before it hunts you again                 |
| `repelRange`              | 14 units | How far the beam reaches a virus                            |
| `repelStrength`           | 3.4      | Gentle recoil, and it fades as the burn charges             |

Beam detection is deliberately **forgiving**: the hit cone is 1.5x wider than the
visible cone, plus extra angular slack scaled to the virus body, so brushing a virus
with the edge of the beam counts. It still requires line of sight, so a wall protects them.

Balance consequence: the light is now both vision and defence, so it drains
**2.6%/s** normally and **8.1%/s while burning** a virus (`PLAYER.batteryDrain` plus
`PLAYER.batteryBurnDrain`). Battery pickups were increased to compensate
(7 to 10 on Field Trip, 5 to 8 on After Hours, 4 to 6 on System Crash). Burning a
virus for two seconds costs roughly 9% of a full battery, so you cannot burn your way
through the night - you have to choose between seeing and defending.

A dead battery is never an unwinnable death sentence: crawling under a desk still
protects you from everything, including viruses.

## Curriculum

48 questions across four terminals, aligned to Code.org's middle school CS curriculum
and ISTE 2025 standards:

1. **The Design Process** - DEFINE, PREPARE, TRY, REFLECT
2. **Computing Systems & Networks**
3. **Data & AI**
4. **Algorithms & Programming**

Answers are length-balanced on purpose: the self test asserts that "always pick the
longest answer" wins no more often than chance (currently 22% of single-answer
questions) and that correct options sit mid-pack by length. Several questions have
multiple correct answers.

## Project Layout

```
tech-escape/
  index.html
  styles.css
  README.md
  _selftest.html        # logic + design assertions, no WebGL needed
  _playtest.html        # drives the real engine, checks mechanics and perf
  _run_selftest.ps1     # runs either page in headless Chrome and prints results
  _lencheck.html        # diagnostic: answer-length distribution
  vendor/
    three.module.js     # vendored so the game works offline
  js/
    main.js             # game loop, state machine, settings, run setup
    config.js           # every tuning value lives here
    input.js            # keyboard, pointer lock, touch
    audio.js            # procedural Web Audio, no audio files
    ui.js               # HUD, toasts, screens
    util.js             # rng, math helpers
    data/
      questions.js      # the question bank
    world/
      maze.js           # layout generation, grid collision, LOS, flow fields
      obstacles.js      # furniture colliders with vertical bands (crawl space)
      lab.js            # geometry: desks, Chromebooks, printer, exit, props
      lighting.js       # ambient, flashlight, pooled point lights
    entities/
      player.js         # movement, stamina, crouch/crawl, hiding, battery
      mouse.js          # evil computer mice
      virus.js          # ghostly viruses, burn/glitch/teleport
      enemies.js        # spawning, escalation, shared pathfinding
      pickups.js        # Hot Cheetos and batteries
    minigames/
      quiz.js           # Chromebook questions
      memory.js         # decryption scramble
```

## Testing

Two headless Chrome harnesses, run from this folder:

```powershell
powershell -ExecutionPolicy Bypass -File _run_selftest.ps1                 # 68 logic assertions
powershell -ExecutionPolicy Bypass -File _run_playtest.ps1 _playtest.html  # live engine run
powershell -ExecutionPolicy Bypass -File _run_boot.ps1                     # boots the real page
```

`_run_boot.ps1` loads `index.html` itself and fails on any console error. The other
two import modules individually, so they cannot catch a syntax error in a file the
game loads at boot - this one can.

`_selftest.html` covers maze generation, collision, line of sight, pathfinding,
question integrity and fairness, player movement, the crouch/desk geometry
relationship, and the full virus burn/glitch/cooldown/re-acquire cycle.

`_playtest.html` boots the real renderer and world, runs a seeded bot for 30 simulated
seconds, then deliberately tests walking into a desk, crawling under it, being
refused a stand-up, a mouse failing to follow, and a sloppily-aimed beam still
glitching a virus. It also reports frame cost. The session is deterministic, so two
runs produce identical numbers.

## Performance Notes

Targeting integrated graphics on a Chromebook:

- Instanced meshes for walls, desks, legs, and glow tape.
- `MeshLambertMaterial` throughout, no shadow maps, no post-processing passes.
- A fixed pool of point lights that re-targets the nearest glow sources, so the
  shader never recompiles mid-run.
- The glitch effect is screen-space **CSS**, not a render pass, so it costs nothing
  on the GPU.
- Obstacle colliders are bucketed per maze cell, so a collision query only looks at
  the handful of boxes near the mover. Measured at 0.63 microseconds per query, which
  is 0.003 ms per frame for the player and every mouse combined.
- The flashlight cone + occlusion test costs 0.002 ms per frame for all viruses.
- A virus teleport picks its destination by filtering cells on cached path distance and
  then line-of-sight testing at most 12 of them, so the glitch never causes a hitch.
- Measured on the reference run (328 colliders, 59 desks, 4 mice, 2 viruses):
  62 draw calls median / 163 worst, ~11k triangles, and a simulation cost of
  0.1 ms median and 0.2 ms p95 per frame - leaving essentially the whole 16.6 ms
  frame budget to the GPU.
- Quality presets (Low / Medium / High) scale render resolution, fog density, and
  the size of the light pool. Low is the recommended setting for older Chromebooks.
```
