# Physix — Audio Assets

Place your audio files here. All paths are referenced in `scripts/autoloads/audio_manager.gd`.

---

## Music  (`assets/sounds/music/`)

| File | Used in | Notes |
|------|---------|-------|
| `menu_theme.ogg` | Main menu / world map | Upbeat, looping, ~2 min |
| `world1_theme.ogg` | World 1 levels | Bright & energetic |
| `world2_theme.ogg` | World 2 levels | Icy/cool tone |
| `world3_theme.ogg` | World 3 levels | Windy/atmospheric |
| `world4_theme.ogg` | World 4 levels | Magnetic/electric |
| `world5_theme.ogg` | World 5 levels | Epic/final world |

**Format**: OGG Vorbis, stereo, 44.1 kHz, ~160 kbps. Enable **Loop** in Godot import settings.

---

## SFX  (`assets/sounds/sfx/`)

| File | Triggered by | Notes |
|------|-------------|-------|
| `jump.wav` | Ball leaves ground | Short pop, ~0.1 s |
| `land.wav` | Ball lands | Short thud, ~0.15 s |
| `coin.wav` | Coin collected | Bright ding, ~0.2 s |
| `boost.wav` | Speed boost pad hit | Whoosh, ~0.3 s |
| `bump.wav` | Bumper hit | Impact + bounce, ~0.25 s |
| `brake.wav` | Brake pad hit | Screech, ~0.35 s |
| `checkpoint.wav` | Checkpoint triggered | Jingle, ~0.5 s |
| `level_complete.wav` | Finish zone entered | Fanfare, ~1.5 s |
| `unlock.wav` | Level/world unlocked | Sparkle, ~0.6 s |
| `death.wav` | Ball falls off track | Falling tone, ~0.8 s |
| `wind_loop.wav` | Inside wind zone (looping) | Soft whoosh loop |

**Format**: WAV (uncompressed) or OGG. Mono for SFX is fine. 44.1 kHz.

---

## Free sources
- [pixabay.com](https://pixabay.com) - search for more
- [freesound.org](https://freesound.org) — search under CC0/CC-BY licences
- [opengameart.org](https://opengameart.org) — dedicated game audio, many CC0
- [kenney.nl/assets](https://kenney.nl/assets) — "Interface Sounds" and "Sci-Fi Sounds" packs are CC0
