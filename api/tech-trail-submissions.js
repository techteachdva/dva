/**
 * Global Tech Gauntlet submissions — proxies to Google Sheets (Apps Script).
 *
 * GET  → { submissions: [...] }  filtered by classroom
 * POST → { ok, id }  submit a run result + oath
 *
 * Vercel environment variables:
 *   TECH_TRAIL_SCRIPT_URL  — deployed Apps Script web app URL
 *   TECH_TRAIL_API_SECRET — must match API_SECRET in the script (default: studentsfirst)
 */

import { VALID_CLASSROOMS, resolveClassroom, verifyClassroomCode, CLASSROOM_CODES } from "./diagnostic-writing/classrooms.js";
import { matchRosterName } from "./tech-trail/roster-lib.js";

const TEACHER_PASSWORD = "studentsfirst";
const MIN_OATH_CHARS = 20;
const MIN_OATH_WORDS = 4;

function countWords(text) {
  const s = String(text || "").trim();
  if (!s) return 0;
  return s.split(/\s+/).filter(Boolean).length;
}

function validateOath(oathText) {
  const text = String(oathText || "").trim();
  if (text.length < MIN_OATH_CHARS) {
    return { ok: false, message: "Complete your Digital Citizenship Oath before submitting (at least a few sentences)." };
  }
  if (countWords(text) < MIN_OATH_WORDS) {
    return { ok: false, message: "Your oath needs a few more words before it can be submitted." };
  }
  return { ok: true };
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}

function getScriptUrl() {
  return (process.env.TECH_TRAIL_SCRIPT_URL || "").trim();
}

function getApiSecret() {
  return (process.env.TECH_TRAIL_API_SECRET || "studentsfirst").trim();
}

function notConfiguredResponse() {
  return Response.json(
    {
      error:
        "Tech Trail storage is not configured. Deploy google-apps-script/tech-trail-backend.gs, then set TECH_TRAIL_SCRIPT_URL in Vercel.",
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
    console.error("Tech Trail script non-JSON:", text.slice(0, 200));
    throw new Error("Google Script returned an invalid response.");
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

function validateScoreName(firstRaw, lastRaw) {
  const first = String(firstRaw ?? "").trim();
  const last = String(lastRaw ?? "").trim();
  if (!first) return { ok: false, message: "Type your first name." };
  if (!/[\p{L}][\p{L}'-]{0,15}$/u.test(first)) {
    return { ok: false, message: "First name: letters only, up to 16 characters." };
  }
  if (!last || !/^[\p{L}]$/u.test(last)) {
    return { ok: false, message: "Last initial must be one letter." };
  }
  if (first.includes("@") || /\d{4,}/.test(first)) {
    return { ok: false, message: "Use a nickname — no emails or long numbers." };
  }
  return { ok: true, name: `${first} ${last.toUpperCase()}` };
}

export async function GET(request) {
  const password = getQueryParam(request, "password");
  const classroomFilter = getQueryParam(request, "classroom");

  if (password !== TEACHER_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders() });
  }

  const scriptUrl = getScriptUrl();
  if (!scriptUrl) return notConfiguredResponse();

  try {
    const url = new URL(scriptUrl);
    url.searchParams.set("action", "list");
    url.searchParams.set("secret", getApiSecret());
    if (classroomFilter) url.searchParams.set("classroom", classroomFilter);

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
    console.error("Tech Trail GET error:", e.message);
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
    const nameRaw = String(body?.name || "").trim();
    const classroomRaw = String(body?.classroom || "").trim();
    const classCode = String(body?.classCode || "").trim();
    const oathText = String(body?.oathText || "").trim().slice(0, 2000);
    const badges = Array.isArray(body?.badges) ? body.badges : [];
    const goldenRules = Array.isArray(body?.goldenRules) ? body.goldenRules : [];
    const mentorsMet = Array.isArray(body?.mentorsMet) ? body.mentorsMet : [];
    const endingType = String(body?.endingType || "").slice(0, 24);
    const endingNode = String(body?.endingNode || "").slice(0, 40);
    const durationSec = Number(body?.durationSec);
    const challengeDurationSec = Number(body?.challengeDurationSec);
    const overallScore = Number(body?.overallScore);
    const oathWpm = Number(body?.oathWpm);
    const analysis = body?.analysis && typeof body.analysis === "object" ? body.analysis : null;
    const diagnosticAnalysis = body?.diagnosticAnalysis && typeof body.diagnosticAnalysis === "object"
      ? body.diagnosticAnalysis
      : null;
    const pedagogy = body?.pedagogy && typeof body.pedagogy === "object" ? body.pedagogy : null;
    const testCpm = Number(body?.testCpm);
    const targetCpm = Number(body?.targetCpm);
    const diagnosed = Boolean(body?.diagnosed);
    const integrity = Number(body?.integrity);
    const reputation = Number(body?.reputation);
    const runId = String(body?.runId || "").trim().slice(0, 40);

    const nameParts = nameRaw.split(/\s+/);
    const lastInitial = nameParts.length >= 2 ? nameParts[nameParts.length - 1].slice(0, 1) : "";
    const firstName = nameParts.slice(0, -1).join(" ");
    const nameCheck = validateScoreName(firstName, lastInitial);
    if (!nameCheck.ok) {
      return Response.json({ error: nameCheck.message }, { status: 400, headers: corsHeaders() });
    }

    const classroom = resolveClassroom(classroomRaw);
    if (!classroom) {
      return Response.json({ error: "Invalid classroom." }, { status: 400, headers: corsHeaders() });
    }
    if (!verifyClassroomCode(classroom, classCode)) {
      return Response.json(
        { error: "Incorrect class code for the selected classroom." },
        { status: 400, headers: corsHeaders() }
      );
    }

    const rosterCheck = matchRosterName(nameCheck.name, classroom);
    if (!rosterCheck.ok) {
      return Response.json({ error: rosterCheck.message }, { status: 400, headers: corsHeaders() });
    }

    const oathCheck = validateOath(oathText);
    if (!oathCheck.ok) {
      return Response.json({ error: oathCheck.message }, { status: 400, headers: corsHeaders() });
    }

    const data = await fetchScriptJson(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save",
        secret: getApiSecret(),
        name: rosterCheck.name,
        classroom,
        classCode,
        oathText,
        badges,
        goldenRules,
        mentorsMet,
        endingType,
        endingNode,
        durationSec: Number.isFinite(durationSec) ? durationSec : 0,
        challengeDurationSec: Number.isFinite(challengeDurationSec) ? challengeDurationSec : 0,
        overallScore: Number.isFinite(overallScore) ? overallScore : null,
        oathWpm: Number.isFinite(oathWpm) ? oathWpm : null,
        analysis,
        diagnosticAnalysis,
        pedagogy,
        testCpm: Number.isFinite(testCpm) ? testCpm : null,
        targetCpm: Number.isFinite(targetCpm) ? targetCpm : null,
        diagnosed,
        integrity: Number.isFinite(integrity) ? integrity : null,
        reputation: Number.isFinite(reputation) ? reputation : null,
        runId,
      }),
    });

    if (data.error) {
      const status = String(data.error).includes("Oath") ? 400 : 502;
      return Response.json({ error: data.error }, { status, headers: corsHeaders() });
    }
    return Response.json(
      {
        ok: true,
        id: data.id || "",
        duplicate: Boolean(data.duplicate),
        updated: Boolean(data.updated),
        message: data.message || "",
      },
      { headers: corsHeaders() }
    );
  } catch (e) {
    console.error("Tech Trail POST error:", e.message);
    return Response.json({ error: e.message || "Server error" }, { status: 502, headers: corsHeaders() });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
