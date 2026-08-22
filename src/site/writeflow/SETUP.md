# WriteFlow Google Sheets Setup

WriteFlow stores student submissions in Google Sheets so any teacher can view results from any device.

**Live guide for teachers and admins:** [/writeflow/setup/](/writeflow/setup/)

---

## For teachers (no technical setup)

If you use an already-connected WriteFlow site (e.g. Mr. Phil's), you do **not** need Google Apps Script or Vercel.

1. Open [WriteFlow Studio](/writeflow/studio/)
2. Click **Configure** and build your assignment (prompt, timer, teacher password)
3. Click **Save assignment** and wait for confirmation
4. Share the **student link** only: `/writeflow/a/?id=your-assignment-id`
5. View submissions via **Results** with your teacher password

If students see "assignment not found," re-save the assignment in Studio.

---

## For site administrators (one-time, ~15 minutes)

### A. Google Sheet

1. Create a Google Sheet (e.g. **WriteFlow Submissions**)
2. Copy the Sheet ID from the URL between `/d/` and `/edit`

### B. Apps Script

1. In the sheet: **Extensions → Apps Script**
2. Paste [`google-apps-script/writeflow-backend.gs`](../../google-apps-script/writeflow-backend.gs) (or [view on GitHub](https://github.com/techteachdva/dva/blob/main/google-apps-script/writeflow-backend.gs))
3. Set `SPREADSHEET_ID` at the top to your Sheet ID → Save
4. Run **`initSheet`** once (authorize when prompted)
5. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy the **Web app URL** (ends in `/exec`)

### C. Vercel

| Variable | Value |
|----------|--------|
| `WRITEFLOW_SCRIPT_URL` | Web app URL from step B5 |
| `WRITEFLOW_API_SECRET` | Same as `API_SECRET` in the script (default: `studentsfirst`) |

Redeploy the site. Test by saving an assignment in Studio and submitting as a student.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "Cloud storage is not configured" | Set `WRITEFLOW_SCRIPT_URL` on Vercel and redeploy |
| "Assignment not found" | Teacher re-saves assignment in Studio |
| "Incorrect teacher password" | Re-save assignment with the intended password |
| "Incorrect class code" | Student must use correct class + code; sync classrooms if admin |
| "Illegal spreadsheet id" | Fix `SPREADSHEET_ID`, run `initSheet`, new web app deployment |
| Wrong assignment on share link | Re-save after script update; check `configJson` column on Assignments tab |

## Class codes

Run `npm run sync:classrooms` after editing `api/diagnostic-writing/classes.json` to update site and Apps Script copies.
