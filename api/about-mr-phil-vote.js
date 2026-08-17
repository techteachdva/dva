/**
 * About Mr. Phil profile version votes — proxies to Google Sheets (Apps Script).
 *
 * GET: { short, mid, full, total }
 * POST: { choice: "short" | "mid" | "full" }
 *
 * Vercel environment variables:
 *   ABOUT_MR_PHIL_VOTE_SCRIPT_URL  — deployed Apps Script web app URL
 *   ABOUT_MR_PHIL_VOTE_API_SECRET  — must match API_SECRET in the script (default: studentsfirst)
 *
 * Setup: see google-apps-script/about-mr-phil-vote-backend.gs
 */

const VALID = new Set(["short", "mid", "full"]);

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}

function emptyTally() {
  return { short: 0, mid: 0, full: 0, total: 0 };
}

function normalize(raw) {
  const tally = emptyTally();
  if (!raw || typeof raw !== "object") return tally;
  for (const key of VALID) {
    const n = Number(raw[key] ?? 0);
    tally[key] = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    tally.total += tally[key];
  }
  return tally;
}

function getScriptUrl() {
  return (process.env.ABOUT_MR_PHIL_VOTE_SCRIPT_URL || "").trim();
}

function getApiSecret() {
  return (process.env.ABOUT_MR_PHIL_VOTE_API_SECRET || "studentsfirst").trim();
}

function notConfiguredResponse() {
  return Response.json(
    {
      ...emptyTally(),
      error:
        "Vote storage is not configured. Deploy the Google Apps Script (google-apps-script/about-mr-phil-vote-backend.gs), then add ABOUT_MR_PHIL_VOTE_SCRIPT_URL to Vercel environment variables and redeploy.",
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
    console.error("Vote script non-JSON response:", text.slice(0, 200));
    throw new Error("Google Script returned an invalid response. Check deployment URL and permissions.");
  }
}

export async function GET() {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl) return notConfiguredResponse();

  try {
    const url = new URL(scriptUrl);
    url.searchParams.set("action", "tally");
    url.searchParams.set("secret", getApiSecret());

    const data = await fetchScriptJson(url.toString(), { method: "GET" });
    if (data.error) {
      return Response.json(
        { ...emptyTally(), error: data.error },
        { status: 502, headers: corsHeaders() }
      );
    }
    return Response.json(normalize(data), { headers: corsHeaders() });
  } catch (e) {
    console.error("About Mr. Phil vote GET proxy error:", e.message);
    return Response.json(
      { ...emptyTally(), error: e.message || "Could not load votes from Google Sheets." },
      { status: 502, headers: corsHeaders() }
    );
  }
}

export async function POST(request) {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl) return notConfiguredResponse();

  try {
    const body = await request.json();
    const choice = body?.choice;
    if (!VALID.has(choice)) {
      return Response.json({ error: "Pick short, mid, or full." }, { status: 400, headers: corsHeaders() });
    }

    const data = await fetchScriptJson(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "vote",
        secret: getApiSecret(),
        choice,
      }),
    });

    if (data.error) {
      return Response.json({ error: data.error }, { status: 502, headers: corsHeaders() });
    }

    return Response.json(normalize(data), { headers: corsHeaders() });
  } catch (e) {
    console.error("About Mr. Phil vote POST proxy error:", e.message);
    return Response.json({ error: e.message || "Could not save vote." }, { status: 502, headers: corsHeaders() });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
