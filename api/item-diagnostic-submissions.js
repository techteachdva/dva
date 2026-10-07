/**
 * ITEM 2025 Diagnostic API — proxies to Google Sheets (Apps Script).
 *
 * Vercel environment variables:
 *   ITEM_DIAGNOSTIC_SCRIPT_URL  — deployed Apps Script web app URL
 *   ITEM_DIAGNOSTIC_API_SECRET    — must match API_SECRET in the script (default: studentsfirst)
 *
 * Setup: see google-apps-script/item-diagnostic-backend.gs
 */

import { VALID_CLASSROOMS, resolveClassroom, verifyClassroomCode, CLASSROOM_CODES } from "./diagnostic-writing/classrooms.js";
import { parseBankFile, normalizeQuestionList } from "./item-diagnostic/parse-bank.mjs";

const TEACHER_PASSWORD = "studentsfirst";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}

function getScriptUrl() {
  return (process.env.ITEM_DIAGNOSTIC_SCRIPT_URL || "").trim();
}

function getApiSecret() {
  return (process.env.ITEM_DIAGNOSTIC_API_SECRET || "studentsfirst").trim();
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

function notConfiguredResponse() {
  return Response.json(
    {
      error:
        "ITEM Diagnostic storage is not configured. Deploy google-apps-script/item-diagnostic-backend.gs, then add ITEM_DIAGNOSTIC_SCRIPT_URL to Vercel environment variables and redeploy.",
      submissions: [],
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
    console.error("ITEM Diagnostic script non-JSON response:", text.slice(0, 200));
    throw new Error("Google Script returned an invalid response. Check deployment URL and permissions.");
  }
}

const BANK_KEY = "item_diagnostic_question_bank";

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

function isBankRequest(request) {
  return getQueryParam(request, "bank") === "1";
}

async function bankGet() {
  if (!storageReady()) {
    return Response.json({ source: "builtin", storage: "unavailable" }, { headers: corsHeaders() });
  }
  try {
    const redis = await redisClient();
    const stored = readStored(await redis.get(BANK_KEY));
    const published = stored ? publishedPayload(stored) : null;
    if (!published) return Response.json({ source: "builtin", storage: "ready" }, { headers: corsHeaders() });
    return Response.json(published, { headers: corsHeaders() });
  } catch (error) {
    console.error("ITEM Diagnostic bank GET error:", error.message);
    return Response.json({ source: "builtin", storage: "ready" }, { headers: corsHeaders() });
  }
}

async function bankPost(body) {
  if (String(body?.password || "") !== TEACHER_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders() });
  }

  const action = String(body?.action || "preview");

  if (action === "preview") {
    const fileBase64 = String(body.fileBase64 || "");
    if (!fileBase64 || fileBase64.length > 2_800_000) {
      return Response.json({ error: "Choose a spreadsheet under 2 MB." }, { status: 400, headers: corsHeaders() });
    }
    const parsed = parseBankFile(Buffer.from(fileBase64, "base64"), String(body.filename || ""));
    return Response.json({
      ok: parsed.questions.length > 0,
      filename: String(body.filename || "").slice(0, 120),
      sheetName: parsed.sheetName,
      count: parsed.questions.length,
      excluded: parsed.excluded,
      errors: parsed.errors.slice(0, 30),
      warnings: parsed.warnings.slice(0, 30),
      questions: parsed.questions,
    }, { headers: corsHeaders() });
  }

  if (action === "publish") {
    if (!storageReady()) {
      return Response.json({
        error: "This site cannot store a new question bank yet, so the built-in questions stay in place.",
        storage: "unavailable",
      }, { status: 503, headers: corsHeaders() });
    }
    const normalized = normalizeQuestionList(body.questions);
    if (!normalized.questions.length) {
      return Response.json({
        error: normalized.errors[0] || "That file has no usable questions.",
        errors: normalized.errors.slice(0, 30),
      }, { status: 400, headers: corsHeaders() });
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
      return Response.json(
        { error: "The new bank could not be saved. The built-in questions are still active." },
        { status: 502, headers: corsHeaders() }
      );
    }
    return Response.json({
      ok: true,
      source: "upload",
      label: record.label,
      updatedAt: record.updatedAt,
      count: record.questions.length,
      warnings: normalized.warnings.slice(0, 30),
      questions: record.questions,
    }, { headers: corsHeaders() });
  }

  if (action === "revert") {
    if (!storageReady()) {
      return Response.json({ ok: true, source: "builtin", storage: "unavailable" }, { headers: corsHeaders() });
    }
    try {
      const redis = await redisClient();
      await redis.del(BANK_KEY);
    } catch (error) {
      console.error("ITEM Diagnostic bank revert error:", error.message);
      return Response.json({ error: "The built-in bank could not be restored." }, { status: 502, headers: corsHeaders() });
    }
    return Response.json({ ok: true, source: "builtin", storage: "ready" }, { headers: corsHeaders() });
  }

  return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders() });
}

export async function GET(request) {
  if (isBankRequest(request)) return bankGet();

  const password = getQueryParam(request, "password");
  if (password !== TEACHER_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders() });
  }

  const scriptUrl = getScriptUrl();
  if (!scriptUrl) return notConfiguredResponse();

  try {
    const url = new URL(scriptUrl);
    url.searchParams.set("action", "list");
    url.searchParams.set("secret", getApiSecret());
    url.searchParams.set("password", password);

    const data = await fetchScriptJson(url.toString(), { method: "GET" });
    if (data.error) {
      return Response.json(
        { error: data.error, submissions: [] },
        { status: data.error === "Unauthorized" ? 401 : 502, headers: corsHeaders() }
      );
    }
    return Response.json(
      {
        submissions: Array.isArray(data.submissions) ? data.submissions : [],
        classrooms: VALID_CLASSROOMS,
        classroomCodes: CLASSROOM_CODES,
      },
      { headers: corsHeaders() }
    );
  } catch (e) {
    console.error("ITEM Diagnostic GET proxy error:", e.message);
    return Response.json(
      { error: e.message || "Could not load submissions from Google Sheets.", submissions: [] },
      { status: 502, headers: corsHeaders() }
    );
  }
}

export async function POST(request) {
  if (isBankRequest(request)) {
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "The upload could not be read." }, { status: 400, headers: corsHeaders() });
    }
    return bankPost(body);
  }

  const scriptUrl = getScriptUrl();
  if (!scriptUrl) return notConfiguredResponse();

  try {
    const body = await request.json();

    const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
    const classroomRaw = typeof body?.classroom === "string" ? body.classroom : "";
    const classroom = resolveClassroom(classroomRaw);
    const classCode = typeof body?.classCode === "string" ? body.classCode : "";
    const typingText = typeof body?.typingText === "string" ? body.typingText.trim().slice(0, 15000) : "";
    const typingAnalysis = body?.typingAnalysis && typeof body.typingAnalysis === "object" ? body.typingAnalysis : null;
    const quizAnswers = Array.isArray(body?.quizAnswers) ? body.quizAnswers : [];
    const standards = Array.isArray(body?.standards) ? body.standards : [];
    const topics = body?.topics && typeof body.topics === "object" ? body.topics : {};
    const quizScore = Number(body?.quizScore);
    const quizTotal = Number(body?.quizTotal);
    const quizPct = Number(body?.quizPct);
    const durationSec = Number(body?.durationSec);

    if (!name || !quizAnswers.length) {
      return Response.json({ error: "Missing required fields" }, { status: 400, headers: corsHeaders() });
    }
    if (!classroom) {
      return Response.json({ error: "Invalid classroom" }, { status: 400, headers: corsHeaders() });
    }
    if (!verifyClassroomCode(classroom, classCode)) {
      return Response.json({ error: "Incorrect class code for the selected classroom." }, { status: 400, headers: corsHeaders() });
    }

    const data = await fetchScriptJson(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save",
        secret: getApiSecret(),
        name,
        classroom,
        typingText,
        typingAnalysis,
        quizAnswers,
        standards,
        topics,
        quizScore: Number.isFinite(quizScore) ? quizScore : 0,
        quizTotal: Number.isFinite(quizTotal) ? quizTotal : quizAnswers.length,
        quizPct: Number.isFinite(quizPct) ? quizPct : 0,
        durationSec: Number.isFinite(durationSec) ? durationSec : 120,
      }),
    });

    if (data.error) {
      return Response.json({ error: data.error }, { status: 502, headers: corsHeaders() });
    }
    return Response.json({ ok: true, id: data.id }, { headers: corsHeaders() });
  } catch (e) {
    console.error("ITEM Diagnostic POST proxy error:", e.message);
    return Response.json({ error: e.message || "Server error" }, { status: 502, headers: corsHeaders() });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
