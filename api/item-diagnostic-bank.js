/**
 * Published ITEM Diagnostic question bank.
 *
 * GET  — students and the teacher page. Returns the uploaded bank, or
 *        { source: "builtin" } so the page keeps the Tech Escape questions.
 * POST — teacher only. preview | publish | revert
 *
 * Storage uses the same Upstash Redis env vars as the leaderboard:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 */

import { parseBankFile, normalizeQuestionList } from "./item-diagnostic/parse-bank.mjs";

const TEACHER_PASSWORD = "studentsfirst";
const BANK_KEY = "item_diagnostic_question_bank";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}

function json(body, status = 200) {
  return Response.json(body, { status, headers: corsHeaders() });
}

function storageReady() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function redisClient() {
  const { Redis } = await import("@upstash/redis");
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

function readStored(stored) {
  if (!stored) return null;
  if (typeof stored === "string") {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return typeof stored === "object" ? stored : null;
}

function publishedPayload(stored) {
  const normalized = normalizeQuestionList(stored?.questions);
  if (!normalized.questions.length) return null;
  return {
    source: "upload",
    storage: "ready",
    label: String(stored.label || "Uploaded spreadsheet").slice(0, 120),
    updatedAt: Number(stored.updatedAt) || null,
    count: normalized.questions.length,
    questions: normalized.questions,
  };
}

export async function GET() {
  if (!storageReady()) {
    return json({ source: "builtin", storage: "unavailable" });
  }
  try {
    const redis = await redisClient();
    const stored = readStored(await redis.get(BANK_KEY));
    const published = stored ? publishedPayload(stored) : null;
    if (!published) return json({ source: "builtin", storage: "ready" });
    return json(published);
  } catch (error) {
    console.error("ITEM Diagnostic bank GET error:", error.message);
    return json({ source: "builtin", storage: "ready" });
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "The upload could not be read." }, 400);
  }

  if (String(body?.password || "") !== TEACHER_PASSWORD) {
    return json({ error: "Unauthorized" }, 401);
  }

  const action = String(body?.action || "preview");

  if (action === "preview") {
    const fileBase64 = String(body.fileBase64 || "");
    if (!fileBase64 || fileBase64.length > 2_800_000) {
      return json({ error: "Choose a spreadsheet under 2 MB." }, 400);
    }
    const parsed = parseBankFile(Buffer.from(fileBase64, "base64"), String(body.filename || ""));
    return json({
      ok: parsed.questions.length > 0,
      filename: String(body.filename || "").slice(0, 120),
      sheetName: parsed.sheetName,
      count: parsed.questions.length,
      excluded: parsed.excluded,
      errors: parsed.errors.slice(0, 30),
      warnings: parsed.warnings.slice(0, 30),
      questions: parsed.questions,
    });
  }

  if (action === "publish") {
    if (!storageReady()) {
      return json({
        error: "This site cannot store a new question bank yet, so the built-in questions stay in place.",
        storage: "unavailable",
      }, 503);
    }
    const normalized = normalizeQuestionList(body.questions);
    if (!normalized.questions.length) {
      return json({
        error: normalized.errors[0] || "That file has no usable questions.",
        errors: normalized.errors.slice(0, 30),
      }, 400);
    }
    const record = {
      label: String(body.label || "Uploaded spreadsheet").slice(0, 120),
      updatedAt: Date.now(),
      questions: normalized.questions,
    };
    try {
      const redis = await redisClient();
      await redis.set(BANK_KEY, record);
    } catch (error) {
      console.error("ITEM Diagnostic bank publish error:", error.message);
      return json({ error: "The new bank could not be saved. The built-in questions are still active." }, 502);
    }
    return json({
      ok: true,
      source: "upload",
      label: record.label,
      updatedAt: record.updatedAt,
      count: record.questions.length,
      warnings: normalized.warnings.slice(0, 30),
      questions: record.questions,
    });
  }

  if (action === "revert") {
    if (!storageReady()) {
      return json({ ok: true, source: "builtin", storage: "unavailable" });
    }
    try {
      const redis = await redisClient();
      await redis.del(BANK_KEY);
    } catch (error) {
      console.error("ITEM Diagnostic bank revert error:", error.message);
      return json({ error: "The built-in bank could not be restored." }, 502);
    }
    return json({ ok: true, source: "builtin", storage: "ready" });
  }

  return json({ error: "Unknown action" }, 400);
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
