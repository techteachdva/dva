/**
 * WriteFlow auth — students, teachers, admin, sessions.
 * Deploy alongside writeflow-backend.gs in the same Apps Script project.
 */

const STUDENTS_SHEET = "Students";
const STUDENT_ROSTER_SHEET = "StudentRoster";
const APPROVED_TEACHERS_SHEET = "ApprovedTeachers";
const VERIFICATION_SHEET = "VerificationCodes";
const ADMIN_USERNAME = "admin";
const STUDENT_DEFAULT_PASSWORD = "SPARK";
const VERIFICATION_TTL_MS = 15 * 60 * 1000;

/** Auto-generated from api/writeflow/approved-teachers.json — run: npm run sync:writeflow-auth */
const APPROVED_TEACHER_EMAILS_EMBED = [
  "pcarroll@davincicharterschool.org",
  "afuhs@davincicharterschool.org",
  "sseverson@davincicharterschool.org",
  "jmccarthy@davincicharterschool.org",
  "deckart@davincicharterschool.org",
  "ssweeney@davincicharterschool.org",
  "eeggers@davincicharterschool.org",
  "varboleda@davincicharterschool.org",
  "jmurphy@davincicharterschool.org",
  "cschneider@davincicharterschool.org",
  "afohrman@davincicharterschool.org",
  "anguyen@davincicharterschool.org",
  "aschlag@davincicharterschool.org",
  "jsundgren@davincicharterschool.org",
  "mattclark@davincicharterschool.org",
  "ttweet@davincicharterschool.org",
  "twink@davincicharterschool.org",
];

function getAdminPassword_() {
  const props = PropertiesService.getScriptProperties();
  const fromProps = props.getProperty("WRITEFLOW_ADMIN_PASSWORD");
  if (fromProps) return String(fromProps);
  return "MNFlumph23";
}

function hashPassword_(password) {
  const raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    "writeflow-v1:" + String(password || "")
  );
  return "sha256:" + Utilities.base64Encode(raw);
}

function passwordsMatchStored_(stored, provided) {
  const s = String(stored || "");
  const p = String(provided || "");
  if (!s) return false;
  if (s.indexOf("sha256:") === 0) return s === hashPassword_(p);
  return s === p;
}

function normalizeStudentUsername_(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeEmail_(value) {
  return String(value || "").trim().toLowerCase();
}

function isTeacherEmailDomain_(email) {
  return normalizeEmail_(email).endsWith("@davincicharterschool.org");
}

function getStudentsSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(STUDENTS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(STUDENTS_SHEET);
    sheet.getRange(1, 1, 1, 5).setValues([["username", "password", "classroom", "mustChangePassword", "createdAt"]]);
    sheet.getRange(1, 1, 1, 5).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getStudentRosterSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(STUDENT_ROSTER_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(STUDENT_ROSTER_SHEET);
    sheet.getRange(1, 1, 1, 3).setValues([["classroom", "username", "active"]]);
    sheet.getRange(1, 1, 1, 3).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getApprovedTeachersSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(APPROVED_TEACHERS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(APPROVED_TEACHERS_SHEET);
    sheet.getRange(1, 1, 1, 2).setValues([["email", "active"]]);
    sheet.getRange(1, 1, 1, 2).setFontWeight("bold");
    sheet.setFrozenRows(1);
    seedApprovedTeachersFromEmbed_();
  }
  return sheet;
}

function getVerificationSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(VERIFICATION_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(VERIFICATION_SHEET);
    sheet.getRange(1, 1, 1, 5).setValues([["email", "code", "username", "displayName", "expiresAt"]]);
    sheet.getRange(1, 1, 1, 5).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function seedApprovedTeachersFromEmbed_() {
  const sheet = getApprovedTeachersSheet_();
  if (sheet.getLastRow() > 1) return;
  for (var i = 0; i < APPROVED_TEACHER_EMAILS_EMBED.length; i++) {
    sheet.appendRow([normalizeEmail_(APPROVED_TEACHER_EMAILS_EMBED[i]), "TRUE"]);
  }
}

function ensureSubmissionStudentColumn_(sheet) {
  if (sheet.getLastColumn() < 13) {
    sheet.getRange(1, 13).setValue("studentUsername");
    sheet.getRange(1, 13).setFontWeight("bold");
  }
}

function ensureSessionColumns_(sheet) {
  const colCount = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, Math.max(6, colCount)).getValues()[0];
  if (String(headers[2] || "").toLowerCase() !== "role") {
    sheet.getRange(1, 1, 1, 6).setValues([["token", "username", "role", "impersonateAs", "createdAt", "expiresAt"]]);
    sheet.getRange(1, 1, 1, 6).setFontWeight("bold");
  }
}

function ensureTeacherColumns_(sheet) {
  if (sheet.getLastColumn() < 6) {
    sheet.getRange(1, 1, 1, 6).setValues([["username", "password", "displayName", "email", "verified", "role"]]);
    sheet.getRange(1, 1, 1, 6).setFontWeight("bold");
  }
}

function initAuthSheets_() {
  getStudentsSheet_();
  getStudentRosterSheet_();
  getApprovedTeachersSheet_();
  getVerificationSheet_();
  ensureSubmissionStudentColumn_(getSubmissionsSheet_());
  ensureSessionColumns_(getSessionsSheet_());
  ensureTeacherColumns_(getTeachersSheet_());
}

function isApprovedTeacherEmail_(email) {
  const norm = normalizeEmail_(email);
  if (!norm || !isTeacherEmailDomain_(norm)) return false;
  const sheet = getApprovedTeachersSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    for (var i = 0; i < APPROVED_TEACHER_EMAILS_EMBED.length; i++) {
      if (normalizeEmail_(APPROVED_TEACHER_EMAILS_EMBED[i]) === norm) return true;
    }
    return false;
  }
  const rows = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  for (var j = 0; j < rows.length; j++) {
    if (normalizeEmail_(rows[j][0]) === norm && String(rows[j][1] || "").toUpperCase() === "TRUE") return true;
  }
  return false;
}

function findRosterEntry_(username) {
  const norm = normalizeStudentUsername_(username);
  if (!norm) return null;
  const sheet = getStudentRosterSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const rows = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][2] || "").toUpperCase() !== "TRUE") continue;
    const rowName = normalizeStudentUsername_(rows[i][1]);
    if (rowName.toLowerCase() === norm.toLowerCase()) {
      return { username: rowName, classroom: String(rows[i][0] || "") };
    }
  }
  return null;
}

function getStudentByUsername_(username) {
  const norm = normalizeStudentUsername_(username);
  if (!norm) return null;
  const sheet = getStudentsSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const rows = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (normalizeStudentUsername_(rows[i][0]).toLowerCase() === norm.toLowerCase()) {
      return {
        username: normalizeStudentUsername_(rows[i][0]),
        password: String(rows[i][1] || ""),
        classroom: String(rows[i][2] || ""),
        mustChangePassword: String(rows[i][3] || "").toUpperCase() === "TRUE",
        createdAt: Number(rows[i][4]) || 0,
      };
    }
  }
  return null;
}

function createStudentAccount_(rosterEntry, password) {
  getStudentsSheet_().appendRow([
    rosterEntry.username,
    hashPassword_(password),
    rosterEntry.classroom,
    "TRUE",
    Date.now(),
  ]);
  return getStudentByUsername_(rosterEntry.username);
}

function updateStudentPassword_(username, newPassword, clearMustChange) {
  const sheet = getStudentsSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error("Student account not found.");
  const norm = normalizeStudentUsername_(username).toLowerCase();
  for (var i = 2; i <= lastRow; i++) {
    const cell = normalizeStudentUsername_(sheet.getRange(i, 1).getValue()).toLowerCase();
    if (cell !== norm) continue;
    sheet.getRange(i, 2).setValue(hashPassword_(newPassword));
    if (clearMustChange) sheet.getRange(i, 4).setValue("FALSE");
    return getStudentByUsername_(username);
  }
  throw new Error("Student account not found.");
}

function createSessionV2_(principal) {
  purgeExpiredSessionsV2_();
  const token = createSessionToken_();
  const now = Date.now();
  const sheet = getSessionsSheet_();
  ensureSessionColumns_(sheet);
  sheet.appendRow([
    token,
    principal.username,
    principal.role || "teacher",
    principal.impersonateAs || "",
    now,
    now + SESSION_TTL_MS,
  ]);
  return {
    token: token,
    username: principal.username,
    displayName: principal.displayName || principal.username,
    role: principal.role || "teacher",
    impersonateAs: principal.impersonateAs || "",
    effectiveUsername: principal.effectiveUsername || principal.username,
    mustChangePassword: principal.mustChangePassword || false,
    expiresAt: now + SESSION_TTL_MS,
  };
}

function purgeExpiredSessionsV2_() {
  const sheet = getSessionsSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  ensureSessionColumns_(sheet);
  const now = Date.now();
  const rows = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  for (var i = rows.length - 1; i >= 0; i--) {
    if (Number(rows[i][5]) < now) sheet.deleteRow(i + 2);
  }
}

function validateSessionV2_(token) {
  const clean = String(token || "").trim();
  if (!clean) return null;
  purgeExpiredSessionsV2_();
  const sheet = getSessionsSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  ensureSessionColumns_(sheet);
  const rows = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  const now = Date.now();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) !== clean) continue;
    if (Number(rows[i][5]) < now) return null;
    const role = String(rows[i][2] || "teacher");
    const username = String(rows[i][1] || "");
    const impersonateAs = String(rows[i][3] || "");
    const effectiveUsername = impersonateAs || username;

    if (role === "student") {
      const student = getStudentByUsername_(effectiveUsername);
      if (!student) return null;
      return {
        token: clean,
        username: student.username,
        displayName: student.username,
        role: "student",
        impersonateAs: "",
        effectiveUsername: student.username,
        classroom: student.classroom,
        mustChangePassword: student.mustChangePassword,
      };
    }

    if (role === "admin") {
      return {
        token: clean,
        username: ADMIN_USERNAME,
        displayName: "Admin",
        role: "admin",
        impersonateAs: impersonateAs,
        effectiveUsername: impersonateAs || ADMIN_USERNAME,
        mustChangePassword: false,
      };
    }

    const teacher = getTeacherByUsername_(username);
    if (!teacher) return null;
    if (impersonateAs) {
      return {
        token: clean,
        username: teacher.username,
        displayName: teacher.displayName,
        role: "admin",
        impersonateAs: impersonateAs,
        effectiveUsername: impersonateAs,
        mustChangePassword: false,
      };
    }
    return {
      token: clean,
      username: teacher.username,
      displayName: teacher.displayName,
      role: "teacher",
      impersonateAs: "",
      effectiveUsername: teacher.username,
      mustChangePassword: false,
    };
  }
  return null;
}

function verifyAdminLogin_(username, password) {
  const norm = normalizeUsername_(username);
  if (norm !== ADMIN_USERNAME) return false;
  return String(password || "") === getAdminPassword_();
}

function studentLogin_(username, password) {
  const roster = findRosterEntry_(username);
  if (!roster) throw new Error("That username is not on your class roster. Use first name + last initial (e.g. John D.).");

  var student = getStudentByUsername_(roster.username);
  if (!student) {
    if (String(password || "") !== STUDENT_DEFAULT_PASSWORD) {
      throw new Error("First login: use default password SPARK, then choose your own password.");
    }
    student = createStudentAccount_(roster, STUDENT_DEFAULT_PASSWORD);
  } else if (!passwordsMatchStored_(student.password, password)) {
    throw new Error("Incorrect password.");
  }

  return createSessionV2_({
    username: student.username,
    displayName: student.username,
    role: "student",
    effectiveUsername: student.username,
    mustChangePassword: student.mustChangePassword,
  });
}

function studentSetPassword_(sessionToken, newPassword) {
  const session = validateSessionV2_(sessionToken);
  if (!session || session.role !== "student") throw new Error("Sign in as a student first.");
  const pw = String(newPassword || "");
  if (pw.length < 4) throw new Error("Password must be at least 4 characters.");
  updateStudentPassword_(session.username, pw, true);
  return createSessionV2_({
    username: session.username,
    displayName: session.username,
    role: "student",
    effectiveUsername: session.username,
    mustChangePassword: false,
  });
}

function adminLogin_(username, password) {
  if (!verifyAdminLogin_(username, password)) throw new Error("Invalid admin credentials.");
  return createSessionV2_({
    username: ADMIN_USERNAME,
    displayName: "Admin",
    role: "admin",
    effectiveUsername: ADMIN_USERNAME,
  });
}

function adminImpersonate_(sessionToken, targetUsername, targetRole) {
  const session = validateSessionV2_(sessionToken);
  if (!session || session.role !== "admin") throw new Error("Admin access required.");
  const target = String(targetUsername || "").trim();
  const role = String(targetRole || "teacher").toLowerCase();
  if (!target) throw new Error("Missing target username.");
  if (role === "student") {
    const roster = findRosterEntry_(target);
    if (!roster) throw new Error("Student not on roster.");
    return createSessionV2_({
      username: ADMIN_USERNAME,
      displayName: "Admin → " + roster.username,
      role: "admin",
      impersonateAs: roster.username,
      effectiveUsername: roster.username,
    });
  }
  const teacher = getTeacherByUsername_(target);
  if (!teacher) throw new Error("Teacher not found.");
  return createSessionV2_({
    username: ADMIN_USERNAME,
    displayName: "Admin → " + teacher.displayName,
    role: "admin",
    impersonateAs: teacher.username,
    effectiveUsername: teacher.username,
  });
}

function generateVerificationCode_() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function teacherRequestVerification_(email, username, displayName) {
  const normEmail = normalizeEmail_(email);
  const normUser = normalizeUsername_(username);
  const name = normalizeDisplayName_(displayName) || normUser;
  if (!normEmail || !normUser) throw new Error("Enter your school email and username.");
  if (!isTeacherEmailDomain_(normEmail)) throw new Error("Use your @davincicharterschool.org email.");
  if (!isApprovedTeacherEmail_(normEmail)) throw new Error("That email is not on the approved teacher list. Contact Mr. Phil.");
  if (normUser.length < 3) throw new Error("Username must be at least 3 characters.");
  if (getTeacherByUsername_(normUser)) throw new Error("That username is already taken.");

  const code = generateVerificationCode_();
  const sheet = getVerificationSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const rows = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
    for (var i = rows.length - 1; i >= 0; i--) {
      if (normalizeEmail_(rows[i][0]) === normEmail) sheet.deleteRow(i + 2);
    }
  }
  sheet.appendRow([normEmail, code, normUser, name, Date.now() + VERIFICATION_TTL_MS]);

  try {
    MailApp.sendEmail({
      to: normEmail,
      subject: "WriteFlow Studio — verify your email",
      body: "Your verification code is: " + code + "\n\nEnter this in WriteFlow Studio to finish signup. Expires in 15 minutes.",
    });
  } catch (mailErr) {
    console.warn("MailApp failed:", mailErr);
  }

  return { ok: true, email: normEmail, verificationSent: true };
}

function teacherCompleteRegistration_(email, username, password, displayName, code) {
  const normEmail = normalizeEmail_(email);
  const normUser = normalizeUsername_(username);
  const pw = String(password || "").slice(0, 80);
  const name = normalizeDisplayName_(displayName) || normUser;
  const cleanCode = String(code || "").trim();
  if (!normEmail || !normUser || !pw || !cleanCode) throw new Error("Complete all fields including verification code.");
  if (pw.length < 4) throw new Error("Password must be at least 4 characters.");

  const sheet = getVerificationSheet_();
  const lastRow = sheet.getLastRow();
  var verified = false;
  if (lastRow >= 2) {
    const rows = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
    const now = Date.now();
    for (var i = 0; i < rows.length; i++) {
      if (normalizeEmail_(rows[i][0]) !== normEmail) continue;
      if (String(rows[i][1]) !== cleanCode) continue;
      if (Number(rows[i][4]) < now) throw new Error("Verification code expired. Request a new one.");
      if (normalizeUsername_(rows[i][2]) !== normUser) continue;
      verified = true;
      sheet.deleteRow(i + 2);
      break;
    }
  }
  if (!verified) throw new Error("Invalid verification code.");
  if (!isApprovedTeacherEmail_(normEmail)) throw new Error("Email not approved.");
  if (getTeacherByUsername_(normUser)) throw new Error("Username already taken.");

  const teachersSheet = getTeachersSheet_();
  ensureTeacherColumns_(teachersSheet);
  teachersSheet.appendRow([normUser, hashPassword_(pw), name, normEmail, "TRUE", "teacher"]);

  const teacher = getTeacherByUsername_(normUser);
  return createSessionV2_({
    username: teacher.username,
    displayName: teacher.displayName,
    role: "teacher",
    effectiveUsername: teacher.username,
  });
}

function verifyTeacherLoginV2_(username, password) {
  const teacher = getTeacherByUsername_(username);
  if (!teacher) return null;
  if (!passwordsMatchStored_(teacher.password, password)) return null;
  return teacher;
}

function listStudentSubmissions_(studentUsername) {
  const norm = normalizeStudentUsername_(studentUsername).toLowerCase();
  const sheet = getSubmissionsSheet_();
  ensureSubmissionStudentColumn_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const numRows = lastRow - 1;
  const colCount = Math.max(13, sheet.getLastColumn());
  const values = sheet.getRange(2, 1, numRows, colCount).getValues();
  const out = [];
  for (var i = values.length - 1; i >= 0; i--) {
    const row = values[i];
    if (!row[0]) continue;
    const rowStudent = normalizeStudentUsername_(row[12] || "").toLowerCase();
    const rowName = normalizeStudentUsername_(row[3] || "").toLowerCase();
    if (rowStudent !== norm && rowName !== norm) continue;
    var analysis = {};
    try {
      analysis = JSON.parse(row[11] || "{}");
    } catch (ignore) {
      analysis = { scores: { overall: Number(row[9]) || 0 } };
    }
    out.push({
      id: String(row[0]),
      submittedAt: Number(row[1]) || 0,
      assignmentId: String(row[2]),
      name: String(row[3]),
      classroom: String(row[4]),
      durationSec: Number(row[5]) || 0,
      text: String(row[10] || ""),
      analysis: analysis,
      studentUsername: String(row[12] || ""),
    });
  }
  return out;
}

function adminGetStats_() {
  const stats = getStats_();
  return {
    ...stats,
    registeredStudents: Math.max(0, getStudentsSheet_().getLastRow() - 1),
    teachers: Math.max(0, getTeachersSheet_().getLastRow() - 1),
    rosterEntries: Math.max(0, getStudentRosterSheet_().getLastRow() - 1),
  };
}

function adminDedupeSubmissions_() {
  const sheet = getSubmissionsSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 3) return { removed: 0 };
  const numRows = lastRow - 1;
  const colCount = Math.max(13, sheet.getLastColumn());
  const values = sheet.getRange(2, 1, numRows, colCount).getValues();
  const seen = {};
  var removed = 0;
  for (var i = values.length - 1; i >= 0; i--) {
    const row = values[i];
    const studentKey = normalizeStudentUsername_(row[12] || row[3] || "").toLowerCase();
    const key = String(row[2]) + "|" + studentKey + "|" + String(row[10] || "").slice(0, 200);
    if (seen[key]) {
      sheet.deleteRow(i + 2);
      removed += 1;
    } else {
      seen[key] = true;
    }
  }
  return { removed: removed };
}

function adminListTeachers_() {
  const sheet = getTeachersSheet_();
  ensureTeacherColumns_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const rows = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  const out = [];
  for (var i = 0; i < rows.length; i++) {
    out.push({
      username: String(rows[i][0] || ""),
      displayName: String(rows[i][2] || ""),
      email: String(rows[i][3] || ""),
      verified: String(rows[i][4] || "").toUpperCase() === "TRUE",
      role: String(rows[i][5] || "teacher"),
    });
  }
  return out;
}

function adminListRegisteredStudents_() {
  const sheet = getStudentsSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const rows = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  const out = [];
  for (var i = 0; i < rows.length; i++) {
    out.push({
      username: String(rows[i][0] || ""),
      classroom: String(rows[i][2] || ""),
      mustChangePassword: String(rows[i][3] || "").toUpperCase() === "TRUE",
      createdAt: Number(rows[i][4]) || 0,
    });
  }
  return out;
}

function checkStudentUsername_(username) {
  const roster = findRosterEntry_(username);
  if (!roster) return { valid: false };
  const registered = getStudentByUsername_(roster.username);
  return {
    valid: true,
    username: roster.username,
    classroom: roster.classroom,
    registered: !!registered,
    mustUseDefaultPassword: !registered,
  };
}
