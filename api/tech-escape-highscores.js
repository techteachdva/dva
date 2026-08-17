/**
 * Tech Escape global high scores — proxies to Google Sheets (Apps Script).
 *
 * GET  → { scores: [...] }  top 100
 * POST → { ok, rank, inTop, scores }  submit a run
 *
 * Vercel environment variables:
 *   TECH_ESCAPE_HIGHSCORES_SCRIPT_URL  — deployed Apps Script web app URL
 *   TECH_ESCAPE_HIGHSCORES_API_SECRET — must match API_SECRET in the script (default: studentsfirst)
 *
 * Setup: see google-apps-script/tech-escape-highscores-backend.gs
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
  return (process.env.TECH_ESCAPE_HIGHSCORES_SCRIPT_URL || "").trim();
}

function getApiSecret() {
  return (process.env.TECH_ESCAPE_HIGHSCORES_API_SECRET || "studentsfirst").trim();
}

function notConfiguredResponse() {
  return Response.json(
    {
      error:
        "High score storage is not configured. Deploy the Google Apps Script (google-apps-script/tech-escape-highscores-backend.gs), then add TECH_ESCAPE_HIGHSCORES_SCRIPT_URL to Vercel environment variables and redeploy.",
      scores: [],
      setupRequired: true,
    },
    { status: 503, headers: corsHeaders() }
  );
}

async function fetchScriptJson(url, options) {
  const res = await fetch(url, { ...options, redirect: "follow" });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error("High scores script non-JSON response:", text.slice(0, 200));
    throw new Error("Google Script returned an invalid response. Check deployment URL and permissions.");
  }
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
    escaped: Boolean(entry.escaped),
    seconds: Number(entry.seconds) || 0,
    floor: String(entry.floor || "").slice(0, 40),
    difficulty: String(entry.difficulty || "").slice(0, 24),
    breakdown: entry.breakdown && typeof entry.breakdown === "object" ? entry.breakdown : {},
    rank: Number(entry.rank) || 0,
  };
}

export async function GET() {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl) return notConfiguredResponse();

  try {
    const url = new URL(scriptUrl);
    url.searchParams.set("action", "list");
    url.searchParams.set("secret", getApiSecret());

    const data = await fetchScriptJson(url.toString(), { method: "GET" });
    if (data.error) {
      return Response.json(
        { error: data.error, scores: [] },
        { status: data.error === "Unauthorized" ? 401 : 502, headers: corsHeaders() }
      );
    }

    const scores = Array.isArray(data.scores)
      ? data.scores.map(normalizeScore).filter(Boolean)
      : [];

    return Response.json({ scores }, { headers: corsHeaders() });
  } catch (e) {
    console.error("Tech Escape high scores GET proxy error:", e.message);
    return Response.json(
      { error: e.message || "Could not load high scores.", scores: [] },
      { status: 502, headers: corsHeaders() }
    );
  }
}

export async function POST(request) {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl) return notConfiguredResponse();

  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim().slice(0, 24) : "";
    const score = Number(body?.score);
    const escaped = Boolean(body?.escaped);
    const seconds = Number(body?.seconds);
    const floor = typeof body?.floor === "string" ? body.floor.trim().slice(0, 40) : "";
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
        escaped,
        seconds: Math.round(seconds),
        floor,
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
      { headers: corsHeaders() }
    );
  } catch (e) {
    console.error("Tech Escape high scores POST proxy error:", e.message);
    return Response.json({ error: e.message || "Could not save score." }, { status: 502, headers: corsHeaders() });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
