# Physix deploy (dva → Vercel)

## Layout

| Path | Purpose |
|------|---------|
| `src/site/physix/` | Static web shell served at `/physix/` |
| `scripts/download-physix.js` | Vercel build: downloads release binaries → `physix.pck` / `physix.wasm` |
| Godot export preset | `../dva/src/site/physix/_godot_export/physix.html` (does **not** overwrite `physix.html`) |
| `scripts/validate-physix-shell.js` | Fails CI/Vercel build if `physix.html` still has `$GODOT_*` placeholders |

## After Godot Web export

1. Export Web from Godot (writes to `_godot_export/`, not `physix.html`).
2. Run `.\scripts\sync-physix-export.ps1` to copy `physix.js`, worklets, and icons into `src/site/physix/`.
3. **Never** commit `physix.html` containing `$GODOT_BASENAME` — that breaks the site (`404` on `$GODOT_BASENAME.js`, `Engine is not defined`). The deployed shell must use `<script src="physix.js"></script>`.
4. Update `fileSizes` in the checked-in `physix.html` if pck/wasm sizes changed.
5. Commit JS/icons/shell only (not `.pck` / `.wasm`).

Or run from `dva` repo root:

```powershell
.\scripts\sync-physix-export.ps1
```

## GitHub Release (required for Vercel)

Upload **all six** files from the **same** Web export to [releases](https://github.com/techteachdva/dva/releases) (e.g. tag `v1.0`):

- `physix.pck`, `physix.wasm`, `physix.side.wasm`
- `physix.js`, `physix.audio.worklet.js`, `physix.audio.position.worklet.js`

Vercel downloads these at build time so `physix.js` always matches `physix.wasm`. Mixing an old `physix.js` from git with new wasm on the release causes `LinkError: emscripten_webgl_create_context`. Missing `physix.side.wasm` causes silent audio.

**Sanity check (match Crystal Wizards):** With `extensions_support=true` (required for web audio worklets), `physix.wasm` is ~35–40 MB and you may need **`physix.side.wasm`** on the release + `PHYSIX_SIDE_WASM_URL` in Vercel. A ~1–2 MB wasm is an old non-extensions build and audio will not work.

**Export preset (Physix project):** `variant/extensions_support=true`, `variant/thread_support=true`, `ensure_cross_origin_isolation_headers=true` — same class of build as Crystal Wizards, not the minimal Dungeon Class shell.

## Vercel environment variables

In **Vercel → Project → Settings → Environment Variables**, set **full HTTPS URLs** (no quotes, not `localhost`, not a path-only value):

| Name | Example value |
|------|----------------|
| `PHYSIX_PCK_URL` | `https://github.com/techteachdva/dva/releases/download/v1.0/physix.pck` |
| `PHYSIX_WASM_URL` | `https://github.com/techteachdva/dva/releases/download/v1.0/physix.wasm` |
| `PHYSIX_SIDE_WASM_URL` | **Required** for web audio — same release tag, `physix.side.wasm` (from the same export as `physix.wasm`) |

Apply to **Production**, **Preview**, and **Development** if you deploy from all of them.

**Common build error:** `connect ECONNREFUSED 127.0.0.1:80` means the env var points at localhost (often copied from a local `.env`). Delete or replace those values with the GitHub URLs above. The download script also falls back to the v1.0 release URLs when it detects localhost.

**Optional:** leave all three unset — the build uses the same default GitHub URLs. Set `PHYSIX_SKIP_DOWNLOAD=true` only if you commit binaries locally (not recommended).

Release asset names can be `index.pck` / `index.wasm`; the URL must be the real download link. The build script always saves files as `physix.pck` / `physix.wasm` in `src/site/physix/`.

## `.gitignore`

Binaries under `src/site/physix/*.pck` and `*.wasm` must stay ignored so git never stores them (Vercel fetches at build time).
