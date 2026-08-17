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
];

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

function getQueryParam(request, key) {
  if (!request?.url) return "";
  try {
    return new URL(request.url, "https://dva-nu.vercel.app").searchParams.get(key) || "";
  } catch {
    const query = request.url.includes("?") ? request.url.split("?")[1] : "";
    return new URLSearchParams(query).get(key) || "";
  }
}

export async function GET(request) {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl) return notConfiguredResponse();

  try {
    const url = new URL(scriptUrl);
    url.searchParams.set("secret", getApiSecret());

    const name = getQueryParam(request, "name").trim().slice(0, 80);
    const classroom = getQueryParam(request, "class").trim();

    if (name && classroom) {
      if (!VALID_CLASSROOMS.includes(classroom)) {
        return Response.json({ error: "Invalid class." }, { status: 400, headers: corsHeaders() });
      }
      url.searchParams.set("action", "status");
      url.searchParams.set("name", name);
      url.searchParams.set("class", classroom);

      const data = await fetchScriptJson(url.toString(), { method: "GET" });
      if (data.error) {
        return Response.json({ error: data.error }, { status: 502, headers: corsHeaders() });
      }
      return Response.json(
        { voted: Boolean(data.voted), choice: VALID.has(data.choice) ? data.choice : null },
        { headers: corsHeaders() }
      );
    }

    url.searchParams.set("action", "tally");

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
    const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
    const classroom = typeof body?.class === "string" ? body.class.trim() : "";
    const choice = body?.choice;
    if (!name || !classroom) {
      return Response.json({ error: "Enter your name and class." }, { status: 400, headers: corsHeaders() });
    }
    if (!VALID_CLASSROOMS.includes(classroom)) {
      return Response.json({ error: "Invalid class." }, { status: 400, headers: corsHeaders() });
    }
    if (!VALID.has(choice)) {
      return Response.json({ error: "Pick short, mid, or full." }, { status: 400, headers: corsHeaders() });
    }

    const data = await fetchScriptJson(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "vote",
        secret: getApiSecret(),
        name,
        class: classroom,
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
