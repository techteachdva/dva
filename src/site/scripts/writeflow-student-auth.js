/**
 * WriteFlow — student account session.
 */
(() => {
  "use strict";

  const API_URL = "/api/writeflow-submissions";
  const SESSION_KEY = "writeflow:studentSession";

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
      const data = await apiGet({ action: "studentValidate", sessionToken: stored.token });
      session = {
        token: stored.token,
        username: data.username,
        displayName: data.displayName,
        classroom: data.classroom,
        role: "student",
        mustChangePassword: data.mustChangePassword,
        offerPasswordChange: data.offerPasswordChange,
        usesDefaultPassword: data.usesDefaultPassword,
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

  async function checkUsername(username) {
    return apiGet({ action: "checkStudentUsername", username });
  }

  async function login(username, password) {
    const data = await apiPost("studentLogin", { username, password });
    session = data.session;
    saveSession(session);
    return session;
  }

  async function setPassword(newPassword) {
    const token = getToken();
    if (!token) throw new Error("Sign in first.");
    const data = await apiPost("studentSetPassword", { sessionToken: token, newPassword });
    session = data.session;
    saveSession(session);
    return session;
  }

  async function keepDefaultPassword() {
    const token = getToken();
    if (!token) throw new Error("Sign in first.");
    const data = await apiPost("studentKeepDefaultPassword", { sessionToken: token });
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

  async function listMySubmissions() {
    const token = getToken();
    if (!token) return [];
    const data = await apiGet({ action: "listMySubmissions", sessionToken: token });
    return Array.isArray(data.submissions) ? data.submissions : [];
  }

  window.WriteFlowStudent = {
    validate,
    checkUsername,
    login,
    setPassword,
    keepDefaultPassword,
    logout,
    getSession,
    getToken,
    isLoggedIn,
    listMySubmissions,
  };
})();
