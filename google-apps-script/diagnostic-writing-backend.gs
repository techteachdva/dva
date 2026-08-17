/**
 * Summer Writing Diagnostic — Google Sheets backend
 *
 * SETUP (about 10 minutes):
 * 1. Create a new Google Sheet (e.g. "Summer Writing Submissions")
 * 2. Extensions → Apps Script → paste this file → Save
 * 3. Set SPREADSHEET_ID below (from the sheet URL)
 * 4. Run initSheet once (authorize when prompted)
 * 5. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. Copy the Web app URL into Vercel env: DIAGNOSTIC_WRITING_SCRIPT_URL
 * 7. Set DIAGNOSTIC_API_SECRET in Vercel to match API_SECRET below
 */

const SPREADSHEET_ID = normalizeSheetId_("PASTE_YOUR_SHEET_ID_HERE");
const SHEET_NAME = "Submissions";
const TEACHER_PASSWORD = "studentsfirst";
const API_SECRET = "studentsfirst";

/** Use only the ID between /d/ and /edit in the sheet URL. */
function normalizeSheetId_(raw) {
  const s = String(raw || "").trim();
  const match = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  return s.split("/")[0].split("?")[0].split("#")[0];
}

/** Keep in sync with api/diagnostic-writing/classes.json */
const VALID_CLASSROOMS = [
  "Tech: Media Arts",
  "Tech 6-A-2",
  "Tech 7-A-4",
  "Mr. Phil's Advisory",
  "Tech 6-A-5",
  "Tech 7-A-6",
  "Tech: Video Production",
  "Tech 8-B-2",
  "Tech: Game Design",
  "Tech 7-B-5",
  "Tech 6-B-6",
  "Mrs. McCarthy 7th Grade ELA",
  "Mrs. Severson 8th Grade ELA",
  "Mrs. Eckart 6th Grade ELA",
];

function getSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    initHeaders_(sheet);
  }
  return sheet;
}

function initHeaders_(sheet) {
  sheet
    .getRange(1, 1, 1, 11)
    .setValues([[
      "id",
      "submittedAt",
      "name",
      "classroom",
      "durationSec",
      "wordCount",
      "wpm",
      "typingLevel",
      "overall",
      "storyText",
      "analysisJson",
    ]]);
  sheet.getRange(1, 1, 1, 11).setFontWeight("bold");
  sheet.setFrozenRows(1);
}

function initSheet() {
  initHeaders_(getSheet_());
}

function doGet(e) {
  return handle_(e, true);
}

function doPost(e) {
  return handle_(e, false);
}

function handle_(e, isGet) {
  try {
    const params = isGet ? (e && e.parameter) || {} : JSON.parse((e && e.postData && e.postData.contents) || "{}");

    if (String(params.secret || "") !== API_SECRET) {
      return respond_({ error: "Unauthorized" });
    }

    const action = String(params.action || (isGet ? "list" : "save"));

    if (action === "list") {
      if (String(params.password || "") !== TEACHER_PASSWORD) {
        return respond_({ error: "Unauthorized" });
      }
      return respond_({ submissions: listSubmissions_(), classrooms: VALID_CLASSROOMS });
    }

    if (action === "save") {
      const entry = saveSubmission_(params);
      return respond_({ ok: true, id: entry.id });
    }

    return respond_({ error: "Unknown action" });
  } catch (err) {
    return respond_({ error: String(err.message || err) });
  }
}

function listSubmissions_() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow, 11).getValues();
  const submissions = [];

  for (let i = values.length - 1; i >= 0; i--) {
    const row = values[i];
    if (!row[0] || !row[2]) continue;
    let analysis = {};
    try {
      analysis = JSON.parse(row[10] || "{}");
    } catch (ignore) {
      analysis = { scores: { overall: Number(row[8]) || 0 }, typingLevel: String(row[7] || "") };
    }
    submissions.push({
      id: String(row[0]),
      submittedAt: Number(row[1]) || 0,
      name: String(row[2]),
      classroom: String(row[3]),
      durationSec: Number(row[4]) || 0,
      text: String(row[9] || ""),
      analysis: analysis,
    });
  }

  return submissions;
}

function saveSubmission_(params) {
  const name = String(params.name || "").trim().slice(0, 80);
  const classroom = String(params.classroom || "").trim();
  const text = String(params.text || "").trim().slice(0, 15000);
  const analysis = params.analysis || {};
  const durationSec = Number(params.durationSec);

  if (!name || !classroom || !text || !analysis) {
    throw new Error("Missing required fields");
  }
  if (VALID_CLASSROOMS.indexOf(classroom) === -1) {
    throw new Error("Invalid classroom");
  }

  const entry = {
    id: String(Date.now()) + "-" + Math.random().toString(36).slice(2, 9),
    submittedAt: Date.now(),
    name: name,
    classroom: classroom,
    durationSec: isFinite(durationSec) ? durationSec : 300,
    text: text,
    analysis: analysis,
  };

  const scores = entry.analysis.scores || {};
  const sheet = getSheet_();
  sheet.appendRow([
    entry.id,
    entry.submittedAt,
    entry.name,
    entry.classroom,
    entry.durationSec,
    entry.analysis.wordCount || 0,
    entry.analysis.wpm || 0,
    entry.analysis.typingLevel || "",
    scores.overall || 0,
    entry.text,
    JSON.stringify(entry.analysis),
  ]);

  return entry;
}

function respond_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
