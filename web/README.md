# Physix Web Export

This folder holds the Godot HTML5 export files for Vercel hosting.

## Setup

1. In Godot, go to **Project > Export** and add a **Web** preset.
2. Make sure **Extensions > GDExtension** is unchecked (or ensure Jolt works on web).
3. Export to this `web/` folder.
4. Commit the small files (`index.html`, `index.js`, any `.worker.js`, `.audio.worklet.js`) to git.
5. **Do NOT commit** `index.pck` or `index.wasm` — they are ignored by `.gitignore`.

## Hosting on Vercel

1. Upload your `index.pck` and `index.wasm` to a **GitHub Release** (or any direct-download URL).
2. In the Vercel dashboard, set these environment variables:
   - `PHYSIX_PCK_URL` — direct URL to the `.pck` file
   - `PHYSIX_WASM_URL` — direct URL to the `.wasm` file
3. Push this repo to GitHub and link it to Vercel.
4. Vercel will run `npm run build`, which executes `scripts/download-physix.js` to pull the binaries into `web/` before deploying.

## Local Testing

You can test the download script locally:

```bash
PHYSIX_PCK_URL=https://... PHYSIX_WASM_URL=https://... npm run build
```

Then serve `web/` with any static server.
