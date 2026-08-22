/**
 * WriteFlow Studio — teacher account session (login, cloud assignments, sharing).
 */
(() => {
  "use strict";

  const API_URL = "/api/writeflow-submissions";
  const SESSION_KEY = "writeflow:teacherSession";

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
    if (next?.token) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }

  async function apiPost(action, body = {}) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (data.setupRequired) throw new Error("Online storage is not configured on the server yet.");
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
  }

  async function apiGet(params) {
    const qs = new URLSearchParams(params);
    const res = await fetch(`${API_URL}?${qs}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (data.setupRequired) throw new Error("Online storage is not configured on the server yet.");
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
  }

  async function validate() {
    const stored = loadStoredSession();
    if (!stored?.token) {
      session = null;
      return null;
    }
    try {
      const data = await apiGet({ action: "teacherValidate", sessionToken: stored.token });
      session = {
        token: stored.token,
        username: data.username,
        displayName: data.displayName,
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
    const data = await apiPost("teacherLogin", { username, password });
    session = data.session;
    saveSession(session);
    return session;
  }

  async function register(username, password, displayName) {
    const data = await apiPost("teacherRegister", { username, password, displayName });
    session = data.session;
    saveSession(session);
    return session;
  }

  async function logout() {
    const token = getToken();
    if (token) {
      try {
        await apiPost("teacherLogout", { sessionToken: token });
      } catch {
        /* ignore */
      }
    }
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

  async function listMyAssignments() {
    const token = getToken();
    if (!token) return [];
    const data = await apiGet({ action: "listMyAssignments", sessionToken: token });
    return Array.isArray(data.assignments) ? data.assignments : [];
  }

  async function listSharedAssignments() {
    const data = await apiGet({ action: "listSharedAssignments" });
    return Array.isArray(data.assignments) ? data.assignments : [];
  }

  async function copyAssignment(sourceAssignmentId, newAssignmentId, newTitle) {
    const token = getToken();
    if (!token) throw new Error("Sign in to copy assignments.");
    return apiPost("copyAssignment", {
      sessionToken: token,
      sourceAssignmentId,
      newAssignmentId,
      newTitle,
    });
  }

  window.WriteFlowTeacher = {
    validate,
    login,
    register,
    logout,
    getSession,
    getToken,
    isLoggedIn,
    listMyAssignments,
    listSharedAssignments,
    copyAssignment,
  };
})();
