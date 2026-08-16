# Tech Escape — Changelog

## 2.1.0 (2026-08-16)

### Playtest & exit fix
- **Debug code `PLAYTEST`** — pause menu unlocks cheats: all code pieces, instant print/key, teleport to exit, god mode, win level. Hotkeys **1–6** while playing.
- **EXIT door fix** — door only spawns on the true outer wall; collision clears when unlocked so you can walk through and finish the level.

### Mobile / Chrome on Android & iOS
- **2T1L readability** — white choice text on solid bubbles for easy lie-spotting on phone and desktop.
- **Full touch play mode** — phones skip pointer lock (which breaks mobile play) and use on-screen controls instead.
- **Look zone** — drag the right side of the screen to turn; virtual stick on the left for movement.
- **Complete action pad** — USE, THROW, EAT, LIGHT, RUN, CROUCH, ITEM, plus PAUSE and FULLSCREEN.
- **Fullscreen** — tap FULL to hide browser UI (Android Chrome); safe-area padding for notched phones.
- **Easier mobile tuning** — wider interact range, higher look sensitivity, auto low graphics preset for smooth FPS.
- **HUD compaction** — meters and inventory shrink so controls are not covered.

### Mouse-only + SEL (2.0.1, 2026-08-15)
- **Three-button mouse layer** — L/M/R + scroll alongside keyboard (forward/back/sprint/strafe/throw/eat/light/crouch/cycle).
- **SEL text notifications** — periodic Two Truths & One Lie smartphone overlay (~50 scenarios).
- **Study Guide** — SEL LOUNGE section for notification answers.
- **Visual polish** — higher-res canvas textures, emergency floor strips, dimmer table zones, richer pickup models.

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

### Controls
- **Enter** — interact (terminals, printer, door)
- **E** — throw (disc at virus, cheetos otherwise)
- **R** — eat hot cheetos / drink soda
- **F** — flashlight
- **Q** — cycle inventory item
- **C** — crouch toggle
- **Shift** — sprint toggle
- **Remappable** — pause menu KEYBINDS section
