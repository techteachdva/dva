/**
 * Launch config lives in sessionStorage for same-tab hops and
 * localStorage so iOS Home Screen / tab eviction can resume play.
 */

const SESSION_KEY = "somnia.launch";
const PERSIST_KEY = "somnia.launch.persist";

function parseConfig(raw) {
  if (!raw) return null;
  const config = JSON.parse(raw);
  if (config?.resumeSaveId) return config;
  if (!config?.lengthKey || !Array.isArray(config.selectedDreamerIds)) return null;
  if (!config.selectedDreamerIds.length) return null;
  return config;
}

export function writeLaunchConfig(config) {
  const raw = JSON.stringify(config);
  try {
    sessionStorage.setItem(SESSION_KEY, raw);
  } catch {
    /* private mode */
  }
  try {
    localStorage.setItem(PERSIST_KEY, raw);
  } catch {
    /* quota / private mode */
  }
}

export function readStoredLaunchConfig() {
  try {
    const fromSession = parseConfig(sessionStorage.getItem(SESSION_KEY));
    if (fromSession) return fromSession;
  } catch {
    /* ignore */
  }
  try {
    return parseConfig(localStorage.getItem(PERSIST_KEY));
  } catch {
    return null;
  }
}

export function clearLaunchConfig() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(PERSIST_KEY);
  } catch {
    /* ignore */
  }
}
