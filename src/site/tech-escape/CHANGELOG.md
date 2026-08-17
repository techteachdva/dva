# Tech Escape — Changelog

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
