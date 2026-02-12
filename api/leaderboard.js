/**
 * Dungeon Class Leaderboard API
 * GET: returns top 10 scores
 * POST: submit a score (body: { name: "ABC", time: 123.45 })
 *
 * Requires Upstash Redis. Add to Vercel:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 */

const PROHIBITED = [
  "ASS", "SEX", "FUK", "FUC", "GAY", "FAG", "PIS", "HOE", "NIG", "BCH",
  "DTF", "CNT", "VAG", "GUN", "COK", "COC", "DIC", "DIK"
];

const LEADERBOARD_KEY = "dungeon_class_leaderboard";
const MAX_ENTRIES = 10;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function isNameValid(name) {
  if (!name || typeof name !== "string") return false;
  const upper = name.toUpperCase().trim();
  if (upper.length !== 3) return false;
  return !PROHIBITED.includes(upper);
}

export async function GET() {
  try {
    const { Redis } = await import("@upstash/redis");
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    const raw = await redis.get(LEADERBOARD_KEY);
    const entries = Array.isArray(raw) ? raw : [];
    return Response.json(entries, { headers: corsHeaders() });
  } catch (e) {
    console.error("Leaderboard GET error:", e.message);
    return Response.json([], { headers: corsHeaders() });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const name = body?.name;
    const time = parseFloat(body?.time);
    if (!name || typeof time !== "number" || isNaN(time) || time < 0) {
      return Response.json(
        { error: "Invalid request" },
        { status: 400, headers: corsHeaders() }
      );
    }
    if (!isNameValid(name)) {
      return Response.json(
        { error: "NOPE! Try a valid input" },
        { status: 400, headers: corsHeaders() }
      );
    }
    const entry = {
      name: name.toUpperCase().trim(),
      time,
      time_sec: time,
      created_at: Date.now(),
    };
    const { Redis } = await import("@upstash/redis");
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    let entries = await redis.get(LEADERBOARD_KEY);
    if (!Array.isArray(entries)) entries = [];
    entries.push(entry);
    entries.sort((a, b) => (a.time || a.time_sec) - (b.time || b.time_sec));
    entries = entries.slice(0, MAX_ENTRIES);
    await redis.set(LEADERBOARD_KEY, entries);
    return Response.json({ ok: true }, { headers: corsHeaders() });
  } catch (e) {
    console.error("Leaderboard POST error:", e.message);
    return Response.json(
      { error: "Server error" },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
