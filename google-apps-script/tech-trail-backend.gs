/**
 * Global Tech Gauntlet — submissions backend (Google Sheets)
 *
 * SETUP (about 10 minutes):
 * 1. Create a new Google Sheet (e.g. "Global Tech Gauntlet Submissions")
 * 2. Extensions → Apps Script → paste this file → Save
 * 3. Set SPREADSHEET_ID below (from the sheet URL)
 * 4. Run initSheet once (authorize when prompted)
 * 5. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. Copy the Web app URL into Vercel env: TECH_TRAIL_SCRIPT_URL
 * 7. Set TECH_TRAIL_API_SECRET in Vercel to match API_SECRET below
 */

const SPREADSHEET_ID = normalizeSheetId_("PASTE_YOUR_SHEET_ID_HERE");
const SHEET_NAME = "TechTrailSubmissions";
const API_SECRET = "studentsfirst";

/** Use only the ID between /d/ and /edit in the sheet URL. */
function normalizeSheetId_(raw) {
  const s = String(raw || "").trim();
  const match = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  return s.split("/")[0].split("?")[0].split("#")[0];
}

function getSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    initHeaders_(sheet);
  } else {
    ensureAnalysisColumns_(sheet);
  }
  return sheet;
}

const PEDAGOGY_HEADERS = [
  "pedagogyJson", "testCpm", "targetCpm", "diagnosed", "integrity", "reputation",
];

function initHeaders_(sheet) {
  const base = [
    "id", "submittedAt", "name", "classroom", "oathText", "badgesJson", "goldenRulesJson",
    "mentorsMetJson", "endingType", "endingNode", "durationSec", "analysisJson",
    "diagnosticAnalysisJson", "overallScore", "oathWpm", "challengeDurationSec",
  ];
  const headers = base.concat(PEDAGOGY_HEADERS);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  sheet.setFrozenRows(1);
}

function ensureAnalysisColumns_(sheet) {
  const base = [
    "id", "submittedAt", "name", "classroom", "oathText", "badgesJson", "goldenRulesJson",
    "mentorsMetJson", "endingType", "endingNode", "durationSec", "analysisJson",
    "diagnosticAnalysisJson", "overallScore", "oathWpm", "challengeDurationSec",
  ];
  const headers = base.concat(PEDAGOGY_HEADERS);
  const lastCol = Math.max(sheet.getLastColumn(), headers.length);
  const existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  for (let i = 0; i < headers.length; i++) {
    if (!String(existing[i] || "").trim()) {
      sheet.getRange(1, i + 1).setValue(headers[i]).setFontWeight("bold");
    }
  }
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
    const params = isGet
      ? (e && e.parameter) || {}
      : JSON.parse((e && e.postData && e.postData.contents) || "{}");

    if (String(params.secret || "") !== API_SECRET) {
      return respond_({ error: "Unauthorized" });
    }

    const action = String(params.action || (isGet ? "list" : "save"));

    if (action === "list") {
      return respond_({ submissions: listSubmissions_(params.classroom) });
    }

    if (action === "save") {
      return respond_(saveSubmission_(params));
    }

    return respond_({ error: "Unknown action" });
  } catch (err) {
    return respond_({ error: String(err.message || err) });
  }
}

function normalizeName_(name) {
  const s = String(name || "").trim().replace(/\s+/g, " ");
  if (!s) throw new Error("Enter your first name and last initial.");
  if (s.includes("@") || /\d{4,}/.test(s)) {
    throw new Error("Use a first name and last initial only — no emails or long numbers.");
  }
  const parts = s.split(" ");
  if (parts.length < 2) throw new Error("Add your last initial after your first name.");
  const first = parts.slice(0, parts.length - 1).join(" ");
  const last = parts[parts.length - 1];
  if (!/[\p{L}][\p{L}'-]{0,15}$/u.test(first)) {
    throw new Error("First name: letters only, up to 16 characters.");
  }
  if (!/^[\p{L}]$/u.test(last)) {
    throw new Error("Last initial must be one letter.");
  }
  return first + " " + last.toUpperCase();
}

function readRows_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const colCount = Math.max(22, sheet.getLastColumn());
  return sheet.getRange(2, 1, lastRow - 1, colCount).getValues();
}

function rowToSubmission_(row) {
  let badges = [];
  let goldenRules = [];
  let mentorsMet = [];
  let analysis = null;
  let diagnosticAnalysis = null;
  let pedagogy = null;
  try { badges = JSON.parse(row[5] || "[]"); } catch (ignore) {}
  try { goldenRules = JSON.parse(row[6] || "[]"); } catch (ignore) {}
  try { mentorsMet = JSON.parse(row[7] || "[]"); } catch (ignore) {}
  try { analysis = JSON.parse(row[11] || "null"); } catch (ignore) {}
  try { diagnosticAnalysis = JSON.parse(row[12] || "null"); } catch (ignore) {}
  try { pedagogy = JSON.parse(row[16] || "null"); } catch (ignore) {}
  return {
    id: String(row[0] || ""),
    submittedAt: Number(row[1]) || 0,
    name: String(row[2] || ""),
    classroom: String(row[3] || ""),
    oathText: String(row[4] || ""),
    badges: badges,
    goldenRules: goldenRules,
    mentorsMet: mentorsMet,
    endingType: String(row[8] || ""),
    endingNode: String(row[9] || ""),
    durationSec: Number(row[10]) || 0,
    analysis: analysis,
    diagnosticAnalysis: diagnosticAnalysis,
    overallScore: row[13] === "" || row[13] == null ? null : Number(row[13]),
    oathWpm: row[14] === "" || row[14] == null ? null : Number(row[14]),
    challengeDurationSec: Number(row[15]) || 0,
    pedagogy: pedagogy,
    testCpm: row[17] === "" || row[17] == null ? null : Number(row[17]),
    targetCpm: row[18] === "" || row[18] == null ? null : Number(row[18]),
    diagnosed: row[19] === true || row[19] === "true" || row[19] === 1,
    integrity: row[20] === "" || row[20] == null ? null : Number(row[20]),
    reputation: row[21] === "" || row[21] == null ? null : Number(row[21]),
  };
}

function listSubmissions_(classroomFilter) {
  const sheet = getSheet_();
  const rows = readRows_(sheet);
  const filter = String(classroomFilter || "").trim().toLowerCase();
  const out = [];
  for (let i = rows.length - 1; i >= 0; i--) {
    const sub = rowToSubmission_(rows[i]);
    if (filter && sub.classroom.toLowerCase() !== filter) continue;
    out.push(sub);
  }
  return out;
}

function saveSubmission_(params) {
  const name = normalizeName_(params.name);
  const classroom = String(params.classroom || "").trim();
  const oathText = String(params.oathText || "").trim().slice(0, 2000);
  const badges = Array.isArray(params.badges) ? params.badges : [];
  const goldenRules = Array.isArray(params.goldenRules) ? params.goldenRules : [];
  const mentorsMet = Array.isArray(params.mentorsMet) ? params.mentorsMet : [];
  const endingType = String(params.endingType || "").slice(0, 24);
  const endingNode = String(params.endingNode || "").slice(0, 40);
  const durationSec = Number(params.durationSec) || 0;
  const challengeDurationSec = Number(params.challengeDurationSec) || 0;
  const overallScore = params.overallScore == null || params.overallScore === "" ? "" : Number(params.overallScore);
  const oathWpm = params.oathWpm == null || params.oathWpm === "" ? "" : Number(params.oathWpm);
  const analysisJson = params.analysis ? JSON.stringify(params.analysis).slice(0, 12000) : "";
  const diagnosticAnalysisJson = params.diagnosticAnalysis
    ? JSON.stringify(params.diagnosticAnalysis).slice(0, 8000)
    : "";
  const pedagogyJson = params.pedagogy ? JSON.stringify(params.pedagogy).slice(0, 6000) : "";
  const testCpm = params.testCpm == null || params.testCpm === "" ? "" : Number(params.testCpm);
  const targetCpm = params.targetCpm == null || params.targetCpm === "" ? "" : Number(params.targetCpm);
  const diagnosed = params.diagnosed ? "true" : "false";
  const integrity = params.integrity == null || params.integrity === "" ? "" : Number(params.integrity);
  const reputation = params.reputation == null || params.reputation === "" ? "" : Number(params.reputation);

  if (!classroom) throw new Error("Classroom is required.");

  const sheet = getSheet_();
  const id = String(Date.now()) + "-" + Math.random().toString(36).slice(2, 9);
  sheet.appendRow([
    id,
    Date.now(),
    name,
    classroom,
    oathText,
    JSON.stringify(badges),
    JSON.stringify(goldenRules),
    JSON.stringify(mentorsMet),
    endingType,
    endingNode,
    Math.round(durationSec),
    analysisJson,
    diagnosticAnalysisJson,
    overallScore,
    oathWpm,
    Math.round(challengeDurationSec),
    pedagogyJson,
    testCpm,
    targetCpm,
    diagnosed,
    integrity,
    reputation,
  ]);

  return { ok: true, id: id };
}

function respond_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
