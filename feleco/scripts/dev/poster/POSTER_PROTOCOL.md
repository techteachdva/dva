# Loading poster update protocol

Dev-only note. This folder is excluded from every export (`exclude_filter` in
`export_presets.cfg`), so nothing here ships with the game.

The loading screen poster (`res://assets/ui/ecosystem_poster.png`) is a baked
picture of the rules. It does not update itself, so whenever a rule changes,
walk this list.

## 1. Did a rule the poster shows change?

| If you changed…                                              | Update in `poster.html`                       |
|--------------------------------------------------------------|-----------------------------------------------|
| `CombatSystem.HUNT` (who hunts whom)                         | `E` edges of kind `hunt` in the Food web      |
| What a species eats (grazing, foraging, rot, mycelium)       | `E` edges of kind `graze` / `forage` / `decay` |
| Fights or raids (boar charges, tribal raids)                 | the `fight(...)` calls and the raid loop      |
| `SimulationDirector.SEASON_TABLE` or `fungal_factor()`       | the `lanes` peak spans in the season timeline |
| Agent states or what triggers them                           | `S` / `T` in the state machine panel          |
| Fish stranding, tribe splits, wizard channels                | the three special `lanes` under the states    |
| Kinds (normal / tough / special) or new species              | `SP`, `N`, `#kinds`, and `crop_sprites.py`    |
| The win condition                                            | the `#rule` text at the top right             |

Also check `FelecoChangelog.TIPS`: the ticker repeats several of the same facts.

## 2. If sprite art changed, re-crop

    python scripts/dev/poster/crop_sprites.py

This writes `img/` from `assets/sprites/*.png`: male and female of the normal
kind, plus the human builder and wizard and the mushroom.

## 3. Render

From `scripts/dev/poster/`:

    Start-Process "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" -Wait -ArgumentList @(
      "--headless=new","--disable-gpu","--hide-scrollbars","--user-data-dir=$env:TEMP\edge-poster",
      "--allow-file-access-from-files","--force-device-scale-factor=1.5","--window-size=1920,1080",
      "--virtual-time-budget=3000","--screenshot=$PWD\poster.png",
      "file:///D:/coding-projects/Feleco/scripts/dev/poster/poster.html")

Open `poster.png` and check:
- no label sits on top of an arrow head or another label;
- every arrow ends on the node it means to reach;
- the bottom centre (about x 760–1160, y 990–1075 at 1920×1080) stays empty for the Play button, and the strip above it is free for the tips ticker.

## 4. Install

    python -c "from PIL import Image; Image.open('poster.png').convert('RGB').resize((2400,1350), Image.LANCZOS).save(r'../../../assets/ui/ecosystem_poster.png', optimize=True)"

Keep the size at 2400×1350. The dust effect samples the poster on a 192×108
grain grid (`GRID` in `loading_screen.gd`), so any 16:9 size works, but larger
images cost download size on the web.

## 5. Verify in game

    godot --path . res://scenes/dev/shots.tscn -- --out=<dir> --scene=world --poster --play=4 --times=3.5,4.4,5.3

Shot 0 is the poster with Play, shot 1 the dust mid-flight, shot 2 the valley.

## 6. Ship

Note the poster change in `FelecoChangelog.CHANGELOG`, then follow the normal
release steps (`gen_stats.py`, export, copy into the dva site, commit, push).
