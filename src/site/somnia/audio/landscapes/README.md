# Landscape sound effects

Each landscape in Somnia has a short ambient sting played when a Dreamer **lands** on that tile or when you **select a Dreamer** (camera snaps to their hex).

## File layout

| Path | Purpose |
|------|---------|
| `../data/landscape-sfx.json` | Maps landscape `id` → audio file path |
| `audio/landscapes/<id>.wav` | One audio file per landscape (26 total; WAV or MP3) |

Landscape ids match `data/landscapes.json` (e.g. `bed`, `the-attic`, `wasteland`).

## Replace a sound

1. Export your replacement as **MP3 or WAV** (mono or stereo, ~0.5–2.5 s works well).
2. Save it as `audio/landscapes/<landscape-id>.wav` (or `.mp3`) using the exact id from `landscapes.json`.
3. Optionally update the `label` / `license` fields for that id in `data/landscape-sfx.json`.
4. Reload the game (hard refresh). No code changes required if the filename stays the same.

## Regenerate placeholders

Shipped placeholders are procedural tones (CC0). To rebuild them:

```bash
node scripts/generate-landscape-sfx.mjs
```

Requires [ffmpeg](https://ffmpeg.org/) on your PATH.

## Tips

- Keep peaks reasonable; landscape stings respect the **SFX volume** slider.
- Wasteland and hidden tiles use the `wasteland` id when face-down.
- Prefer CC0 or similarly permissive samples from [Freesound](https://freesound.org/) (filter by CC0).
