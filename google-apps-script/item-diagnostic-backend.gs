/**
 * ITEM 2025 Diagnostic — Google Sheets backend
 *
 * SETUP (about 10 minutes):
 * 1. Open the Google Sheet (ITEM Diagnostic Submissions)
 * 2. Extensions → Apps Script → paste this file → Save
 * 3. SPREADSHEET_ID is already set below
 * 4. Run initSheet once (authorize when prompted)
 * 5. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. Copy the Web app URL into Vercel env: ITEM_DIAGNOSTIC_SCRIPT_URL
 * 7. Set ITEM_DIAGNOSTIC_API_SECRET in Vercel to match API_SECRET below
 */

const SPREADSHEET_ID = normalizeSheetId_("1Bvkva_TrAdjySPEBErm4kU6HgDEuZnfwbDL78pEtuAM");
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

function normalizeClassroom_(value) {
  return String(value || "")
    .trim()
    .replace(/[\u2018\u2019\u201B\u2032]/g, "'");
}

function resolveClassroom_(value) {
  const norm = normalizeClassroom_(value);
  if (!norm) return "";
  for (var i = 0; i < VALID_CLASSROOMS.length; i++) {
    if (normalizeClassroom_(VALID_CLASSROOMS[i]) === norm) return VALID_CLASSROOMS[i];
  }
  return "";
}

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
    .getRange(1, 1, 1, 13)
    .setValues([[
      "id",
      "submittedAt",
      "name",
      "classroom",
      "quizScore",
      "quizTotal",
      "quizPct",
      "typingWpm",
      "typingWordCount",
      "typingLevel",
      "gapCount",
      "typingText",
      "resultJson",
    ]]);
  sheet.getRange(1, 1, 1, 13).setFontWeight("bold");
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

  const numRows = lastRow - 1;
  const values = sheet.getRange(2, 1, numRows, 13).getValues();
  const submissions = [];

  for (let i = values.length - 1; i >= 0; i--) {
    const row = values[i];
    if (!row[0] || !row[2]) continue;

    let result = {};
    try {
      result = JSON.parse(row[12] || "{}");
    } catch (ignore) {
      result = {};
    }

    submissions.push({
      id: String(row[0]),
      submittedAt: Number(row[1]) || 0,
      name: String(row[2]),
      classroom: String(row[3]),
      quizScore: Number(row[4]) || 0,
      quizTotal: Number(row[5]) || 0,
      quizPct: Number(row[6]) || 0,
      typingWpm: Number(row[7]) || 0,
      typingWordCount: Number(row[8]) || 0,
      typingLevel: String(row[9] || ""),
      gapCount: Number(row[10]) || 0,
      typingText: String(row[11] || ""),
      typingAnalysis: result.typingAnalysis || null,
      quizAnswers: Array.isArray(result.quizAnswers) ? result.quizAnswers : [],
      standards: Array.isArray(result.standards) ? result.standards : [],
      topics: result.topics && typeof result.topics === "object" ? result.topics : {},
      durationSec: Number(result.durationSec) || 0,
    });
  }

  return submissions;
}

function saveSubmission_(params) {
  const name = String(params.name || "").trim().slice(0, 80);
  const classroom = resolveClassroom_(params.classroom);
  const typingText = String(params.typingText || "").trim().slice(0, 15000);
  const typingAnalysis = params.typingAnalysis || null;
  const quizAnswers = Array.isArray(params.quizAnswers) ? params.quizAnswers : [];
  const standards = Array.isArray(params.standards) ? params.standards : [];
  const topics = params.topics && typeof params.topics === "object" ? params.topics : {};
  const quizScore = Number(params.quizScore);
  const quizTotal = Number(params.quizTotal);
  const quizPct = Number(params.quizPct);
  const durationSec = Number(params.durationSec);

  if (!name || !classroom || !quizAnswers.length) {
    throw new Error("Missing required fields");
  }
  if (VALID_CLASSROOMS.indexOf(classroom) === -1) {
    throw new Error("Invalid classroom");
  }

  const gapCount = standards.filter(function (s) {
    return s && s.level === "gap";
  }).length;

  const entry = {
    id: String(Date.now()) + "-" + Math.random().toString(36).slice(2, 9),
    submittedAt: Date.now(),
    name: name,
    classroom: classroom,
    quizScore: isFinite(quizScore) ? quizScore : 0,
    quizTotal: isFinite(quizTotal) ? quizTotal : quizAnswers.length,
    quizPct: isFinite(quizPct) ? quizPct : 0,
    typingWpm: typingAnalysis && typingAnalysis.wpm ? typingAnalysis.wpm : 0,
    typingWordCount: typingAnalysis && typingAnalysis.wordCount ? typingAnalysis.wordCount : 0,
    typingLevel: typingAnalysis && typingAnalysis.typingLevel ? typingAnalysis.typingLevel : "",
    gapCount: gapCount,
    typingText: typingText,
    typingAnalysis: typingAnalysis,
    quizAnswers: quizAnswers,
    standards: standards,
    topics: topics,
    durationSec: isFinite(durationSec) ? durationSec : 120,
  };

  const resultJson = JSON.stringify({
    typingAnalysis: entry.typingAnalysis,
    quizAnswers: entry.quizAnswers,
    standards: entry.standards,
    topics: entry.topics,
    durationSec: entry.durationSec,
  });

  const sheet = getSheet_();
  sheet.appendRow([
    entry.id,
    entry.submittedAt,
    entry.name,
    entry.classroom,
    entry.quizScore,
    entry.quizTotal,
    entry.quizPct,
    entry.typingWpm,
    entry.typingWordCount,
    entry.typingLevel,
    entry.gapCount,
    entry.typingText,
    resultJson,
  ]);

  return entry;
}

function respond_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
