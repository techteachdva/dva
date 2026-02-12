# Dungeon Class Deployment Fixes

## 1. API is now in dva

The `api/` folder with the leaderboard is now in this project. When you push to Vercel, the API will be at:
**https://dva-nu.vercel.app/api/leaderboard**

## 2. Use your latest game export (Refresh button + leaderboard)

Your dva build downloads the `.pck` file from `DUNGEONCLASS_PCK_URL` during build. If that env var points to an **old** release, you'll get the old game (no refresh button, old leaderboard).

**To use your latest export:**

1. **Export from Godot** (Project → Export → Web) – this writes files to `dva/src/site/dungeonclass/`
2. **Remove or clear** `DUNGEONCLASS_PCK_URL` in Vercel:
   - Vercel dashboard → Your project → Settings → Environment Variables
   - Delete `DUNGEONCLASS_PCK_URL` (or leave it empty)
3. **Push** – the build will use the exported `.pck` in the repo

**If you keep DUNGEONCLASS_PCK_URL:** it must point to a GitHub Release (or similar) that contains your **newest** `.pck` with the refresh button and leaderboard.

## 3. Upstash Redis (leaderboard storage)

Add these to Vercel Environment Variables:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Without these, the API returns empty and cannot save scores.
