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

const SPREADSHEET_ID = normalizeSheetId_("1qzyvkmUlavabIq5VPgxornjIwKL0devWijH0kYmvSV4");
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
  "Tech: Media Arts": "storyboard",
  "Tech 6-A-2": "variable",
  "Tech 7-A-4": "function",
  "Mr. Phil's Advisory": "dontbeagort",
  "Tech 6-A-5": "circuit",
  "Tech 7-A-6": "debugging",
  "Tech: Video Production": "lightscamera",
  "Tech 8-B-2": "prototype",
  "Tech: Game Design": "rollforit",
  "Tech 7-B-5": "iteration",
  "Tech 6-B-6": "binary",
  "Mrs. Eckart 6th Grade ELA": "narrative",
  "Mrs. McCarthy 7th Grade ELA": "revision",
  "Mrs. Severson 8th Grade ELA": "thesis",
  "Teacher's Lounge": "alwayslearning",
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

function assertSpreadsheetConfigured_() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === "PASTE_YOUR_SHEET_ID_HERE") {
    throw new Error(
      "WriteFlow Apps Script is not linked to a Google Sheet yet. " +
        "Open the script editor and set SPREADSHEET_ID to your sheet ID (the long string between /d/ and /edit in the sheet URL)."
    );
  }
}

function getSpreadsheet_() {
  assertSpreadsheetConfigured_();
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
  sheet.getRange(1, 1, 1, 5).setValues([["assignmentId", "teacherPassword", "title", "updatedAt", "configJson"]]);
  sheet.getRange(1, 1, 1, 5).setFontWeight("bold");
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

    if (action === "stats") {
      return respond_({ ok: true, stats: getStats_() });
    }

    if (action === "getAssignment") {
      const assignmentId = String(params.assignmentId || "").trim();
      if (!assignmentId) return respond_({ error: "Missing assignmentId" });
      const assignment = getAssignmentConfig_(assignmentId);
      if (!assignment) return respond_({ error: "Assignment not found" });
      return respond_({ ok: true, assignmentId: assignmentId, title: assignment.title, config: assignment.config });
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
  const configJson = String(params.configJson || "").slice(0, 45000);
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

  const row = [assignmentId, teacherPassword, title, Date.now(), configJson];
  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, 5).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
}

function getAssignmentConfig_(assignmentId) {
  const sheet = getAssignmentsSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const numRows = lastRow - 1;
  const rows = sheet.getRange(2, 1, numRows, 5).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) !== assignmentId) continue;
    const rawJson = String(rows[i][4] || "").trim();
    if (!rawJson) return null;
    var config = {};
    try {
      config = JSON.parse(rawJson);
    } catch (ignore) {
      return null;
    }
    return {
      title: String(rows[i][2] || ""),
      config: config,
    };
  }
  return null;
}

function countSentencesInText_(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return 0;
  return trimmed.split(/[.!?]+/).filter(function (part) {
    return String(part || "").trim().length > 0;
  }).length;
}

function getStats_() {
  const assignmentsSheet = getAssignmentsSheet_();
  const submissionsSheet = getSubmissionsSheet_();
  const assignmentLastRow = assignmentsSheet.getLastRow();
  const submissionLastRow = submissionsSheet.getLastRow();
  const assignments = Math.max(0, assignmentLastRow - 1);
  const classrooms = {};
  var submissions = 0;
  var sentences = 0;

  if (submissionLastRow >= 2) {
    const numRows = submissionLastRow - 1;
    const values = submissionsSheet.getRange(2, 1, numRows, 12).getValues();
    for (var i = 0; i < values.length; i++) {
      const row = values[i];
      if (!row[0]) continue;
      submissions += 1;
      const classroom = normalizeClassroom_(row[4]);
      if (classroom) classrooms[classroom] = true;
      var analysis = {};
      try {
        analysis = JSON.parse(row[11] || "{}");
      } catch (ignore) {}
      const sentenceCount = Number(analysis.sentenceCount);
      sentences += sentenceCount > 0 ? sentenceCount : countSentencesInText_(row[10]);
    }
  }

  return {
    classrooms: Object.keys(classrooms).length,
    assignments: assignments,
    submissions: submissions,
    sentences: sentences,
  };
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
