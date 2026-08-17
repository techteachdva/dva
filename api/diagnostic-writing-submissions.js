/**
 * Diagnostic Writing Submissions API
 * GET:  ?password=...  → all submissions (teacher only)
 * POST: { name, classroom, text, analysis, durationSec } → save submission
 *
 * Requires Upstash Redis (UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN)
 */

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

const TEACHER_PASSWORD = "studentsfirst";
const SUBMISSIONS_KEY = "diagnostic_writing_submissions_v2";
const MAX_SUBMISSIONS = 2000;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}

function hasRedisConfig() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function getRedis() {
  if (!hasRedisConfig()) {
    throw new Error("Redis not configured");
  }
  const { Redis } = await import("@upstash/redis");
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

function isValidClassroom(classroom) {
  return typeof classroom === "string" && VALID_CLASSROOMS.includes(classroom);
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== "object" || !entry.name || !entry.text) return null;
  return entry;
}

async function loadSubmissions(redis) {
  const raw = await redis.get(SUBMISSIONS_KEY);
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeEntry).filter(Boolean);
}

async function saveSubmission(redis, entry) {
  const submissions = await loadSubmissions(redis);
  submissions.unshift(entry);
  await redis.set(SUBMISSIONS_KEY, submissions.slice(0, MAX_SUBMISSIONS));
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

  if (!hasRedisConfig()) {
    return Response.json(
      {
        error: "Server storage is not configured. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel.",
        submissions: [],
      },
      { status: 503, headers: corsHeaders() }
    );
  }

  try {
    const redis = await getRedis();
    const submissions = await loadSubmissions(redis);
    submissions.sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
    return Response.json({ submissions, classrooms: VALID_CLASSROOMS }, { headers: corsHeaders() });
  } catch (e) {
    console.error("Diagnostic writing GET error:", e.message);
    return Response.json(
      { error: "Server error", submissions: [] },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function POST(request) {
  if (!hasRedisConfig()) {
    return Response.json(
      { error: "Server storage is not configured. Contact your teacher." },
      { status: 503, headers: corsHeaders() }
    );
  }

  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
    const classroom = typeof body?.classroom === "string" ? body.classroom.trim() : "";
    const text = typeof body?.text === "string" ? body.text.trim().slice(0, 15000) : "";
    const analysis = body?.analysis && typeof body.analysis === "object" ? body.analysis : null;
    const durationSec = Number(body?.durationSec);

    if (!name || !classroom || !text || !analysis) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400, headers: corsHeaders() }
      );
    }

    if (!isValidClassroom(classroom)) {
      return Response.json(
        { error: "Invalid classroom" },
        { status: 400, headers: corsHeaders() }
      );
    }

    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name,
      classroom,
      text,
      analysis,
      durationSec: Number.isFinite(durationSec) ? durationSec : 300,
      submittedAt: Date.now(),
    };

    const redis = await getRedis();
    await saveSubmission(redis, entry);

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
