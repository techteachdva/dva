# Tech Escape — Changelog

## 2.6.0 — The First Night Update (2026-10-23)

### HUD and viruses
- The HUD is a top objective chip, code slots, and one bottom dock for health, stamina, flashlight, and stance.
- Viruses are particle globes: a swarm that holds a sphere, breathes, and flies apart when the flashlight burns it.

### Pause menu
- The pause card is four pages: Play, Comfort, Picture, Controls. Resume stays on the card. Mix, grain, and axis speeds sit behind a disclosure instead of filling the screen.

### Teaching
- The rules are on the first screen, on the lobby, and as a one-line lesson inside the lab. The lesson clears when you do the thing (walk, crouch, flashlight, Chromebook). The old manual no longer pops over the lobby.
- Pause can skip the lesson. It does not come back on this computer.

### Floor arrows
- Red floor arrows stay dark while you are still searching.
- If you linger in one pocket of the maze, the nearby arrows wake and point along the path to the nearest locked Chromebook.
- Following them, or ignoring them, puts them back to sleep. They are a hint, not a GPS.
- They no longer light the whole maze or rebuild a path every frame.

### Difficulty
- **After Hours** mice are slower than a walk (3.85 vs 4.1). Standing still is a mistake you can leave. Sprint and desks are the panic tools.
- Field Trip is actually easier than After Hours. It used to hit harder.
- One hunter bites at a time. They keep a step of space instead of sitting in the camera.
- Beginner, Field Trip, and After Hours get a quiet opening before anything hunts. System Crash does not, and its mice still outrun a walk.

### Graphics and Chromebooks
- Richer floor, wall, and ceiling textures, and a soft flashlight cookie, on every preset including Chromebook Medium.
- Shaders, including the flashlight, compile before you have control, so the first press of F is not a long stall.
- A graphics-chip stall pauses the lab and restores meshes instead of leaving you in a broken frame.
- Movement substeps and a snap-back if a body is left inside a wall. A long frame is not a step.
- **Ultra** (desktop): filmic tone mapping, higher resolution, more lights, and a flashlight shadow. Chromebooks keep Ultra's textures and drop the shadow pass.

## 2.5.0 — The Map & Enemies Update (2026-08-17)

### Navigation
- **Map posters** at up to four maze dead ends show a birds-eye map: walls, terminals (squares), printer (triangle), exit (circle), poster dot, and **live player position**.
- Flashlight starts **empty** — a battery spawns near your start cell.

### Enemies (per floor)
- **Level 1:** mice + viruses
- **Level 2:** mice + **circuit bugs** (whole cheetos bag kills one)
- **Level 3:** mice + **phishers** (steal items or pull you from under desks)
- **Level 4:** mice + **cyberbullies**
- **Level 5:** mix of all special enemies

### Floors
- Each level has distinct **floor/wall/table textures**, **emergency light colour** (red → orange → yellow → green → blue), and a **signature dressing prop**.

### Flashlight
- **F** always toggles on/off; sputter/flicker only when battery is nearly empty.

### Balance (2.5.1)
- **AFTER HOURS** smoothed: fewer hunters, more loot, gentler damage/speed/drain, shorter wrong-answer hunts, softer printer swarm, ~55% chance of extra spawns per code piece.

## 2.4.0 — The High Score Update (2026-08-17)

### Global leaderboard
- **Top 100 high scores** saved to Google Sheets (same proxy pattern as Summer Writing and About Mr. Phil votes).
- **Post your score** after winning or losing — first name (16 letters) + last initial.
- **Title screen → High Scores** lists the full board.
- **Run scoring** rewards escapes, speed, first-try answers, accuracy, item use, flashlight time, decrypt efficiency, low damage, floor progress, and difficulty multiplier.

## 2.3.0 — The Binaural Update (2026-08-17)

### Audio
- **10 Hz alpha binaural beat** layered under the lab drone (340 Hz left / 350 Hz right) for relaxed-alert focus during play.
- **Directional damage audio** and proximity enemy sounds (mouse scroll ticks, virus chiptune ticks).

### Terminals & pressure
- **Locked terminals** glow cool blue; **completed terminals** glow faint green.
- **First-attempt gate** — need 2 of 3 credentials accepted on the first try per question set; failing locks the terminal for 60s and pings all enemies for 10s (global alert, ignores normal detection range).
- **Desk ridge boost** — jumping onto a hide-under table brightens locked terminals you can see.

### Navigation & maze
- Stronger terminal spread, brighter emergency arrows when one terminal remains, and more robust fully-connected maze validation.
- Floor arrows still point along the maze path toward unsolved Chromebooks.

### World & loot
- **Larger student chairs** proportional to hide-under tables.
- **Fixed standing clip-through** on table tops; crawl grace no longer lets you walk through the slab.
- **Improved hot chip bag** model — bulging body with rounded end caps instead of boxy crimp sticks.
- Scatter dressing on tabletops; loot under tables or on chair seats.

### Decrypt minigame
- **Color-blind safe pair colors** — each matched pair has its own hue.
- **Larger, thicker glyph symbols** on memory cards.

## 2.1.0 (2026-08-16)

### Playtest & exit fix
- **Debug `PLAYTEST`** — full brightness + flashlight, invincibility, click-through minigames (any tap = correct + SKIP buttons), plus keys 1–6.
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
