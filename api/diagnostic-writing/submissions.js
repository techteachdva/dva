/**
 * Diagnostic Writing Submissions API
 * GET:  ?password=...  → all submissions (teacher only)
 * POST: { name, text, analysis, durationSec } → save submission
 *
 * Requires Upstash Redis (UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN)
 */

const TEACHER_PASSWORD = "studentsfirst";
const SUBMISSIONS_KEY = "diagnostic_writing_submissions";
const MAX_SUBMISSIONS = 500;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}

async function getRedis() {
  const { Redis } = await import("@upstash/redis");
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

export async function GET(request) {
  const url = new URL(request.url);
  const password = url.searchParams.get("password") || "";

  if (password !== TEACHER_PASSWORD) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: corsHeaders() }
    );
  }

  try {
    const redis = await getRedis();
    const raw = await redis.get(SUBMISSIONS_KEY);
    const submissions = Array.isArray(raw) ? raw : [];
    submissions.sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
    return Response.json({ submissions }, { headers: corsHeaders() });
  } catch (e) {
    console.error("Diagnostic writing GET error:", e.message);
    return Response.json(
      { error: "Server error", submissions: [] },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
    const text = typeof body?.text === "string" ? body.text.trim().slice(0, 15000) : "";
    const analysis = body?.analysis && typeof body.analysis === "object" ? body.analysis : null;
    const durationSec = Number(body?.durationSec);

    if (!name || !text || !analysis) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400, headers: corsHeaders() }
      );
    }

    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name,
      text,
      analysis,
      durationSec: Number.isFinite(durationSec) ? durationSec : 300,
      submittedAt: Date.now(),
    };

    const redis = await getRedis();
    let submissions = await redis.get(SUBMISSIONS_KEY);
    if (!Array.isArray(submissions)) submissions = [];
    submissions.unshift(entry);
    submissions = submissions.slice(0, MAX_SUBMISSIONS);
    await redis.set(SUBMISSIONS_KEY, submissions);

    return Response.json({ ok: true, id: entry.id }, { headers: corsHeaders() });
  } catch (e) {
    console.error("Diagnostic writing POST error:", e.message);
    return Response.json(
      { error: "Server error" },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
