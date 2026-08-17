/**
 * Tech Escape — global high scores (Google Sheets backend)
 *
 * SETUP (about 10 minutes):
 * 1. Create a new Google Sheet (e.g. "Tech Escape High Scores")
 * 2. Extensions → Apps Script → paste this file → Save
 * 3. Set SPREADSHEET_ID below (from the sheet URL)
 * 4. Run initSheet once (authorize when prompted)
 * 5. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. Copy the Web app URL into Vercel env: TECH_ESCAPE_HIGHSCORES_SCRIPT_URL
 * 7. Set TECH_ESCAPE_HIGHSCORES_API_SECRET in Vercel to match API_SECRET below
 */

const SPREADSHEET_ID = normalizeSheetId_("PASTE_YOUR_SHEET_ID_HERE");
const SHEET_NAME = "HighScores";
const API_SECRET = "studentsfirst";
const MAX_ROWS = 100;

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
  }
  return sheet;
}

function initHeaders_(sheet) {
  sheet
    .getRange(1, 1, 1, 10)
    .setValues([[
      "id",
      "submittedAt",
      "name",
      "score",
      "escaped",
      "seconds",
      "floor",
      "difficulty",
      "breakdownJson",
      "rank",
    ]]);
  sheet.getRange(1, 1, 1, 10).setFontWeight("bold");
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
      return respond_({ scores: listScores_() });
    }

    if (action === "save") {
      return respond_(saveScore_(params));
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
  if (!/^[\p{L}][\p{L}'-]{0,15}$/u.test(first)) {
    throw new Error("First name: letters only, up to 16 characters.");
  }
  if (!/^[\p{L}]$/u.test(last)) {
    throw new Error("Last initial must be one letter.");
  }
  return first + " " + last.toUpperCase();
}

function rowToScore_(row, rank) {
  let breakdown = {};
  try {
    breakdown = JSON.parse(row[8] || "{}");
  } catch (ignore) {
    breakdown = {};
  }
  return {
    id: String(row[0] || ""),
    submittedAt: Number(row[1]) || 0,
    name: String(row[2] || ""),
    score: Number(row[3]) || 0,
    escaped: Boolean(row[4]),
    seconds: Number(row[5]) || 0,
    floor: String(row[6] || ""),
    difficulty: String(row[7] || ""),
    breakdown,
    rank: rank || Number(row[9]) || 0,
  };
}

function readRows_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow, 10).getValues();
}

function sortRows_(rows) {
  rows.sort(function (a, b) {
    const ds = Number(b[3]) - Number(a[3]);
    if (ds !== 0) return ds;
    const es = Number(a[5]) - Number(b[5]);
    if (es !== 0) return es;
    return Number(a[1]) - Number(b[1]);
  });
  return rows;
}

function writeRows_(sheet, rows) {
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow, 10).clearContent();
    if (lastRow > rows.length + 1) {
      sheet.deleteRows(rows.length + 2, lastRow - rows.length - 1);
    }
  }
  if (!rows.length) return;
  sheet.getRange(2, 1, rows.length, 10).setValues(rows);
}

function trimAndRank_(sheet) {
  const rows = sortRows_(readRows_(sheet));
  const kept = rows.slice(0, MAX_ROWS);
  for (let i = 0; i < kept.length; i++) {
    kept[i][9] = i + 1;
  }
  writeRows_(sheet, kept);
  return kept.map(function (row, i) {
    return rowToScore_(row, i + 1);
  });
}

function listScores_() {
  const sheet = getSheet_();
  const rows = sortRows_(readRows_(sheet)).slice(0, MAX_ROWS);
  return rows.map(function (row, i) {
    return rowToScore_(row, i + 1);
  });
}

function findRank_(scores, id) {
  for (let i = 0; i < scores.length; i++) {
    if (scores[i].id === id) return scores[i].rank;
  }
  return 0;
}

function saveScore_(params) {
  const name = normalizeName_(params.name);
  const score = Number(params.score);
  const escaped = Boolean(params.escaped);
  const seconds = Number(params.seconds);
  const floor = String(params.floor || "").trim().slice(0, 40);
  const difficulty = String(params.difficulty || "").trim().slice(0, 24);
  const breakdown = params.breakdown && typeof params.breakdown === "object"
    ? params.breakdown
    : {};

  if (!Number.isFinite(score) || score < 0) {
    throw new Error("Invalid score.");
  }
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new Error("Invalid run time.");
  }

  const sheet = getSheet_();
  const id = String(Date.now()) + "-" + Math.random().toString(36).slice(2, 9);
  sheet.appendRow([
    id,
    Date.now(),
    name,
    Math.round(score),
    escaped ? 1 : 0,
    Math.round(seconds),
    floor,
    difficulty,
    JSON.stringify(breakdown),
    0,
  ]);

  const scores = trimAndRank_(sheet);
  const rank = findRank_(scores, id);

  return {
    ok: true,
    id: id,
    rank: rank,
    inTop: rank > 0 && rank <= MAX_ROWS,
    scores: scores,
  };
}

function respond_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
