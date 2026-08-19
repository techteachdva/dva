/**
 * Diagnostic Writing API — proxies to Google Sheets (Apps Script).
 *
 * Vercel environment variables:
 *   DIAGNOSTIC_WRITING_SCRIPT_URL  — deployed Apps Script web app URL
 *   DIAGNOSTIC_API_SECRET          — must match API_SECRET in the script (default: studentsfirst)
 *
 * Setup: see google-apps-script/diagnostic-writing-backend.gs
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
  return (process.env.DIAGNOSTIC_WRITING_SCRIPT_URL || "").trim();
}

function getApiSecret() {
  return (process.env.DIAGNOSTIC_API_SECRET || "studentsfirst").trim();
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
        "Writing storage is not configured. Deploy the Google Apps Script (google-apps-script/diagnostic-writing-backend.gs), then add DIAGNOSTIC_WRITING_SCRIPT_URL to Vercel environment variables and redeploy.",
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
    console.error("Script non-JSON response:", text.slice(0, 200));
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
    console.error("Diagnostic writing GET proxy error:", e.message);
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

    if (body?.action === "update" || body?.action === "updateBulk") {
      const password = typeof body?.password === "string" ? body.password : "";
      if (password !== TEACHER_PASSWORD) {
        return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders() });
      }

      if (body.action === "updateBulk") {
        const updates = Array.isArray(body.updates) ? body.updates : [];
        if (!updates.length) {
          return Response.json({ error: "Missing updates array" }, { status: 400, headers: corsHeaders() });
        }
        const sanitized = updates.slice(0, 50).map((u) => ({
          id: typeof u?.id === "string" ? u.id.trim() : String(u?.id || "").trim(),
          analysis: u?.analysis && typeof u.analysis === "object" ? u.analysis : null,
        })).filter((u) => u.id && u.analysis);

        const data = await fetchScriptJson(scriptUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "updateBulk",
            secret: getApiSecret(),
            password,
            updates: sanitized,
          }),
        });

        if (data.error) {
          return Response.json({ error: data.error }, { status: 502, headers: corsHeaders() });
        }
        return Response.json(
          { ok: true, updated: data.updated || 0, errors: data.errors || [] },
          { headers: corsHeaders() }
        );
      }

      const id = typeof body?.id === "string" ? body.id.trim() : "";
      const analysis = body?.analysis && typeof body.analysis === "object" ? body.analysis : null;
      if (!id || !analysis) {
        return Response.json({ error: "Missing id or analysis" }, { status: 400, headers: corsHeaders() });
      }

      const data = await fetchScriptJson(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          secret: getApiSecret(),
          password,
          id,
          analysis,
        }),
      });

      if (data.error) {
        return Response.json({ error: data.error }, { status: 502, headers: corsHeaders() });
      }
      return Response.json({ ok: true, id: data.id }, { headers: corsHeaders() });
    }

    const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
    const classroomRaw = typeof body?.classroom === "string" ? body.classroom : "";
    const classroom = resolveClassroom(classroomRaw);
    const classCode = typeof body?.classCode === "string" ? body.classCode : "";
    const text = typeof body?.text === "string" ? body.text.trim().slice(0, 15000) : "";
    const analysis = body?.analysis && typeof body.analysis === "object" ? body.analysis : null;
    const durationSec = Number(body?.durationSec);

    if (!name || !text || !analysis) {
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
    console.error("Diagnostic writing POST proxy error:", e.message);
    return Response.json({ error: e.message || "Server error" }, { status: 502, headers: corsHeaders() });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
