/**
 * About Mr. Phil profile vote — Google Sheets backend
 *
 * SETUP (about 10 minutes):
 * 1. Create a new Google Sheet (e.g. "About Mr. Phil Votes")
 * 2. Extensions → Apps Script → paste this file → Save
 * 3. Set SPREADSHEET_ID below (from the sheet URL)
 * 4. Run initSheet once (authorize when prompted)
 * 5. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. Copy the Web app URL into Vercel env: ABOUT_MR_PHIL_VOTE_SCRIPT_URL
 * 7. Set ABOUT_MR_PHIL_VOTE_API_SECRET in Vercel to match API_SECRET below
 */

const SPREADSHEET_ID = normalizeSheetId_("PASTE_YOUR_SHEET_ID_HERE");
const SHEET_NAME = "Votes";
const API_SECRET = "studentsfirst";
const VALID_CHOICES = ["short", "mid", "full"];

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
    .getRange(1, 1, 1, 3)
    .setValues([["id", "votedAt", "choice"]]);
  sheet.getRange(1, 1, 1, 3).setFontWeight("bold");
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

    const action = String(params.action || (isGet ? "tally" : "vote"));

    if (action === "tally") {
      return respond_(getTally_());
    }

    if (action === "vote") {
      return respond_(saveVote_(params));
    }

    return respond_({ error: "Unknown action" });
  } catch (err) {
    return respond_({ error: String(err.message || err) });
  }
}

function getTally_() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  const tally = { short: 0, mid: 0, full: 0, total: 0 };

  if (lastRow < 2) return tally;

  const values = sheet.getRange(2, 1, lastRow, 3).getValues();
  for (let i = 0; i < values.length; i++) {
    const choice = String(values[i][2] || "").trim();
    if (VALID_CHOICES.indexOf(choice) === -1) continue;
    tally[choice] += 1;
    tally.total += 1;
  }

  return tally;
}

function saveVote_(params) {
  const choice = String(params.choice || "").trim();
  if (VALID_CHOICES.indexOf(choice) === -1) {
    throw new Error("Pick short, mid, or full.");
  }

  const sheet = getSheet_();
  const id = String(Date.now()) + "-" + Math.random().toString(36).slice(2, 9);
  sheet.appendRow([id, Date.now(), choice]);

  return getTally_();
}

function respond_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
