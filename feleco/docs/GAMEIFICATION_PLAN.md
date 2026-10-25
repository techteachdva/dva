# Feleco Gameification Plan
## Research & Implementation Roadmap

---

## Part 1: Research Summary

### Ecosystem Simulation Models

**Lotka-Volterra Predator-Prey Dynamics**
The classic mathematical model produces oscillating populations: prey boom → predator boom → prey crash → predator crash → recovery. Key insight: the phase lag between predator and prey populations is what creates cycles. In Feleco, wolves should peak ~10-15 seconds AFTER sheep peak, not simultaneously.

**Agent-Based Modeling (NetLogo, Unity implementations)**
Research shows that purely local rules create emergent global patterns. The MDPI Informatics 2022 paper found that adding Mendelian inheritance (heritable speed, metabolism, reproduction rate) stabilized populations compared to identical clones. Feleco already has phenotype variance -- this is a competitive advantage.

**Cellular Automata for Ecology**
- **NetLogo Fire Model**: Demonstrates critical density thresholds (~59% tree coverage) where fire has 50/50 chance of crossing the grid. Percolation theory applies to grass spread too.
- **Continuous-State CA**: Allow cells to represent partial states (e.g., grass density 0.0-1.0) rather than binary alive/dead. Feleco already does this well with density grids.
- **Predator-Prey CA**: Spatial Lotka-Volterra on lattices produces coexistence, extinction, or oscillatory phases depending on local interaction rules.

**Key Design Principle from Research**: Games often oversimplify ecological consequences. The GAS Framework (Games and Culture, 2022) emphasizes four dimensions: Accuracy, Comprehensiveness, Balance, and Consistency. Feleco needs internal logical coherence above all.

---

### Spectator Game Design

**Auto-Battler / Idle Game Patterns**
From Dota Underlords, TFT, and Stargrid:
- **Object pooling** for rapid combat events (prevents frame drops)
- **Stack offsets** for floating text to prevent overlap
- **Color-coded feedback**: green = heal, red = damage, yellow = crit, white = info
- **World-space vs screen-space**: Numbers anchor to entities; notifications anchor to screen
- **Hit flash + screen shake**: Micro-reactions to major events
- **Transparency of math**: Spectators must understand WHY something died

**Academic Findings (ACM CHI PLAY 2018)**
- Visual hierarchies help spectators parse rapid gameplay
- Dashboards filter noise from high-volume simultaneous actions
- Trust comes from accurate representation of underlying combat math

**Betting Game Mechanics**
From PowerUP Roulette, IdleView, and 155.io:
- **Spectator Mode**: Watch without betting to learn patterns
- **XP & Levels**: Permanent progression from watching/betting
- **Channel Point Integration**: Spend earned points to influence game
- **Compounding Multipliers**: Risk/reward escalation (small bets → large payouts)
- **Prestige/Skill Trees**: Ascension mechanics for long-term retention

---

### Visual Polish (Godot 4)

**Particle Systems**
- `GPUParticles2D` with `one_shot = true` and `explosiveness = 1.0` for burst effects
- Sub-emitters at particle death for chain reactions
- Color ramps: bright → fade → transparent
- Trails for projectiles and movement streaks

**Tweening & Animation**
- `create_tween()` with `TRANS_ELASTIC` for bouncy popups
- `TRANS_BACK` for slide-from-edge notifications
- `modulate:a` fade for smooth dismissal
- Scale from `Vector2.ZERO` to `Vector2.ONE` for pop effects

**Notification Systems**
- Queue-based to prevent overlap
- Deduplication for spam prevention
- Hover-to-pause auto-dismiss
- Severity-based scenes (success vs error vs warning)

---

## Part 2: Feleco Gameification Plan

### Phase 1: Visual Feedback Layer (Immediate Impact)

#### 1.1 Particle Effects
- **Birth Burst**: `GPUParticles2D` burst when offspring spawns. Color = species color (white for sheep, red for wolves, etc.). Scale = small → large → fade.
- **Death Explosion**: Larger burst with darker particles when entity dies. Sub-emitter for lingering smoke/rot.
- **Grazing Sparkles**: Tiny green particles when sheep eat grass.
- **Combat Blood**: Red particles on non-lethal hits; larger burst on kills.
- **Healing Glow**: Soft green/yellow upward particles when eating restores health.
- **Level-Up Shine**: Gold burst when desperation repopulation triggers.

#### 1.2 Floating Combat Text
- **Damage Numbers**: Red text on hits, white text on blocked/dodged, gold on criticals.
- **Heal Numbers**: Green text with "+" prefix.
- **Energy Numbers**: Yellow text when eating restores energy.
- **Death Label**: "X" skull icon when entity dies.
- **Reproduction Label**: Baby icon + species name when offspring spawns.
- Physics: gravity drift upward, slight random x-velocity, fade after 1.5s.

#### 1.3 Screen Effects
- **Screen Shake**: Brief shake on mass extinction events (>10 deaths in 2 seconds).
- **Flash**: Subtle vignette flash when a species drops below 10.
- **Time Dilation**: Slow motion for 0.5s when a species hits desperation repopulation.

---

### Phase 2: Event System & Notifications

#### 2.1 Significant Events
Trigger notifications for:
- **Population Milestones**: "Sheep reached 100!" / "Wolves extinct!"
- **Boom/Bust Detection**: "Sheep population DOUBLED in 10s!" / "Sheep CRASHED -80%"
- **Species Interactions**: "Wolves overhunting Sheep" / "Grass depleted - famine imminent"
- **Desperation Events**: "Sheep DESPERATION breeding activated!"
- **First Blood**: First kill of each species
- ** Apex Predator**: "Wolves are DOMINANT"
- **Trophic Cascade**: "Grass recovery → Sheep boom → Wolf boom" chain

#### 2.2 Notification Architecture
- `NotificationManager` autoload singleton (CanvasLayer)
- Queue system: max 5 visible, older ones fade
- Types: INFO (blue), WARNING (yellow), CRITICAL (red), CELEBRATION (gold)
- Slide-in from right edge, auto-dismiss after 4s
- Click to expand details (population graph)

#### 2.3 Sound Effects
- Birth: soft chime (varied pitch per species)
- Death: low thud (varied by size)
- Combat: sharp snap
- Extinction: dramatic minor chord
- Milestone: triumphant fanfare

---

### Phase 3: Enhanced HUD & Betting Interface

#### 3.1 Population Dashboard
- **Live Bar Charts**: Vertical bars for each species, colored by faction
- **Trend Arrows**: Up/down indicators showing 5-second delta
- **Dominance Pie Chart**: Which species controls the ecosystem (% of biomass)
- **Timeline Graph**: Scrollable mini-graph showing last 60 seconds
- **Event Log**: Scrollable text log of recent notifications

#### 3.2 Betting UI
- **Current Bet Display**: Show what the player bet on, with live odds
- **Odds Calculation**: Dynamic odds based on population trends
- **Payout Preview**: "If Sheep wins: 3.5x your bet"
- **Live Leaderboard**: Top 3 species by population with crown icons
- **Species Cards**: Clickable cards showing species details, current count, trend, and recent events

#### 3.3 GUI Polish
- **Theme**: Dark fantasy / nature aesthetic with organic curves
- **Panel Backgrounds**: Semi-transparent dark panels with subtle border glow
- **Fonts**: Bold sans-serif for numbers, serif for flavor text
- **Animations**: Tweened entrance for all panels, hover states for buttons

---

### Phase 4: Powerups & Player Agency

#### 4.1 Powerup Design
| Powerup | Effect | Cooldown | Cost |
|---------|--------|----------|------|
| **Divine Rain** | Instantly regrows all grass to max | 60s | 50 points |
| **Predator Call** | Spawns 3 wolves at random locations | 45s | 40 points |
| **Sanctuary** | Creates a zone where one species cannot be hunted | 30s | 30 points |
| **Plague** | Reduces target species by 30% | 90s | 60 points |
| **Fertility Blessing** | Target species reproduces 2x faster for 10s | 30s | 25 points |
| **Meteor Strike** | Kills 20% of ALL populations (chaos) | 120s | 80 points |
| **Resurrection** | Brings back 5 members of extinct species | 180s | 100 points |

#### 4.2 Points Economy
- **Passive Income**: +1 point per second while watching
- **Correct Bets**: 10x payout in points
- **Milestone Rewards**: +50 points for correctly predicting a boom/bust
- **Achievements**: "Witnessed Extinction" (+25), "Called the Bottom" (+100), etc.

#### 4.3 Strategic Depth
- Powerups create emergent narratives: "The player saved the wolves from extinction with Divine Rain"
- Counter-play: opponents can use Plague on your chosen species
- Spectacle: Meteor Strike makes watching more exciting even if you lose the bet

---

### Phase 5: Cellular Automata Enhancements

#### 5.1 Grass CA Improvements
- **Seasonal Cycles**: Add day/night and seasonal modifiers to growth rate
- **Soil Nutrient Map**: Separate CA layer tracking nitrogen/phosphorus
- **Fire Mechanic**: Lightning strikes can start fires that spread through dry grass (new species: fire)
- **Water Sources**: Rivers/lakes that create local grass abundance

#### 5.2 Weather System
- **Rain**: Boosts grass growth, reduces fire spread
- **Drought**: Suppresses grass, triggers mass migration
- **Storm**: Random lightning strikes (fire risk), brief chaos in movement AI
- **Snow**: Covers ground, grass dormant, wolves hunt more aggressively

#### 5.3 Terrain Variety
- **Forests**: Slow movement, rich in apples/trees
- **Plains**: Fast movement, grass-rich, exposed to predators
- **Mountains**: Impassable barriers that shape migration routes
- **Swamps**: Slow movement, mushroom-rich, disease risk

---

## Part 3: Implementation Priority

### Week 1: Visual Layer
1. Particle effects for birth/death (highest visual impact, lowest risk)
2. Floating combat text (makes combat readable)
3. Basic screen shake and flash

### Week 2: HUD & Notifications
1. Population dashboard with live bars
2. Notification system for significant events
3. Enhanced betting UI with odds and payouts

### Week 3: Powerups & Agency
1. Point economy and passive income
2. 3-4 core powerups (Divine Rain, Predator Call, Plague, Fertility)
3. Cooldown and cost balancing

### Week 4: Polish & CA Depth
1. Weather system
2. Terrain variety
3. Sound effects
4. Final balance pass

---

## Sources

- [Better Game Worlds by Design: The GAS Framework](https://journals.sagepub.com/doi/10.1177/15554120211027109)
- [Unity 3D Ecological System with Gene Evolution](https://mdpi-res.com/d_attachment/informatics/informatics-09-00009/article_deploy/informatics-09-00009.pdf?version=1643188810)
- [Building Living Game Ecosystems - DEV Community](https://dev.to/paulcuffe/building-a-living-game-ecosystem-from-forests-to-wildlife-to-economy-18hn)
- [Simulating Wildlife Populations in Unity](https://dev.to/paulcuffe/simulating-wildlife-populations-in-unity-a-c-system-for-dynamic-ecosystem-management-3mop)
- [Godot 4 Floating Combat Text](https://mtw1man2.itch.io/godot-4-floating-combat-text-damage-number-combat-feedback-system)
- [Real-Time Dashboards for eSports Spectating](https://dl.acm.org/doi/10.1145/3242671.3242680)
- [Godot 4 Particle Properties](https://docs.godotengine.org/en/4.6/tutorials/3d/particles/properties.html)
- [Godot 4 HUD Tutorial](https://docs.godotengine.org/en/4.4/getting_started/first_2d_game/06.heads_up_display.html)
- [EasyNotify Godot Addon](https://github.com/IUXGames/EasyNotify)
- [ToastX Godot Addon](https://github.com/godot-x/toastx)
- [PowerUP Roulette Strategy](https://powerup-roulette.com/)
- [IdleView - Cooperative Twitch Idle Game](https://idleview.app/)
