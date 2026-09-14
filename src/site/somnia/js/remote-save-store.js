/**
 * Cloud game saves — Google Sheets via Vercel API proxy (same backend as high scores).
 */

const API_URL = "/api/somnia-saves";

export async function listSaves(name = "") {
  const url = new URL(API_URL, window.location.origin);
  if (name) url.searchParams.set("name", name);
  const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !data.saves) {
    throw new Error(data.error || `Could not load saves (${res.status}).`);
  }
  return {
    saves: Array.isArray(data.saves) ? data.saves : [],
    setupRequired: Boolean(data.setupRequired),
    local: false,
    error: data.error || null,
  };
}

export async function loadSave(id) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "load", id }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error || `Could not load save (${res.status}).`);
  }
  return data.save || null;
}

export async function saveGame(entry) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "saveGame", ...entry }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error || `Could not save game (${res.status}).`);
  }
  return data;
}

export async function deleteSave(id) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete", id }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error || `Could not delete save (${res.status}).`);
  }
  return data;
}
