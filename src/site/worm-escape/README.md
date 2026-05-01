# GUTS & GLORY: Escape the Purple Worm

A text-flavored, pixel-chunky, sword-and-sorcery action RPG where you climb your way out of a 200-foot purple worm's gullet before the stomach acid dissolves your everything.

## How to Run

1. Open `index.html` in any modern browser (Chrome, Firefox, Edge).
2. That's it. No build step. No dependencies. Pure HTML/CSS/JS modules.

> If you open the file from your filesystem and the game doesn't load, some browsers block ES modules over `file://`. Easiest fix: run a tiny local server.
>
> ```bash
> # With Python 3 installed:
> cd worm-escape
> python -m http.server 8000
> # Then visit http://localhost:8000
> ```

## Controls

| Key                | Action                                  |
| ------------------ | --------------------------------------- |
| Arrow Keys / WASD  | Move / Climb / Navigate menus           |
| SPACE or ENTER     | Confirm / Attack / Continue text        |
| 1, 2, 3, 4         | Hotkeys for combat menu                 |
| A / D              | Quick-dodge during acid gouts           |
| ESC                | Return to title (from victory/death)    |

## Core Mechanics

- **Climb** the slimy walls of each worm chamber, hop between three hand-hold columns, and dodge falling bones & teeth.
- **Beat the Acid Timer** - the rising bile corrodes your armor even if it doesn't reach you.
- **Fight a Sphincter Guardian** at each gate - hybrid turn-based combat with live-action acid dodging.
- **Choose Your Path** - Swiftfoot or Ironhide. Speed or steel. Never both.
- **4 Chambers** to escape: Stomach -> Lower Gut -> Heart-Hollow -> Gullet -> FREEDOM.

## Project Layout

```
worm-escape/
  index.html
  styles.css
  CHANGELOG.txt
  README.md
  js/
    main.js            # boots the game
    engine/
      loop.js          # game loop + delta time
      input.js         # keyboard manager
      scenes.js        # scene stack manager
      render.js        # canvas helpers (flesh, veins, acid, text)
      audio.js         # tiny WebAudio SFX
      rng.js           # seeded randomness
    content/
      player.js        # player model, builds, loadouts
      enemies.js       # enemy definitions
      chambers.js      # chamber config (acid rate, debris rate, guardian)
    scenes/
      intro.js         # typewriter story
      create.js        # character creation
      climb.js         # climbing mini-game
      combat.js        # sphincter guardian fight
      transition.js    # between-chamber cutscene
      gameover.js
      victory.js
```

See `CHANGELOG.txt` for version history.

Music by
"Level Up" Kevin MacLeod (incompetech.com)
Licensed under Creative Commons: By Attribution 4.0 License
http://creativecommons.org/licenses/by/4.0/

Art by
Dez