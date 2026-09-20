/**
 * In-memory undo stack for table actions. Snapshots live only for this session.
 */

const HISTORY_MAX = 40;
const SKIP_KEYS = new Set([
  "checkPsycheDeath",
  "onResolutionIdle",
  "tutorialSnapshots",
  "actionHistory",
]);

let undoStack = [];
let lastCheckpoint = null;

function clonePlayState(state) {
  const seen = new WeakSet();
  return JSON.parse(JSON.stringify(state, (key, value) => {
    if (SKIP_KEYS.has(key) || typeof value === "function") return undefined;
    if (value && typeof value === "object") {
      if (seen.has(value)) return undefined;
      seen.add(value);
    }
    return value;
  }));
}

function historyKey(state) {
  const players = (state.players || []).map((p) => [
    p.landscapeId || "",
    p.hand?.length || 0,
    p.powerTokens || 0,
    p.alive ? 1 : 0,
  ].join(":"));
  return [
    state.round,
    state.phaseIndex,
    state.status,
    state.dreamDrawn ? 1 : 0,
    state.revealLandscapeUsed ? 1 : 0,
    state.exploreActivated ? 1 : 0,
    state.exploreMovesLeft || 0,
    state.meetActionBudget || 0,
    state.meetActionsUsed || 0,
    (state.selectedHand || []).join(","),
    (state.log || []).length,
    state.selectedLandscapeId || "",
    players.join("|"),
  ].join("/");
}

export function clearActionHistory() {
  undoStack = [];
  lastCheckpoint = null;
}

export function undoStackSize() {
  return undoStack.length;
}

export function canUndoAction() {
  return undoStack.length > 0;
}

export function recordActionCheckpoint(state) {
  if (!state || state.status !== "playing") return;
  let snap = null;
  try {
    snap = clonePlayState(state);
  } catch {
    return;
  }
  const key = historyKey(state);
  if (lastCheckpoint && lastCheckpoint.key !== key) {
    undoStack.push(lastCheckpoint.snap);
    if (undoStack.length > HISTORY_MAX) undoStack.shift();
  }
  lastCheckpoint = { snap, key };
}

export function popActionCheckpoint() {
  const prev = undoStack.pop();
  if (!prev) return null;
  lastCheckpoint = {
    snap: prev,
    key: historyKey(prev),
  };
  return prev;
}

export function restorePlayState(state, snapshot) {
  if (!state || !snapshot) return state;
  const tutorialSnapshots = state.tutorialSnapshots;
  for (const key of Object.keys(state)) {
    if (key === "checkPsycheDeath" || key === "onResolutionIdle" || key === "tutorialSnapshots") continue;
    delete state[key];
  }
  Object.assign(state, JSON.parse(JSON.stringify(snapshot)));
  if (tutorialSnapshots) state.tutorialSnapshots = tutorialSnapshots;
  return state;
}
