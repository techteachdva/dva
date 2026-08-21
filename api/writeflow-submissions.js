/**
 * WriteFlow Studio API — proxies to Google Sheets (Apps Script).
 *
 * Vercel environment variables:
 *   WRITEFLOW_SCRIPT_URL  — deployed Apps Script web app URL
 *   WRITEFLOW_API_SECRET  — must match API_SECRET in the script (default: studentsfirst)
 *
 * Setup: see google-apps-script/writeflow-backend.gs
 */

import { VALID_CLASSROOMS, resolveClassroom, verifyClassroomCode, CLASSROOM_CODES } from "./diagnostic-writing/classrooms.js";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}

function getScriptUrl() {
  return (process.env.WRITEFLOW_SCRIPT_URL || "").trim();
}

function getApiSecret() {
  return (process.env.WRITEFLOW_API_SECRET || "studentsfirst").trim();
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
        "WriteFlow storage is not configured. Deploy google-apps-script/writeflow-backend.gs, then set WRITEFLOW_SCRIPT_URL in Vercel.",
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
    console.error("WriteFlow script non-JSON:", text.slice(0, 200));
    throw new Error("Google Script returned an invalid response.");
  }
}

export async function GET(request) {
  const password = getQueryParam(request, "password");
  const assignmentId = getQueryParam(request, "assignmentId");

  if (!assignmentId) {
    return Response.json({ error: "Missing assignmentId" }, { status: 400, headers: corsHeaders() });
  }
  if (!password) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders() });
  }

  const scriptUrl = getScriptUrl();
  if (!scriptUrl) return notConfiguredResponse();

  try {
    const url = new URL(scriptUrl);
    url.searchParams.set("action", "list");
    url.searchParams.set("secret", getApiSecret());
    url.searchParams.set("password", password);
    url.searchParams.set("assignmentId", assignmentId);

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
    console.error("WriteFlow GET error:", e.message);
    return Response.json(
      { error: e.message || "Could not load submissions.", submissions: [] },
      { status: 502, headers: corsHeaders() }
    );
  }
}

export async function POST(request) {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl) return notConfiguredResponse();

  try {
    const body = await request.json();
    const action = String(body?.action || "save");

    if (action === "registerAssignment") {
      const assignmentId = typeof body?.assignmentId === "string" ? body.assignmentId.trim().slice(0, 80) : "";
      const teacherPassword = typeof body?.teacherPassword === "string" ? body.teacherPassword.slice(0, 80) : "";
      const title = typeof body?.title === "string" ? body.title.trim().slice(0, 200) : "";
      if (!assignmentId || !teacherPassword) {
        return Response.json({ error: "Missing assignmentId or teacherPassword" }, { status: 400, headers: corsHeaders() });
      }
      const data = await fetchScriptJson(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "registerAssignment",
          secret: getApiSecret(),
          assignmentId,
          teacherPassword,
          title,
        }),
      });
      if (data.error) {
        return Response.json({ error: data.error }, { status: 502, headers: corsHeaders() });
      }
      return Response.json({ ok: true, assignmentId: data.assignmentId }, { headers: corsHeaders() });
    }

    const assignmentId = typeof body?.assignmentId === "string" ? body.assignmentId.trim().slice(0, 80) : "";
    const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
    const classroomRaw = typeof body?.classroom === "string" ? body.classroom : "";
    const classroom = resolveClassroom(classroomRaw);
    const classCode = typeof body?.classCode === "string" ? body.classCode : "";
    const text = typeof body?.text === "string" ? body.text.trim().slice(0, 15000) : "";
    const analysis = body?.analysis && typeof body.analysis === "object" ? body.analysis : null;
    const durationSec = Number(body?.durationSec);

    if (!assignmentId || !name || !text || !analysis) {
      return Response.json({ error: "Missing required fields" }, { status: 400, headers: corsHeaders() });
    }
    if (classroomRaw && !classroom) {
      return Response.json({ error: "Invalid classroom" }, { status: 400, headers: corsHeaders() });
    }
    if (classroom && !verifyClassroomCode(classroom, classCode)) {
      return Response.json({ error: "Incorrect class code for the selected classroom." }, { status: 400, headers: corsHeaders() });
    }

    const data = await fetchScriptJson(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save",
        secret: getApiSecret(),
        assignmentId,
        name,
        classroom: classroom || "",
        classCode,
        text,
        analysis,
        durationSec: Number.isFinite(durationSec) ? durationSec : 300,
      }),
    });

    if (data.error) {
      return Response.json({ error: data.error }, { status: 502, headers: corsHeaders() });
    }
    return Response.json({ ok: true, id: data.id }, { headers: corsHeaders() });
  } catch (e) {
    console.error("WriteFlow POST error:", e.message);
    return Response.json({ error: e.message || "Server error" }, { status: 502, headers: corsHeaders() });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
