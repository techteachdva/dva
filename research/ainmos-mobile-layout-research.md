# Ainmos mobile layout: research and plan

18 Oct 2026. Research only. No game code was changed. Another agent is editing Ainmos right now, so treat every "Ainmos today" note as a snapshot of the working tree on this date. Re-check each one before acting on it.

**How this was made**
- Web research on mobile browser games and on four reference games: Balatro, Ball x Pit, Cultist Simulator and Terraforming Mars. Sources are listed at the end.
- A read of `src/site/ainmos/css/ainmos-mobile.css`, `js/app/device-mode.js`, `js/ui/mobile-chrome.js`, `js/flow/input-quarantine.js`, `play.html` and `manifest.webmanifest`.
- A short guided Daydream in the in-app browser with the form forced to `phone`, at 844×390 (iPhone 16e landscape), 667×330 (iPhone SE with Safari's bars) and 390×760 (portrait). This was emulated with a mouse, not a touch phone. Anything that depends on `pointer: coarse` is marked "check on a device".

---

## Part A: Rules for a game that runs in any mobile browser

These are platform facts. Ainmos already handles most of them; the gaps are marked ✗.

| Rule | Why | Ainmos today |
| --- | --- | --- |
| `viewport-fit=cover` in the viewport meta | Without it, `env(safe-area-inset-*)` is 0 and iOS letterboxes landscape | ✓ `play.html`, `index.html` |
| Keep controls inside the safe-area insets | Landscape notch insets are about 44–62pt per side. The home-indicator strip stays reserved even when it fades | ✓ `--sa-*` variables. ✗ the Next-phase orb is still clipped at the right edge (Part D) |
| Size from `visualViewport` / `innerHeight`, not only `100vh` | Safari's bars change the height. `dvh` has been reported unreliable on a PWA cold start | ✓ `viewport-sync.js` publishes `--vvh` |
| No Fullscreen API on iPhone | iPhone Safari rejects `requestFullscreen()`. An installed PWA (`display: standalone`) is the only full-screen path | ✓ PWA manifest. `play.js` calls `requestFullscreen()`, which works on Android only |
| No orientation lock on iOS | `screen.orientation.lock()` is unsupported in iOS Safari as of 26.x. Show a rotate hint instead | ✓ rotate hint. ✗ manifest says `"orientation": "any"`. `"landscape"` would lock installed Android PWAs |
| Kill double-tap zoom and pinch on the page | iOS ignores `user-scalable=no` and sometimes `touch-action` for double-tap | ✓ `input-quarantine.js` (`gesturestart`, `dblclick`, `touch-action: manipulation`) |
| No hover-only information | Touch has no hover. Use `(hover: hover) and (pointer: fine)` to gate hover UI, and give every tooltip a tap or long-press route | Partly. Long-press inspect exists (`pointer-gestures.js`). ✗ no one tells the player about it |
| Touch targets: 44×44 CSS px (Apple 44pt, Material 48dp). WCAG 2.2 AA floor is 24px, or 24px spacing | Missed taps are the top mobile complaint in every case study below | ✓ 0.28 set `--tap: 44px` throughout |
| Save on every state change; expect the tab to be killed | iOS ends backgrounded web apps without warning | Check: confirm the save module writes on `visibilitychange` / `pagehide` |
| Separate storage for Safari and the installed app | After install, the PWA and Safari stop sharing localStorage | Worth one line in How to Play: "installed Ainmos keeps its own saves" |
| No Vibration API on iOS | `navigator.vibrate` works on Android Chrome only | Haptics would be Android-only (Part E, P2) |
| Test real browsers | Desktop emulation misses touch, safe areas and the bars | Matrix in Part E, P5 |

## Part B: Layout and UX principles that apply to Ainmos

1. **Two-thumb landscape grip.** In landscape the thumbs rest on the lower left and lower right. The bottom corners and the lower halves of both edges are easy to reach. Top centre is the hardest spot. The most-pressed control belongs bottom-right. Rare or dangerous controls (pause, menu, quit) belong top-right, out of casual reach.
2. **Zones, not floating windows.** Balatro's layout is often described as fixed zones: status on the left, Jokers and consumables across the top, play area in the middle, hand and Play/Discard at the bottom. The eye always knows where to look. Floating, minimizable windows are a desktop idea.
3. **One task at a time.** The open-source Terraforming Mars web app got a community mobile redesign with one task per screen, bottom navigation and a turn drawer. Its desktop view keeps the map visible and enlarges it for tile placement.
4. **Keep dangerous targets away from frequent ones.** Balatro's sell zone sits next to the rightmost Joker slot, and players sell Jokers by accident. Its Skip button in pack openings is also easy to hit by mistake. A mod author moved the sell zone further away and turned that on by default.
5. **The background is dead while a menu is open.** Terraforming Mars mobile placed confirm boxes over the card-deck icon, so stray taps opened the deck. The reviewer asked for the background to ignore taps. Ball x Pit's floating joystick jumped to a new spot after a level-up screen, which is the same bug class: a tap that closes one layer must not land on the next.
6. **Colour is the label; icons back it up.** Balatro uses blue for Chips, red for Mult and gold for money. Its High Contrast Cards option was praised because hearts/diamonds and clubs/spades look alike on a phone.
7. **Show cause, then effect, at readable speed.** Terraforming Mars AI cards "flashed up too quickly to read". Its every-resource animations made AI turns drag. Both problems at once: give a log for what flew past, and a speed setting for what drags.
8. **Text the player can read is the hard part.** Cultist Simulator's porter (Playdigious) said the card controls adapted easily but the text-heavy UI had to be rethought for small screens. Players of Balatro (Switch, PC) and Cultist (Switch) asked for a text-size option they did not get.
9. **Truncated rules text is a common failure.** Terraforming Mars cuts long card text and puts the rest behind a small info icon, at the cost of the art. Make the full rule the default view on phones and let art shrink first.

## Part C: The four reference games

### Balatro (Playstack port, iOS/Android, Sep 2024)
- **Orientation:** landscape only. No portrait at launch.
- **Input:** the desktop pop-up tabs (Sell / Use / Select) were too small for fingers, so mobile replaced them with **drop zones**: drag a card to sell, use or select it. Reviewers say touch maps almost one-to-one onto mouse play and feels better than mouse or controller.
- **Feel:** light haptics on card taps, button presses and dealing. Launches fast and stays responsive.
- **Readability:** fine on most phones, worse on very small ones. Jack vs. king and heart vs. diamond can need a second look. High Contrast Cards fixes the suits.
- **Failures:** the Joker sell zone sits next to the slot players most want to use, which reviewers call "the perfect spot for a run-ending error". Skip in pack openings is too easy to press by accident. Foldables don't use the extra height.
- **For Ainmos:** (a) a drag-to-tray alternative for building spreads, (b) keep Skip and other "lose this" buttons small and away from the primary, (c) a high-contrast suit option, (d) Android haptics on dice landing and card picks.

### Ball x Pit (Kenny Sun / Devolver, iOS/Android, 2026)
- **Orientation:** landscape-locked. A third-party summary of store reviews says the most common request is a portrait mode for one-handed play. That is an aggregator's reading, not a review site, so treat it as a hint.
- **Input:** on-screen twin sticks are "adequate", especially with auto-fire on. Players asked for aim-style toggles and a sensitivity setting, and the studio shipped control fixes within weeks.
- **Failures:** the left stick re-anchored after a level-up (input carrying across a modal). In the town builder, a low camera made bottom buildings hard to see and neighbours hard to pick.
- **For Ainmos:** (a) a tap that closes a modal must never act on the board under it, (b) when targets on the Dreamscape are dense, magnify or disambiguate instead of making the player hit a 50px hex, (c) the portrait question is real (Part E, P4).

### Cultist Simulator (Playdigious port, iOS/Android, 2019)
- **Input:** dragging cards onto "verb" boxes moved straight to touch. The porter called it far easier than their action-game ports, and reviewers say the game suits touch better than mouse.
- **What changed:** the verbs moved to a **fixed spot on screen**. **Pause and Play / Fast-forward got new, larger buttons**. The layout was redone so card counts and time controls stay visible while the board gets more room. Pinch zoom works, and a high-contrast mode makes text bolder.
- **Failures:** "a little cluttered" on iPhone and best on iPad. The Switch version had no text-size setting and drew squinting complaints.
- **For Ainmos:** (a) persistent controls get a fixed dock and never float, (b) the board can zoom and the UI never has to, (c) a bold/large text toggle, (d) tablets deserve their own roomier layout (0.28 started this).

### Terraforming Mars (Asmodee Digital / Twin Sails app, plus the open-source web version)
- **Layout:** the App Store lists it as "Designed for iPad", and phone reviewers call it cramped. iPhone SE users report "VERY small" buttons. Condensed player boards (tags and ongoing effects at a glance) were praised.
- **Failures:** cut-off card text behind a small info icon. Confirm dialogs over live buttons, so stray taps opened the deck. An End Turn press after every two actions. AI turns too fast to read and too slow to sit through.
- **The open-source web version (GitHub `terraforming-mars/terraforming-mars`):** a community redesign showed one task at a time on phones, bottom navigation and a turn drawer. On desktop it keeps Mars visible beside the actions and **enlarges Mars for tile placement**, then animates it back. The maintainer pushed for phone support because "people play on mobile".
- **For Ainmos:** (a) a condensed status strip and a reference sheet, which the Table menu already roughly is, (b) full rules text on phones, (c) inert backgrounds, (d) magnify the Dreamscape for placement instead of bouncing between screens, (e) don't make the player confirm what the game can infer.

## Part D: Ainmos on a phone today (18 Oct 2026, emulated)

**What's working**
- 44px tap floor, safe-area variables, solid Table menu, and a readable hand drawer: six big Psyche cards with a clear Done button.
- Full-screen Lost & Found and Cycle screens with swipe shelves. The primary button (Begin Cycle, Take 2 Free, Done) sits bottom-right, in thumb reach.
- Flat, crisp dice on touch. A rotate hint in portrait. Long-press inspect.

**What I saw that hurts** (screens named as the player sees them)
1. **The Next-phase orb is clipped by the right edge** at both 844 and 667 wide ("NEXT: EXPLOR"). It is also top-right, the hardest spot to reach for the button pressed most often.
2. **The guide covers what it talks about.** The coach card sits on the Cycle map, the phase-opener title and the Vault title, and on the table it covers the whole lower-right quadrant. During placement, a second toast ("Build the Dreamscape … tap a glowing hex") repeats the coach ("Place it … Tap a glowing hex") at the same moment.
3. **The coach pill draws over the portrait rotate hint** ("Dream built" button floating at bottom-right of the rotate screen).
4. **The Dream card ("Every Dream hurts … Read the Dream")** shows the art panel, cut off at the bottom of the screen. The rule the guide tells you to read isn't on screen. The action button carries the name ("Silence eats Motion / Endure it"), but not the rule.
5. **Vault screen ("Dreamscape Vault"):** each Landscape's rule is clipped to one line with tiny inner scroll arrows, while a band of empty space sits above the cards. 0.29.1 fixed this pattern for Lost & Found on short screens but not here at 390 tall.
6. **Placement ping-pong:** Vault screen → Place → board → tap hex → back to the Vault screen, once per tile. Four screen changes for two tiles.
7. **Board tiles are small.** On a 390-tall phone the Dreamscape hexes are about 50px and the printed tile names can't be read. Wide side areas sit empty.
8. **The command bar holds nine things:** phase stepper, ★ goal, Cycle, Mind, ?, death-clock pips, count, pause, more. Below 740px the Mind chip loses its label and becomes a bare "43".
9. **The goal appears three times:** ★ 0/3 in the bar, the Archetypes plaque (0/3) and Wake (0 of 3) in the Table menu.
10. **Phase opener:** Skip is a large pill at bottom centre, between View Board and the primary. That's Balatro's Skip-misfire layout. The card fan also shows its own inner scrollbar.
11. **Title screen at 844×390:** three squeezed columns. The Dreamer grid is cut off after the first row, and the seed field's placeholder is clipped ("ANY WORD OR GAM"). The scrollbars may come from mouse emulation; check on a device.
12. **Gate copy:** "Click to begin (fullscreen)" and "Esc — pause menu" appeared. That may be the mouse emulation, since the board hint switched correctly to "PINCH ZOOM · DRAG PAN". Check on a device.

**Code health (affects every fix below)**
- `ainmos-mobile.css` is 1,043 lines of override layers on top of the desktop table. Sections are named "Last stragglers from the 0.28 audit". Specificity hacks like `.hand-bar.hand-bar.hand-bar` and a lot of `!important` are needed because the phone layout is a patch on the desktop one, not a layout of its own.
- Several parts of the phone table are absolutely positioned floats tuned against each other: orbs, Vault column, Archetypes plaque, Table button at `left: 66px`, the coach card's `max-height: calc(100dvh - 172px)` "stops below the Archetypes plaque (its bottom edge: 158px)". Any change to one moves the others. That explains issues 1, 2 and 3.

## Part E: The plan

Ordered so each phase ships on its own. Nothing here is implemented. Start only after the other agent's current Ainmos work has landed, and re-run `scripts/ainmos-mobile-walk.mjs` first, because Part D may have moved.

### P0: Quick fixes (one small release, low risk)
| # | Change | Where | Check |
| --- | --- | --- | --- |
| 0.1 | Keep the Next-phase orb inside `--sa-r` at every width. Its label fits or wraps to two lines | `ainmos-mobile.css` §2 orbs | Mobile walk at `phone-small`, `iphone-16e`, `iphone-16e-safari`: orb box inside viewport |
| 0.2 | One teaching voice: suppress the board toast while a coach step says the same thing | coach-panel.js / the board toast source | Guided Daydream: never two instructions at once |
| 0.3 | Coach never covers its subject. On menus it docks to the empty band or the bottom-left. On the table it starts minimized to the pill once the step is shown | `ainmos-mobile.css` §9, coach-panel.js | Walk: coach rect doesn't overlap the screen title or primary button |
| 0.4 | Hide the coach pill (and every floating control) under the rotate hint | `ainmos-layout.css` rotate-hint z-index | Portrait screenshot shows only the hint |
| 0.5 | The Dream card shows its rule on phones. Art shrinks to a strip | Dream reveal modal CSS | 844×342: full rule visible, no clipping |
| 0.6 | Vault screen: same short-screen treatment Lost & Found got in 0.29.1. Rule gets the room, art shrinks, no empty band | `ainmos-mobile.css` Vault section | 844×342 and 667×330: whole rule visible |
| 0.7 | Phase opener: Skip becomes a small text button at the left beside View Board, never next to the primary | phase opener markup/CSS | Visual check, plus the walk's adjacency check |
| 0.8 | Mind chip keeps an icon below 740px instead of a bare number | §6 narrow phones | 667 screenshot |
| 0.9 | Manifest `"orientation": "landscape"` (iOS ignores it, installed Android obeys it) | `manifest.webmanifest` | Install on Android, rotate |
| 0.10 | Gate and hint copy say "Tap" and drop "Esc" when `data-pointer="coarse"` | play.js gate | Real phone |

### P1: The phone table as zones (the big one)
Rebuild the phone table as a CSS grid with named areas instead of floats placed against each other.

```
┌──────────────────────────────────────────────────────────────┐
│ status strip: phase · ★goal · Cycle · Mind · clock   ⏸  ⋯   │  40–44px, read-only except ⏸ ⋯
├────────┬───────────────────────────────────────────┬─────────┤
│ Back   │                                           │ Archet. │
│ Table  │              Dreamscape board             │ plaque  │
│ Vault  │        (fills the area; auto-fit)         │         │
│ tiles  │                                           │         │
├────────┴───────────────────────────────────────────┤  NEXT   │  ← bottom-right: the most-pressed control
│ Power coins · Hand (6) · spread tray / Fight        │  PHASE  │
└─────────────────────────────────────────────────────┴─────────┘
```

- **Left rail (left thumb):** Back, Table, the Vault tiles. **Right rail (right thumb):** Archetypes plaque above, **Next phase as a big bottom-right button**. Pause and More stay top-right on purpose.
- **Status strip on a diet:** phase, ★ goal (the plaque becomes that ★ chip's expansion, removing a duplicate), Cycle (tap to peek the night, as now), Mind, death clock. Move "?" into More.
- **Board auto-fits** the centre area so hexes come out at least 64px on a 390-tall phone. Tile names show on long-press or in a "magnify" view.
- Build it as one new phone-layout file (or an `@layer phone` block) that owns these grid areas. Then delete the floats and stragglers it replaces from `ainmos-mobile.css` instead of adding more overrides. Tablets can reuse the same areas with roomier sizes.
- **Risk:** this is the largest change, touching `play.html` structure, `ainmos-layout.css`, `ainmos-mobile.css`, `fit-bar.js`, `float-window.js` and `panel-layout.js`. Ship it alone, behind the existing form override (`ainmos.formOverride`) so it can be compared side by side.

### P2: Interaction (after P1)
1. **Place on the board, not between screens.** On phones, Reveal shows the Vault offer as a tray on the left rail. Tap a tile, then a glowing hex, or drag it there. The board magnifies while a tile is held, as the Terraforming Mars web version does for Mars. This removes the screen ping-pong. *Design decision for Phil:* it changes the Reveal flow's look on phones only.
2. **Drag as an option for spreads:** drag Psyche cards into the spread tray, Balatro style, with tap-to-pick kept as the main path. No destructive drop zone (Repress, discard) next to the tray.
3. **Inert background:** every modal sets `inert` on the table behind it. A closing tap is swallowed for about 300ms so it can't hit a hex. `input-quarantine.js` is the place.
4. **Teach the long-press once:** the first time a card or tile appears, a single "Hold to read" hint. Audit `title=` attributes (e.g. `#board-viewport` "Scroll or pinch to zoom") since touch never shows them.
5. **Android haptics:** a short `navigator.vibrate` on die landing, card pick and Fight. Off with Reduce Motion, and a toggle in Pause.

### P3: Readability and comfort settings (Pause menu)
- **Larger text** toggle: one `--ui-scale` that phone and tablet sizes multiply by. The reference games' players asked for this and didn't get it.
- **High-contrast suits:** heavier suit icons and outlines on Psyche cards and dice, after Balatro's High Contrast Cards.
- **Fast dice:** shortens the dice battle and Dreambeast reveal animations. The Dream feed already serves as the log for anything that went by too fast.

### P4: Portrait (decision for Phil, not a task yet)
Balatro and Ball x Pit both shipped landscape-only, and portrait was Ball x Pit's most-requested change. Three options:
- **A. Stay landscape-only** (today). The cheapest option, and the table's shape suits it.
- **B. Portrait for the full-screen menus only:** title, Cycle, Lost & Found, Vault and run summary become vertical lists in portrait. The table still asks you to rotate. Most of these screens are already one-column-capable.
- **C. A full portrait table:** board on top, hand at the bottom, rails become a top strip. A new layout and a lot of work.
Recommendation: **A now, B after P1**, because B gives phone players a one-handed shop and menus with no change to play.

### P5: Testing that matches "any browser"
- **Extend `ainmos-mobile-walk.mjs`** with checks that would have caught Part D: control boxes outside the viewport or safe area; the coach rect overlapping a primary button or screen title; rules text clipped (`scrollHeight > clientHeight` on `.lf-item-text`); two instruction surfaces visible at once; anything drawn over `.rotate-hint`.
- **Device matrix per release:** iPhone SE (667×375) and iPhone 16e in Safari, in Chrome iOS, and installed. Pixel in Chrome and installed. Samsung Internet. Firefox Android. An iPad in both orientations. Emulation can't stand in for touch, the bars or the notch.
- **Baseline:** the CSS relies on `:has()` and `zoom`. Both are in current Safari, Chrome, Samsung Internet and Firefox (121+ / 126+). Older Firefox Android would fall back badly, so either note a minimum or avoid them in the new phone layout.

## Decisions (Phil, 18 Oct 2026)
1. **Placement:** phones pick Landscapes from the Vault column on the board. No Vault screen between placements.
2. **Portrait:** landscape only for now. Revisit portrait menus after the table rebuild.
3. **Next phase:** a big button at the bottom-right on phones. Desktop keeps the top-right orb.
4. **Settings:** Fast dice only. Larger text and high-contrast suits are not wanted for now.

## Progress (18 Oct 2026, uncommitted, no version bump)
Done and checked with `ainmos-mobile-walk.mjs` (iphone-16e-safari, phone-small, pixel-10-chrome, tablet-landscape, desktop) and a tap-driven Playwright run of Reveal:
- **Next phase** is a 48px pill at the board's bottom-right. The Archetypes plaque moved up into the freed corner.
- **The guide covers nothing on phones** (`coach-panel.js` `placeStrip` / `placeSide`):
  - Over a menu it is one strip across the top, and the menu moves down by its height (`--guide-strip-h`). The Dream rule, Vault rules and phase window are no longer under it.
  - On the table it sits in the free column right of the board, between the Archetypes plaque and Next.
  - If the card is too tall for that gap (iPhone SE), it hangs as a strip under the command bar until it folds into its pill.
  - It hides under Pause and under the portrait rotate screen.
- **Phone Vault tray** (`vault-screen.js`, `vault-panel.js`): phones skip the full-screen Vault.
  - The left Vault column is the picker, and its live tiles pulse.
  - A plaque above the hand shows the chosen Landscape's rule, its "★ X's home" mark and the actions left.
  - The table's duplicate notice waits while the plaque is up.
  - Done is Next phase.
  - Not on the tray: the Vault screen's "Add Lucidity" top-up. The phase window still offers it.
- **Skip** in the phase window is a quiet underlined word beside View Board.
- **Mind** keeps a Ψ mark on narrow phones.
- **Fast dice:** Pause → Display → Dice ("Fast dice: On/Off", saved in `ainmos.settings.fastDice`). Every roll, landing and result hold plays at 0.45×.
- Phase-window cards shrink to make room for the guide strip, and Lost & Found cards switch to the short-screen layout under it.

Not done:
- Board magnify. The free-form board already fits placed tiles plus open slots, so on a 342px-tall phone it is height-bound. Magnify only pays once the board grows.
- The manifest stays `"orientation": "any"`. Locking landscape would also block Android tablets in portrait.
- The rest of P1: moving Back and Table, the status-strip diet, and replacing the floats with grid areas.
- P2.2–P2.5 and P5.

## Sources
- Balatro: [Engadget, "an almost perfect mobile port"](https://www.engadget.com/gaming/balatro-is-an-almost-perfect-mobile-port-163050971.html) · [Android Police hands-on](https://www.androidpolice.com/balatro-hands-on/) · [Shacknews impressions](https://shacknews.com/article/141549/balatro-mobile-impressions) · [Digital Trends](https://www.digitaltrends.com/gaming/balatro-mobile-version-impressions-apple-arcade/) · [damien.zone, porting the touch controls to PC (sell-zone fix)](https://damien.zone/modding-balatro-on-pc-to-add-touch-controls/) · [Blake Crosley, Balatro feedback design](https://blakecrosley.com/guides/design/balatro) · [GameFAQs, font size thread](https://gamefaqs.gamespot.com/boards/445924-balatro/80912598)
- Ball x Pit: [Engadget on the mobile release](https://www.engadget.com/gaming/ball-x-pit-on-mobile-piece-by-piece-x2-and-other-new-indie-games-worth-checking-out-110000319.html) · [App Store page and reviews](https://apps.apple.com/us/app/ball-x-pit/id6738703497) · [games.gg](https://games.gg/news/ball-x-pit-goes-mobile/) · [KitGuru](https://www.kitguru.net/gaming/matthew-wilson/ball-x-pit-comes-to-mobile-and-promises-feature-parity-with-pc-and-console-versions/) · [marlvel.ai review summary (aggregator, low confidence)](https://marlvel.ai/apps/ball-x-pit)
- Cultist Simulator: [TouchArcade announcement (Playdigious on the port)](https://toucharcade.com/2019/02/28/cultist-simulator-occult-card-roguelike-mobile-announcement-confirmed-pre-registration/) · [TouchArcade review](https://toucharcade.com/2019/04/01/cultist-simulator-review/) · [MSPoweruser review](https://mspoweruser.com/review-cultist-simulators-mobile-port-sacrifices-unbelievers-but-not-quality/) · [TapSmart review](https://www.tapsmart.com/games/review-cultist-simulator-beguilingly-odd-card-game/) · [Pocket Tactics review](https://www.pockettactics.com/cultist-simulator/review) · [GameSpew, Switch text size](https://www.gamespew.com/2021/02/cultist-simulator-initiate-edition-review/)
- Terraforming Mars: [Pocket Tactics review](https://www.pockettactics.com/terraforming-mars/review) · [Screen Rant mobile review](https://screenrant.com/terraforming-mars-mobile-review/) · [Board Game Quest, Steam review](https://www.boardgamequest.com/terraforming-mars-steam-review/) · [Board Game Quest, iOS](https://www.boardgamequest.com/quick-thoughts-on-terraforming-mars-for-ios) · [Pixelated Cardboard review](https://www.pixelatedcardboard.com/terraforming-mars-review/) · [Dude, Take Your Turn](https://dudetakeyourturn.ca/2019/12/05/why-i-wont-be-buying-mobile-terraforming-mars/) · [App Store page](https://apps.apple.com/us/app/-/id1353471030) · [open-source web version, UX redesign issue #8477](https://github.com/terraforming-mars/terraforming-mars/issues/8477)
- Web platform: [iPhone PWA game guide (gist)](https://gist.github.com/fozzedout/5e77925381991a9570151550992baf14) · [caniuse, ScreenOrientation.lock](https://caniuse.com/mdn-api_screenorientation_lock) · [WebKit bug 257695](https://bugs.webkit.org/show_bug.cgi?id=257695) · [Safe-area insets and Dynamic Island](https://www.mironsoft.de/en/blog/css-safe-area-insets-iphone-notch-dynamic-island) · [web.dev, interaction media features](https://web.dev/learn/design/interaction) · [css-irl, detecting hover-capable devices](https://css-irl.info/detecting-hover-capable-devices/) · [iOS double-tap zoom in a web game (issue)](https://github.com/thedumbtechguy/scorched_highway/issues/20) · [Apple, Safari web content events](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/HandlingEvents/HandlingEvents.html)
- Touch targets and reach: [WCAG 2.5.8 Target Size (Minimum)](https://wcag.dock.codes/documentation/wcag258) · [Front-End Checklist, touch targets](https://frontendchecklist.io/rules/accessibility/touch-targets) · [Smashing Magazine, The Thumb Zone](https://www.smashingmagazine.com/2016/09/the-thumb-zone-designing-for-mobile-users/) · [Parachute Design, thumb-zone guide](https://parachutedesign.ca/blog/thumb-zone-ux/) · [Mobile Free To Play, touch control design](https://mobilefreetoplay.com/control-mechanics/)
