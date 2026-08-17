/**
 * About Mr. Phil profile version votes.
 * GET: { short, mid, full, total }
 * POST: { choice: "short" | "mid" | "full" }
 */

const VOTES_KEY = "about_mr_phil_profile_votes";
const VALID = new Set(["short", "mid", "full"]);

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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

export async function GET() {
  try {
    const { Redis } = await import("@upstash/redis");
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    const raw = await redis.get(VOTES_KEY);
    return Response.json(normalize(raw), { headers: corsHeaders() });
  } catch (e) {
    console.error("about-mr-phil-vote GET:", e.message);
    return Response.json(emptyTally(), { headers: corsHeaders() });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const choice = body?.choice;
    if (!VALID.has(choice)) {
      return Response.json({ error: "Pick short, mid, or full." }, { status: 400, headers: corsHeaders() });
    }

    const { Redis } = await import("@upstash/redis");
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    const raw = await redis.get(VOTES_KEY);
    const tally = normalize(raw);
    tally[choice] += 1;
    tally.total += 1;
    await redis.set(VOTES_KEY, { short: tally.short, mid: tally.mid, full: tally.full });
    return Response.json(tally, { headers: corsHeaders() });
  } catch (e) {
    console.error("about-mr-phil-vote POST:", e.message);
    return Response.json({ error: "Could not save vote." }, { status: 500, headers: corsHeaders() });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
