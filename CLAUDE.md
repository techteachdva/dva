# Physix — Revised Design Document & AI Skill Reference

**Version:** 2.0 — Speed/Momentum Edition  
**Last Updated:** May 10, 2026  
**Purpose:** Human reference + AI instruction set for all future Physix work. Overrides all default behavior.

---

## 1. Project Overview

Physix is a Godot 4.6.2 physics-based ball-rolling game with 6 worlds × 6 levels + 6 bonus levels (42 total). Uses RigidBody3D, procedural level generation, GDScript, and GL Compatibility rendering.

### Target Feel
The game should feel like a **physics playground**, not a maze. The ball has weight, momentum, and inertia. The track is a **rollercoaster**, not a flat plane with obstacles. Every level is a **momentum economy** — the player invests effort (uphill climbs, precise steering) and gets paid back in speed (downhill rushes, satisfying jumps).

---

## 2. The Three Pillars of Physix Design

### Pillar 1: Momentum Economics (The "Sonic/Trackmania" Rule)
> *"Speed must be earned, readable, conserved, and tested."*

- **Earned**: Uphill climbs and narrow sections store tension. The player works for speed.
- **Readable**: At high speed, the player must see landing zones 1.5+ seconds ahead. No blind jumps.
- **Conserved**: Never place cheap traps (spikes, sudden narrow walls) in high-speed sections. Let the player enjoy their speed.
- **Tested**: Big gaps and steep climbs should require a minimum speed to clear. The gap is the exam; the preceding downhill is the study.

### Pillar 2: Slope-First Geometry (The "Sonic Mania" Rule)
> *"Slopes are the primary mechanic, not decoration."*

- Every segment should have slope variation. Flat (`ramp=0`) is a **rest zone**, not the default.
- Uphill segments must be **earned** — preceded by a downhill or boost pad.
- The steeper the slope, the **wider** the track (player needs room to correct at speed).
- Banked turns (rotation around Z) are preferred over sharp x-shifts. The ball's momentum follows the bank naturally.

### Pillar 3: Modular, Validated Generation (The "McGill/Word2World" Rule)
> *"Handcraft modules, assemble levels, validate with bots, iterate."*

- **Never** write 36 bespoke levels as one giant dictionary.
- Design **~15 playtested modules** (highway, funnel, switchback, ski jump, half-pipe, corkscrew, bumper arena, etc.)
- **Assemble** each level as a sequence of 3-5 modules.
- **Validate** every module with the bot before using it in production levels.
- **Repair** — if the bot fails, adjust the module constraints, not the individual segment numbers.

---

## 3. The Roller Coaster Rhythm Cycle

Every level must follow this 5-phase structure:

```
TAKEOFF (Acclimation) → BUILD-UP (Tension) → RELEASE (Speed) → REST (Breathing Room) → LANDING (Conclusion)
```

| Phase | Geometry | Feel | Purpose |
|-------|----------|------|---------|
| **Takeoff** | `ramp = -0.3 to 0`, `w = 10-12`, `x = 0`, no obstacles | Calm, centered, predictable | Player acclimates to the level |
| **Build-Up** | `ramp > 0` (uphill), `w = 5-7`, ice or gravity zones | Slow, careful, tense | Player works for speed |
| **Release** | `ramp < -2` (downhill), `w = 9-12`, gap or boost pad | Fast, exhilarating, flow | Player enjoys their reward |
| **Rest** | `ramp = 0`, `w = 10`, no obstacles, wide landing | Calm, recover, breathe | Player prepares for next cycle |
| **Landing** | `ramp = 0`, `w = 10-12`, `x = 0`, no obstacles | Satisfying, predictable conclusion | Player crosses the finish with confidence |

### Sacred Structure (The "Takeoff → Body → Landing" Rule)

**Every level, regardless of layout type, must start with an opening straightaway and end with a closing straightaway.** The opening and closing are sacred — they are never skipped, narrowed, or filled with obstacles.

| Zone | Segment Count | Width | Ramp | X | Obstacles |
|------|--------------|-------|------|---|-----------|
| **Opening** | 2 segments | 10-12 | -0.3 to 0 (gentle downhill or flat) | 0 | **None** |
| **Body** | Layout-specific | Per layout config | Per layout config | Per layout config | Scored placement |
| **Closing** | 2 segments | 10-12 | Trending to 0 (gentle) | Trending to 0 | **None** |
| **Runway** | 1 segment | 10 | 0 | 0 | **None** |

**Why this matters:** A level that launches the player immediately into a sharp curve or narrow funnel feels unfair. The player needs 2-3 seconds of straight track to get their bearings, feel the ball's weight, and build trust. The closing straightaway provides a dopamine hit — the player sees the finish, knows they made it, and enjoys the final roll.

**Anti-patterns:**
- **Random mixing of danger** — a level that is narrow everywhere with random gaps is not "hard," it's **anxiety-inducing**.
- **Body segments touching the start or end** — if the first body segment is a sharp x-shift or steep uphill, the level feels disjointed.
- **Checkpoints in opening/closing zones** — hoops in the sacred zones break the calm. Place them in the body only.

**Continuity enforcement:** The factory uses `OPENING_ZONE_SEGS = 2` and `CLOSING_ZONE_SEGS = 2`. The body is `max(total_count - 4, 3)`. Transitions are eased:
- First body segment x is blended 30% from opening (x=0)
- Last body segment x is blended 30% toward closing (x=0)
- First body segment ramp is lerped 60% from the opening's final ramp
- Last body segment ramp is lerped 50% toward 0

---

## 4. Level Module Database

### Approved Module Archetypes

Each module is a validated, playtested sequence of segments. A level is assembled by chaining 3-5 modules.

| Module | Description | Geometry Signature | Constraints |
|--------|-------------|-------------------|-------------|
| **Highway** | Wide, straight, slight downhill. Pure speed feel. | `w=10-12`, `ramp=-0.5`, long `z` span | Must be followed by a build-up or a gap |
| **Funnel** | Wide → narrow → wide. Tests precision approach. | `w=10→7→5→7→10` | Narrowest point should have a coin or checkpoint |
| **Ski Jump** | Downhill → flat → gap. Classic momentum test. | `ramp=-3→0`, gap at end | Preceded by uphill or boost pad |
| **Switchback** | Sharp x-shifts (±3-4) with gaps at turns. | `x` oscillates, `w=6-8` | Gaps only at inflection points |
| **Half-Pipe** | Banked walls where ball rides the curve. | Segments rotated around Z (`bank=30-45°`) | `w >= 8` |
| **Corkscrew** | Spiral rotation around Z over 4-6 segments. | Progressive `rotation.z` increase | Requires sustained speed |
| **Bumper Arena** | Wide arena with diamond bumper grid. | `w=14`, bumpers at intersections | Coins placed in ricochet paths |
| **Step-Up** | Each segment is +1.0y higher. Momentum staircase. | `y` increments by 1.0 per segment | Too slow = roll backward |
| **Gravity Well** | Reversed gravity zone in a bowl shape. | `gravity=reverse` in a dip | Wide enough to escape if overshot |
| **Wind Tunnel** | Crosswind pushing player sideways. | `wind_force=20-26` | Counter-steer required |
| **Ice S-Curve** | Continuous ice curve with outer-edge coins. | `ice=true`, `x` shifts smoothly | Outer edge = risk coins |

### Module Assembly Rules

Every level is assembled as: **Opening → Body Module(s) → Closing → Runway**

- **World 1** (Beginner): `Opening → Highway → Funnel → Ski Jump → Closing` — teaches speed, precision, and momentum
- **World 2** (Ice): `Opening → Ice S-Curve → Funnel → Ski Jump → Closing` — adds frictionless control
- **World 3** (Gravity): `Opening → Step-Up → Gravity Well → Highway → Closing` — verticality and force fields
- **World 4** (Bumper): `Opening → Bumper Arena → Switchback → Bumper Arena → Closing` — chaos and ricochet mastery
- **World 5** (Wind): `Opening → Wind Tunnel → Switchback → Wind Tunnel → Closing` — constant lateral pressure
- **World 6** (Mastery): `Opening → Half-Pipe → Corkscrew → Step-Up → Bumper Arena → Ski Jump → Closing` — everything combined

The opening and closing zones are always present, always straight, always wide, and always obstacle-free. They are sacred.

---

## 5. World Progression & Educational Scaffolding

### The Learning → Testing → Mastery Cadence

| Level # | Purpose | Content |
|---------|---------|---------|
| **1-2** | Learning | Pure mechanic, isolated, safe context |
| **3-4** | Testing | Mechanic + one known danger |
| **5-6** | Mastery | Full synthesis with all prior mechanics |

### Textless Teaching (The "World 1-1" Principle)

**Never** explain mechanics with text popups. The geometry teaches:

- **First gap (World 1-1)**: Wide, obvious hole. Player falls in, respawns, next run they jump instinctively.
- **Narrow corridor (World 1-2)**: Walls funnel the player toward the landing zone. Player learns: "I need to be centered before jumping."
- **Ramp into gap (World 1-3)**: Gentle downhill leading to a jump. Player learns: "Downhill makes me jump farther."

### Flow Framework

| Zone | What Happens | Fix |
|------|--------------|-----|
| **Boredom** | Too easy, no stakes | Add gaps, narrow sections, or off-path coins |
| **Flow** | Just right | Maintain — this is the goal |
| **Frustration** | Too hard, deaths feel unfair | Widen track, add checkpoint, slow slope |
| **Anxiety** | Too much simultaneous danger | Reduce to 1-2 mechanics at once |

---

## 6. Segment Parameter Bible

### Parameter Meanings

| Field | Meaning | Good Values | Bad Values |
|-------|---------|-------------|------------|
| `z0`, `z1` | Segment start/end along track | Negative z (forward) | Gaps should be readable from approach |
| `w` | Track width | 5 (hard) to 12 (highway) | Uniform width = flat difficulty |
| `x` | Lateral offset | ±0 to ±4 | Random zigzags with no purpose |
| `y` | Elevation above TrackRoot slope | -3 to +5 | Mostly flat = boring |
| `ramp` | Height change across segment | -3 (downhill) to +3 (uphill) | 0 everywhere = no momentum variation |
| `jump` | Auto-ramp at start/end (launch pad) | `true` on segments before gaps | `true` on flat segments = wasted |
| `ice` | Low-friction surface | `true` on 1-2 segments per level | More than 50% = frustrating |
| `boost` | Speed pad strength | 14-22 | On rest zones = handout, not earned |

### Speed Profile Constraints

```gdscript
# Pseudocode for level speed profile validation
func validate_speed_profile(segments: Array) -> bool:
    var speed := 10.0  # start speed after countdown
    for seg in segments:
        # Uphill reduces speed
        if seg.ramp > 0:
            speed -= seg.ramp * 2.5
        # Downhill increases speed
        if seg.ramp < 0:
            speed += abs(seg.ramp) * 3.0
        # Boost pad adds speed
        if seg.boost > 0:
            speed += seg.boost * 0.8
        # Ice reduces friction, speed bleeds slower
        if seg.ice:
            speed *= 0.98  # slight decay instead of 0.95
        # Flat sections decay speed
        if seg.ramp == 0 and not seg.ice:
            speed *= 0.90
        # Gap requires minimum speed
        if seg.jump or has_gap(seg):
            var required := estimate_gap_speed(seg)
            if speed < required * 0.8:
                return false  # gap is impossible
    return true
```

---

## 7. Checkpoint Placement Rules

**Golden Rule:** Checkpoints are **momentum insurance**, not save states.

- **Place AFTER hard sections**, not before. A checkpoint at the top of a ramp means the player respawns with zero speed and can't climb the next hill.
- **Place in rest zones.** Wide, flat, no obstacles. The player respawns, gets oriented, and builds speed for the next challenge.
- **Never place in narrow sections.** Respawning with zero speed in `w=5` is instant death.
- **One checkpoint per cycle.** After the release phase (big jump, downhill rush), place a checkpoint before the next build-up.
- **Never place in opening or closing zones.** The sacred straightaways are for acclimation and conclusion — hoops there break the calm and feel cheap. All 6 checkpoints must live in the body zone.

### Hoop Height Tiers (The Three Difficulties)

Every level must contain **at least 1 of each tier**. The remaining 3 hoops scale with world difficulty.

| Tier | Clearance Above Track | Feel | Skill Required |
|------|----------------------|------|---------------|
| **Ground** | 0.0 – 0.4m | Roll through effortlessly | None — reward for staying on track |
| **Mid** | 0.8 – 1.5m | Slight hop, timing matters | Basic jump timing |
| **High** | 2.0 – 3.2m | Full jump height + placement | Precise jump + lateral aim |

**World distribution (shuffled per level so order is unpredictable):**

| World | Ground | Mid | High | Philosophy |
|-------|--------|-----|------|-----------|
| 1 | 2 | 2 | 2 | Gentle introduction to all tiers |
| 2 | 1 | 3 | 2 | More aerial control |
| 3 | 1 | 2 | 3 | Gravity changes jump feel |
| 4 | 1 | 1 | 4 | Precision and commitment |
| 5 | 0 | 2 | 4 | Mostly aerial mastery |
| 6 | 0 | 1 | 5 | Mastery — almost all high |

**Offset by tier:**
- Ground: centered ±1.2 (rolling player shouldn't need to aim)
- Mid: moderate ±1.5–2.5 (steer toward it)
- High: wide ±2.5–4.0 (risk/reward — wide = harder to hit but bigger dopamine)

---

## 8. Coin Placement Philosophy

### Risk/Reward Branching (The "Warp Goal" Principle)

| Path | Location | Coins | Accessibility |
|------|----------|-------|---------------|
| **Standard** | Center line, main path | 4 coins | Automatic |
| **Risk** | Outer edge of turns, high ledges, inside bumper fields | 2 coins | Requires speed + precision |

**Rule:** 20-30% of coins should be on **risk paths**. The 3-star completion is a skill check, not a participation trophy.

**Never** place risk coins:
- After a speed section with no time to react
- On narrow ice without a safety net
- Where missing the coin means unavoidable death (unfair, not hard)

---

## 9. Anti-Patterns (Things That Kill Game Feel)

| Anti-Pattern | Why It Sucks | The Fix |
|--------------|--------------|---------|
| **Random zigzags** | Forces constant steering, never lets ball "run" | Long straights with 1-2 deliberate turns |
| **Uniform flatness** | No momentum variation, ball feels glued | Every segment needs some ramp or slope |
| **Narrow everywhere** | Anxiety, not flow | Wide → narrow → wide = rhythm |
| **Gaps without speed setup** | Feels random, not skill-based | Pre-gap downhill or boost pad guarantees speed |
| **Checkpoints at top of ramps** | Respawn with 0 speed, can't proceed | Checkpoints at bottom or in flat zones |
| **Walls on both sides of fast sections** | Corridor feel, no agency | One open side, or banked turns |
| **90° turns at high speed** | Player hits wall through no fault of their own | Minimum turn radius scales with speed |
| **Blind jumps** | Landing invisible = dice roll, not skill | Landing zone visible 1.5+ seconds before takeoff |
| **Flat difficulty within a world** | Levels 1-6 feel samey | Progressive escalation: gentle → moderate → hard |
| **Mixing all mechanics at once** | World 3 is "gravity," not "gravity+ice+wind+bumpers" | One new mechanic per world, synthesis only in W6 |
| **Jump segments without landing validation** | Factory-generated gaps can leave the ball with no platform at the correct height | Always verify `seg_y` continuity across gaps; auto-correct landing platforms |
| **Obstacles placed without interest scoring** | Random obstacle distribution feels chaotic and unfair | Score segments by jumps/ramps/narrow sections; place high-DR obstacles on high-interest segments |
| **Hoops floating at wrong heights** | Hoop passes through track geometry or floats impossibly high | Use `segment_at_z()` to query track surface Y before placing hoops |
| **Instant gravity transitions** | Gravity snapping feels like a bug, not a feature | Tween `gravity_scale` over 0.3s with entry impulse matching zone type |
| **Bonus levels with flat geometry** | Coin rushes feel like chores without momentum variation | Use sine-wave hills, alternating ramps, and speed pads in bonus tracks |
| **Level keys without type prefixes** | `world=0,level=1` (secret) collides with bonus parsing logic | Always prefix: `S-1` for secret, `B-1` for bonus, `1-1` for normal |
| **Levels without opening/closing straightaways** | Player is thrown into danger immediately; finish feels abrupt and unsatisfying | Enforce `OPENING_ZONE_SEGS = 2` and `CLOSING_ZONE_SEGS = 2` in the factory |
| **Auto-launch on world map click** | Inconsistent UX: some nodes move selector, others launch immediately | All clicks move selector; Enter or double-click launches |

---

## 10. AI/LLM Workflow for Future Development

### The Structured Decomposition Pipeline

When redesigning levels or adding new content, **never** jump straight to the `LEVELS` dictionary. Follow this pipeline:

```
1. Design Intent      → Write a sentence: "Player climbs 3 uphill ramps, then 
                         launches across a gap requiring speed."
2. Constraint Extract → Derive: ramp=2.5, w=8→6, gap=16, checkpoint=true
3. Module Selection   → Pick from approved module database: [Step-Up, Ski Jump]
4. Layout Generation  → Assemble segments with speed profile
5. Validation         → Bot test: Can it clear the gap? Is the checkpoint valid?
6. Repair             → If bot fails, adjust module constraints, not segment numbers
7. Integration        → Only now add to LEVELS dictionary
```

### Prompting Guidelines for the Human

When asking me (the AI) to design levels, use this structure:

```
Design a level module called "[Name]" for Physix.

Player feel: [What should the player feel?]
Physics constraints:
- Ball max speed: 32 m/s
- Gravity scale: 1.25
- [Other relevant params]

Output:
1. Design sentence
2. Segment sequence with physical parameters
3. State machine (Build-up → Action → Recovery)
4. What could go wrong and how the module prevents it
5. Bot test criteria (e.g., "bot must clear gap 90% of attempts")
```

### Bot-as-Validator Pattern

The BotController + TestHarness is not a final integration test — it's a **real-time design feedback loop**:

1. Generate module
2. Run bot immediately
3. Analyze failure: speed too low? steering too weak? gap too wide?
4. Adjust constraints
5. Re-test
6. Only mark module as "approved" after 90%+ bot success rate

---

## 11. Godot 4 Implementation Notes

### Key Files
- `scripts/autoloads/level_manager.gd` — Save data, progression, shop.
- `scripts/autoloads/game_manager.gd` — In-game state, scoring, buffs.
- `scripts/level_generator.gd` — **Module assembler + dictionary**. Must validate speed profiles.
- `scripts/game_level.gd` — Level runtime logic. Handles coins, finish, checkpoints.
- `scripts/player.gd` — RigidBody3D ball controller. Physics parameters are sacred.
- `scripts/bot_controller.gd` — **Design validator**. Must be improved alongside levels.
- `scripts/world_map.gd` — 2D overworld. Navigation must be position-based, not number-based.
- `scripts/track_builder.gd` — Material application. Must run for baked scenes too.

### Physics Parameters (Sacred — Do Not Change Without Research)

```gdscript
# Player physics — these create the "feel"
max_forward_speed = 32.0
forward_push = 7.0
speed_ramp_rate = 1.2  # ramps to 1.6x base over time
gravity_scale = 1.25    # heavy, responsive fall

# These were tuned for momentum economics. Changing them breaks all modules.
```

### Testing
Run the bot test suite via `bash tools/run_all_tests.sh` (requires WSL2 + xvfb + Godot Linux build).

### Godoty — Godot Specialist Agent
When deep Godot 4.x expertise is needed, invoke **Godoty** by spawning a sub-agent with the prompt in: `.claude/GODOTY.md`

Godoty has 3 specialist modes:
1. **Scripting & Best Practices** — GDScript review, optimization, architecture.
2. **Troubleshooting & Bugs** — Physics issues, crashes, null refs, bot failures.
3. **Graphics & UI Design** — Theming, shaders, materials, visual polish.

### Physix Architect — Design & Implementation Agent
When implementing obvious fixes, refactoring code, or designing new levels/modules, invoke **Physix Architect** by spawning a sub-agent with the prompt in: `.claude/PHYSIX_ARCHITECT.md`

Physix Architect embodies the Momentum Economics design system and follows the Structured Decomposition Pipeline. Use it for:
- Designing new level modules or assembling levels from the module database
- Implementing surgical code changes (refactors, small features, bug fixes)
- Validating speed profiles and anti-patterns
- Generating level data dictionaries with physics-aware constraints

---

## 12. Version History

- **v1.0** — Original project instructions (minimal)
- **v2.0** — Momentum Economics Edition. Added module database, speed profiles, anti-patterns, LLM workflow pipeline, and research-backed design principles from Sonic, Trackmania, Marble Madness, Celeste, and 2024-2025 LLM PCG research.
- **v2.1** — Factory & Secret World Edition. Added procedural level factory, hexagonal hoop meshes, dramatic gravity zones, secret world S-1, and 8 new anti-patterns from factory/UX implementation odyssey.

---

*End of Document*
