# WriteFlow Google Sheets Setup

WriteFlow stores student submissions in Google Sheets so any teacher can view results from any device. Each assignment has its own teacher password (set in the builder).

## One-time setup (~10 minutes)

1. **Create a Google Sheet** named e.g. `WriteFlow Submissions`.

2. **Open Apps Script:** Extensions → Apps Script → paste `google-apps-script/writeflow-backend.gs` → Save.

3. **Set `SPREADSHEET_ID`** in the script (the ID from your sheet URL between `/d/` and `/edit`).

4. **Run `initSheet`** once from the script editor (authorize when prompted). This creates two tabs:
   - `Submissions` — student writing rows
   - `Assignments` — teacher passwords, titles, and published assignment configs (`configJson` column)

   **Upgrading from an older script?** Add a fifth column header `configJson` on the `Assignments` tab, paste the updated script, and create a **new** web app deployment.

5. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**

6. **Vercel environment variables** (Project Settings → Environment Variables):
   - `WRITEFLOW_SCRIPT_URL` = the Web app URL from step 5
   - `WRITEFLOW_API_SECRET` = must match `API_SECRET` in the script (default: `studentsfirst`)

7. **Redeploy** the site on Vercel.

## Teacher workflow

1. Open **WriteFlow builder**: `/writeflow/?mode=builder`
2. Set assignment title, prompt, timer, and **teacher password**.
3. Click **Save assignment** — this saves locally and **publishes** the full assignment config to the `Assignments` sheet so share links work on any device.
4. Share the student link: `/writeflow/?id=YOUR-ASSIGNMENT-ID`
5. View results: **Results** button → enter the same teacher password.

**Important:** If you only saved before this update, open the builder and click **Save assignment** again so the config is published to the cloud.

## Student submissions

Students submit through the normal flow. Submissions include:
- Assignment ID, name, class, duration, full text, and analysis JSON.

## Class codes

Class validation uses the same lists as the Summer Writing Test (`api/diagnostic-writing/classes.json`). Run `npm run sync:classrooms` after editing classes to update both SWAT and WriteFlow Apps Script copies.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "Cloud storage is not configured" | Set `WRITEFLOW_SCRIPT_URL` on Vercel and redeploy |
| "Incorrect teacher password" | Re-save assignment in builder to sync password to `Assignments` sheet |
| "Unauthorized" on save | Check `WRITEFLOW_API_SECRET` matches script `API_SECRET` |
| "Illegal spreadsheet id" or `PASTE_YOUR_SHEET_ID_HERE` | In Apps Script line 18, paste your Sheet ID from the URL (`/d/SHEET_ID/edit`), save, run `initSheet`, redeploy web app |
| Share link shows default template | Re-save in builder after updating Apps Script; confirm `configJson` column exists |
| "Assignment not found online" | Teacher must click Save assignment while Google Sheets storage is connected |
