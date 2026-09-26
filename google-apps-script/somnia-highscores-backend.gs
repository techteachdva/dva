/**
 * Somnia — global high scores (Google Sheets backend)
 *
 * SETUP:
 * 1. Create a new Google Sheet (e.g. "Somnia High Scores")
 * 2. Extensions → Apps Script → paste this file → Save
 * 3. Set SPREADSHEET_ID below (from the sheet URL)
 * 4. Run initSheet once (authorize when prompted) — creates HighScores + SavedGames tabs
 * 5. Deploy → New deployment → Web app (Execute as: Me, Anyone)
 * 6. Copy Web app URL into Vercel env: SOMNIA_HIGHSCORES_SCRIPT_URL
 * 7. Set SOMNIA_HIGHSCORES_API_SECRET in Vercel to match API_SECRET below
 */

const SPREADSHEET_ID = normalizeSheetId_("PASTE_YOUR_SHEET_ID_HERE");
const SHEET_NAME = "HighScores";
const SAVES_SHEET_NAME = "SavedGames";
const API_SECRET = "studentsfirst";
const MAX_ROWS = 100;
const MAX_SAVES_PER_NAME = 5;
const MAX_STATE_CHARS = 50000;

function normalizeSheetId_(raw) {
  const s = String(raw || "").trim();
  const match = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  return s.split("/")[0].split("?")[0].split("#")[0];
}

function assertSpreadsheetConfigured_() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === "PASTE_YOUR_SHEET_ID_HERE") {
    throw new Error(
      "Somnia Apps Script is not linked to a Google Sheet yet. " +
        "Open the script editor and set SPREADSHEET_ID to your sheet ID (the long string between /d/ and /edit in the sheet URL)."
    );
  }
}

function getSpreadsheet_() {
  assertSpreadsheetConfigured_();
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    initHeaders_(sheet);
  }
  return sheet;
}

function initHeaders_(sheet) {
  sheet
    .getRange(1, 1, 1, 9)
    .setValues([[
      "id",
      "submittedAt",
      "name",
      "score",
      "won",
      "seconds",
      "difficulty",
      "breakdownJson",
      "rank",
    ]]);
  sheet.getRange(1, 1, 1, 9).setFontWeight("bold");
  sheet.setFrozenRows(1);
}

function getSavesSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(SAVES_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SAVES_SHEET_NAME);
    initSaveHeaders_(sheet);
  }
  return sheet;
}

function initSaveHeaders_(sheet) {
  sheet
    .getRange(1, 1, 1, 13)
    .setValues([[
      "id",
      "updatedAt",
      "name",
      "label",
      "lengthKey",
      "round",
      "phase",
      "status",
      "compressed",
      "stateData",
      "gameId",
      "dreamers",
      "seed",
    ]]);
  sheet.getRange(1, 1, 1, 13).setFontWeight("bold");
  sheet.setFrozenRows(1);
}

function initSheet() {
  initHeaders_(getSheet_());
  initSaveHeaders_(getSavesSheet_());
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

    if (action === "listSaves") {
      return respond_({ saves: listSaves_(params.name || "") });
    }

    if (action === "saveGame") {
      return respond_(saveGame_(params));
    }

    if (action === "load") {
      return respond_(loadSave_(params.id));
    }

    if (action === "delete") {
      return respond_(deleteSave_(params.id));
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
    breakdown = JSON.parse(row[7] || "{}");
  } catch (ignore) {
    breakdown = {};
  }
  return {
    id: String(row[0] || ""),
    submittedAt: Number(row[1]) || 0,
    name: String(row[2] || ""),
    score: Number(row[3]) || 0,
    won: Boolean(row[4]),
    seconds: Number(row[5]) || 0,
    difficulty: String(row[6] || ""),
    breakdown,
    rank: rank || Number(row[8]) || 0,
  };
}

function readRows_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow, 9).getValues();
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
    sheet.getRange(2, 1, lastRow, 9).clearContent();
    if (lastRow > rows.length + 1) {
      sheet.deleteRows(rows.length + 2, lastRow - rows.length - 1);
    }
  }
  if (!rows.length) return;
  sheet.getRange(2, 1, rows.length, 9).setValues(rows);
}

function trimAndRank_(sheet) {
  const rows = sortRows_(readRows_(sheet));
  const kept = rows.slice(0, MAX_ROWS);
  for (let i = 0; i < kept.length; i++) {
    kept[i][8] = i + 1;
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
  const won = Boolean(params.won);
  const seconds = Number(params.seconds);
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
    won ? 1 : 0,
    Math.round(seconds),
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

function rowToSaveMeta_(row) {
  return {
    id: String(row[0] || ""),
    updatedAt: Number(row[1]) || 0,
    name: String(row[2] || ""),
    label: String(row[3] || ""),
    lengthKey: String(row[4] || ""),
    round: Number(row[5]) || 0,
    phase: String(row[6] || ""),
    status: String(row[7] || "playing"),
    compressed: Boolean(row[8]),
    gameId: String(row[10] || ""),
    dreamers: String(row[11] || ""),
    seed: String(row[12] || ""),
  };
}

function rowToSave_(row) {
  return {
    id: String(row[0] || ""),
    updatedAt: Number(row[1]) || 0,
    name: String(row[2] || ""),
    label: String(row[3] || ""),
    lengthKey: String(row[4] || ""),
    round: Number(row[5]) || 0,
    phase: String(row[6] || ""),
    status: String(row[7] || "playing"),
    compressed: Boolean(row[8]),
    stateData: String(row[9] || ""),
    gameId: String(row[10] || ""),
    dreamers: String(row[11] || ""),
    seed: String(row[12] || ""),
  };
}

function readSaveRows_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow, 13).getValues();
}

function listSaves_(nameFilter) {
  const sheet = getSavesSheet_();
  const filter = String(nameFilter || "").trim().toLowerCase();
  const rows = readSaveRows_(sheet)
    .map(rowToSaveMeta_)
    .filter(function (save) {
      if (!save.id) return false;
      if (!filter) return true;
      return String(save.name || "").toLowerCase() === filter;
    });
  rows.sort(function (a, b) {
    return Number(b.updatedAt) - Number(a.updatedAt);
  });
  return rows;
}

function saveGame_(params) {
  const name = normalizeName_(params.name);
  const label = String(params.label || "Saved dream").trim().slice(0, 80);
  const lengthKey = String(params.lengthKey || "").trim().slice(0, 24);
  const round = Number(params.round);
  const phase = String(params.phase || "").trim().slice(0, 16);
  const status = String(params.status || "playing").trim().slice(0, 16);
  const compressed = params.compressed ? 1 : 0;
  const stateData = String(params.stateData || "");
  const gameId = String(params.gameId || "").trim().slice(0, 40);
  const dreamers = String(params.dreamers || "").trim().slice(0, 120);
  const seed = String(params.seed || "").trim().slice(0, 24);

  if (!stateData) throw new Error("Missing save data.");
  if (stateData.length > MAX_STATE_CHARS) {
    throw new Error("Save data is too large for cloud storage.");
  }
  if (!Number.isFinite(round) || round < 1) throw new Error("Invalid round.");

  const sheet = getSavesSheet_();
  const rows = readSaveRows_(sheet);
  const matching = rows.filter(function (row) {
    return String(row[2] || "").toLowerCase() === name.toLowerCase();
  });

  if (matching.length >= MAX_SAVES_PER_NAME) {
    matching.sort(function (a, b) {
      return Number(a[1]) - Number(b[1]);
    });
    const oldest = matching[0];
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === oldest[0]) {
        rows.splice(i, 1);
        break;
      }
    }
  }

  const id = String(Date.now()) + "-" + Math.random().toString(36).slice(2, 9);
  rows.push([
    id,
    Date.now(),
    name,
    label,
    lengthKey,
    Math.round(round),
    phase,
    status,
    compressed,
    stateData,
    gameId,
    dreamers,
    seed,
  ]);

  writeSaveRows_(sheet, rows);
  return {
    ok: true,
    id: id,
    saves: listSaves_(name),
  };
}

function loadSave_(id) {
  const saveId = String(id || "").trim();
  if (!saveId) throw new Error("Missing save id.");
  const sheet = getSavesSheet_();
  const row = readSaveRows_(sheet).find(function (entry) {
    return String(entry[0]) === saveId;
  });
  if (!row) throw new Error("Save not found.");
  return { save: rowToSave_(row) };
}

function deleteSave_(id) {
  const saveId = String(id || "").trim();
  if (!saveId) throw new Error("Missing save id.");
  const sheet = getSavesSheet_();
  const rows = readSaveRows_(sheet).filter(function (entry) {
    return String(entry[0]) !== saveId;
  });
  writeSaveRows_(sheet, rows);
  return { ok: true };
}

function writeSaveRows_(sheet, rows) {
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow, 13).clearContent();
    if (lastRow > rows.length + 1) {
      sheet.deleteRows(rows.length + 2, lastRow - rows.length - 1);
    }
  }
  if (!rows.length) return;
  sheet.getRange(2, 1, rows.length, 13).setValues(rows);
}

function respond_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
