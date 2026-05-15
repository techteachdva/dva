# Ghost-Driven Level Iteration Workflow

## Overview

Use your play sessions as the primary design signal. Ghost data reveals whether a level forces meaningful steering, tests momentum, or is just a straight line. The workflow feeds ghost analysis back into both bot AI and track design.

---

## Phase 1: Enhanced Ghost Recording

### What to Record (10 Hz, every 0.1s)

Current ghost data records only position + rotation + time. We need **input telemetry**:

```gdscript
# ghost_manager.gd — extend record_sample()
func record_sample(pos: Vector3, rot: Quaternion, vel: Vector3, steer: float, jump: bool, brake: bool, delta: float) -> void:
    _timeline.append({
        "t": _recording_time,
        "px": pos.x, "py": pos.y, "pz": pos.z,
        "rx": rot.x, "ry": rot.y, "rz": rot.z, "rw": rot.w,
        "vx": vel.x, "vy": vel.y, "vz": vel.z,
        "steer": steer,      # -1.0 left, 0.0 neutral, 1.0 right
        "jump": jump,        # true if jump button held this frame
        "brake": brake,      # true if brake held
    })
```

**Why inputs matter:**
- `steer = 0` for > 60% of a level → track is too straight
- `jump` spikes clustered at same Z → gap is too easy/predictable
- `brake` used heavily before a turn → turn is too sharp for the speed

---

## Phase 2: Ghost Analysis Pipeline

After each level, compute these metrics:

### 1. Lateral Variance (Straightness Score)

```gdscript
func analyze_lateral_variance(samples: Array[Dictionary]) -> Dictionary:
    var xs: Array[float] = []
    for s in samples:
        xs.append(s.get("px", 0.0))
    var mean_x := _mean(xs)
    var variance := 0.0
    for x in xs:
        variance += (x - mean_x) * (x - mean_x)
    variance /= maxi(xs.size(), 1)
    var steer_inputs: int = 0
    for s in samples:
        if absf(s.get("steer", 0.0)) > 0.1:
            steer_inputs += 1
    var steer_ratio: float = float(steer_inputs) / maxi(samples.size(), 1)
    return {
        "variance": variance,
        "steer_ratio": steer_ratio,
        "is_too_straight": variance < 1.5 and steer_ratio < 0.25,
    }
```

| Score | Interpretation | Action |
|---|---|---|
| `variance < 1.0` | Player barely moved left/right | Add switchbacks, S-curves, or lateral gaps |
| `steer_ratio < 0.20` | Player held straight most of the time | Narrow corridors or place coins on edges |
| `variance > 3.0` | Player zigzagged constantly | Track is too erratic, smooth the X shifts |

### 2. Speed Consistency (Momentum Score)

```gdscript
func analyze_speed_profile(samples: Array[Dictionary]) -> Dictionary:
    var speeds: Array[float] = []
    for s in samples:
        var vz: float = absf(s.get("vz", 0.0))
        speeds.append(vz)
    var mean_spd := _mean(speeds)
    var stddev := _stddev(speeds, mean_spd)
    var cv: float = stddev / maxf(mean_spd, 0.01)  # coefficient of variation
    return {
        "mean_speed": mean_spd,
        "cv": cv,
        "is_flat": cv < 0.15,       # speed never changes = boring
        "is_spiky": cv > 0.55,      # speed oscillates wildly = frustrating
    }
```

| `cv` Range | Feel | Action |
|---|---|---|
| `< 0.15` | Monotonous, no tension | Add uphill/downhill ramps, gravity zones |
| `0.25–0.40` | Good build-up/release rhythm | Keep |
| `> 0.55` | Chaotic, unfair | Widen narrow sections, add checkpoints |

### 3. Jump Density & Timing (Gap Quality)

```gdscript
func analyze_jumps(samples: Array[Dictionary]) -> Dictionary:
    var jumps: Array[float] = []  # Z positions where jump=true
    var prev_jump := false
    for s in samples:
        var is_jumping := s.get("jump", false)
        if is_jumping and not prev_jump:
            jumps.append(s.get("pz", 0.0))
        prev_jump = is_jumping
    var jump_rate: float = float(jumps.size()) / maxf(absf(samples[-1].get("pz", 1.0)), 1.0) * 100.0
    return {
        "count": jumps.size(),
        "rate_per_100m": jump_rate,
        "is_sparse": jumps.size() < 2 and len(samples) > 50,
    }
```

### 4. Death Clustering (Frustration Map)

If the player dies multiple times, cluster the death locations:

```gdscript
func cluster_deaths(death_positions: Array[Vector3]) -> Array[Dictionary]:
    # Simple 10-unit Z-bucket clustering
    var buckets := {}
    for pos in death_positions:
        var bucket := int(pos.z / 10.0) * 10
        if not buckets.has(bucket):
            buckets[bucket] = 0
        buckets[bucket] += 1
    var clusters := []
    for z_bucket in buckets.keys():
        if buckets[z_bucket] >= 2:
            clusters.append({"z": z_bucket, "deaths": buckets[z_bucket]})
    return clusters
```

| Cluster Size | Action |
|---|---|
| 2–3 deaths at same spot | Add checkpoint just before, or widen the track |
| 4+ deaths | Major redesign: reduce slope, add safety net, or move obstacle |

---

## Phase 3: Bot Training from Ghosts

### 3A. Ghost Waypoints as Steering Targets

Instead of the bot aiming for segment centers, extract the player's actual path:

```gdscript
# bot_controller.gd — _compute_target_x() replacement
func _ghost_target_x(pos: Vector3) -> float:
    if _ghost_samples.is_empty():
        return INF
    # Find the ghost sample closest in Z to the bot's current position
    var best_idx := 0
    var best_dz := INF
    for i in range(_ghost_samples.size()):
        var dz := absf(_ghost_samples[i].get("pz", 0.0) - pos.z)
        if dz < best_dz:
            best_dz = dz
            best_idx = i
    # Return ghost's X at this Z, plus small lookahead
    var lookahead_idx := mini(best_idx + 3, _ghost_samples.size() - 1)
    return _ghost_samples[lookahead_idx].get("px", 0.0)
```

**Effect:** The bot mimics your actual steering curve, not the mathematical center. It learns to cut corners, take wide lines, and dodge obstacles the way you did.

### 3B. Ghost Jump Timing Model

Build a lookup table from every ghost jump:

```gdscript
var _jump_model: Array[Dictionary] = []

func _build_jump_model(samples: Array[Dictionary]) -> void:
    _jump_model.clear()
    var prev_jump := false
    for i in range(samples.size()):
        var s := samples[i]
        if s.get("jump", false) and not prev_jump:
            # Record: speed at jump, Z position, gap width ahead
            var speed := absf(s.get("vz", 10.0))
            var z_pos := s.get("pz", 0.0)
            _jump_model.append({"speed": speed, "z": z_pos})
        prev_jump = s.get("jump", false)
```

Then the bot's jump predictor queries this model:

```gdscript
func _predict_jump_from_ghost(pos: Vector3, vel: Vector3) -> bool:
    if _jump_model.is_empty():
        return false
    var fwd_speed := maxf(absf(vel.z), 3.0)
    # Find the ghost jump entry with closest speed
    var best := _jump_model[0]
    var best_diff := absf(best["speed"] - fwd_speed)
    for entry in _jump_model:
        var diff := absf(entry["speed"] - fwd_speed)
        if diff < best_diff:
            best_diff = diff
            best = entry
    # Jump when we reach the same Z position the ghost jumped at
    var dz := pos.z - best["z"]
    return dz > 0.0 and dz < fwd_speed * 0.20  # within 0.2s travel of ghost trigger point
```

**Effect:** The bot jumps at the exact spots you jumped, adjusted for its current speed.

### 3C. Multi-Ghost Averaging (Polybot-style)

If you play the level multiple times, blend the paths:

```gdscript
func _average_ghost_paths(runs: Array[Array]) -> Array[Dictionary]:
    # Resample all runs to fixed Z intervals, then average X
    var out: Array[Dictionary] = []
    for z_bucket in range(0, -500, -2):  # every 2 units of Z
        var sum_x := 0.0
        var sum_steer := 0.0
        var count := 0
        for run in runs:
            for s in run:
                if absf(s.get("pz", 999.0) - z_bucket) < 1.0:
                    sum_x += s.get("px", 0.0)
                    sum_steer += s.get("steer", 0.0)
                    count += 1
                    break
        if count > 0:
            out.append({"z": z_bucket, "x": sum_x / count, "steer": sum_steer / count})
    return out
```

Outliers (runs where you died early) are discarded. The averaged path becomes the bot's "expert demonstration."

---

## Phase 4: Automated Redesign Triggers

### Trigger 1: Track is Too Straight

```gdscript
if ghost_analysis["is_too_straight"]:
    # Inject lateral shifts into existing segments
    for seg in layout["segments"]:
        var z_mid := (seg["z0"] + seg["z1"]) * 0.5
        if absf(z_mid) > 20.0:  # skip the starting straight
            seg["x"] = 3.0 * sin(deg_to_rad(z_mid * 0.15))  # gentle S-curve
```

Or manually: add a **Switchback** module mid-level.

### Trigger 2: Ghost Speed is Flat

```gdscript
if ghost_analysis["is_flat"]:
    # Insert a Step-Up or uphill ramp mid-level
    var mid := layout["segments"].size() / 2
    layout["segments"][mid]["ramp"] = 2.5  # uphill climb
    layout["segments"][mid + 1]["ramp"] = -3.0  # downhill reward
```

### Trigger 3: Death Cluster Detected

```gdscript
for cluster in death_clusters:
    var z_death := cluster["z"]
    # Place checkpoint 15 units before the death zone
    layout["checkpoints"].append(z_death + 15.0)
    layout["obstacles"].append({"kind": "checkpoint", "z": z_death + 15.0, "x": 0})
    # Widen the track at the death zone
    for seg in layout["segments"]:
        if absf(seg["z0"] - z_death) < 10.0:
            seg["w"] = maxf(seg.get("w", 8.0), 10.0)
```

### Trigger 4: All Ghosts Take the Same Line

If every ghost run has `steer_ratio < 0.10` AND `variance < 0.5`:
- The level is a **single-lane corridor**. Add a risk path:
  - Outer-edge coins (`x = ±3.5`, `y = surface + 2.5`)
  - A narrow shortcut with a coin at the end
  - A low-G zone that lets players jump to an alternate landing

---

## Phase 5: The Iteration Loop

```
┌─────────────────┐
│  YOU PLAY LEVEL │  ← Run the game, clear it (or fail)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  GHOST SAVED    │  ← Position + inputs + speed + deaths
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  ANALYZE GHOST  │  ← lateral_variance, speed_cv, death_clusters
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐  ┌──────────┐
│TOO    │  │DEATHS    │
│STRAIGHT│  │CLUSTERED │
└───┬───┘  └────┬─────┘
    │           │
    ▼           ▼
┌──────────┐  ┌────────────┐
│REDESIGN  │  │ADD CHECKPT │
│TRACK     │  │WIDEN PATH  │
└────┬─────┘  └─────┬──────┘
     │              │
     └──────┬───────┘
            ▼
┌─────────────────┐
│  BOT RETRAINS   │  ← Load new ghost waypoints + jump model
└────────┬────────┘
         ▼
┌─────────────────┐
│  BOT TEST RUN   │  ← TestHarness runs 10 attempts
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐  ┌────────┐
│PASS   │  │FAIL    │
│> 90%  │  │< 90%   │
└───┬───┘  └───┬────┘
    │          │
    ▼          ▼
┌──────┐   ┌──────────┐
│SHIP IT│   │TUNE AGAIN│
└──────┘   └──────────┘
```

### Practical Execution

1. **Play a level** → Ghost auto-saves to `user://ghosts/w{world}_l{level}.json`
2. **Run analysis** — a new `GhostAnalyzer` autoload computes metrics and prints a report:
   ```
   [GhostAnalyzer] 2-1: variance=0.8 | steer_ratio=0.12 | TOO STRAIGHT
   [GhostAnalyzer] 2-1: death cluster at z=-85 (3 deaths) → add checkpoint at z=-70
   ```
3. **Redesign** — either the analyzer auto-patches the JSON, or you manually edit `levels/2-1.json`
4. **Re-test** — press "Run Bot Test" and watch the bot use your ghost waypoints
5. **Iterate** — play again, see if the new design forces you to steer more

### Success Criteria

A level is "good" when:
- `lateral_variance >= 2.0` (you had to move left/right meaningfully)
- `speed_cv` between 0.25 and 0.45 (build-up/release rhythm)
- `death_clusters` is empty, OR each cluster has a checkpoint before it
- The bot, trained on your ghosts, clears the level 90%+ of the time
- **You** still find it fun (subjective, but if you play it 3+ times voluntarily, it's working)

---

## Phase 6: Immediate Next Steps

To implement this in Physix:

1. **Extend ghost recording** (`scripts/autoloads/ghost_manager.gd`) to capture `steer`, `jump`, `brake`, `velocity` alongside position
2. **Create `scripts/autoloads/ghost_analyzer.gd`** with the analysis functions above
3. **Extend `scripts/bot_controller.gd`** with `_ghost_target_x()` and `_predict_jump_from_ghost()` modes
4. **Add a debug panel** that shows real-time metrics while you play:
   - Live lateral variance
   - Current speed CV
   - "Track Straightness" warning if variance drops below 1.5
5. **Hook the analyzer into level completion** — when you finish a level, it prints redesign suggestions to the console

This turns your playtesting from "I feel like this is boring" into "the data says this track is too straight; here is the exact Z position to add a switchback."
