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

function isQuotaError(err) {
  return err && (err.name === "QuotaExceededError" || err.name === "NS_ERROR_DOM_QUOTA_REACHED" || err.code === 22 || err.code === 1014);
}

/**
 * iOS caps localStorage around 5 MB. If a write overflows, drop the oldest
 * manual saves (never the autosave being written) and retry before giving up.
 */
function persistStore(data) {
  for (let attempt = 0; attempt < MAX_SAVES; attempt += 1) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return;
    } catch (err) {
      if (!isQuotaError(err)) throw err;
      const victims = Object.values(data.saves)
        .filter((entry) => entry.id !== "autosave")
        .sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0));
      if (!victims.length) {
        throw new Error("This device's save storage is full. Delete a saved dream and try again.");
      }
      delete data.saves[victims[0].id];
    }
  }
  throw new Error("This device's save storage is full. Delete a saved dream and try again.");
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
