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

async function handleScoresGet() {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl) return notConfiguredScoresResponse();

  try {
    assertScriptUrl(scriptUrl);
    const url = new URL(scriptUrl);
    url.searchParams.set("action", "list");
    url.searchParams.set("secret", getApiSecret());

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

async function handleSavesGet(request) {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl) return notConfiguredSavesResponse();

  try {
    assertScriptUrl(scriptUrl);
    const { searchParams } = new URL(request.url);
    const name = (searchParams.get("name") || "").trim().slice(0, 24);
    const url = new URL(scriptUrl);
    url.searchParams.set("action", "listSaves");
    url.searchParams.set("secret", getApiSecret());
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

async function handleScoresPost(body) {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl) return notConfiguredScoresResponse();
  assertScriptUrl(scriptUrl);

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

async function handleSavesPost(body) {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl) return notConfiguredSavesResponse();
  assertScriptUrl(scriptUrl);

  let action = String(body?.action || "saveGame");
  if (action === "save") action = "saveGame";

  const payload = {
    action,
    secret: getApiSecret(),
    ...body,
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
  if (isSavesRequest(request)) {
    return handleSavesGet(request);
  }
  return handleScoresGet();
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (isSavesRequest(request, body)) {
      if (!getScriptUrl()) return notConfiguredSavesResponse();
      return await handleSavesPost(body);
    }
    if (!getScriptUrl()) return notConfiguredScoresResponse();
    return await handleScoresPost(body);
  } catch (e) {
    console.error("Somnia API POST proxy error:", e.message);
    return Response.json({ error: e.message || "Could not complete request." }, { status: 502, headers: corsHeaders() });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
