# Tech Escape — High Score Setup

Global leaderboard uses the same pattern as **Summer Writing** and **About Mr. Phil votes**: Google Sheets + Apps Script + Vercel API proxy.

## 1. Google Sheet

1. Create a new Google Sheet named **Tech Escape High Scores**.
2. Copy the spreadsheet ID from the URL (`/d/SPREADSHEET_ID/edit`).

## 2. Apps Script

1. In the sheet: **Extensions → Apps Script**.
2. Delete any default code and paste **`google-apps-script/tech-escape-highscores-backend.gs`** from this repo.
3. Set `SPREADSHEET_ID` at the top (paste your sheet ID or full URL).
4. Set `API_SECRET` if you want something other than `studentsfirst`.
5. **Save** the project.
6. Run **`initSheet`** once from the editor (authorize when prompted).
7. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
8. Copy the **Web app URL** (ends with `/exec`).

## 3. Vercel environment variables

In the Vercel project for **dva-nu**:

| Variable | Value |
|----------|--------|
| `TECH_ESCAPE_HIGHSCORES_SCRIPT_URL` | Web app URL from step 2 |
| `TECH_ESCAPE_HIGHSCORES_API_SECRET` | Same as `API_SECRET` in the script |

Redeploy after adding env vars.

## 4. Verify

```bash
curl "https://dva-nu.vercel.app/api/tech-escape-highscores"
```

You should get `{ "scores": [] }` (or a list). If not configured: `setupRequired: true`.

## 5. In-game

- After **win or loss**, enter **first name** (≤16 letters) + **last initial**, then **POST SCORE**.
- **Title screen → High Scores** shows the top 100.
- Only the top 100 rows are kept in the sheet (sorted by score, then faster time).

## Scoring (summary)

| Factor | Effect |
|--------|--------|
| Escape | Large base bonus + speed bonus |
| Loss | Points for code pieces + survival time |
| First-try answers | +280 each |
| Accuracy | Up to +1600 |
| Items / combat | Cheetos, soda, batteries, throws, mice popped, viruses killed |
| Flashlight time | Up to ~10 minutes credited |
| Decrypt flips | Bonus for fewer card flips |
| Damage | −130 per hit |
| Floor | Higher floors add bonus |
| Difficulty | BEGINNER ×0.75 … SYSTEM CRASH ×1.35 |

Scores and breakdown JSON are stored per row for teacher review.
