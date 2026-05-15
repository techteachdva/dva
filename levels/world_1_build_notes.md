# World 1 Build Notes

## Status
GOOD — beginner-friendly, no contaminating mechanics

## Obstacle Audit
- 1-1: spike, speed_boost, bumper
- 1-2: spike, bumper, speed_boost, bumper
- 1-3: speed_boost, bumper, speed_boost, speed_boost, speed_boost, speed_boost, spike, brake_pad
- 1-4: speed_boost, brake_pad, spike, spike, spike, bumper
- 1-5: bumper, spike, spike, spike, speed_boost
- 1-6: spike, speed_boost, speed_boost, speed_boost, spike, speed_boost, speed_boost, speed_boost, bumper, speed_boost, spike, spike, speed_boost, speed_boost

World 1 obstacle pool is now locked to: speed_boost, brake_pad, bumper, spike. No gravity, wind, or magnet.

## Factory Fixes Applied
- Removed "gravity" from World 1 bias in `regen_world1.py`
- Added `_fallback_pool()` to `level_factory.gd` and `regen_world1.py` so 25% fallback only draws from world-appropriate obstacles
- Bias chance raised from 70% to 75%

## Known Issues / Next Pass
- Geometry continuity: some segments have gaps where the landing platform doesn't perfectly align with the jump takeoff height
- Track-to-sunset connection: final runway geometry should visually flow into the sunset horizon (finish line at z=-200 with sky sphere alignment)
- Rest zones needed after high-obstacle-density sections (1-6 is spike-heavy, needs a breathing flat)

## Wind Zone Verification
Wind oscillation and particle direction are already dynamic in `scripts/obstacles/wind_zone.gd`:
- `sway = sin(_sway_time * sway_speed) * sway_amplitude`
- Particles update `_process_mat.direction = current_dir` every frame

No code changes needed for wind behavior.
