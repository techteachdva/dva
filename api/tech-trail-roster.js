/**
 * Global Tech Gauntlet — class roster API (names from class-roster.json).
 *
 * GET  ?action=classrooms → { classrooms: [...] }
 * GET  ?classroom=...&classCode=... → { names: [...] }
 * POST { classroom, classCode, firstName, lastInitial } → { ok, name, classroom }
 */

import {
  listClassrooms,
  rosterNamesForClassroom,
  parseStudentName,
  matchRosterName,
  verifyClassAccess,
} from "./tech-trail/roster-lib.js";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
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

export async function GET(request) {
  const action = getQueryParam(request, "action");
  if (action === "classrooms") {
    return Response.json({ classrooms: listClassrooms() }, { headers: corsHeaders() });
  }

  const classroomRaw = getQueryParam(request, "classroom");
  const classCode = getQueryParam(request, "classCode");
  const access = verifyClassAccess(classroomRaw, classCode);
  if (!access.ok) {
    return Response.json({ error: access.message, names: [] }, { status: 400, headers: corsHeaders() });
  }

  const names = rosterNamesForClassroom(access.classroom);
  return Response.json(
    { classroom: access.classroom, names, count: names.length },
    { headers: corsHeaders() }
  );
}

export async function POST(request) {
  try {
    const body = await request.json();
    const access = verifyClassAccess(body?.classroom, body?.classCode);
    if (!access.ok) {
      return Response.json({ error: access.message }, { status: 400, headers: corsHeaders() });
    }

    const nameCheck = parseStudentName(body?.firstName, body?.lastInitial);
    if (!nameCheck.ok) {
      return Response.json({ error: nameCheck.message }, { status: 400, headers: corsHeaders() });
    }

    const rosterCheck = matchRosterName(nameCheck.name, access.classroom);
    if (!rosterCheck.ok) {
      return Response.json({ error: rosterCheck.message }, { status: 400, headers: corsHeaders() });
    }

    return Response.json(
      { ok: true, name: rosterCheck.name, classroom: rosterCheck.classroom },
      { headers: corsHeaders() }
    );
  } catch (e) {
    return Response.json({ error: e.message || "Invalid request" }, { status: 400, headers: corsHeaders() });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
