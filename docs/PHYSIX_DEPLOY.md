# Physix deploy (dva → Vercel)

## Layout

| Path | Purpose |
|------|---------|
| `src/site/physix/` | Static web shell served at `/physix/` |
| `scripts/download-physix.js` | Vercel build: downloads release binaries → `physix.pck` / `physix.wasm` |
| Godot export preset | `../dva/src/site/physix/physix.html` (from Physix project) |

## After Godot Web export

1. Export to `dva/src/site/physix/` (or copy `physix.js` + `physix.audio.*.js` from `Physix/exports/`).
2. **Do not replace** `physix.html` entirely — keep AudioContext patch, **Click to play**, and `serviceWorker` in `GODOT_CONFIG`.
3. Update `fileSizes` in `physix.html` to match the new `.pck` / `.wasm` byte sizes (from the export HTML or file properties).
4. Commit JS/shell/manifest/worker files only (not `.pck` / `.wasm`).

Or run from `dva` repo root:

```powershell
.\scripts\sync-physix-export.ps1
```

## GitHub Release (required for Vercel)

Upload **`physix.pck`** and **`physix.wasm`** from the same export to [releases](https://github.com/techteachdva/dva/releases) (e.g. tag `v1.0`).

**Sanity check (match Crystal Wizards):** With `extensions_support=true` (required for web audio worklets), `physix.wasm` is ~35–40 MB and you may need **`physix.side.wasm`** on the release + `PHYSIX_SIDE_WASM_URL` in Vercel. A ~1–2 MB wasm is an old non-extensions build and audio will not work.

**Export preset (Physix project):** `variant/extensions_support=true`, `variant/thread_support=true`, `ensure_cross_origin_isolation_headers=true` — same class of build as Crystal Wizards, not the minimal Dungeon Class shell.

## Vercel environment variables

```
PHYSIX_PCK_URL=https://github.com/techteachdva/dva/releases/download/v1.0/physix.pck
PHYSIX_WASM_URL=https://github.com/techteachdva/dva/releases/download/v1.0/physix.wasm
```

URLs can point to `index.pck` / `index.wasm` on the release; the build script always writes `physix.pck` / `physix.wasm` locally.

## `.gitignore`

Binaries under `src/site/physix/*.pck` and `*.wasm` must stay ignored so git never stores them (Vercel fetches at build time).
