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
const ROSTER_SHEET_NAME = "ClassRosters";
const API_SECRET = "studentsfirst";

/** Auto-generated from api/tech-trail/class-roster.json — run: npm run sync:tech-trail-roster */
const CLASS_ROSTER_EMBED = {
  "Tech: Media Arts": [
    "Aaron R.",
    "Aleena O.",
    "Alexi G.",
    "Benjamin W.",
    "Desmond S.",
    "Eden T.",
    "Evan M.",
    "Evan S.",
    "Finlay A.",
    "Gael LG.",
    "Glory R.",
    "Greyson K.",
    "Julia R.",
    "Kamden B.",
    "Kendrick N.",
    "Kunshita Y.",
    "Lucas S.",
    "Magefera H.",
    "Maryam M.",
    "Mason R.",
    "Mateo M.",
    "Milan R.",
    "MJ J.",
    "Noah S.",
    "Shaelyn GA.",
    "Siinan R.",
    "Tara I."
  ],
  "Tech 6-A-2": [
    "Adolphlyn G.",
    "Aurnel W.",
    "Brady S.",
    "Briella L.",
    "Callie S.",
    "Fiona D.",
    "Kendrick N.",
    "Lukas B.",
    "Marshall Y.",
    "Mckayla N.",
    "Mohamed A.",
    "Nanat K.",
    "Nathan T.",
    "Nidharth Y.",
    "Omar M.",
    "Reuben M.",
    "Soliyana A.",
    "Sophia L.",
    "Tatiana B.",
    "Theo J.",
    "Valerie LG.",
    "Yaddi T.",
    "Zhi'yon A."
  ],
  "Tech 7-A-4": [
    "Amir A.",
    "Anas M.",
    "Andrew K.",
    "Avalyn M.",
    "Benjamin L.",
    "Christian C.",
    "Dillon H.",
    "Dursaa M.",
    "Elijah S.",
    "Elim G.",
    "Gabriel D.",
    "Hamza M.",
    "Jeremiah U.",
    "Jillian O.",
    "Kamden B.",
    "Kenan N.",
    "Levi H.",
    "Levi S.",
    "Max B.",
    "Mila S.",
    "Nace F.",
    "Rosaria F.",
    "Sharon I.",
    "Solomon M.",
    "Stella M.",
    "Tenzin W.",
    "Vasiliy V."
  ],
  "Mr. Phil's Advisory": [
    "Ahmed J.",
    "Alice O.",
    "Anoushka K.",
    "Bazil K.",
    "Dickson T.",
    "Dillon H.",
    "EJ J.",
    "Emanuel G.",
    "Enaya O.",
    "Ethan A.",
    "Finlay A.",
    "Gabriel D.",
    "Jack T.",
    "Jerron S.",
    "Jillian O.",
    "Logan M.",
    "Matthew Y.",
    "Mila S.",
    "Nolan S.",
    "RJ E.",
    "Vasiliy V.",
    "Zach C."
  ],
  "Tech 6-A-5": [
    "Abdinasir M.",
    "Abdullahi Y.",
    "Claire A.",
    "Fayz O.",
    "Giselle M.",
    "Hudson K.",
    "Jackson L.",
    "Lalesa I.",
    "Malek A.",
    "McKenna W.",
    "Niyah O.",
    "Noah G.",
    "Nolan A.",
    "Reina G.",
    "Hafsa H."
  ],
  "Tech 7-A-6": [
    "Abdullahi S.",
    "Ava C.",
    "Avah S.",
    "Ayah S.",
    "Bazil K.",
    "Bellanie G.",
    "Bonsa I.",
    "Christian M.",
    "Cody J.",
    "Duraan AT.",
    "Elena X.",
    "Enaya O.",
    "Finlay A.",
    "Henry R.",
    "Inaya A.",
    "Jada EC.",
    "Jana H.",
    "Logan M.",
    "Matilda V.",
    "Mohamed M.",
    "Ngawang D.",
    "Nolan S.",
    "RJ E.",
    "Vivian S.",
    "Yahya S.",
    "Zahrah S.",
    "Zoya S."
  ],
  "Tech: Video Production": [
    "Alexi G.",
    "Brady S.",
    "Cody J.",
    "Coraline S.",
    "Finlay A.",
    "Gideon S.",
    "Isaac H.",
    "Jackson L.",
    "Jerron S.",
    "Luke S.",
    "Magefera H",
    "Mateo M.",
    "MJ J.",
    "Mohamed M.",
    "Paislee S.",
    "Roderick E.",
    "Seth N.",
    "Tenzing P.",
    "Vasiliy V.",
    "Younis A."
  ],
  "Tech 8-B-2": [
    "Aaron R.",
    "Cameron S.",
    "Daniel G.",
    "Dennis X.",
    "Hailey L.",
    "Hana A.",
    "Kadija A.",
    "Kamden P.",
    "Kole R.",
    "Milan R.",
    "Naitik V.",
    "Renae L."
  ],
  "Tech: Game Design": [
    "Abdulahi M.",
    "Aleena O.",
    "Aliyah C.",
    "Allison P.",
    "Autumn S.",
    "Easton K.",
    "Eleanor I.",
    "Elijah S.",
    "Ethan A.",
    "Gabriel D.",
    "Hamza M.",
    "Hana A.",
    "Idris L.",
    "Jillian O.",
    "Kamden B.",
    "Kenan N.",
    "Kimberly B.",
    "Liam P.",
    "Lilyanna J.",
    "Lucas VS.",
    "Maxwell L.",
    "Omar M.",
    "Tatianaf J.",
    "Zyana E."
  ],
  "Tech 7-B-5": [
    "Ahmed J.",
    "Aila N.",
    "Anoushka K.",
    "Anvie G.",
    "Avery W.",
    "Bazir K.",
    "EJ J.",
    "Eleanor I.",
    "Ella B.",
    "Emelia M.",
    "Emmanuella A.",
    "Habiba B.",
    "Lum M.",
    "Nawal A.",
    "Raegen N.",
    "Samhita S.",
    "Sena K.",
    "Tumsa T.",
    "Victoria VF.",
    "Zach C."
  ],
  "Tech 6-B-6": [
    "Alexis K.",
    "Ameer M.",
    "Autumn S.",
    "Azalea T.",
    "Charles W.",
    "Dulce T.",
    "Emerson B.",
    "Francesca E.",
    "Joel T.",
    "Liam P.",
    "Lucas S.",
    "Lyra S.",
    "Matei Z.",
    "Michelle K.",
    "Prince O.",
    "Rosemary M.",
    "Seth N.",
    "Sumaya A.",
    "Surya A.",
    "Zakia A.",
    "Zeina SB."
  ],
  "Mrs. Eckart 6th Grade ELA": [],
  "Mrs. McCarthy 7th Grade ELA": [],
  "Mrs. Severson 8th Grade ELA": [],
  "Teacher's Lounge": [
    "Phil C.",
    "Amy F.",
    "Emily E.",
    "Jessica M."
  ]
};

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
  "pedagogyJson", "testCpm", "targetCpm", "diagnosed", "integrity", "reputation", "runId",
];

const MIN_OATH_CHARS = 20;
const MIN_OATH_WORDS = 4;

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

function getRosterSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(ROSTER_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(ROSTER_SHEET_NAME);
    sheet.getRange(1, 1, 1, 3).setValues([["classroom", "username", "active"]]);
    sheet.getRange(1, 1, 1, 3).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function initRosterSheet() {
  getRosterSheet_();
}

function rosterUsernameKey_(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^a-z0-9]/g, "");
}

function rosterClassroomKey_(value) {
  return String(value || "")
    .trim()
    .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
    .toLowerCase();
}

function canonicalRosterClassroom_(raw) {
  const key = rosterClassroomKey_(raw);
  if (!key) return "";
  const embed = CLASS_ROSTER_EMBED || {};
  const keys = Object.keys(embed);
  for (let i = 0; i < keys.length; i++) {
    if (rosterClassroomKey_(keys[i]) === key) return keys[i];
  }
  return String(raw || "").trim().replace(/[\u2018\u2019\u201B\u2032]/g, "'");
}

function rosterEntryFromRow_(classroom, username) {
  const room = canonicalRosterClassroom_(classroom);
  const user = String(username || "").trim();
  if (!room || !user) return null;
  return { classroom: room, username: user, gtgName: normalizeGtgName_(user) };
}

function mergeRosterEntries_(sheetEntries, embedEntries) {
  const merged = {};
  function addEntry(entry) {
    if (!entry || !entry.classroom || !entry.username) return;
    const roomKey = rosterClassroomKey_(entry.classroom);
    const userKey = rosterUsernameKey_(entry.username);
    if (!roomKey || !userKey) return;
    if (!merged[roomKey]) merged[roomKey] = {};
    merged[roomKey][userKey] = entry;
  }
  embedEntries.forEach(addEntry);
  sheetEntries.forEach(addEntry);
  const out = [];
  Object.keys(merged).forEach(function (roomKey) {
    Object.keys(merged[roomKey]).forEach(function (userKey) {
      out.push(merged[roomKey][userKey]);
    });
  });
  return out;
}

function normalizeGtgName_(raw) {
  const s = String(raw || "").trim().replace(/\s+/g, " ");
  if (!s) return "";
  const parts = s.replace(/\.$/, "").split(/\s+/);
  if (parts.length < 2) return s.replace(/\.$/, "");
  const last = parts[parts.length - 1].replace(/\./g, "").toUpperCase().slice(0, 2);
  const first = parts.slice(0, -1).join(" ");
  return first + " " + last;
}

function listRosterEntries_() {
  const embedEntries = rosterEntriesFromEmbed_();
  const sheet = getRosterSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return embedEntries;
  const rows = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  const sheetEntries = [];
  for (let i = 0; i < rows.length; i++) {
    const active = String(rows[i][2] || "TRUE").toUpperCase() !== "FALSE";
    if (!active) continue;
    const entry = rosterEntryFromRow_(rows[i][0], rows[i][1]);
    if (entry) sheetEntries.push(entry);
  }
  if (!sheetEntries.length) return embedEntries;
  return mergeRosterEntries_(sheetEntries, embedEntries);
}

function rosterEntriesFromEmbed_() {
  const out = [];
  const embed = CLASS_ROSTER_EMBED || {};
  Object.keys(embed).forEach(function (classroom) {
    const names = embed[classroom] || [];
    for (let i = 0; i < names.length; i++) {
      const username = String(names[i] || "").trim();
      if (!username) continue;
      out.push({ classroom: classroom, username: username, gtgName: normalizeGtgName_(username) });
    }
  });
  return out;
}

function listRosterNames_(classroomFilter) {
  const filter = rosterClassroomKey_(classroomFilter);
  const entries = listRosterEntries_();
  const names = [];
  const seen = {};
  for (let i = 0; i < entries.length; i++) {
    if (filter && rosterClassroomKey_(entries[i].classroom) !== filter) continue;
    const name = entries[i].gtgName;
    const key = rosterUsernameKey_(name);
    if (!key || seen[key]) continue;
    seen[key] = true;
    names.push(name);
  }
  names.sort();
  return names;
}

function validateRosterName_(name, classroom) {
  const room = String(classroom || "").trim();
  const key = rosterUsernameKey_(name);
  if (!room || !key) throw new Error("Student name and classroom are required.");
  const pool = listRosterNames_(room);
  if (!pool.length) {
    throw new Error("No roster loaded for this class. Ask your teacher to add names to the Class Rosters sheet.");
  }
  for (let i = 0; i < pool.length; i++) {
    if (rosterUsernameKey_(pool[i]) === key) return normalizeGtgName_(pool[i]);
  }
  throw new Error("That name is not on your class roster. Use the exact spelling from the roster.");
}

function initSheet() {
  initHeaders_(getSheet_());
  getRosterSheet_();
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

    if (action === "roster") {
      return respond_({ names: listRosterNames_(params.classroom) });
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
  const colCount = Math.max(23, sheet.getLastColumn());
  return sheet.getRange(2, 1, lastRow, colCount).getValues();
}

function countWords_(text) {
  const s = String(text || "").trim();
  if (!s) return 0;
  return s.split(/\s+/).filter(Boolean).length;
}

function validateOath_(oathText) {
  const text = String(oathText || "").trim();
  if (text.length < MIN_OATH_CHARS) {
    throw new Error("Complete your Digital Citizenship Oath before submitting (at least a few sentences).");
  }
  if (countWords_(text) < MIN_OATH_WORDS) {
    throw new Error("Your oath needs a few more words before it can be submitted.");
  }
}

function submissionScore_(goldenRules, overallScore, endingType) {
  const golden = Array.isArray(goldenRules) ? goldenRules.length : 0;
  const score = overallScore === "" || overallScore == null ? 0 : Number(overallScore) || 0;
  const champion = String(endingType || "") === "champion" ? 1 : 0;
  return champion * 1000 + golden * 100 + score;
}

function findSubmissionRow_(sheet, name, classroom, runId) {
  const rows = readRows_(sheet);
  const classKey = String(classroom || "").trim().toLowerCase();
  const runKey = String(runId || "").trim();
  let best = null;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowName = String(row[2] || "").trim();
    const rowClass = String(row[3] || "").trim().toLowerCase();
    if (rowName !== name || rowClass !== classKey) continue;
    const rowRunId = String(row[22] || "").trim();
    if (runKey && rowRunId && rowRunId === runKey) {
      return { rowIndex: i + 2, row: row, exactRun: true };
    }
    if (!best) best = { rowIndex: i + 2, row: row, exactRun: false };
  }
  return best;
}

function buildRowValues_(params, id, submittedAt) {
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
  const runId = String(params.runId || "").trim().slice(0, 40);

  return [
    id,
    submittedAt,
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
    runId,
  ];
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
    runId: String(row[22] || ""),
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
  const runId = String(params.runId || "").trim().slice(0, 40);

  if (!classroom) throw new Error("Classroom is required.");
  validateRosterName_(name, classroom);
  validateOath_(oathText);

  const sheet = getSheet_();
  const existing = findSubmissionRow_(sheet, name, classroom, runId);
  if (existing) {
    const existingSub = rowToSubmission_(existing.row);
    if (existing.exactRun) {
      return { ok: true, id: existingSub.id, duplicate: true, message: "This run was already submitted." };
    }
    const newScore = submissionScore_(params.goldenRules, params.overallScore, params.endingType);
    const oldScore = submissionScore_(existingSub.goldenRules, existingSub.overallScore, existingSub.endingType);
    if (newScore <= oldScore) {
      return {
        ok: true,
        id: existingSub.id,
        duplicate: true,
        message: "You already submitted for this class. Only a better run can replace it.",
      };
    }
    const values = buildRowValues_(params, existingSub.id, Date.now());
    sheet.getRange(existing.rowIndex, 1, 1, values.length).setValues([values]);
    return { ok: true, id: existingSub.id, updated: true };
  }

  const id = String(Date.now()) + "-" + Math.random().toString(36).slice(2, 9);
  sheet.appendRow(buildRowValues_(params, id, Date.now()));
  return { ok: true, id: id };
}

function respond_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
