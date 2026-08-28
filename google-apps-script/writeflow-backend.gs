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
 *   Assignments — teacher assignments (config, owner, shared flag)
 *   Teachers — teacher usernames and passwords (admin-managed)
 *   Sessions — login tokens
 */

const SPREADSHEET_ID = normalizeSheetId_("1qzyvkmUlavabIq5VPgxornjIwKL0devWijH0kYmvSV4");
const SUBMISSIONS_SHEET = "Submissions";
const ASSIGNMENTS_SHEET = "Assignments";
const TEACHERS_SHEET = "Teachers";
const SESSIONS_SHEET = "Sessions";
const API_SECRET = "studentsfirst";
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

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
  } else {
    ensureAssignmentColumns_(sheet);
  }
  return sheet;
}

function getTeachersSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(TEACHERS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(TEACHERS_SHEET);
    initTeacherHeaders_(sheet);
  }
  return sheet;
}

function getSessionsSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(SESSIONS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(SESSIONS_SHEET);
    initSessionHeaders_(sheet);
  }
  return sheet;
}

function ensureAssignmentColumns_(sheet) {
  if (sheet.getLastColumn() < 8) {
    initAssignmentHeaders_(sheet);
  }
}

function normalizeUsername_(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 40);
}

function normalizeAssignmentId_(value) {
  return String(value || "").trim();
}

function assignmentIdMatches_(a, b) {
  return normalizeAssignmentId_(a).toLowerCase() === normalizeAssignmentId_(b).toLowerCase();
}

function passwordsMatch_(stored, provided) {
  return String(stored || "").trim() === String(provided || "").trim();
}

function normalizeDisplayName_(value) {
  return String(value || "").trim().slice(0, 80);
}

function columnIndexToLetter_(column) {
  var letter = "";
  var temp = 0;
  var col = column;
  while (col > 0) {
    temp = (col - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    col = Math.floor((col - 1) / 26);
  }
  return letter || "A";
}

/** Data rows 2…lastRow via A1 notation (avoids numRows vs endRow ambiguity in getRange). */
function readSheetDataRows_(sheet, minCols) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var lastCol = Math.max(minCols || 1, sheet.getLastColumn());
  if (lastCol < 1) lastCol = 1;
  return sheet.getRange("A2:" + columnIndexToLetter_(lastCol) + lastRow).getValues();
}

function getTeacherByUsername_(username) {
  const norm = normalizeUsername_(username);
  if (!norm) return null;
  const sheet = getTeachersSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const rows = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (normalizeUsername_(rows[i][0]) === norm) {
      return {
        username: norm,
        password: String(rows[i][1] || ""),
        displayName: normalizeDisplayName_(rows[i][2]) || norm,
        createdAt: Number(rows[i][3]) || 0,
      };
    }
  }
  return null;
}

function verifyTeacherLogin_(username, password) {
  const teacher = getTeacherByUsername_(username);
  if (!teacher) return null;
  if (String(teacher.password) !== String(password)) return null;
  return teacher;
}

function registerTeacher_(username, password, displayName) {
  const norm = normalizeUsername_(username);
  const pw = String(password || "").slice(0, 80);
  const name = normalizeDisplayName_(displayName) || norm;
  if (!norm || norm.length < 3) throw new Error("Username must be at least 3 characters (letters, numbers, dots, dashes).");
  if (!pw || pw.length < 4) throw new Error("Password must be at least 4 characters.");
  if (getTeacherByUsername_(norm)) throw new Error("That username is already taken.");
  getTeachersSheet_().appendRow([norm, pw, name, Date.now()]);
  return getTeacherByUsername_(norm);
}

function createSessionToken_() {
  return Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "").slice(0, 8);
}

function createSession_(teacher) {
  purgeExpiredSessions_();
  const token = createSessionToken_();
  const now = Date.now();
  getSessionsSheet_().appendRow([token, teacher.username, now, now + SESSION_TTL_MS]);
  return { token: token, username: teacher.username, displayName: teacher.displayName, expiresAt: now + SESSION_TTL_MS };
}

function purgeExpiredSessions_() {
  const sheet = getSessionsSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const now = Date.now();
  const rows = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  for (var i = rows.length - 1; i >= 0; i--) {
    if (Number(rows[i][3]) < now) {
      sheet.deleteRow(i + 2);
    }
  }
}

function validateSession_(token) {
  const v2 = validateSessionV2_(token);
  if (v2) return v2;
  const clean = String(token || "").trim();
  if (!clean) return null;
  purgeExpiredSessions_();
  const sheet = getSessionsSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const rows = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  const now = Date.now();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) !== clean) continue;
    if (Number(rows[i][3]) < now) return null;
    const teacher = getTeacherByUsername_(rows[i][1]);
    if (!teacher) return null;
    return { username: teacher.username, displayName: teacher.displayName, token: clean, role: "teacher", effectiveUsername: teacher.username };
  }
  return null;
}

function revokeSession_(token) {
  const clean = String(token || "").trim();
  if (!clean) return;
  const sheet = getSessionsSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const rows = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i][0]) === clean) sheet.deleteRow(i + 2);
  }
}

function readAssignmentRows_() {
  return readSheetDataRows_(getAssignmentsSheet_(), 8);
}

function assignmentSummaryFromRow_(row) {
  return {
    assignmentId: String(row[0] || ""),
    title: String(row[2] || ""),
    updatedAt: Number(row[3]) || 0,
    ownerUsername: String(row[5] || ""),
    shared: String(row[6] || "").toUpperCase() === "TRUE",
    authorDisplayName: String(row[7] || "") || String(row[5] || ""),
  };
}

function listAssignmentsForOwner_(username) {
  const norm = normalizeUsername_(username);
  const out = [];
  const rows = readAssignmentRows_();
  for (var i = 0; i < rows.length; i++) {
    if (normalizeUsername_(rows[i][5]) !== norm) continue;
    out.push(assignmentSummaryFromRow_(rows[i]));
  }
  out.sort(function (a, b) { return b.updatedAt - a.updatedAt; });
  return out;
}

function listSharedAssignments_() {
  const out = [];
  const rows = readAssignmentRows_();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][6] || "").toUpperCase() !== "TRUE") continue;
    out.push(assignmentSummaryFromRow_(rows[i]));
  }
  out.sort(function (a, b) { return b.updatedAt - a.updatedAt; });
  return out;
}

function userOwnsAssignment_(username, assignmentId) {
  const rows = readAssignmentRows_();
  for (var i = 0; i < rows.length; i++) {
    if (!assignmentIdMatches_(rows[i][0], assignmentId)) continue;
    return normalizeUsername_(rows[i][5]) === normalizeUsername_(username);
  }
  return false;
}

function copyAssignmentForUser_(session, sourceAssignmentId, newAssignmentId, newTitle) {
  const sourceId = String(sourceAssignmentId || "").trim().slice(0, 80);
  const newId = String(newAssignmentId || "").trim().slice(0, 80);
  if (!sourceId || !newId) throw new Error("Missing assignment id.");
  if (sourceId === newId) throw new Error("Choose a different id for your copy.");

  const rows = readAssignmentRows_();
  var sourceRow = null;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === sourceId) {
      sourceRow = rows[i];
      break;
    }
  }
  if (!sourceRow) throw new Error("Source assignment not found.");
  const isShared = String(sourceRow[6] || "").toUpperCase() === "TRUE";
  const isOwner = normalizeUsername_(sourceRow[5]) === session.username;
  if (!isShared && !isOwner) throw new Error("You do not have permission to copy this assignment.");

  for (var j = 0; j < rows.length; j++) {
    if (String(rows[j][0]) === newId) throw new Error("That assignment id is already in use.");
  }

  const rawJson = String(sourceRow[4] || "").trim();
  if (!rawJson) throw new Error("Source assignment has no saved config.");
  var config = {};
  try {
    config = JSON.parse(rawJson);
  } catch (ignore) {
    throw new Error("Source assignment config is invalid.");
  }

  const title = String(newTitle || config.title || sourceRow[2] || newId).trim().slice(0, 200);
  config.id = newId;
  config.title = title;
  config.shared = false;
  config.ownerUsername = session.username;
  const teacherPassword = String(config.teacherPassword || "").slice(0, 80) || ("wf" + Math.random().toString(36).slice(2, 10));
  config.teacherPassword = teacherPassword;

  registerAssignment_({
    assignmentId: newId,
    teacherPassword: teacherPassword,
    title: title,
    configJson: JSON.stringify(config),
    ownerUsername: session.username,
    shared: false,
    authorDisplayName: session.displayName,
    sessionToken: session.token,
  });

  return { assignmentId: newId, title: title, config: config, teacherPassword: teacherPassword };
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
  sheet.getRange(1, 1, 1, 8).setValues([[
    "assignmentId", "teacherPassword", "title", "updatedAt", "configJson",
    "ownerUsername", "shared", "authorDisplayName",
  ]]);
  sheet.getRange(1, 1, 1, 8).setFontWeight("bold");
  sheet.setFrozenRows(1);
}

function initTeacherHeaders_(sheet) {
  sheet.getRange(1, 1, 1, 4).setValues([["username", "password", "displayName", "createdAt"]]);
  sheet.getRange(1, 1, 1, 4).setFontWeight("bold");
  sheet.setFrozenRows(1);
}

function initSessionHeaders_(sheet) {
  sheet.getRange(1, 1, 1, 4).setValues([["token", "username", "createdAt", "expiresAt"]]);
  sheet.getRange(1, 1, 1, 4).setFontWeight("bold");
  sheet.setFrozenRows(1);
}

function initSheet() {
  initSubmissionHeaders_(getSubmissionsSheet_());
  initAssignmentHeaders_(getAssignmentsSheet_());
  initTeacherHeaders_(getTeachersSheet_());
  initSessionHeaders_(getSessionsSheet_());
  initAuthSheets_();
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
      const session = validateSession_(params.sessionToken);
      if (!assignmentId) return respond_({ error: "Missing assignmentId" });
      if (!verifyAssignmentPassword_(assignmentId, password, session)) {
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
      const publicConfig = stripPublicAssignmentConfig_(assignment.config);
      return respond_({ ok: true, assignmentId: assignmentId, title: assignment.title, config: publicConfig });
    }

    if (action === "listSharedAssignments") {
      return respond_({ ok: true, assignments: listSharedAssignments_() });
    }

    if (action === "teacherValidate") {
      const session = validateSession_(params.sessionToken);
      if (!session) return respond_({ error: "Invalid session" });
      return respond_({
        ok: true,
        username: session.username,
        displayName: session.displayName,
        role: session.role || "teacher",
        mustChangePassword: session.mustChangePassword || false,
      });
    }

    if (action === "studentValidate") {
      const session = validateSessionV2_(params.sessionToken);
      if (!session || session.role !== "student") return respond_({ error: "Invalid session" });
      const roster = findRosterEntry_(session.username);
      const student = getStudentByUsername_(session.username);
      return respond_({
        ok: true,
        username: session.username,
        displayName: session.displayName,
        role: "student",
        classroom: roster ? roster.classroom : (student ? student.classroom : ""),
        mustChangePassword: session.mustChangePassword || false,
      });
    }

    if (action === "adminValidate") {
      const session = validateSessionV2_(params.sessionToken);
      if (!session || session.role !== "admin") return respond_({ error: "Invalid session" });
      return respond_({
        ok: true,
        username: session.username,
        displayName: session.displayName,
        role: "admin",
        impersonateAs: session.impersonateAs || "",
      });
    }

    if (action === "checkStudentUsername") {
      return respond_({ ok: true, ...checkStudentUsername_(params.username) });
    }

    if (action === "listMySubmissions") {
      const session = validateSessionV2_(params.sessionToken);
      if (!session || session.role !== "student") return respond_({ error: "Invalid session" });
      return respond_({ ok: true, submissions: listStudentSubmissions_(session.effectiveUsername) });
    }

    if (action === "adminStats") {
      const session = validateSessionV2_(params.sessionToken);
      if (!session || session.role !== "admin") return respond_({ error: "Admin access required" });
      return respond_({ ok: true, stats: adminGetStats_() });
    }

    if (action === "adminListAllSubmissions") {
      const session = validateSessionV2_(params.sessionToken);
      if (!session || session.role !== "admin") return respond_({ error: "Admin access required" });
      return respond_({ ok: true, submissions: listAllSubmissions_() });
    }

    if (action === "listMyAssignments") {
      const session = validateSession_(params.sessionToken);
      if (!session) return respond_({ error: "Invalid session" });
      return respond_({ ok: true, assignments: listAssignmentsForOwner_(session.username) });
    }

    if (action === "registerAssignment") {
      registerAssignment_(params);
      return respond_({ ok: true, assignmentId: String(params.assignmentId || "") });
    }

    if (action === "save") {
      const entry = saveSubmission_(params);
      return respond_({
        ok: true,
        id: entry.id,
        attemptNumber: entry.attemptNumber,
        attemptsUsed: entry.attemptsUsed,
        maxAttempts: entry.maxAttempts,
        canRetry: entry.canRetry,
      });
    }

    if (action === "saveSubmissionGrade") {
      const result = saveSubmissionGrade_(params);
      return respond_({ ok: true, grading: result });
    }

    if (action === "saveGradesBulk") {
      const result = saveGradesBulk_(params);
      return respond_({ ok: true, saved: result.saved, results: result.results, errors: result.errors });
    }

    if (action === "setCountedSubmission") {
      const result = setCountedSubmission_(params);
      return respond_({ ok: true, counted: result });
    }

    if (action === "updateBulk") {
      const session = validateSessionV2_(params.sessionToken);
      if (!session || session.role !== "admin") return respond_({ error: "Admin access required" });
      const assignmentId = String(params.assignmentId || "").trim();
      if (!assignmentId) return respond_({ error: "Missing assignmentId" });
      const result = updateSubmissionsBulk_(assignmentId, params.updates || []);
      return respond_({ ok: true, updated: result.updated, errors: result.errors });
    }

    if (action === "teacherLogin") {
      const teacher = verifyTeacherLoginV2_(params.username, params.password);
      if (!teacher) return respond_({ error: "Invalid username or password." });
      const session = createSessionV2_({
        username: teacher.username,
        displayName: teacher.displayName,
        role: "teacher",
        effectiveUsername: teacher.username,
      });
      return respond_({ ok: true, session: session });
    }

    if (action === "teacherRegister") {
      return respond_({ error: "Use email verification signup. Click Create account in Studio." });
    }

    if (action === "teacherRequestVerification") {
      const result = teacherRequestVerification_(params.email, params.username, params.displayName);
      return respond_(result);
    }

    if (action === "teacherCompleteRegistration") {
      const session = teacherCompleteRegistration_(params.email, params.username, params.password, params.displayName, params.code);
      return respond_({ ok: true, session: session });
    }

    if (action === "studentLogin") {
      const session = studentLogin_(params.username, params.password);
      return respond_({ ok: true, session: session });
    }

    if (action === "studentSetPassword") {
      const session = studentSetPassword_(params.sessionToken, params.newPassword);
      return respond_({ ok: true, session: session });
    }

    if (action === "adminLogin") {
      const session = adminLogin_(params.username, params.password);
      return respond_({ ok: true, session: session });
    }

    if (action === "adminImpersonate") {
      const session = adminImpersonate_(params.sessionToken, params.targetUsername, params.targetRole);
      return respond_({ ok: true, session: session });
    }

    if (action === "adminDedupeSubmissions") {
      const session = validateSessionV2_(params.sessionToken);
      if (!session || session.role !== "admin") return respond_({ error: "Admin access required" });
      return respond_({ ok: true, ...adminDedupeSubmissions_() });
    }

    if (action === "adminListTeachers") {
      const session = validateSessionV2_(params.sessionToken);
      if (!session || session.role !== "admin") return respond_({ error: "Admin access required" });
      return respond_({ ok: true, teachers: adminListTeachers_() });
    }

    if (action === "adminListStudents") {
      const session = validateSessionV2_(params.sessionToken);
      if (!session || session.role !== "admin") return respond_({ error: "Admin access required" });
      return respond_({ ok: true, students: adminListRegisteredStudents_() });
    }

    if (action === "adminListClassRoster") {
      const session = validateSessionV2_(params.sessionToken);
      if (!session || session.role !== "admin") return respond_({ error: "Admin access required" });
      return respond_({ ok: true, roster: adminListClassRoster_() });
    }

    if (action === "adminBackfillStudentCreatedAt") {
      const session = validateSessionV2_(params.sessionToken);
      if (!session || session.role !== "admin") return respond_({ error: "Admin access required" });
      return respond_({ ok: true, ...adminBackfillStudentCreatedAt_() });
    }

    if (action === "adminAddRosterEntry") {
      const session = validateSessionV2_(params.sessionToken);
      if (!session || session.role !== "admin") return respond_({ error: "Admin access required" });
      const entry = adminAddRosterEntry_(params.classroom, params.username);
      return respond_({ ok: true, entry: entry });
    }

    if (action === "adminPreviewUsernameCleanup") {
      const session = validateSessionV2_(params.sessionToken);
      if (!session || session.role !== "admin") return respond_({ error: "Admin access required" });
      return respond_({ ok: true, ...adminPreviewUsernameCleanup_() });
    }

    if (action === "adminApplyUsernameCleanup") {
      const session = validateSessionV2_(params.sessionToken);
      if (!session || session.role !== "admin") return respond_({ error: "Admin access required" });
      const applyLow = params.applyLowConfidence === true;
      return respond_({ ok: true, ...adminApplyUsernameCleanup_(applyLow) });
    }

    if (action === "teacherLogout") {
      revokeSession_(params.sessionToken);
      return respond_({ ok: true });
    }

    if (action === "copyAssignment") {
      const session = validateSession_(params.sessionToken);
      if (!session) return respond_({ error: "Invalid session" });
      const copied = copyAssignmentForUser_(
        session,
        params.sourceAssignmentId,
        params.newAssignmentId,
        params.newTitle
      );
      return respond_({ ok: true, assignmentId: copied.assignmentId, title: copied.title, config: copied.config });
    }

    return respond_({ error: "Unknown action" });
  } catch (err) {
    return respond_({ error: String(err.message || err) });
  }
}

function verifyAssignmentPassword_(assignmentId, password, session) {
  const targetId = normalizeAssignmentId_(assignmentId);
  if (!targetId) return false;
  if (session && session.role === "admin") return true;
  if (session && userOwnsAssignment_(session.username, targetId)) return true;
  const rows = readAssignmentRows_();
  for (var i = 0; i < rows.length; i++) {
    if (!assignmentIdMatches_(rows[i][0], targetId)) continue;
    return passwordsMatch_(rows[i][1], password);
  }
  return false;
}

function stripPublicAssignmentConfig_(config) {
  const next = config && typeof config === "object" ? Object.assign({}, config) : {};
  delete next.teacherPassword;
  delete next.heroImageData;
  return next;
}

function registerAssignment_(params) {
  const assignmentId = String(params.assignmentId || "").trim().slice(0, 80);
  const teacherPassword = String(params.teacherPassword || "").slice(0, 80);
  const title = String(params.title || "").trim().slice(0, 200);
  const rawConfigJson = String(params.configJson || "").slice(0, 45000);
  var configJson = rawConfigJson;
  if (rawConfigJson) {
    try {
      const parsed = JSON.parse(rawConfigJson);
      configJson = JSON.stringify(stripPublicAssignmentConfig_(parsed)).slice(0, 45000);
    } catch (ignore) {
      configJson = rawConfigJson;
    }
  }
  if (!assignmentId || !teacherPassword) {
    throw new Error("Missing assignmentId or teacherPassword");
  }

  var ownerUsername = normalizeUsername_(params.ownerUsername);
  var authorDisplayName = normalizeDisplayName_(params.authorDisplayName);
  const session = validateSession_(params.sessionToken);
  if (session) {
    ownerUsername = session.username;
    authorDisplayName = session.displayName;
  }
  const shared = params.shared === true || String(params.shared).toUpperCase() === "TRUE";

  const sheet = getAssignmentsSheet_();
  const lastRow = sheet.getLastRow();
  var targetRow = -1;
  if (lastRow >= 2) {
    const numRows = lastRow - 1;
    const ids = sheet.getRange(2, 1, numRows, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (assignmentIdMatches_(ids[i][0], assignmentId)) {
        targetRow = i + 2;
        break;
      }
    }
  }

  if (targetRow > 0) {
    const existingOwner = normalizeUsername_(sheet.getRange(targetRow, 6).getValue());
    if (existingOwner && (!session || session.username !== existingOwner)) {
      throw new Error("This assignment belongs to another teacher. Sign in to edit it.");
    }
  }

  const row = [
    assignmentId,
    teacherPassword,
    title,
    Date.now(),
    configJson,
    ownerUsername,
    shared ? "TRUE" : "FALSE",
    authorDisplayName || ownerUsername,
  ];
  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, 8).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
}

function getAssignmentConfig_(assignmentId) {
  const rows = readAssignmentRows_();
  for (var i = 0; i < rows.length; i++) {
    if (!assignmentIdMatches_(rows[i][0], assignmentId)) continue;
    const rawJson = String(rows[i][4] || "").trim();
    if (!rawJson) return null;
    var config = {};
    try {
      config = JSON.parse(rawJson);
    } catch (ignore) {
      return null;
    }
    config.ownerUsername = String(rows[i][5] || "");
    config.shared = String(rows[i][6] || "").toUpperCase() === "TRUE";
    config.authorDisplayName = String(rows[i][7] || "") || config.ownerUsername;
    return {
      title: String(rows[i][2] || ""),
      config: config,
      ownerUsername: String(rows[i][5] || ""),
      shared: String(rows[i][6] || "").toUpperCase() === "TRUE",
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
    const values = readSheetDataRows_(submissionsSheet, 12);
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
  ensureSubmissionGradingColumns_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const colCount = Math.max(19, sheet.getLastColumn());
  const values = readSheetDataRows_(sheet, colCount);
  const submissions = [];

  for (let i = values.length - 1; i >= 0; i--) {
    const row = values[i];
    if (!row[0] || !assignmentIdMatches_(row[2], assignmentId)) continue;
    const analysis = parseSubmissionAnalysis_(row);
    const grading = parseSubmissionGrading_(row);
    const attempts = parseSubmissionAttempts_(row);
    const storyText = normalizeSubmissionText_(row);
    submissions.push({
      id: String(row[0]),
      submittedAt: Number(row[1]) || 0,
      assignmentId: String(row[2]),
      name: String(row[3]),
      classroom: String(row[4]),
      durationSec: Number(row[5]) || 0,
      text: storyText,
      textUnavailable: !storyText && looksLikeAnalysisJson_(row[10]),
      analysis: analysis,
      studentUsername: String(row[12] || ""),
      teacherGrade: grading.teacherGrade,
      teacherFeedback: grading.teacherFeedback,
      feedbackVisible: grading.feedbackVisible,
      gradedAt: grading.gradedAt,
      attemptNumber: attempts.attemptNumber,
      countsForGrade: attempts.countsForGrade,
    });
  }
  return submissions;
}

function listAllSubmissions_() {
  const sheet = getSubmissionsSheet_();
  ensureSubmissionGradingColumns_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const colCount = Math.max(19, sheet.getLastColumn());
  const values = readSheetDataRows_(sheet, colCount);
  const submissions = [];
  const titleCache = {};

  function assignmentTitle(assignmentId) {
    const key = String(assignmentId || "").trim();
    if (!key) return "";
    if (titleCache[key] !== undefined) return titleCache[key];
    const assignment = getAssignmentConfig_(key);
    titleCache[key] = assignment ? String(assignment.title || key) : key;
    return titleCache[key];
  }

  for (let i = values.length - 1; i >= 0; i--) {
    const row = values[i];
    if (!row[0]) continue;
    const analysis = parseSubmissionAnalysis_(row);
    const grading = parseSubmissionGrading_(row);
    const attempts = parseSubmissionAttempts_(row);
    const assignmentId = String(row[2]);
    const storyText = normalizeSubmissionText_(row);
    submissions.push({
      id: String(row[0]),
      submittedAt: Number(row[1]) || 0,
      assignmentId: assignmentId,
      assignmentTitle: assignmentTitle(assignmentId),
      name: String(row[3]),
      classroom: String(row[4]),
      durationSec: Number(row[5]) || 0,
      textPreview: storyText ? storyText.slice(0, 400) : "",
      textTruncated: storyText.length > 400,
      textUnavailable: !storyText && looksLikeAnalysisJson_(row[10]),
      analysis: analysis,
      studentUsername: String(row[12] || ""),
      teacherGrade: grading.teacherGrade,
      teacherFeedback: grading.teacherFeedback,
      feedbackVisible: grading.feedbackVisible,
      gradedAt: grading.gradedAt,
      attemptNumber: attempts.attemptNumber,
      countsForGrade: attempts.countsForGrade,
    });
  }
  return submissions;
}

function saveSubmission_(params) {
  const assignmentId = String(params.assignmentId || "").trim().slice(0, 80);
  const classroom = resolveClassroom_(params.classroom);
  const classCode = String(params.classCode || "");
  const text = String(params.text || "").trim().slice(0, 15000);
  const analysis = params.analysis || {};
  const durationSec = Number(params.durationSec);
  const rosterStudent = resolveSubmissionStudent_(params);
  const name = rosterStudent.username;

  if (!assignmentId || !text || !analysis) {
    throw new Error("Missing required fields");
  }
  if (params.classroom && !classroom) {
    throw new Error("Invalid classroom");
  }
  const requireClassCode = params.requireClassCode !== false;
  if (classroom && requireClassCode && !verifyClassroomCode_(classroom, classCode)) {
    throw new Error("Incorrect class code for the selected classroom.");
  }

  const entry = {
    id: String(Date.now()) + "-" + Math.random().toString(36).slice(2, 9),
    submittedAt: Date.now(),
    assignmentId: assignmentId,
    name: name,
    classroom: classroom || rosterStudent.classroom || "",
    studentUsername: rosterStudent.username,
    durationSec: isFinite(durationSec) ? durationSec : 300,
    text: text,
    analysis: analysis,
  };

  const scores = entry.analysis.scores || {};
  const sheet = getSubmissionsSheet_();
  ensureSubmissionStudentColumn_(sheet);
  ensureSubmissionAttemptColumns_(sheet);
  const studentKey = normalizeStudentUsername_(entry.studentUsername || entry.name).toLowerCase();
  const retryMeta = getAssignmentGradingMeta_(assignmentId);
  const priorAttempts = countStudentAttemptsForAssignment_(sheet, assignmentId, studentKey);
  if (priorAttempts > 0) {
    if (!retryMeta.allowRetries) {
      throw new Error("This assignment allows only one submission.");
    }
    if (!retryMeta.retriesOpen) {
      throw new Error("Revision round is not open yet. Wait for your teacher to open it.");
    }
    if (priorAttempts >= retryMeta.maxAttempts) {
      throw new Error("You have used all " + retryMeta.maxAttempts + " attempts for this assignment.");
    }
  }
  const attemptNumber = priorAttempts + 1;
  const countsForGrade = attemptNumber === 1 && retryMeta.maxAttempts === 1;
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
    entry.studentUsername || entry.name,
    "",
    "",
    "FALSE",
    "",
    attemptNumber,
    countsForGrade ? "TRUE" : "FALSE",
  ]);

  return {
    id: entry.id,
    attemptNumber: attemptNumber,
    attemptsUsed: attemptNumber,
    maxAttempts: retryMeta.maxAttempts,
    canRetry: retryMeta.allowRetries && retryMeta.retriesOpen && attemptNumber < retryMeta.maxAttempts,
  };
}

function writeSubmissionAnalysisToRow_(sheet, row, analysis) {
  const scores = analysis.scores || {};
  sheet.getRange(row, 7, 1, 4).setValues([[
    analysis.wordCount || 0,
    analysis.wpm || 0,
    analysis.typingLevel || "",
    scores.overall || 0,
  ]]);
  sheet.getRange(row, 12).setValue(JSON.stringify(analysis));
}

function looksLikeAnalysisJson_(value) {
  const s = String(value || "").trim();
  if (!s || s.charAt(0) !== "{") return false;
  return s.indexOf('"scores"') !== -1 || s.indexOf('"feedback"') !== -1;
}

function normalizeSubmissionText_(row) {
  const text = String(row[10] || "");
  if (!looksLikeAnalysisJson_(text)) return text;
  return "";
}

function parseSubmissionAnalysis_(row) {
  const storyCol = String(row[10] || "");
  const analysisCol = String(row[11] || "");
  if (looksLikeAnalysisJson_(storyCol)) {
    try {
      return JSON.parse(storyCol);
    } catch (ignore) {}
  }
  try {
    return JSON.parse(analysisCol || "{}");
  } catch (ignore) {
    return { scores: { overall: Number(row[9]) || 0 }, typingLevel: String(row[8] || "") };
  }
}

function updateSubmissionsBulk_(assignmentId, updates) {
  const sheet = getSubmissionsSheet_();
  const result = { updated: 0, errors: [] };
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    result.errors.push({ id: "", error: "No submissions in sheet" });
    return result;
  }
  if (!updates || !updates.length) return result;

  const colCount = Math.max(19, sheet.getLastColumn());
  const values = readSheetDataRows_(sheet, colCount);
  const idToRow = {};
  for (var i = 0; i < values.length; i++) {
    const row = values[i];
    const id = String(row[0] || "").trim();
    if (!id) continue;
    if (!assignmentIdMatches_(row[2], assignmentId)) continue;
    idToRow[id] = i + 2;
  }

  for (var j = 0; j < updates.length; j++) {
    const entry = updates[j] || {};
    const id = String(entry.id || "").trim();
    const analysis = entry.analysis || {};
    const row = idToRow[id];
    if (!row) {
      result.errors.push({ id: id, error: "Submission not found for this assignment" });
      continue;
    }
    if (!analysis || typeof analysis !== "object") {
      result.errors.push({ id: id, error: "Missing analysis" });
      continue;
    }
    try {
      writeSubmissionAnalysisToRow_(sheet, row, analysis);
      result.updated++;
    } catch (err) {
      result.errors.push({ id: id, error: String(err.message || err) });
    }
  }
  return result;
}

function respond_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
