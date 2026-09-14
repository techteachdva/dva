# Somnia — High Scores & Cloud Saves Setup

Global leaderboard and cloud game saves use the same backend: **Google Sheets + Apps Script + Vercel API proxy**.

Until this is configured, `/api/somnia-highscores` and `/api/somnia-saves` return **502** errors in the browser.

## 1. Google Sheet

1. Create a new Google Sheet (e.g. **Somnia High Scores**).
2. Copy the spreadsheet ID from the URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`

## 2. Apps Script

1. In the sheet: **Extensions → Apps Script**.
2. Delete any default code and paste **`google-apps-script/somnia-highscores-backend.gs`** from this repo.
3. Set `SPREADSHEET_ID` at the top (paste your sheet ID or full sheet URL).
4. Set `API_SECRET` if you want something other than `studentsfirst` (must match Vercel).
5. **Save** the project.
6. Run **`initSheet`** once from the editor (authorize when prompted). This creates **HighScores** and **SavedGames** tabs.
7. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
8. Copy the **Web app URL** (must end with **`/exec`**, not `/dev`).

## 3. Vercel environment variables

In the Vercel project for **dva-nu**:

| Variable | Value |
|----------|--------|
| `SOMNIA_HIGHSCORES_SCRIPT_URL` | Web app `/exec` URL from step 2 |
| `SOMNIA_HIGHSCORES_API_SECRET` | Same as `API_SECRET` in the script |

**Redeploy** the site after adding or changing env vars.

## 4. Verify

```bash
curl "https://dva-nu.vercel.app/api/somnia-highscores"
curl "https://dva-nu.vercel.app/api/somnia-saves"
```

You should get `{ "scores": [] }` and `{ "saves": [] }`. If you see `setupRequired: true`, the env var is missing. If you see **502**, the script URL is wrong or the script was not deployed.

## 5. In-game

- **Leaderboard:** After a win, enter first name + last initial on the end screen.
- **Cloud save:** Pause menu → **Save** tab → enter the same name format → **Save to cloud**.
- **Device save:** Works without setup (local autosave in the browser).
- **itch.io / standalone:** Cloud save is unavailable; local saves only.

## SavedGames sheet

Each player name can store up to **5** cloud saves. Save data is gzip-compressed JSON in the `stateData` column (max ~50k characters per save).
