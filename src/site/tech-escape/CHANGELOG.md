# Tech Escape 2.0 — Changelog

## 2.0.0 (2026-08-15)

### Progression & replay
- **5 floors** with distinct maze layouts, enemy mixes, fog/brightness, and loot budgets (Lab → Server Room → Library → Tunnels → Mainframe).
- **Local player profiles** — names saved on-device only; no accounts or server.
- **Study Guide** — missed questions appear immediately; correct answers unlock only after answering correctly on a later run.
- **Progress survives death** — run stats, guide entries, floor unlocks, and best times persist per profile.

### Questions
- **128-question bank** (32 per terminal pool) with stable IDs and ITEM standard tags.
- **Fresh draws** — mastered and recently served questions are excluded from new terminal sessions.
- **Difficulty weighting** — higher game difficulties prefer harder authored questions when tagged.

### Gameplay
- **Inventory** — Hot Cheetos, Soda, Anti-Virus CD go into your bag instead of auto-consuming.
- **Throw mechanics** — Cheetos lure mice then explode; Anti-Virus disc permanently deletes one virus.
- **Terminal pause** — on FIELD TRIP and AFTER HOURS, enemies freeze while you read; SYSTEM CRASH keeps hunting.
- **Improved pickup models** — puffy chip bags, readable soda cans, flat discs.

### Accessibility & UI
- **First-run screen** — reduce motion, reduce flashing, captions, look speed before first play.
- **75% terminal panel** with larger fonts, shape-coded answers, two-step commit, retry-until-correct.
- **Sound captions** — directional `[arrow] Source (proximity)` lines, on by default.
- **Colourblind-safe palette** — four luminance tiers plus shape redundancy in HUD and world.
- **Slower loading animation** — typewriter boot log (~6–10s, skippable).
- **Pause menu** — full accessibility panel (motion, flash, captions, sensitivity, text presets).

### Controls (new)
- **Q** — cycle inventory item
- **R** — use selected item (eat cheetos / drink soda)
- **G** — throw selected item
