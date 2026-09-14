/**
 * Somnia cloud game saves — proxies to Google Sheets (Apps Script).
 *
 * GET  ?name=Phil%20K → { saves: [...] }  metadata only
 * POST { action: "save", name, label, ... stateData }
 * POST { action: "load", id }
 * POST { action: "delete", id }
 *
 * Uses the same Apps Script deployment as high scores:
 *   SOMNIA_HIGHSCORES_SCRIPT_URL
 *   SOMNIA_HIGHSCORES_API_SECRET
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

function notConfiguredResponse() {
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

async function fetchScriptJson(url, options) {
  const res = await fetch(url, { ...options, redirect: "follow" });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error("Somnia saves script non-JSON response:", text.slice(0, 200));
    throw new Error("Google Script returned an invalid response. Check deployment URL and permissions.");
  }
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
    compressed: Boolean(entry.compressed),
  };
}

export async function GET(request) {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl) return notConfiguredResponse();

  try {
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

export async function POST(request) {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl) return notConfiguredResponse();

  try {
    const body = await request.json();
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
  } catch (e) {
    console.error("Somnia saves POST proxy error:", e.message);
    return Response.json(
      { error: e.message || "Could not complete save request." },
      { status: 502, headers: corsHeaders() },
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
