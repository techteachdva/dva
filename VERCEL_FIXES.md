# Vercel Build Failures – How to Fix

## Step 1: Find the actual error

1. Go to **[vercel.com](https://vercel.com)** → your project (dva-nu)
2. Open the **Deployments** tab
3. Click the **failed** deployment (red X)
4. Click **Building** or **View Build Logs**
5. Scroll to the bottom – the error message is usually in the last 20–30 lines

Common patterns:
- `Error: ...` or `failed: ...`
- `process.exit(1)` or `Command failed`
- `ENOENT` = file not found
- `404` or `Download failed` = download-pck URL is wrong

---

## Step 2: Common fixes

### Fix A: DUNGEONCLASS_PCK_URL is broken

If the build fails in `download-pck`:
- **Option 1:** Remove `DUNGEONCLASS_PCK_URL` from Vercel (Settings → Environment Variables). The build will use the `.pck` in your repo.
- **Option 2:** If you keep it, make sure the URL points to a real `.pck` file (e.g. a GitHub Release asset).

### Fix B: Out of memory

If you see `JavaScript heap out of memory`:
- Vercel already uses `NODE_OPTIONS=--max-old-space-size=4096` in the build. If it still fails, you may need a higher Vercel plan or to simplify the build.

### Fix C: Missing dependency

If you see `Cannot find module 'X'`:
- Run `npm install` locally and commit `package-lock.json`
- Ensure the dependency is in `package.json` (not only devDependencies if it’s needed at runtime)

### Fix D: API / serverless error

If the error is in the `api/` folder:
- Confirm `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set in Vercel
- Without these, the API will fail when it runs (but the build may still succeed)

---

## Step 3: Test the build locally

Before pushing, run:

```bash
cd c:\Users\Philip.Carroll\Documents\dva
npm install
npm run build
```

If it fails locally, you’ll see the same error. Fix it, then push again.

---

## What was changed

The `download-pck` script was updated so a failed download no longer fails the whole build. It will warn and continue, using the `.pck` file already in your repo.
