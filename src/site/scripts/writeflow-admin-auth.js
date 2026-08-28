/**
 * WriteFlow — admin session and tools.
 */
(() => {
  "use strict";

  const API_URL = "/api/writeflow-submissions";
  const SESSION_KEY = "writeflow:adminSession";

  let session = null;

  function loadStoredSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function saveSession(next) {
    session = next;
    if (next?.token) localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    else localStorage.removeItem(SESSION_KEY);
  }

  async function apiPost(action, body = {}) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  async function apiGet(params) {
    const qs = new URLSearchParams(params);
    const res = await fetch(`${API_URL}?${qs}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  async function validate() {
    const stored = loadStoredSession();
    if (!stored?.token) {
      session = null;
      return null;
    }
    try {
      const data = await apiGet({ action: "adminValidate", sessionToken: stored.token });
      session = {
        token: stored.token,
        username: data.username,
        displayName: data.displayName,
        role: "admin",
        impersonateAs: data.impersonateAs || "",
        expiresAt: stored.expiresAt,
      };
      saveSession(session);
      return session;
    } catch {
      saveSession(null);
      session = null;
      return null;
    }
  }

  async function login(username, password) {
    const data = await apiPost("adminLogin", { username, password });
    session = data.session;
    saveSession(session);
    return session;
  }

  async function impersonate(targetUsername, targetRole = "teacher") {
    const token = getToken();
    if (!token) throw new Error("Admin sign-in required.");
    const data = await apiPost("adminImpersonate", {
      sessionToken: token,
      targetUsername,
      targetRole,
    });
    session = data.session;
    saveSession(session);
    return session;
  }

  async function logout() {
    saveSession(null);
    session = null;
  }

  function getSession() {
    return session || loadStoredSession();
  }

  function getToken() {
    return getSession()?.token || "";
  }

  function isLoggedIn() {
    return !!getToken();
  }

  async function getStats() {
    const token = getToken();
    if (!token) throw new Error("Admin sign-in required.");
    const data = await apiGet({ action: "adminStats", sessionToken: token });
    return data.stats || {};
  }

  async function dedupeSubmissions() {
    const token = getToken();
    if (!token) throw new Error("Admin sign-in required.");
    return apiPost("adminDedupeSubmissions", { sessionToken: token });
  }

  async function listTeachers() {
    const token = getToken();
    if (!token) throw new Error("Admin sign-in required.");
    const data = await apiPost("adminListTeachers", { sessionToken: token });
    return data.teachers || [];
  }

  async function listStudents() {
    const token = getToken();
    if (!token) throw new Error("Admin sign-in required.");
    const data = await apiPost("adminListStudents", { sessionToken: token });
    return data.students || [];
  }

  async function listClassRoster() {
    const token = getToken();
    if (!token) throw new Error("Admin sign-in required.");
    const data = await apiPost("adminListClassRoster", { sessionToken: token });
    return data.roster || [];
  }

  async function backfillStudentCreatedAt() {
    const token = getToken();
    if (!token) throw new Error("Admin sign-in required.");
    return apiPost("adminBackfillStudentCreatedAt", { sessionToken: token });
  }

  async function addRosterEntry(classroom, username) {
    const token = getToken();
    if (!token) throw new Error("Admin sign-in required.");
    const data = await apiPost("adminAddRosterEntry", { sessionToken: token, classroom, username });
    return data.entry;
  }

  async function previewUsernameCleanup() {
    const token = getToken();
    if (!token) throw new Error("Admin sign-in required.");
    return apiPost("adminPreviewUsernameCleanup", { sessionToken: token });
  }

  async function applyUsernameCleanup({ applyLowConfidence = false } = {}) {
    const token = getToken();
    if (!token) throw new Error("Admin sign-in required.");
    return apiPost("adminApplyUsernameCleanup", { sessionToken: token, applyLowConfidence });
  }

  async function listClassrooms() {
    const token = getToken();
    if (!token) throw new Error("Admin sign-in required.");
    const data = await apiPost("adminListClassrooms", { sessionToken: token });
    return data.classrooms || [];
  }

  async function resetStudentPassword(username) {
    const token = getToken();
    if (!token) throw new Error("Admin sign-in required.");
    return apiPost("adminResetStudentPassword", { sessionToken: token, username });
  }

  async function bulkResetPasswords(classroom = "") {
    const token = getToken();
    if (!token) throw new Error("Admin sign-in required.");
    return apiPost("adminBulkResetPasswords", { sessionToken: token, classroom });
  }

  async function syncStudentClassrooms() {
    const token = getToken();
    if (!token) throw new Error("Admin sign-in required.");
    return apiPost("adminSyncStudentClassrooms", { sessionToken: token });
  }

  async function bulkAddRosterEntries(classroom, usernamesText) {
    const token = getToken();
    if (!token) throw new Error("Admin sign-in required.");
    const data = await apiPost("adminBulkAddRosterEntries", { sessionToken: token, classroom, usernamesText });
    return data;
  }

  async function listAllSubmissions() {
    const token = getToken();
    if (!token) throw new Error("Admin sign-in required.");
    const data = await apiGet({ action: "adminListAllSubmissions", sessionToken: token });
    return data.submissions || [];
  }

  async function reanalyzeBulk(assignmentId, updates) {
    const token = getToken();
    if (!token) throw new Error("Admin sign-in required.");
    if (!assignmentId) throw new Error("Missing assignment ID.");
    return apiPost("updateBulk", {
      sessionToken: token,
      assignmentId,
      updates,
    });
  }

  async function listAssignmentSubmissions(assignmentId) {
    const token = getToken();
    if (!token) throw new Error("Admin sign-in required.");
    if (!assignmentId) throw new Error("Missing assignment ID.");
    const data = await apiGet({ action: "list", assignmentId, sessionToken: token });
    return data.submissions || [];
  }

  async function saveSubmissionGrade(submissionId, assignmentId, { teacherGrade, teacherFeedback, feedbackVisible }) {
    const token = getToken();
    if (!token) throw new Error("Admin sign-in required.");
    if (!submissionId || !assignmentId) throw new Error("Missing submission or assignment ID.");
    return apiPost("saveSubmissionGrade", {
      sessionToken: token,
      submissionId,
      assignmentId,
      teacherGrade,
      teacherFeedback,
      feedbackVisible,
    });
  }

  async function saveGradesBulk(grades) {
    const token = getToken();
    if (!token) throw new Error("Admin sign-in required.");
    if (!grades?.length) return { saved: 0, results: [], errors: [] };
    return apiPost("saveGradesBulk", {
      sessionToken: token,
      grades,
    });
  }

  window.WriteFlowAdmin = {
    validate,
    login,
    impersonate,
    logout,
    getSession,
    getToken,
    isLoggedIn,
    getStats,
    dedupeSubmissions,
    listTeachers,
    listStudents,
    listClassRoster,
    backfillStudentCreatedAt,
    addRosterEntry,
    previewUsernameCleanup,
    applyUsernameCleanup,
    listClassrooms,
    resetStudentPassword,
    bulkResetPasswords,
    syncStudentClassrooms,
    bulkAddRosterEntries,
    listAllSubmissions,
    listAssignmentSubmissions,
    saveSubmissionGrade,
    saveGradesBulk,
    reanalyzeBulk,
  };
})();
