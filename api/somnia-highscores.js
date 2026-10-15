/**
 * Somnia Google Sheets proxy — high scores + cloud game saves.
 *
 * High scores:
 *   GET  /api/somnia-highscores → { scores: [...] }
 *   POST /api/somnia-highscores → submit a run
 *
 * Cloud saves (same Apps Script deployment):
 *   GET  /api/somnia-saves?name=Phil%20K → { saves: [...] }
 *   POST /api/somnia-saves { action: "saveGame"|"load"|"delete", ... }
 *
 * Ainmos uses the same deployment with game=ainmos (its own sheet tabs):
 *   /api/ainmos-highscores and /api/ainmos-saves rewrite here with ?game=ainmos.
 *   Before any Ainmos call the proxy pings the script; an older script that
 *   does not know Ainmos gets a setupRequired reply, never a write into Somnia's tabs.
 *
 * Vercel environment variables:
 *   SOMNIA_HIGHSCORES_SCRIPT_URL
 *   SOMNIA_HIGHSCORES_API_SECRET
 *
 * Setup: see google-apps-script/somnia-highscores-backend.gs
 */

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}

function getScriptUrl() {
  return (process.env.SOMNIA_HIGHSCORES_SCRIPT_URL || "").trim();
}

function getApiSecret() {
  return (process.env.SOMNIA_HIGHSCORES_API_SECRET || "studentsfirst").trim();
}

function assertScriptUrl(scriptUrl) {
  if (!scriptUrl) return;
  if (!scriptUrl.includes("script.google.com")) {
    throw new Error(
      "SOMNIA_HIGHSCORES_SCRIPT_URL must be a Google Apps Script web app URL (https://script.google.com/.../exec), not a Google Sheet link.",
    );
  }
  if (scriptUrl.includes("/dev")) {
    throw new Error(
      "SOMNIA_HIGHSCORES_SCRIPT_URL is using a /dev test URL. Deploy the script as a web app and use the /exec URL.",
    );
  }
}

function parseScriptResponse(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    throw new Error("Google Script returned an empty response. Redeploy the Somnia Apps Script web app.");
  }
  if (trimmed.startsWith("<")) {
    if (/sign in|accounts\.google/i.test(trimmed)) {
      throw new Error(
        "Google Script is not public. Redeploy with Who has access: Anyone, then update SOMNIA_HIGHSCORES_SCRIPT_URL on Vercel.",
      );
    }
    if (/script function not found|page not found/i.test(trimmed)) {
      throw new Error(
        "Google Script deployment not found. Create a new web app deployment and paste the /exec URL into SOMNIA_HIGHSCORES_SCRIPT_URL.",
      );
    }
    throw new Error(
      "Google Script returned HTML instead of JSON. Set SPREADSHEET_ID in google-apps-script/somnia-highscores-backend.gs, run initSheet(), deploy as web app (/exec), then update Vercel.",
    );
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error(`Google Script returned an unexpected response: ${trimmed.slice(0, 120)}`);
  }
}

async function fetchScriptJson(url, options) {
  const res = await fetch(url, { ...options, redirect: "follow" });
  const text = await res.text();
  try {
    return parseScriptResponse(text);
  } catch (e) {
    console.error("Somnia Apps Script non-JSON response:", text.slice(0, 200));
    throw e;
  }
}

const GAMES = new Set(["somnia", "ainmos"]);

function gameOf(request, body = null) {
  const fromUrl = new URL(request.url).searchParams.get("game");
  const game = String(body?.game || fromUrl || "somnia").toLowerCase();
  return GAMES.has(game) ? game : "somnia";
}

let ainmosReady = { ok: false, checkedAt: 0 };

/** True when the deployed Apps Script has the Ainmos tabs (backend version 2+). */
async function ainmosBackendReady(scriptUrl) {
  const now = Date.now();
  if (ainmosReady.ok || now - ainmosReady.checkedAt < 60000) return ainmosReady.ok;
  try {
    const url = new URL(scriptUrl);
    url.searchParams.set("action", "ping");
    url.searchParams.set("game", "ainmos");
    url.searchParams.set("secret", getApiSecret());
    const data = await fetchScriptJson(url.toString(), { method: "GET" });
    ainmosReady = { ok: Boolean(data.ok && Array.isArray(data.games) && data.games.includes("ainmos")), checkedAt: now };
  } catch {
    ainmosReady = { ok: false, checkedAt: now };
  }
  return ainmosReady.ok;
}

function ainmosNotDeployedResponse(kind) {
  return Response.json(
    {
      error:
        "Ainmos cloud storage is not deployed yet. Paste the updated google-apps-script/somnia-highscores-backend.gs into the Apps Script editor and deploy a New version (same /exec URL).",
      [kind]: [],
      setupRequired: true,
    },
    { status: 503, headers: corsHeaders() },
  );
}

function isSavesRequest(request, body = null) {
  const url = new URL(request.url);
  if (url.pathname.endsWith("/somnia-saves")) return true;
  if (url.searchParams.get("somniaApi") === "saves") return true;
  const action = String(body?.action || "");
  return action === "saveGame" || action === "load" || action === "delete" || action === "listSaves";
}

function notConfiguredScoresResponse() {
  return Response.json(
    {
      error:
        "High score storage is not configured. Deploy the Google Apps Script (google-apps-script/somnia-highscores-backend.gs), then add SOMNIA_HIGHSCORES_SCRIPT_URL to Vercel environment variables and redeploy.",
      scores: [],
      setupRequired: true,
    },
    { status: 503, headers: corsHeaders() },
  );
}

function notConfiguredSavesResponse() {
  return Response.json(
    {
      error:
        "Cloud save storage is not configured. Redeploy google-apps-script/somnia-highscores-backend.gs with the SavedGames sheet, then set SOMNIA_HIGHSCORES_SCRIPT_URL on Vercel.",
      saves: [],
      setupRequired: true,
    },
    { status: 503, headers: corsHeaders() },
  );
}

function normalizeScore(entry) {
  if (!entry || typeof entry !== "object") return null;
  const score = Number(entry.score);
  if (!Number.isFinite(score)) return null;
  return {
    id: String(entry.id || ""),
    submittedAt: Number(entry.submittedAt) || 0,
    name: String(entry.name || "").slice(0, 24),
    score: Math.round(score),
    won: Boolean(entry.won),
    seconds: Number(entry.seconds) || 0,
    difficulty: String(entry.difficulty || "").slice(0, 24),
    breakdown: entry.breakdown && typeof entry.breakdown === "object" ? entry.breakdown : {},
    rank: Number(entry.rank) || 0,
  };
}

function normalizeSaveMeta(entry) {
  if (!entry || typeof entry !== "object") return null;
  return {
    id: String(entry.id || ""),
    updatedAt: Number(entry.updatedAt) || 0,
    name: String(entry.name || "").slice(0, 24),
    label: String(entry.label || "").slice(0, 80),
    lengthKey: String(entry.lengthKey || "").slice(0, 24),
    round: Number(entry.round) || 0,
    phase: String(entry.phase || "").slice(0, 16),
    status: String(entry.status || "playing").slice(0, 16),
    gameId: String(entry.gameId || "").slice(0, 40),
    seed: String(entry.seed || "").slice(0, 24),
    dreamers: String(entry.dreamers || "").slice(0, 120),
    compressed: Boolean(entry.compressed),
  };
}

async function handleScoresGet(game = "somnia") {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl) return notConfiguredScoresResponse();

  try {
    assertScriptUrl(scriptUrl);
    if (game === "ainmos" && !(await ainmosBackendReady(scriptUrl))) return ainmosNotDeployedResponse("scores");
    const url = new URL(scriptUrl);
    url.searchParams.set("action", "list");
    url.searchParams.set("secret", getApiSecret());
    url.searchParams.set("game", game);

    const data = await fetchScriptJson(url.toString(), { method: "GET" });
    if (data.error) {
      return Response.json(
        { error: data.error, scores: [] },
        { status: data.error === "Unauthorized" ? 401 : 502, headers: corsHeaders() },
      );
    }

    const scores = Array.isArray(data.scores)
      ? data.scores.map(normalizeScore).filter(Boolean)
      : [];

    return Response.json({ scores }, { headers: corsHeaders() });
  } catch (e) {
    console.error("Somnia high scores GET proxy error:", e.message);
    return Response.json(
      { error: e.message || "Could not load high scores.", scores: [] },
      { status: 502, headers: corsHeaders() },
    );
  }
}

async function handleSavesGet(request, game = "somnia") {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl) return notConfiguredSavesResponse();

  try {
    assertScriptUrl(scriptUrl);
    if (game === "ainmos" && !(await ainmosBackendReady(scriptUrl))) return ainmosNotDeployedResponse("saves");
    const { searchParams } = new URL(request.url);
    const name = (searchParams.get("name") || "").trim().slice(0, 24);
    const url = new URL(scriptUrl);
    url.searchParams.set("action", "listSaves");
    url.searchParams.set("secret", getApiSecret());
    url.searchParams.set("game", game);
    if (name) url.searchParams.set("name", name);

    const data = await fetchScriptJson(url.toString(), { method: "GET" });
    if (data.error) {
      return Response.json(
        { error: data.error, saves: [] },
        { status: data.error === "Unauthorized" ? 401 : 502, headers: corsHeaders() },
      );
    }

    const saves = Array.isArray(data.saves)
      ? data.saves.map(normalizeSaveMeta).filter(Boolean)
      : [];

    return Response.json({ saves }, { headers: corsHeaders() });
  } catch (e) {
    console.error("Somnia saves GET proxy error:", e.message);
    return Response.json(
      { error: e.message || "Could not load saves.", saves: [] },
      { status: 502, headers: corsHeaders() },
    );
  }
}

async function handleScoresPost(body, game = "somnia") {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl) return notConfiguredScoresResponse();
  assertScriptUrl(scriptUrl);
  if (game === "ainmos" && !(await ainmosBackendReady(scriptUrl))) return ainmosNotDeployedResponse("scores");

  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 24) : "";
  const score = Number(body?.score);
  const won = Boolean(body?.won);
  const seconds = Number(body?.seconds);
  const difficulty = typeof body?.difficulty === "string" ? body.difficulty.trim().slice(0, 24) : "";
  const breakdown = body?.breakdown && typeof body.breakdown === "object" ? body.breakdown : {};

  if (!name) {
    return Response.json({ error: "Enter your first name and last initial." }, { status: 400, headers: corsHeaders() });
  }
  if (!Number.isFinite(score) || score < 0) {
    return Response.json({ error: "Invalid score." }, { status: 400, headers: corsHeaders() });
  }
  if (!Number.isFinite(seconds) || seconds < 0) {
    return Response.json({ error: "Invalid run time." }, { status: 400, headers: corsHeaders() });
  }

  const data = await fetchScriptJson(scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "save",
      secret: getApiSecret(),
      game,
      name,
      score: Math.round(score),
      won,
      seconds: Math.round(seconds),
      difficulty,
      breakdown,
    }),
  });

  if (data.error) {
    return Response.json({ error: data.error }, { status: 502, headers: corsHeaders() });
  }

  const scores = Array.isArray(data.scores)
    ? data.scores.map(normalizeScore).filter(Boolean)
    : [];

  return Response.json(
    {
      ok: true,
      id: data.id || "",
      rank: Number(data.rank) || 0,
      inTop: Boolean(data.inTop),
      scores,
    },
    { headers: corsHeaders() },
  );
}

async function handleSavesPost(body, game = "somnia") {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl) return notConfiguredSavesResponse();
  assertScriptUrl(scriptUrl);
  if (game === "ainmos" && !(await ainmosBackendReady(scriptUrl))) return ainmosNotDeployedResponse("saves");

  let action = String(body?.action || "saveGame");
  if (action === "save") action = "saveGame";

  const payload = {
    ...body,
    action,
    secret: getApiSecret(),
    game,
  };

  const data = await fetchScriptJson(scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (data.error) {
    return Response.json({ error: data.error }, { status: 502, headers: corsHeaders() });
  }

  if (action === "load" && data.save) {
    return Response.json({ save: data.save }, { headers: corsHeaders() });
  }

  if (action === "save" || action === "saveGame") {
    const saves = Array.isArray(data.saves)
      ? data.saves.map(normalizeSaveMeta).filter(Boolean)
      : [];
    return Response.json(
      { ok: true, id: data.id || "", saves },
      { headers: corsHeaders() },
    );
  }

  return Response.json(data, { headers: corsHeaders() });
}

export async function GET(request) {
  const game = gameOf(request);
  if (isSavesRequest(request)) {
    return handleSavesGet(request, game);
  }
  return handleScoresGet(game);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const game = gameOf(request, body);
    if (isSavesRequest(request, body)) {
      if (!getScriptUrl()) return notConfiguredSavesResponse();
      return await handleSavesPost(body, game);
    }
    if (!getScriptUrl()) return notConfiguredScoresResponse();
    return await handleScoresPost(body, game);
  } catch (e) {
    console.error("Somnia API POST proxy error:", e.message);
    return Response.json({ error: e.message || "Could not complete request." }, { status: 502, headers: corsHeaders() });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
