# Physix Phase 3: The Validation Loop
## Unified Factory + Bot + Ghost Analyzer Feedback System

### Research Synthesis

#### Super Monkey Ball — The Bite-Sized Floor Philosophy
- No mid-level checkpoints; floors are 30-60 seconds
- Momentum is everything: every slope is a decision about speed
- Speed is risk/reward: fast way vs. slow way, warp goals for skilled players
- Speed control zones: hazards placed immediately after high-speed sections to punish unchecked momentum
- Multi-path design: easy lower path vs. risky upper path

#### Sonic the Hedgehog — The Slope-as-Song Philosophy
- "Good Sonic level design is all about slopes" — Christian Whitehead
- 3-phase rhythm cycle: Build-Up (tension) → Release (speed) → Rest (recovery), repeated 2-3x per level
- Flow breaks: minor every 1-2s, semi-major every 6-8s, major every 13-20 semi-majors
- Multi-tiered paths: top = fastest/safest, falling to lower = soft punishment
- Speed is earned, not given: loops are "locked" until you back up and build speed
- Post-major-break recovery: re-introduce speed slowly, never instantly throw back into danger

#### Marble Run / PCG Research — The Simulation Gold Standard
- Two-stage evaluation: static reachability + dynamic simulation with AI agent
- KGoldrunner: run 20 high-level plans per candidate; reject if too few succeed
- MCTS-guided generation: interleave generation with lookahead search to prune impossible branches
- Graph grammar + constraint solving: simultaneously generate level AND valid playthrough
- Key finding: static analysis alone is inadequate when dynamic elements exist (falling, timing, physics)

---

## The Sacred Level Structure (New — May 2026)

Every level now follows a **5-phase anatomy** enforced by the factory:

```
TAKEOFF (Opening) → BUILD-UP → RELEASE → REST → LANDING (Closing) → RUNWAY
```

| Zone | Segments | Width | Ramp | X | Obstacles | Purpose |
|------|----------|-------|------|---|-----------|---------|
| **Opening** | 2 | 10-12 | -0.3 to 0 | 0 | None | Acclimation — player feels the ball |
| **Body** | Layout-specific | Per config | Per config | Per config | Scored placement | The challenge |
| **Closing** | 2 | 10-12 | Trending to 0 | Trending to 0 | None | Predictable conclusion |
| **Runway** | 1 | 10 | 0 | 0 | None | Finish line approach |

**Why this matters:**
- The player needs 2-3 seconds of straight track to get their bearings, feel the ball's weight, and build trust.
- The closing straightaway provides a dopamine hit — the player sees the finish, knows they made it, and enjoys the final roll.
- Obstacles are never placed in sacred zones. Checkpoints (hoops) are never placed in sacred zones.
- Transitions are eased: first body segment x is blended 30% from opening; last body segment x is blended 30% toward closing.

This structure guarantees that every level is **coherent**, not disjointed. The player experiences a clear narrative arc: takeoff → adventure → landing.

---

## The Unified Feedback Loop Architecture

```
┌──────────────┐     generate      ┌──────────────┐
│   LevelFactory│ ──────────────────> │    Level JSON│
│   (Generator) │                     │              │
└──────────────┘                     └──────┬───────┘
       ^                                    │
       │         ┌──────────────┐          │ build
       │         │ GhostAnalyzer│ <─────────┘
       │         │  (Learner)   │    ghost data
       │         └──────┬───────┘
       │                │
       │    diagnose    │
       │                v
       │         ┌──────────────┐
       └──────── │   BotTester  │
         tune    │  (Validator) │
         params  └──────────────┘
```

### Loop Stages

1. **Factory generates** level with seed + constraints
2. **Bot validates** — runs 3-5 attempts, measures:
   - Success rate (must be ≥ 90% for World 1, ≥ 70% for World 6)
   - Gap clearance rate (must be 100% — gaps should never be impossible)
   - Hoop clearance rate (must be ≥ 50%)
   - Momentum cycles (must be ≥ 2 per level)
   - Flow distribution (flow should be 40-60% of total time)
   - Death positions (cluster detection)
3. **GhostAnalyzer learns** — if bot fails, diagnose issue and suggest factory parameter adjustments
4. **Factory retunes** — adjust layout config, segment count, ramp ranges, obstacle budget
5. **Repeat until** all validation gates pass

---

## Checkpoint Placement: The Art and Science

### Current Problem
Hoop checkpoints are placed at fixed Z-percentages (0.18 + i * 0.11 for World 1). This ignores:
- Whether the player has speed to continue after respawn
- Whether the checkpoint sits in a narrow/dangerous zone
- Whether the checkpoint breaks the momentum arc

### The Checkpoint Placement Rules (Sonic + Monkey Ball Synthesis)

**Rule 1: Checkpoints are momentum insurance, not save states.**
- Place AFTER hard sections, not before
- A checkpoint at the top of a ramp means respawning with zero speed → can't climb → frustration

**Rule 2: Checkpoints live in Rest zones only.**
- Wide (w ≥ 9), flat (ramp = 0), no obstacles, no gaps within ±10m
- Player respawns, gets oriented, builds speed for the next challenge

**Rule 3: One checkpoint per momentum cycle.**
- After Release phase (big jump, downhill rush), place checkpoint before next Build-Up
- This creates natural chapter boundaries within the level

**Rule 4: Never in narrow sections.**
- Respawning with zero lateral velocity in w = 5 is instant death

**Rule 5: Visible from approach.**
- The player should see the hoop 1.5+ seconds before reaching it
- No blind hoops around corners or over jumps

### New Algorithm: `place_checkpoints_physics_aware()`

```
Input: segments[], obstacles[], world, level
Output: hoop_positions[]

Step 1: Identify momentum cycles from segment metadata
  For each segment, classify phase:
    Build-Up:  ramp > 0.5 or w < 7
    Release:   ramp < -1.0 or jump == true
    Rest:      ramp == 0 and w >= 9 and no obstacles

Step 2: Find valid checkpoint candidates
  For each Rest zone, score it:
    +10: follows a Release phase (reward completion)
    +5:  preceded by Build-Up (recovery needed)
    -20: within 10m of a gap or jump
    -20: within 5m of an obstacle
    -10: w < 8
    +3:  visible from previous segment (straight Z-line, no x-shift > 2)

Step 3: Greedily select 6 checkpoints
  Sort candidates by score descending
  Ensure minimum Z-spacing: 15m for World 1, 12m for others
  Ensure no checkpoint is at Z > -total_length * 0.95 (leave room for finish)

Step 4: Compute hoop geometry
  For each selected checkpoint:
    x = segment.x + offset (World 1: ±1.5 to ±2.0, others: tiered difficulty)
    y = segment_y + 0.7 + clearance
    clearance = 1.5-2.2 for World 1, 1.2-2.8 for others
    If previous segment was jump or steep ramp: +0.3 to +1.0 bonus clearance
```

---

## Beatable Verification: The Physics Simulation Layer

### Why Static Analysis Fails
Current `_validate_speed_profile()` uses a naive speed accumulator:
```
speed -= ramp * 2.5  # uphill
speed += abs(ramp) * 3.0  # downhill
```
This ignores: jump physics, boost pads, ice friction, gravity zones, wind, actual ball mass and momentum.

### The New `simulate_ball_trajectory()` Algorithm

```
Input: segments[], obstacles[], max_sim_steps=3000
Output: {pass: bool, issues: [], trajectory: []}

State: pos=(0,1.5,0), vel=(0,0,0), on_ground=true
Physics constants from SACRED_PHYSICS:
  gravity = 9.8 * 1.25 = 12.25 m/s²
  forward_push = 7.0 N per frame
  max_speed = 32.0 m/s
  speed_ramp = 1.2 * delta * 2.0 → approaches 51.2 m/s max

For each segment in order:
  For each physics frame (60fps, dt=1/60):
    Apply gravity to velocity.y
    Apply forward_push if on_ground and speed < max
    Apply slope force: project push onto slope plane
    Apply ice friction reduction if segment.ice
    Apply boost pad impulse if obstacle at current z is speed_boost
    Apply wind force if in wind zone
    Apply gravity multiplier if in gravity zone
    Integrate position
    Check ground collision with segment surface
    If jump segment and on_ground: apply vertical impulse + forward boost
    If gap after segment: simulate projectile arc
      Check if landing segment is reachable within height tolerance
    If position.y < -50: fail — "fall_death"
    If stuck (position unchanged for 2s): fail — "stuck"
    If speed < 2.0 for >3s on uphill: fail — "speed_bleed"

After all segments:
  If position.z < finish_z - 5: fail — "did_not_reach_finish"
  Compute par_time from simulated duration
  Return PASS if no failures
```

### Integration into Factory

```gdscript
static func generate(world, level, seed_) -> Dictionary:
    # ... current generation ...
    var validation := _simulate_trajectory(segments, obstacles)
    if not validation.passed:
        # Auto-repair: adjust offending segments
        segments = _auto_repair(segments, validation.issues)
        # Re-validate
        validation = _simulate_trajectory(segments, obstacles)
        if not validation.passed:
            # Fallback: regenerate with gentler constraints
            return generate(world, level, seed_ + 1)
    return { ... }
```

---

## Flow Break Architecture: Pacing by Design

### The Sonic Rhythm Applied to Physix

Every level must have intentional pacing. We encode this into the segment generator:

```
Level structure (repeated 2-3 times):
  [Build-Up] 2-3 segments → [Release] 1-2 segments → [Rest] 1 segment

Build-Up segments:
  ramp: 0.5 to 2.5 (uphill)
  width: 6-8 (narrow, careful)
  obstacles: allowed (spikes, narrow bumper)
  duration target: 3-5 seconds

Release segments:
  ramp: -1.0 to -3.0 (downhill)
  width: 9-12 (wide, fast)
  jump: true at end if gap follows
  obstacles: none (let player enjoy speed)
  duration target: 2-4 seconds

Rest segments:
  ramp: 0
  width: 10-12
  obstacles: none
  checkpoint: place hoop here
  duration target: 2-3 seconds
```

### World 1 Specifics (Beginner Friendly)
- No more than 2 momentum cycles per level
- Build-up ramps capped at 1.5
- Release ramps capped at -2.0
- Rest zones must be ≥ 10m long
- Checkpoints placed generously (6 total, but lower clearance requirements)

---

## The Three Systems Harmonized

### 1. Factory Changes
- [ ] Implement `classify_segment_phase()` — Build-Up / Release / Rest
- [ ] Implement `_place_checkpoints_physics_aware()` — rest-zone scoring
- [ ] Implement `_simulate_ball_trajectory()` — full physics verification
- [ ] Implement `_auto_repair()` — fix gap speed setup, bleed speed, stuck points
- [ ] Add `flow_break_count` constraint to layout configs
- [ ] Add `momentum_cycle_min` per world (W1=2, W6=4)

### 2. Bot Changes
- [ ] Add `success_rate_gate` — fail level if bot success < threshold
- [ ] Add `gap_clearance_gate` — fail if any gap uncleared
- [ ] Add `checkpoint_respawn_test` — bot dies at each checkpoint, tests if respawn is beatable
- [ ] Add `flow_time_requirement` — flow must be 40-60% of total
- [ ] Export JSON report in format GhostAnalyzer expects

### 3. Ghost Analyzer Changes
- [ ] Read bot JSON reports directly (not just player ghosts)
- [ ] Map bot failure modes to factory parameter adjustments:
  - `gap_impossible` → reduce gap size, increase pre-gap downhill
  - `speed_bleed` → reduce uphill ramp, add boost pad
  - `stuck` → widen segment, remove obstacle
  - `too_frustrating` → add rest zone, reduce obstacle budget
  - `hoops_too_hard` → lower clearance, reduce offset
- [ ] Maintain `module_repair_log` — track which adjustments fixed which issues
- [ ] Auto-regenerate and re-test loop (configurable max iterations)

---

## Implementation Order

### Step 1: Factory Physics-Aware Checkpoint Placement
- Implement `classify_segment_phase()`
- Implement checkpoint candidate scoring
- Replace `_build_hoops()` with new algorithm
- Test with existing World 1 levels

### Step 2: Factory Trajectory Simulator
- Implement `_simulate_ball_trajectory()` as static validator
- Add `_auto_repair()` for common issues
- Wire into `generate()` as post-process gate
- Regenerate all World 1 levels and verify 100% pass rate

### Step 3: Bot Checkpoint Respawn Test
- Add `test_respawn_beatablility()` — bot dies at each checkpoint, verifies continuation
- Add flow-time validation
- Update JSON report format

### Step 4: Ghost Analyzer Bot Integration
- Add `analyze_bot_report()` function
- Map failure codes to factory parameter deltas
- Implement auto-regenerate loop

### Step 5: Validation Suite
- Run full suite on World 1 (6 levels × 5 bot runs = 30 tests)
- Target: 100% gap clearance, ≥ 90% success rate, ≥ 2 momentum cycles, flow ≥ 40%
- Iterate until all gates pass
- Repeat for World 2, 3, etc.

---

## Success Metrics for Phase 3

| Metric | Target | Measurement |
|--------|--------|-------------|
| Bot success rate (W1) | ≥ 90% | Bot runs per level |
| Gap clearance rate | 100% | No impossible gaps ever |
| Checkpoint respawn rate | ≥ 85% | Die at checkpoint, continue and finish |
| Flow time ratio | 40-60% | Bot flow_state tracking |
| Momentum cycles | ≥ 2/level | Ghost + bot detection |
| Death clustering | < 2 deaths at same Z | Bot death_positions analysis |
| Hoop clears | ≥ 50% | Bot hoop tracking |
| Player ghost variance | > 1.5 | Human play diversity |

---

## Sources

- [Super Monkey Ball — StrategyWiki](https://strategywiki.org/wiki/Super_Monkey_Ball/Beginner_floors)
- [Super Monkey Ball Guide — Nintendo World Report](http://www.nintendoworldreport.com/feature/2021/super-monkey-ball-guide)
- [Sonic Mania Dev on Slopes — Game Developer](https://www.gamedeveloper.com/design/-i-sonic-mania-i-dev-says-good-i-sonic-i-level-design-is-all-about-slopes)
- [Sonic Retro Physics Guide](https://forums.sonicretro.org/threads/sonic-physics-guide.40148/)
- [Sonic Level Design Principles — Sonic Retro Forums](https://forums.sonicretro.org/threads/dudes-intro-to-basic-level-design-principles.13538)
- [KGoldrunner — Automatic Puzzle Level Generation](https://cspages.ucalgary.ca/~bdstephe/pubs/2012_KGoldRunner.pdf)
- [Runtime PCG Evaluation with Autonomous Agents](https://arxiv.org/html/2605.01783v1)
- [MCMCTS PCG for SMB — AAAI AIIDE](https://ojs.aaai.org/index.php/AIIDE/article/view/12816)
- [Constraint-Based Level+Playthrough Generation](https://ceur-ws.org/Vol-4090/short5.pdf)
- [Illuminating Beatable Lode Runner Levels — Steckel & Schrum 2021](https://arxiv.org/pdf/2101.07868)
