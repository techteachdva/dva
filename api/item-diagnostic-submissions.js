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

export async function GET(request) {
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
