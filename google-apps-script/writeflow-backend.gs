/**
 * WriteFlow Studio — Google Sheets backend
 *
 * SETUP:
 * 1. Create a Google Sheet (e.g. "WriteFlow Submissions")
 * 2. Extensions → Apps Script → paste this file → Save
 * 3. Set SPREADSHEET_ID below
 * 4. Run initSheet once (authorize when prompted)
 * 5. Deploy → New deployment → Web app (Execute as: Me, Anyone)
 * 6. Vercel env: WRITEFLOW_SCRIPT_URL = web app URL
 * 7. Vercel env: WRITEFLOW_API_SECRET = match API_SECRET below
 *
 * Sheets:
 *   Submissions — student writing rows (one row per submission)
 *   Assignments — teacher passwords per assignment ID (synced from builder)
 */

const SPREADSHEET_ID = normalizeSheetId_("PASTE_YOUR_SHEET_ID_HERE");
const SUBMISSIONS_SHEET = "Submissions";
const ASSIGNMENTS_SHEET = "Assignments";
const API_SECRET = "studentsfirst";

/** Auto-generated from api/diagnostic-writing/classes.json — run: npm run sync:classrooms */
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
  "Mrs. Eckart 6th Grade ELA",
  "Mrs. McCarthy 7th Grade ELA",
  "Mrs. Severson 8th Grade ELA",
  "Teacher's Lounge",
];

/** Auto-generated from api/diagnostic-writing/classroom-codes.json */
const CLASSROOM_CODES = {
  "Tech: Media Arts": "media",
  "Tech 6-A-2": "variable",
  "Tech 7-A-4": "function",
  "Mr. Phil's Advisory": "advisory",
  "Tech 6-A-5": "loop",
  "Tech 7-A-6": "binary",
  "Tech: Video Production": "frame",
  "Tech 8-B-2": "pixel",
  "Tech: Game Design": "sprite",
  "Tech 7-B-5": "debug",
  "Tech 6-B-6": "input",
  "Mrs. Eckart 6th Grade ELA": "eclipse",
  "Mrs. McCarthy 7th Grade ELA": "metaphor",
  "Mrs. Severson 8th Grade ELA": "syntax",
  "Teacher's Lounge": "coffee",
};

function normalizeSheetId_(raw) {
  const s = String(raw || "").trim();
  const match = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  return s.split("/")[0].split("?")[0].split("#")[0];
}

function normalizeClassroom_(value) {
  return String(value || "").trim().replace(/[\u2018\u2019\u201B\u2032]/g, "'");
}

function normalizeClassCode_(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
}

function resolveClassroom_(value) {
  const norm = normalizeClassroom_(value);
  if (!norm) return "";
  for (var i = 0; i < VALID_CLASSROOMS.length; i++) {
    if (normalizeClassroom_(VALID_CLASSROOMS[i]) === norm) return VALID_CLASSROOMS[i];
  }
  return "";
}

function verifyClassroomCode_(classroom, code) {
  const expected = CLASSROOM_CODES[classroom];
  if (!expected) return false;
  return normalizeClassCode_(code) === normalizeClassCode_(expected);
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getSubmissionsSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(SUBMISSIONS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(SUBMISSIONS_SHEET);
    initSubmissionHeaders_(sheet);
  }
  return sheet;
}

function getAssignmentsSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(ASSIGNMENTS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(ASSIGNMENTS_SHEET);
    initAssignmentHeaders_(sheet);
  }
  return sheet;
}

function initSubmissionHeaders_(sheet) {
  sheet.getRange(1, 1, 1, 12).setValues([[
    "id", "submittedAt", "assignmentId", "name", "classroom",
    "durationSec", "wordCount", "wpm", "typingLevel", "overall", "storyText", "analysisJson",
  ]]);
  sheet.getRange(1, 1, 1, 12).setFontWeight("bold");
  sheet.setFrozenRows(1);
}

function initAssignmentHeaders_(sheet) {
  sheet.getRange(1, 1, 1, 4).setValues([["assignmentId", "teacherPassword", "title", "updatedAt"]]);
  sheet.getRange(1, 1, 1, 4).setFontWeight("bold");
  sheet.setFrozenRows(1);
}

function initSheet() {
  initSubmissionHeaders_(getSubmissionsSheet_());
  initAssignmentHeaders_(getAssignmentsSheet_());
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
      const assignmentId = String(params.assignmentId || "").trim();
      const password = String(params.password || "");
      if (!assignmentId) return respond_({ error: "Missing assignmentId" });
      if (!verifyAssignmentPassword_(assignmentId, password)) {
        return respond_({ error: "Unauthorized" });
      }
      return respond_({
        submissions: listSubmissions_(assignmentId),
        classrooms: VALID_CLASSROOMS,
        classroomCodes: CLASSROOM_CODES,
      });
    }

    if (action === "registerAssignment") {
      registerAssignment_(params);
      return respond_({ ok: true, assignmentId: String(params.assignmentId || "") });
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

function verifyAssignmentPassword_(assignmentId, password) {
  const sheet = getAssignmentsSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  const numRows = lastRow - 1;
  const rows = sheet.getRange(2, 1, numRows, 2).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === assignmentId) {
      return String(rows[i][1]) === String(password);
    }
  }
  return false;
}

function registerAssignment_(params) {
  const assignmentId = String(params.assignmentId || "").trim().slice(0, 80);
  const teacherPassword = String(params.teacherPassword || "").slice(0, 80);
  const title = String(params.title || "").trim().slice(0, 200);
  if (!assignmentId || !teacherPassword) {
    throw new Error("Missing assignmentId or teacherPassword");
  }

  const sheet = getAssignmentsSheet_();
  const lastRow = sheet.getLastRow();
  var targetRow = -1;
  if (lastRow >= 2) {
    const numRows = lastRow - 1;
    const ids = sheet.getRange(2, 1, numRows, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === assignmentId) {
        targetRow = i + 2;
        break;
      }
    }
  }

  const row = [assignmentId, teacherPassword, title, Date.now()];
  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, 4).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
}

function listSubmissions_(assignmentId) {
  const sheet = getSubmissionsSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const numRows = lastRow - 1;
  const values = sheet.getRange(2, 1, numRows, 12).getValues();
  const submissions = [];

  for (let i = values.length - 1; i >= 0; i--) {
    const row = values[i];
    if (!row[0] || String(row[2]) !== assignmentId) continue;
    let analysis = {};
    try {
      analysis = JSON.parse(row[11] || "{}");
    } catch (ignore) {
      analysis = { scores: { overall: Number(row[9]) || 0 }, typingLevel: String(row[8] || "") };
    }
    submissions.push({
      id: String(row[0]),
      submittedAt: Number(row[1]) || 0,
      assignmentId: String(row[2]),
      name: String(row[3]),
      classroom: String(row[4]),
      durationSec: Number(row[5]) || 0,
      text: String(row[10] || ""),
      analysis: analysis,
    });
  }
  return submissions;
}

function saveSubmission_(params) {
  const assignmentId = String(params.assignmentId || "").trim().slice(0, 80);
  const name = String(params.name || "").trim().slice(0, 80);
  const classroom = resolveClassroom_(params.classroom);
  const classCode = String(params.classCode || "");
  const text = String(params.text || "").trim().slice(0, 15000);
  const analysis = params.analysis || {};
  const durationSec = Number(params.durationSec);

  if (!assignmentId || !name || !text || !analysis) {
    throw new Error("Missing required fields");
  }
  if (params.classroom && !classroom) {
    throw new Error("Invalid classroom");
  }
  if (classroom && !verifyClassroomCode_(classroom, classCode)) {
    throw new Error("Incorrect class code for the selected classroom.");
  }

  const entry = {
    id: String(Date.now()) + "-" + Math.random().toString(36).slice(2, 9),
    submittedAt: Date.now(),
    assignmentId: assignmentId,
    name: name,
    classroom: classroom || "",
    durationSec: isFinite(durationSec) ? durationSec : 300,
    text: text,
    analysis: analysis,
  };

  const scores = entry.analysis.scores || {};
  const sheet = getSubmissionsSheet_();
  sheet.appendRow([
    entry.id,
    entry.submittedAt,
    entry.assignmentId,
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
