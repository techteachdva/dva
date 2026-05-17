# Physix Web Export

Godot exports land in **`dva/src/site/physix/`** (see Physix project export preset).

## After exporting from Godot

1. Export **Web** to `../dva/src/site/physix/physix.html` (relative to the Physix Godot project).
2. **Keep** the checked-in `physix.html` shell: AudioContext patch, **Click to play**, and `serviceWorker` in `GODOT_CONFIG`. If Godot overwrites `physix.html`, merge those pieces back from git.
3. Update `fileSizes` in `GODOT_CONFIG` to match the new export (pck/wasm byte counts in the fresh export HTML).
4. Commit the small files: `physix.js`, `physix.audio.*.js`, `physix.manifest.json`, `physix.service.worker.js`, icons, etc.
5. **Do not commit** `physix.pck` or `physix.wasm` — they are in `.gitignore`.

## Vercel / GitHub Release

1. Upload `physix.pck` and `physix.wasm` to a **GitHub Release** on `techteachdva/dva`.
2. In Vercel → Environment Variables:
   - `PHYSIX_PCK_URL` — direct download URL to the `.pck` asset
   - `PHYSIX_WASM_URL` — direct download URL to the `.wasm` asset
   - `PHYSIX_SIDE_WASM_URL` — optional, if the export uses extensions / side module
3. `npm run build` runs `scripts/download-physix.js`, which saves them as `physix.pck` / `physix.wasm` under `src/site/physix/`.

Release asset names can be `index.pck` / `index.wasm`; URLs only need to point at the files — the build script renames them locally to `physix.*`.
