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

function scriptGetUrl(params) {
  const url = new URL(getScriptUrl());
  url.searchParams.set("secret", getApiSecret());
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function scriptPost(body) {
  return fetchScriptJson(getScriptUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: getApiSecret(), ...body }),
  });
}

export async function GET(request) {
  const action = getQueryParam(request, "action") || "list";
  const scriptUrl = getScriptUrl();

  if (action === "stats") {
    if (!scriptUrl) {
      return Response.json(
        { ok: true, stats: { classrooms: 0, assignments: 0, submissions: 0, sentences: 0 }, setupRequired: true },
        { headers: { ...corsHeaders(), "Cache-Control": "public, max-age=300" } }
      );
    }
    try {
      const data = await fetchScriptJson(scriptGetUrl({ action: "stats" }), { method: "GET" });
      if (data.error) {
        return Response.json(
          { error: data.error, stats: { classrooms: 0, assignments: 0, submissions: 0, sentences: 0 } },
          { status: 502, headers: corsHeaders() }
        );
      }
      return Response.json(
        { ok: true, stats: data.stats || { classrooms: 0, assignments: 0, submissions: 0, sentences: 0 } },
        { headers: { ...corsHeaders(), "Cache-Control": "public, max-age=300" } }
      );
    } catch (e) {
      console.error("WriteFlow stats error:", e.message);
      return Response.json(
        { error: e.message || "Could not load stats.", stats: { classrooms: 0, assignments: 0, submissions: 0, sentences: 0 } },
        { status: 502, headers: corsHeaders() }
      );
    }
  }

  if (!scriptUrl) return notConfiguredResponse();

  if (action === "listSharedAssignments") {
    try {
      const data = await fetchScriptJson(scriptGetUrl({ action: "listSharedAssignments" }), { method: "GET" });
      if (data.error) {
        return Response.json({ error: data.error, assignments: [] }, { status: 502, headers: corsHeaders() });
      }
      return Response.json(
        { ok: true, assignments: Array.isArray(data.assignments) ? data.assignments : [] },
        { headers: corsHeaders() }
      );
    } catch (e) {
      return Response.json({ error: e.message || "Could not load shared assignments.", assignments: [] }, { status: 502, headers: corsHeaders() });
    }
  }

  if (action === "teacherValidate") {
    const sessionToken = getQueryParam(request, "sessionToken");
    if (!sessionToken) {
      return Response.json({ error: "Invalid session" }, { status: 401, headers: corsHeaders() });
    }
    try {
      const data = await fetchScriptJson(scriptGetUrl({ action: "teacherValidate", sessionToken }), { method: "GET" });
      if (data.error) {
        return Response.json({ error: data.error }, { status: 401, headers: corsHeaders() });
      }
      return Response.json({
        ok: true,
        username: data.username,
        displayName: data.displayName,
        role: data.role || "teacher",
        mustChangePassword: data.mustChangePassword || false,
      }, { headers: corsHeaders() });
    } catch (e) {
      return Response.json({ error: e.message || "Could not validate session." }, { status: 502, headers: corsHeaders() });
    }
  }

  if (action === "studentValidate") {
    const sessionToken = getQueryParam(request, "sessionToken");
    if (!sessionToken) {
      return Response.json({ error: "Invalid session" }, { status: 401, headers: corsHeaders() });
    }
    try {
      const data = await fetchScriptJson(scriptGetUrl({ action: "studentValidate", sessionToken }), { method: "GET" });
      if (data.error) {
        return Response.json({ error: data.error }, { status: 401, headers: corsHeaders() });
      }
      return Response.json({
        ok: true,
        username: data.username,
        displayName: data.displayName,
        classroom: data.classroom || "",
        role: "student",
        mustChangePassword: data.mustChangePassword || false,
      }, { headers: corsHeaders() });
    } catch (e) {
      return Response.json({ error: e.message || "Could not validate session." }, { status: 502, headers: corsHeaders() });
    }
  }

  if (action === "adminValidate") {
    const sessionToken = getQueryParam(request, "sessionToken");
    if (!sessionToken) {
      return Response.json({ error: "Invalid session" }, { status: 401, headers: corsHeaders() });
    }
    try {
      const data = await fetchScriptJson(scriptGetUrl({ action: "adminValidate", sessionToken }), { method: "GET" });
      if (data.error) {
        return Response.json({ error: data.error }, { status: 401, headers: corsHeaders() });
      }
      return Response.json({
        ok: true,
        username: data.username,
        displayName: data.displayName,
        role: "admin",
        impersonateAs: data.impersonateAs || "",
      }, { headers: corsHeaders() });
    } catch (e) {
      return Response.json({ error: e.message || "Could not validate session." }, { status: 502, headers: corsHeaders() });
    }
  }

  if (action === "checkStudentUsername") {
    const username = getQueryParam(request, "username");
    try {
      const data = await fetchScriptJson(scriptGetUrl({ action: "checkStudentUsername", username }), { method: "GET" });
      if (data.error) {
        return Response.json({ error: data.error }, { status: 400, headers: corsHeaders() });
      }
      return Response.json({
        ok: true,
        valid: data.valid,
        username: data.username || "",
        classroom: data.classroom || "",
      }, { headers: corsHeaders() });
    } catch (e) {
      return Response.json({ error: e.message || "Could not check username." }, { status: 502, headers: corsHeaders() });
    }
  }

  if (action === "listMySubmissions") {
    const sessionToken = getQueryParam(request, "sessionToken");
    if (!sessionToken) {
      return Response.json({ error: "Invalid session" }, { status: 401, headers: corsHeaders() });
    }
    try {
      const data = await fetchScriptJson(scriptGetUrl({ action: "listMySubmissions", sessionToken }), { method: "GET" });
      if (data.error) {
        return Response.json({ error: data.error, submissions: [] }, { status: 401, headers: corsHeaders() });
      }
      return Response.json({
        ok: true,
        submissions: Array.isArray(data.submissions) ? data.submissions : [],
      }, { headers: corsHeaders() });
    } catch (e) {
      return Response.json({ error: e.message || "Could not load submissions.", submissions: [] }, { status: 502, headers: corsHeaders() });
    }
  }

  if (action === "adminStats") {
    const sessionToken = getQueryParam(request, "sessionToken");
    if (!sessionToken) {
      return Response.json({ error: "Admin sign-in required" }, { status: 401, headers: corsHeaders() });
    }
    try {
      const data = await fetchScriptJson(scriptGetUrl({ action: "adminStats", sessionToken }), { method: "GET" });
      if (data.error) {
        return Response.json({ error: data.error }, { status: 401, headers: corsHeaders() });
      }
      return Response.json({ ok: true, stats: data.stats || {} }, { headers: corsHeaders() });
    } catch (e) {
      return Response.json({ error: e.message || "Could not load stats." }, { status: 502, headers: corsHeaders() });
    }
  }

  if (action === "adminListAllSubmissions") {
    const sessionToken = getQueryParam(request, "sessionToken");
    if (!sessionToken) {
      return Response.json({ error: "Admin sign-in required" }, { status: 401, headers: corsHeaders() });
    }
    try {
      const data = await fetchScriptJson(scriptGetUrl({ action: "adminListAllSubmissions", sessionToken }), { method: "GET" });
      if (data.error) {
        return Response.json({ error: data.error, submissions: [] }, { status: 401, headers: corsHeaders() });
      }
      return Response.json({
        ok: true,
        submissions: Array.isArray(data.submissions) ? data.submissions : [],
      }, { headers: corsHeaders() });
    } catch (e) {
      return Response.json({ error: e.message || "Could not load submissions.", submissions: [] }, { status: 502, headers: corsHeaders() });
    }
  }

  if (action === "listMyAssignments") {
    const sessionToken = getQueryParam(request, "sessionToken");
    if (!sessionToken) {
      return Response.json({ error: "Invalid session" }, { status: 401, headers: corsHeaders() });
    }
    try {
      const data = await fetchScriptJson(scriptGetUrl({ action: "listMyAssignments", sessionToken }), { method: "GET" });
      if (data.error) {
        return Response.json({ error: data.error, assignments: [] }, { status: data.error === "Invalid session" ? 401 : 502, headers: corsHeaders() });
      }
      return Response.json(
        { ok: true, assignments: Array.isArray(data.assignments) ? data.assignments : [] },
        { headers: corsHeaders() }
      );
    } catch (e) {
      return Response.json({ error: e.message || "Could not load assignments.", assignments: [] }, { status: 502, headers: corsHeaders() });
    }
  }

  const assignmentId = getQueryParam(request, "assignmentId");
  if (!assignmentId) {
    return Response.json({ error: "Missing assignmentId" }, { status: 400, headers: corsHeaders() });
  }

  if (action === "getAssignment") {
    try {
      const data = await fetchScriptJson(scriptGetUrl({ action: "getAssignment", assignmentId }), { method: "GET" });
      if (data.error) {
        return Response.json(
          { error: data.error },
          { status: data.error === "Assignment not found" ? 404 : 502, headers: corsHeaders() }
        );
      }
      const publicConfig = data.config && typeof data.config === "object" ? { ...data.config } : data.config;
      if (publicConfig && typeof publicConfig === "object") {
        delete publicConfig.teacherPassword;
        delete publicConfig.heroImageData;
      }
      return Response.json(
        { ok: true, assignmentId: data.assignmentId, title: data.title, config: publicConfig },
        { headers: corsHeaders() }
      );
    } catch (e) {
      console.error("WriteFlow getAssignment error:", e.message);
      return Response.json(
        { error: e.message || "Could not load assignment." },
        { status: 502, headers: corsHeaders() }
      );
    }
  }

  const password = getQueryParam(request, "password");
  const sessionToken = getQueryParam(request, "sessionToken");
  if (!password && !sessionToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders() });
  }

  try {
    const data = await fetchScriptJson(
      scriptGetUrl({ action: "list", password, sessionToken, assignmentId }),
      { method: "GET" }
    );
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

    if (action === "teacherLogin") {
      const username = typeof body?.username === "string" ? body.username.trim() : "";
      const password = typeof body?.password === "string" ? body.password : "";
      if (!username || !password) {
        return Response.json({ error: "Enter username and password." }, { status: 400, headers: corsHeaders() });
      }
      const data = await scriptPost({ action: "teacherLogin", username, password });
      if (data.error) {
        return Response.json({ error: data.error }, { status: 401, headers: corsHeaders() });
      }
      return Response.json({ ok: true, session: data.session }, { headers: corsHeaders() });
    }

    if (action === "teacherRegister") {
      return Response.json({ error: "Use email verification signup. Click Create account in Studio." }, { status: 400, headers: corsHeaders() });
    }

    if (action === "teacherRequestVerification") {
      const email = typeof body?.email === "string" ? body.email.trim() : "";
      const username = typeof body?.username === "string" ? body.username.trim() : "";
      const displayName = typeof body?.displayName === "string" ? body.displayName.trim().slice(0, 80) : "";
      if (!email || !username) {
        return Response.json({ error: "Enter your school email and username." }, { status: 400, headers: corsHeaders() });
      }
      const data = await scriptPost({ action: "teacherRequestVerification", email, username, displayName });
      if (data.error) {
        return Response.json({ error: data.error }, { status: 400, headers: corsHeaders() });
      }
      return Response.json({ ok: true, message: data.message || "Verification code sent." }, { headers: corsHeaders() });
    }

    if (action === "teacherCompleteRegistration") {
      const email = typeof body?.email === "string" ? body.email.trim() : "";
      const username = typeof body?.username === "string" ? body.username.trim() : "";
      const password = typeof body?.password === "string" ? body.password : "";
      const displayName = typeof body?.displayName === "string" ? body.displayName.trim().slice(0, 80) : "";
      const code = typeof body?.code === "string" ? body.code.trim() : "";
      if (!email || !username || !password || !code) {
        return Response.json({ error: "Complete all registration fields." }, { status: 400, headers: corsHeaders() });
      }
      const data = await scriptPost({ action: "teacherCompleteRegistration", email, username, password, displayName, code });
      if (data.error) {
        return Response.json({ error: data.error }, { status: 400, headers: corsHeaders() });
      }
      return Response.json({ ok: true, session: data.session }, { headers: corsHeaders() });
    }

    if (action === "studentLogin") {
      const username = typeof body?.username === "string" ? body.username.trim() : "";
      const password = typeof body?.password === "string" ? body.password : "";
      if (!username || !password) {
        return Response.json({ error: "Enter username and password." }, { status: 400, headers: corsHeaders() });
      }
      const data = await scriptPost({ action: "studentLogin", username, password });
      if (data.error) {
        return Response.json({ error: data.error }, { status: 401, headers: corsHeaders() });
      }
      return Response.json({ ok: true, session: data.session }, { headers: corsHeaders() });
    }

    if (action === "studentSetPassword") {
      const sessionToken = typeof body?.sessionToken === "string" ? body.sessionToken.trim() : "";
      const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
      if (!sessionToken || !newPassword) {
        return Response.json({ error: "Enter a new password." }, { status: 400, headers: corsHeaders() });
      }
      const data = await scriptPost({ action: "studentSetPassword", sessionToken, newPassword });
      if (data.error) {
        return Response.json({ error: data.error }, { status: 400, headers: corsHeaders() });
      }
      return Response.json({ ok: true, session: data.session }, { headers: corsHeaders() });
    }

    if (action === "adminLogin") {
      const username = typeof body?.username === "string" ? body.username.trim() : "";
      const password = typeof body?.password === "string" ? body.password : "";
      if (!username || !password) {
        return Response.json({ error: "Enter username and password." }, { status: 400, headers: corsHeaders() });
      }
      const data = await scriptPost({ action: "adminLogin", username, password });
      if (data.error) {
        return Response.json({ error: data.error }, { status: 401, headers: corsHeaders() });
      }
      return Response.json({ ok: true, session: data.session }, { headers: corsHeaders() });
    }

    if (action === "adminImpersonate") {
      const sessionToken = typeof body?.sessionToken === "string" ? body.sessionToken.trim() : "";
      const targetUsername = typeof body?.targetUsername === "string" ? body.targetUsername.trim() : "";
      const targetRole = typeof body?.targetRole === "string" ? body.targetRole.trim() : "teacher";
      if (!sessionToken || !targetUsername) {
        return Response.json({ error: "Missing required fields." }, { status: 400, headers: corsHeaders() });
      }
      const data = await scriptPost({ action: "adminImpersonate", sessionToken, targetUsername, targetRole });
      if (data.error) {
        return Response.json({ error: data.error }, { status: 400, headers: corsHeaders() });
      }
      return Response.json({ ok: true, session: data.session }, { headers: corsHeaders() });
    }

    if (action === "adminDedupeSubmissions") {
      const sessionToken = typeof body?.sessionToken === "string" ? body.sessionToken.trim() : "";
      if (!sessionToken) {
        return Response.json({ error: "Admin sign-in required." }, { status: 401, headers: corsHeaders() });
      }
      const data = await scriptPost({ action: "adminDedupeSubmissions", sessionToken });
      if (data.error) {
        return Response.json({ error: data.error }, { status: 400, headers: corsHeaders() });
      }
      return Response.json({ ok: true, removed: data.removed || 0, message: data.message || "" }, { headers: corsHeaders() });
    }

    if (action === "adminListTeachers") {
      const sessionToken = typeof body?.sessionToken === "string" ? body.sessionToken.trim() : "";
      if (!sessionToken) {
        return Response.json({ error: "Admin sign-in required." }, { status: 401, headers: corsHeaders() });
      }
      const data = await scriptPost({ action: "adminListTeachers", sessionToken });
      if (data.error) {
        return Response.json({ error: data.error, teachers: [] }, { status: 401, headers: corsHeaders() });
      }
      return Response.json({ ok: true, teachers: data.teachers || [] }, { headers: corsHeaders() });
    }

    if (action === "adminListStudents") {
      const sessionToken = typeof body?.sessionToken === "string" ? body.sessionToken.trim() : "";
      if (!sessionToken) {
        return Response.json({ error: "Admin sign-in required." }, { status: 401, headers: corsHeaders() });
      }
      const data = await scriptPost({ action: "adminListStudents", sessionToken });
      if (data.error) {
        return Response.json({ error: data.error, students: [] }, { status: 401, headers: corsHeaders() });
      }
      return Response.json({ ok: true, students: data.students || [] }, { headers: corsHeaders() });
    }

    if (action === "adminListClassRoster") {
      const sessionToken = typeof body?.sessionToken === "string" ? body.sessionToken.trim() : "";
      if (!sessionToken) {
        return Response.json({ error: "Admin sign-in required." }, { status: 401, headers: corsHeaders() });
      }
      const data = await scriptPost({ action: "adminListClassRoster", sessionToken });
      if (data.error) {
        return Response.json({ error: data.error, roster: [] }, { status: 401, headers: corsHeaders() });
      }
      return Response.json({ ok: true, roster: data.roster || [] }, { headers: corsHeaders() });
    }

    if (action === "adminBackfillStudentCreatedAt") {
      const sessionToken = typeof body?.sessionToken === "string" ? body.sessionToken.trim() : "";
      if (!sessionToken) {
        return Response.json({ error: "Admin sign-in required." }, { status: 401, headers: corsHeaders() });
      }
      const data = await scriptPost({ action: "adminBackfillStudentCreatedAt", sessionToken });
      if (data.error) {
        return Response.json({ error: data.error }, { status: 401, headers: corsHeaders() });
      }
      return Response.json({ ok: true, updated: data.updated || 0 }, { headers: corsHeaders() });
    }

    if (action === "adminAddRosterEntry") {
      const sessionToken = typeof body?.sessionToken === "string" ? body.sessionToken.trim() : "";
      const classroom = typeof body?.classroom === "string" ? body.classroom.trim() : "";
      const username = typeof body?.username === "string" ? body.username.trim() : "";
      if (!sessionToken) {
        return Response.json({ error: "Admin sign-in required." }, { status: 401, headers: corsHeaders() });
      }
      if (!classroom || !username) {
        return Response.json({ error: "Classroom and username are required." }, { status: 400, headers: corsHeaders() });
      }
      const data = await scriptPost({ action: "adminAddRosterEntry", sessionToken, classroom, username });
      if (data.error) {
        return Response.json({ error: data.error }, { status: 400, headers: corsHeaders() });
      }
      return Response.json({ ok: true, entry: data.entry || null }, { headers: corsHeaders() });
    }

    if (action === "teacherLogout") {
      const sessionToken = typeof body?.sessionToken === "string" ? body.sessionToken.trim() : "";
      if (sessionToken) await scriptPost({ action: "teacherLogout", sessionToken });
      return Response.json({ ok: true }, { headers: corsHeaders() });
    }

    if (action === "copyAssignment") {
      const sessionToken = typeof body?.sessionToken === "string" ? body.sessionToken.trim() : "";
      const sourceAssignmentId = typeof body?.sourceAssignmentId === "string" ? body.sourceAssignmentId.trim().slice(0, 80) : "";
      const newAssignmentId = typeof body?.newAssignmentId === "string" ? body.newAssignmentId.trim().slice(0, 80) : "";
      const newTitle = typeof body?.newTitle === "string" ? body.newTitle.trim().slice(0, 200) : "";
      if (!sessionToken || !sourceAssignmentId || !newAssignmentId) {
        return Response.json({ error: "Missing required fields." }, { status: 400, headers: corsHeaders() });
      }
      const data = await scriptPost({ action: "copyAssignment", sessionToken, sourceAssignmentId, newAssignmentId, newTitle });
      if (data.error) {
        return Response.json({ error: data.error }, { status: 502, headers: corsHeaders() });
      }
      return Response.json(
        { ok: true, assignmentId: data.assignmentId, title: data.title, config: data.config },
        { headers: corsHeaders() }
      );
    }

    if (action === "registerAssignment") {
      const assignmentId = typeof body?.assignmentId === "string" ? body.assignmentId.trim().slice(0, 80) : "";
      const teacherPassword = typeof body?.teacherPassword === "string" ? body.teacherPassword.slice(0, 80) : "";
      const title = typeof body?.title === "string" ? body.title.trim().slice(0, 200) : "";
      const sessionToken = typeof body?.sessionToken === "string" ? body.sessionToken.trim() : "";
      const shared = body?.shared === true;
      const config = body?.config && typeof body.config === "object" ? body.config : null;
      if (!assignmentId || !teacherPassword) {
        return Response.json({ error: "Missing assignmentId or teacherPassword" }, { status: 400, headers: corsHeaders() });
      }
      let configJson = "";
      if (config) {
        const publicConfig = { ...config };
        delete publicConfig.teacherPassword;
        delete publicConfig.heroImageData;
        configJson = JSON.stringify(publicConfig);
        if (configJson.length > 45000) {
          return Response.json({ error: "Assignment config is too large to publish. Remove uploaded hero images and use a URL instead." }, { status: 400, headers: corsHeaders() });
        }
      }
      const data = await scriptPost({
        action: "registerAssignment",
        assignmentId,
        teacherPassword,
        title,
        configJson,
        sessionToken,
        shared,
      });
      if (data.error) {
        return Response.json({ error: data.error }, { status: 502, headers: corsHeaders() });
      }
      return Response.json({ ok: true, assignmentId: data.assignmentId }, { headers: corsHeaders() });
    }

    if (action === "saveSubmissionGrade") {
      const submissionId = typeof body?.submissionId === "string" ? body.submissionId.trim() : "";
      const assignmentId = typeof body?.assignmentId === "string" ? body.assignmentId.trim().slice(0, 80) : "";
      const password = typeof body?.password === "string" ? body.password.slice(0, 80) : "";
      const sessionToken = typeof body?.sessionToken === "string" ? body.sessionToken.trim() : "";
      const teacherFeedback = typeof body?.teacherFeedback === "string" ? body.teacherFeedback : "";
      const feedbackVisible = body?.feedbackVisible === true;
      const teacherGrade = body?.teacherGrade;
      if (!submissionId || !assignmentId) {
        return Response.json({ error: "Missing submission or assignment ID." }, { status: 400, headers: corsHeaders() });
      }
      const data = await scriptPost({
        action: "saveSubmissionGrade",
        submissionId,
        assignmentId,
        password,
        sessionToken,
        teacherGrade,
        teacherFeedback,
        feedbackVisible,
      });
      if (data.error) {
        return Response.json({ error: data.error }, { status: data.error === "Unauthorized" ? 401 : 400, headers: corsHeaders() });
      }
      return Response.json({ ok: true, grading: data.grading }, { headers: corsHeaders() });
    }

    if (action === "saveGradesBulk") {
      const sessionToken = typeof body?.sessionToken === "string" ? body.sessionToken.trim() : "";
      const password = typeof body?.password === "string" ? body.password.slice(0, 80) : "";
      const grades = Array.isArray(body?.grades) ? body.grades : [];
      if (!grades.length) {
        return Response.json({ error: "Missing grades array." }, { status: 400, headers: corsHeaders() });
      }
      const sanitized = grades.slice(0, 50).map((g) => ({
        submissionId: typeof g?.submissionId === "string" ? g.submissionId.trim() : String(g?.id || "").trim(),
        assignmentId: typeof g?.assignmentId === "string" ? g.assignmentId.trim().slice(0, 80) : "",
        teacherGrade: g?.teacherGrade,
        teacherFeedback: typeof g?.teacherFeedback === "string" ? g.teacherFeedback : "",
        feedbackVisible: g?.feedbackVisible === true,
      })).filter((g) => g.submissionId && g.assignmentId);
      const data = await scriptPost({
        action: "saveGradesBulk",
        sessionToken,
        password,
        grades: sanitized,
      });
      if (data.error) {
        return Response.json({ error: data.error }, { status: data.error === "Unauthorized" ? 401 : 400, headers: corsHeaders() });
      }
      return Response.json(
        { ok: true, saved: data.saved || 0, results: data.results || [], errors: data.errors || [] },
        { headers: corsHeaders() }
      );
    }

    if (action === "setCountedSubmission") {
      const submissionId = typeof body?.submissionId === "string" ? body.submissionId.trim() : "";
      const assignmentId = typeof body?.assignmentId === "string" ? body.assignmentId.trim().slice(0, 80) : "";
      const password = typeof body?.password === "string" ? body.password.slice(0, 80) : "";
      const sessionToken = typeof body?.sessionToken === "string" ? body.sessionToken.trim() : "";
      if (!submissionId || !assignmentId) {
        return Response.json({ error: "Missing submission or assignment ID." }, { status: 400, headers: corsHeaders() });
      }
      const data = await scriptPost({
        action: "setCountedSubmission",
        submissionId,
        assignmentId,
        password,
        sessionToken,
      });
      if (data.error) {
        return Response.json({ error: data.error }, { status: data.error === "Unauthorized" ? 401 : 400, headers: corsHeaders() });
      }
      return Response.json({ ok: true, counted: data.counted }, { headers: corsHeaders() });
    }

    if (action === "updateBulk") {
      const sessionToken = typeof body?.sessionToken === "string" ? body.sessionToken.trim() : "";
      const assignmentId = typeof body?.assignmentId === "string" ? body.assignmentId.trim().slice(0, 80) : "";
      const updates = Array.isArray(body?.updates) ? body.updates : [];
      if (!sessionToken) {
        return Response.json({ error: "Admin sign-in required." }, { status: 401, headers: corsHeaders() });
      }
      if (!assignmentId) {
        return Response.json({ error: "Missing assignmentId" }, { status: 400, headers: corsHeaders() });
      }
      if (!updates.length) {
        return Response.json({ error: "Missing updates array" }, { status: 400, headers: corsHeaders() });
      }
      const sanitized = updates.slice(0, 50).map((u) => ({
        id: typeof u?.id === "string" ? u.id.trim() : String(u?.id || "").trim(),
        analysis: u?.analysis && typeof u.analysis === "object" ? u.analysis : null,
      })).filter((u) => u.id && u.analysis);
      const data = await scriptPost({
        action: "updateBulk",
        sessionToken,
        assignmentId,
        updates: sanitized,
      });
      if (data.error) {
        return Response.json(
          { error: data.error },
          { status: data.error === "Admin access required" ? 403 : 502, headers: corsHeaders() }
        );
      }
      return Response.json(
        { ok: true, updated: data.updated || 0, errors: data.errors || [] },
        { headers: corsHeaders() }
      );
    }

    const assignmentId = typeof body?.assignmentId === "string" ? body.assignmentId.trim().slice(0, 80) : "";
    const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
    const classroomRaw = typeof body?.classroom === "string" ? body.classroom : "";
    const classroom = resolveClassroom(classroomRaw);
    const classCode = typeof body?.classCode === "string" ? body.classCode : "";
    const requireClassCode = body?.requireClassCode !== false;
    const text = typeof body?.text === "string" ? body.text.trim().slice(0, 15000) : "";
    const analysis = body?.analysis && typeof body.analysis === "object" ? body.analysis : null;
    const durationSec = Number(body?.durationSec);

    if (!assignmentId || !name || !text || !analysis) {
      return Response.json({ error: "Missing required fields" }, { status: 400, headers: corsHeaders() });
    }
    if (classroomRaw && !classroom) {
      return Response.json({ error: "Invalid classroom" }, { status: 400, headers: corsHeaders() });
    }
    if (classroom && requireClassCode && !verifyClassroomCode(classroom, classCode)) {
      return Response.json({ error: "Incorrect class code for the selected classroom." }, { status: 400, headers: corsHeaders() });
    }

    const data = await scriptPost({
      action: "save",
      assignmentId,
      name,
      classroom: classroom || "",
      classCode,
      requireClassCode,
      text,
      analysis,
      durationSec: Number.isFinite(durationSec) ? durationSec : 300,
      studentUsername: typeof body?.studentUsername === "string" ? body.studentUsername.trim().slice(0, 80) : "",
    });

    if (data.error) {
      return Response.json({ error: data.error }, { status: 502, headers: corsHeaders() });
    }
    return Response.json({
      ok: true,
      id: data.id,
      attemptNumber: data.attemptNumber,
      attemptsUsed: data.attemptsUsed,
      maxAttempts: data.maxAttempts,
      canRetry: data.canRetry,
    }, { headers: corsHeaders() });
  } catch (e) {
    console.error("WriteFlow POST error:", e.message);
    return Response.json({ error: e.message || "Server error" }, { status: 502, headers: corsHeaders() });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
