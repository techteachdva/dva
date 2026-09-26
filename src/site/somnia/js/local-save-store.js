/**
 * Local game saves (standalone / autosave on this device).
 */

const STORAGE_KEY = "somnia.gameSaves";
const MAX_SAVES = 12;

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: 1, saves: {} };
    const data = JSON.parse(raw);
    if (!data.saves || typeof data.saves !== "object") return { version: 1, saves: {} };
    return data;
  } catch {
    return { version: 1, saves: {} };
  }
}

function persistStore(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function listSaves() {
  const data = loadStore();
  return Object.values(data.saves)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function readSave(id) {
  const data = loadStore();
  return data.saves[id] || null;
}

export function writeSave(record) {
  const data = loadStore();
  data.saves[record.id] = record;
  const ordered = Object.values(data.saves)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  if (ordered.length > MAX_SAVES) {
    ordered.slice(MAX_SAVES).forEach((entry) => {
      delete data.saves[entry.id];
    });
  }
  persistStore(data);
  return record;
}

export function deleteSave(id) {
  const data = loadStore();
  if (!data.saves[id]) return false;
  delete data.saves[id];
  persistStore(data);
  return true;
}
