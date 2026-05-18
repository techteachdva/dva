# Physix deploy (dva → Vercel)

**New Godot games / web audio:** see [GODOT_WEB_AUDIO.txt](./GODOT_WEB_AUDIO.txt) for a first-time checklist (shell, AudioManager, releases, common silent-audio fixes).

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
3. **Never** copy Godot’s `physix.html` into `src/site/physix/` — only edit **`physix.shell.html`**. Vercel runs `restore-physix-shell` to generate `physix.html` before deploy.
4. Commit `physix.shell.html` + JS/worklets/icons (not `.pck` / `.wasm`).

Or run from `dva` repo root:

```powershell
.\scripts\sync-physix-export.ps1
```

## Safari (macOS / iOS)

Safari often crashes **multi-threaded** Godot 4.6 web builds (`Blocking on the main thread`, then `Out of bounds memory access` from pthreads). Physix uses **`thread_support=false`** in the Web export preset so the same binaries work in Safari and Chrome.

After changing the preset, **re-export Web**, upload a **new** GitHub release (e.g. `v1.1`), point Vercel env URLs at that tag, and `git push` the updated `physix.shell.html`. Until then, Safari users see a clear shell message instead of a silent crash.

The `WEBGL_polygon_mode` warning in Safari is harmless.

## Godot 4.6 file sizes (normal)

With **extensions_support** (and **thread_support** off for Physix), Godot 4.6 often produces:

| File | Typical size |
|------|----------------|
| `physix.wasm` | **~1–2 MB** (loader stub) |
| `physix.side.wasm` | **~35–40 MB** (main engine) |
| `physix.pck` | **~50–65 MB** |

A **1 MB `physix.wasm` is correct** if `physix.side.wasm` is large. Vercel must download **both** from the release. A missing or tiny `physix.side.wasm` breaks the game/audio.

```powershell
# After Godot Web export (extensions on):
.\scripts\upload-physix-release.ps1 -ExportDir "C:\Users\phili\OneDrive\Desktop\Physix\exports"
# or: -ExportDir "C:\Users\phili\OneDrive\Desktop\dva\src\site\physix\_godot_export"
```

Requires [GitHub CLI](https://cli.github.com/) (`gh auth login`). Retries uploads; more reliable than the browser.

## GitHub Release (required for Vercel)

Upload **all six** files from the **same** Web export to [releases](https://github.com/techteachdva/dva/releases) (e.g. tag `v1.0`):

- `physix.pck`, `physix.wasm`, `physix.side.wasm`
- `physix.js`, `physix.audio.worklet.js`, `physix.audio.position.worklet.js`

Vercel downloads these at build time so `physix.js` always matches `physix.wasm`. Mixing an old `physix.js` from git with new wasm on the release causes `LinkError: emscripten_webgl_create_context`. Missing `physix.side.wasm` causes silent audio.

**Sanity check:** `physix.js` must reference `.side.wasm`, and **`physix.side.wasm` on the release must be ~35–40 MB**. Do not replace `physix.wasm` with a huge monolithic file from an older Godot export mental model.

**Export preset (Physix project):** `variant/extensions_support=true`, `variant/thread_support=false` (Safari-safe), `ensure_cross_origin_isolation_headers=true`. Crystal Wizards still uses threads; Physix does not.

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

## `.gitignore` (do not commit binaries)

`physix.pck`, `physix.wasm`, and `physix.side.wasm` are ignored. Vercel downloads them from the GitHub release at build time.

If GitHub warns about a 50+ MB `physix.pck` on push, the file was **tracked before** it was ignored. Fix once:

```powershell
cd C:\Users\phili\OneDrive\Desktop\dva
npm run untrack:physix
git add .gitignore scripts/
git commit -m "Stop tracking Physix binaries; keep on GitHub release only"
git push
```

Optional: block future accidents (run once per clone):

```powershell
git config core.hooksPath .githooks
```

Then `git commit` runs `check:physix-binaries` and rejects staged `.pck` / `.wasm` files.
