# Game Master Research Report — Physix Design Improvements
**Date:** 2026-05-10
**Scope:** UX, Speed Perception, Racing Satisfaction, Arcade Replayability
**Target:** Solo developer + AI assistant, Godot 4.6.2, GDScript

---

## 1. User Experience in Physics-Based Level Design

### Key Findings
1. **Fairness is predictive, not easy.** Players accept death when they can trace the failure back to their own input. The critical threshold is roughly 300–500 ms of forewarning. Marble Madness (1984) and Super Monkey Ball use wide sightlines and consistent obstacle timing so players always see the consequence of a mistake before it happens. Frustration spikes when physics introduce randomness the player cannot model — e.g., an unexpected bounce angle or a hidden gap.
2. **Difficulty curves should be "staircase," not linear.** Hamsterball and Super Monkey Ball escalate in short, sharp jumps followed by plateaus. Each world introduces one new mechanic in isolation (levels 1–2), tests it in combination with one prior mechanic (levels 3–4), then demands synthesis (levels 5–6). This matches the existing Physix Learning → Testing → Mastery cadence and should be preserved rigidly.
3. **Failure recovery is a UX pillar, not an accessibility option.** Rolling Sky shows that "perfect path" difficulty (collecting everything) can coexist with "survival" difficulty because the player chooses their risk level. The most retentive physics games give the player a way to feel skilled even on a failed run — Celeste’s strawberries, Hamsterball’s time-bonus crates, or Trackmania’s personal-ghost comparisons.

### Concrete Recommendation for Physix
Implement a **Dual-Layer Star System** immediately:
- **1 Star:** Finish the level (survival path, wide track, generous checkpoints).
- **2 Stars:** Finish under par time + collect 50% of coins.
- **3 Stars:** Finish under fast time + collect all coins + zero checkpoint usage.
Lock the 3-star medal behind a "No-Checkpoint" flag in the save data. This gives casual players a clear win condition while giving hardcore players a prestige target that is entirely skill-based.

### Example from Existing Games
**Super Monkey Ball 2 (GCN)** — Each level has a "warp goal" (hidden, harder path) and a "main goal." The hidden path carries a higher point multiplier but requires riskier play. The key lesson: the player decides how hard the level is, not the designer. This maps directly to Physix’s coin-placement philosophy — standard path coins vs. risk-path coins.

---

## 2. Perception of Speed

### Key Findings
1. **FOV scaling is the single most effective speed cue.** Racing research (Wipeout, Trackmania, F-Zero GX) shows that increasing camera FOV by 5–15 degrees as speed crosses thresholds creates a visceral "warp" effect without disorientation. The critical rule: FOV changes must be **smoothly interpolated** over 0.3–0.5 seconds; instant jumps cause motion sickness. FOV should only expand, never contract suddenly.
2. **Camera distance and speed have an inverse relationship.** At low speed, the camera trails slightly behind (closer = sense of weight). At high speed, the camera pulls back and tilts downward to show more ground rush. Trackmania uses a "track preview" camera at extreme speeds that subtly elevates the view angle so the player sees landing zones earlier. The threshold for "out of control" is when the ground texture becomes unreadable; maintain a minimum pixel density on the track surface.
3. **Audio doppler and haptic rhythm anchor speed perception.** F-Zero GX layers engine pitch, wind noise, and screen-edge vignette as speed increases. The audio cue is not volume but **pitch modulation tied to acceleration** — the brain reads "getting faster" more clearly than "already fast." Particle density (wind lines, sparks) should increase with speed but cap at ~80% of max speed to avoid visual noise.

### Concrete Recommendation for Physix
Add a **Speed-Driven Camera System** in `player.gd` or a dedicated `camera_controller.gd`:
- Measure current forward velocity every physics frame.
- Interpolate camera FOV from base (70°) to max (85°) across the 0–32 m/s speed range.
- Interpolate camera Z-offset from close (-3 units) to far (-6 units) across the same range.
- Add a subtle camera roll (±2°) during high-speed turns for dynamic feel.
- Gate all changes behind a `lerp` or `tween` with a 0.4-second smoothing window.
- Cap motion-blur intensity so the track remains readable at max speed.
This is implementable in Godot 4 with `Camera3D.fov`, `Camera3D.position`, and `Tween` nodes.

### Example from Existing Games
**Trackmania (2020)** — At high speed, the camera pulls back and the FOV expands dynamically. The genius detail: the expansion is **non-linear**. The first 50% of max speed gets only 30% of the FOV change; the last 50% gets 70%. This makes high-speed moments feel explosive while keeping low-speed moments grounded. Physix should copy this curve exactly.

---

## 3. Satisfaction in Racing Sims and Arcade Racers

### Key Findings
1. **Flow state in racing games requires "reachable but demanding" performance.** iRacing and Gran Turismo satisfy through precision and consistency; arcade racers (Burnout, Wipeout) satisfy through risk-taking and spectacle. The common thread is that the player must feel they are operating at **the edge of their current skill ceiling** for 60–80% of a run. Below that, boredom; above that, anxiety.
2. **Near-miss design is the dopamine backbone.** Burnout’s "traffic check" system and Wipeout’s "barely clipped the wall" audio cues are deliberate. Studies on racing-game satisfaction show that near-miss events trigger stronger dopamine releases than clean runs because they combine threat + relief. However, a near-miss must be **perceived as player skill**, not luck. The obstacle must be avoidable with a known technique.
3. **Time attack + ghosts create an infinite skill ceiling.** Trackmania’s longevity comes from the fact that the "perfect run" is theoretically reachable but practically unattainable for 99.9% of players. The personal ghost turns every run into a race against a known target. Leaderboards work best when segmented by "friends" first, then "regional," then "global" — global leaderboards demotivate casual players; friend leaderboards motivate them.

### Concrete Recommendation for Physix
Implement a **Personal Ghost + Sector Split System**:
- Record the player’s best-run position and replay it as a semi-transparent ghost ball.
- Divide each level into 3–4 sectors (based on module boundaries) and display sector-time differences (+0.2s, -0.1s) in real-time on the HUD.
- Store ghost data as a lightweight array of `(position, rotation, timestamp)` sampled at 10 Hz. For a 60-second level, this is ~600 records — trivial in Godot.
- Add a "Race Ghost" button on the level-complete screen.
This gives the "just one more run" loop immediately without needing multiplayer infrastructure.

### Example from Existing Games
**Celeste’s B-Sides** — The base game teaches mechanics; the B-Sides demand mastery. Crucially, Celeste shows the player their death count per room and tracks a room-best time. This transforms failure into data. For Physix, displaying "deaths this run" and "best time this session" on the HUD achieves the same psychological effect: the player is always chasing a personal record, even on the first attempt.

---

## 4. Arcade-Like Replayability

### Key Findings
1. **Arcade replayability is driven by three loops: mastery, variety, and social proof.** Mastery = skill expression (muscle memory, speedrun optimization). Variety = content rotation that prevents pattern fatigue. Social proof = leaderboards, shared replays, or co-op competition. A game needs at least two of the three to sustain long-term engagement.
2. **Daily/weekly rotations create FOMO without predatory design.** Splatoon’s Salmon Run rotates maps and weapons; Trackmania’s "Track of the Day" guarantees a fresh, community-curated level every 24 hours. The key is **bounded commitment** — the player knows exactly what they are getting and for how long. This is especially important for a solo-dev project where new handcrafted content is expensive.
3. **Medal chasing is the most effective retention mechanic for level-based games.** Super Meat Boy’s warp zones and Dark World levels give the player a visible but unearned reward on the world map. The player can see the locked content, creating an explicit goal. Celeste’s golden strawberries are functionally identical to normal completion but carry social prestige because they are visibly rare.

### Concrete Recommendation for Physix
Build a **Weekly Bonus Rotation** system using the existing bonus levels:
- The 6 bonus levels already exist; instead of unlocking them linearly, rotate **one per week** as a "Featured Bonus" with a modifier (e.g., "Ice Physics," "Double Gravity," "No Checkpoints").
- Track a separate leaderboard for each weekly rotation.
- Award a unique cosmetic (ball skin, trail effect) for achieving 3 stars on the featured bonus during its active week.
- Because the levels are already built, this system is almost entirely data-driven (a `bonus_rotation.json` file + a few UI changes).
This gives players a recurring reason to return without requiring new level geometry.

### Example from Existing Games
**Trackmania’s Track of the Day (TOTD)** — Every day, one community track is featured with a dedicated leaderboard. The leaderboard resets weekly, so new players can compete on equal footing with veterans. The genius is that the *same track* feels fresh when the social context (leaderboard) changes. For Physix, rotating bonus levels with a weekly modifier achieves the same effect at a fraction of the content cost.

---

## Implementation Priority (Solo-Dev Friendly)

| Priority | System | Effort | Impact |
|----------|--------|--------|--------|
| 1 | Dual-Layer Star System (No-Checkpoint medals) | Low | High |
| 2 | Speed-Driven Camera (FOV + distance lerp) | Low | High |
| 3 | Personal Ghost + Sector Splits | Medium | High |
| 4 | Weekly Bonus Rotation | Low | Medium |

All four recommendations are implementable in pure GDScript without new assets, new levels, or network code.

---

*End of Report*
