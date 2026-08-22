# WriteFlow Setup (teachers)

WriteFlow stores student submissions online so any teacher can view results from any device.

**Live guide:** [/writeflow/setup/](/writeflow/setup/)

---

## For teachers

If you use an already-connected WriteFlow site (e.g. Mr. Phil's), you do **not** need Google Apps Script, Vercel, or any technical setup.

1. Open [WriteFlow Studio](/writeflow/studio/)
2. Click **New assignment** and build your assignment (prompt, timer, teacher password)
3. Click **Save assignment** and wait for confirmation
4. Share the **student link** only: `/writeflow/a/?id=your-assignment-id`
5. View submissions via **Results** with your assignment teacher password

If students see "assignment not found," re-save the assignment in Studio.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "Cloud storage is not configured" | Contact your site administrator |
| "Assignment not found" | Re-save assignment in Studio |
| "Incorrect teacher password" | Re-save assignment with the intended password |
| "Incorrect class code" | Student must use correct class + code |

---

## Site administrators

Backend connection steps (Google Sheets, Apps Script, Vercel) are **not** published on the public site. See the local admin folder on the site owner's desktop:

`Desktop/writeflow-admin-setup/`
