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

Use the **Web Release** export preset in Physix (not **Web**) for production — it omits editor, bot, level backups, and `LevelFactory` from the `.pck`. See `Physix/docs/EXPORT.md`.

1. Export **Web Release** from Godot (writes to `_godot_export/`, not `physix.html`).
2. Run `.\scripts\sync-physix-export.ps1` to copy `physix.js`, worklets, and icons into `src/site/physix/`.
3. **Never** copy Godot’s `physix.html` into `src/site/physix/` — only edit **`physix.shell.html`**. Vercel runs `restore-physix-shell` to generate `physix.html` before deploy.
4. Commit `physix.shell.html` + JS/worklets/icons (not `.pck` / `.wasm`).

Or run from `dva` repo root:

```powershell
.\scripts\sync-physix-export.ps1
```

## Safari (macOS / iOS)

Safari often crashes **multi-threaded** Godot 4.6 web builds (`Blocking on the main thread`, then `Out of bounds memory access` from pthreads). The site serves two exports:

- **Chrome, Edge, Firefox:** `Web Release` with `thread_support=true` and `extensions_support=false` (`physix.wasm` + `physix.js` in the site root).
- **Safari and iOS:** `Web Safe` with both flags off (`safe/physix.wasm` + `safe/physix.js`). The shell picks this build. One shared `physix.pck`.

`physix.shell.html` stretches a 1280×720 canvas across the window. Do not turn Extensions Support back on; that was the 5 MB linker script and the 39 MB `physix.side.wasm`.

The `WEBGL_polygon_mode` warning in Safari is harmless.

## Godot 4.6 file sizes (normal)

With **extensions_support off**, Godot 4.6 produces one engine wasm, not a side module:

| File | Typical size |
|------|----------------|
| `physix.wasm` | **~35 MB** (threaded engine) |
| `safe/physix.wasm` | **~36 MB** (Safari engine) |
| `physix.pck` | **~16 MB** on the Web Release preset |
| `physix.js` | **~0.3 MB** |

There is no `physix.side.wasm`. A 1 MB `physix.wasm` is the old GDExtension stub and will not run this shell.

```powershell
# After exporting Web Release and Web Safe from Godot:
.\scripts\upload-physix-release.ps1 -ExportDir "D:\coding-projects\dva\src\site\physix\_godot_export"
```

Requires [GitHub CLI](https://cli.github.com/) (`gh auth login`). Retries uploads; more reliable than the browser.

## GitHub Release (required for Vercel)

Upload one tag (the build default is `v1.3-web`) with:

- `physix.pck`, `physix.wasm`, `physix.js`, `physix.audio.worklet.js`, `physix.audio.position.worklet.js`
- `physix.safe.wasm`, `physix.safe.js`, `physix.safe.audio.worklet.js`, `physix.safe.audio.position.worklet.js`

`physix.js` must come from the same export as `physix.wasm`. The safe files come from the Web Safe export. Do not upload `physix.side.wasm`.

**Export presets:** Web Release is `extensions_support=false`, `thread_support=true`. Web Safe is both false. Canvas resize policy is Project (1280×720), stretched by the shell.

## Vercel environment variables

In **Vercel → Project → Settings → Environment Variables**, set **full HTTPS URLs** (no quotes, not `localhost`, not a path-only value):

| Name | Example value |
|------|----------------|
| `PHYSIX_PCK_URL` | `https://github.com/techteachdva/dva/releases/download/v1.3-web/physix.pck` |
| `PHYSIX_WASM_URL` | `https://github.com/techteachdva/dva/releases/download/v1.3-web/physix.wasm` |
| `PHYSIX_JS_URL` | `https://github.com/techteachdva/dva/releases/download/v1.3-web/physix.js` |
| `PHYSIX_SAFE_WASM_URL` | `https://github.com/techteachdva/dva/releases/download/v1.3-web/physix.safe.wasm` |
| `PHYSIX_SAFE_JS_URL` | `https://github.com/techteachdva/dva/releases/download/v1.3-web/physix.safe.js` |

Leave them unset to use the `v1.3-web` defaults in `scripts/download-physix.js`. Delete any old `PHYSIX_SIDE_WASM_URL`.

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
