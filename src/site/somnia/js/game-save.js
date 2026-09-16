/**
 * Serialize, compress, and restore in-progress Somnia games.
 */
import { getPhase, checkDreamerPsycheDeath } from "./state.js";
import { LENGTHS } from "./data.js";
import { validateScoreName, splitNameHint } from "./highscores.js";
import * as localSaveStore from "./local-save-store.js";
import * as remoteSaveStore from "./remote-save-store.js";
import { isStandaloneMode } from "./standalone.js";

export const SAVE_VERSION = 1;
const MAX_STATE_CHARS = 48000;

function activeStore() {
  return isStandaloneMode() ? localSaveStore : remoteSaveStore;
}

function stripRuntime(state) {
  const {
    checkPsycheDeath,
    onResolutionIdle,
    tutorialSnapshots,
    ...game
  } = state;
  const payload = JSON.parse(JSON.stringify(game));
  if (state.tutorialMode) {
    payload.tutorialStepIndex = state.tutorialStepIndex ?? 0;
    payload.tutorialCanAdvance = state.tutorialCanAdvance ?? false;
    payload.tutorialComplete = state.tutorialComplete ?? false;
    payload.tutorialSuppressCatchUp = true;
  }
  return payload;
}

export function reattachGameRuntime(state) {
  state.checkPsycheDeath = (player) => checkDreamerPsycheDeath(state, player);
  delete state.onResolutionIdle;
  return state;
}

export function buildSaveLabel(state) {
  const phase = getPhase(state);
  const length = LENGTHS[state.lengthKey]?.label || state.lengthKey || "Dream";
  return `Round ${state.round} · ${phase} · ${length}`;
}

export function canSaveGame(state) {
  if (!state || state.status !== "playing") return false;
  if (state.tutorialMode && !state.tutorialComplete) return false;
  return true;
}

async function gzipText(text) {
  if (!globalThis.CompressionStream) return { data: text, compressed: false };
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  const buffer = await new Response(stream).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return { data: btoa(binary), compressed: true };
}

async function gunzipText(data, compressed) {
  if (!compressed) return data;
  if (!globalThis.DecompressionStream) {
    throw new Error("This browser cannot decompress cloud saves. Try a newer browser.");
  }
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
}

export async function packGameSave(state, launchConfig, { label, playerName } = {}) {
  const game = stripRuntime(state);
  const payload = {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    label: label || buildSaveLabel(state),
    launchConfig: {
      lengthKey: launchConfig?.lengthKey || state.lengthKey,
      selectedDreamerIds: launchConfig?.selectedDreamerIds
        || state.players?.map((p) => p.dreamer?.id).filter(Boolean),
      tutorialMode: false,
      gentleStart: launchConfig?.gentleStart ?? false,
    },
    game,
  };
  const raw = JSON.stringify(payload);
  const packed = await gzipText(raw);
  if (packed.data.length > MAX_STATE_CHARS) {
    throw new Error("This dream is too large to save. Finish the round or clear pending choices first.");
  }
  return {
    ...payload,
    stateData: packed.data,
    compressed: packed.compressed,
    playerName: playerName || null,
  };
}

export async function unpackGameSave(record) {
  const raw = await gunzipText(record.stateData, record.compressed);
  const payload = JSON.parse(raw);
  if (!payload?.game || payload.version !== SAVE_VERSION) {
    throw new Error("Save file version is not supported.");
  }
  const state = reattachGameRuntime(payload.game);
  return {
    state,
    launchConfig: payload.launchConfig,
    label: record.label || payload.label,
    savedAt: record.updatedAt || payload.savedAt,
  };
}

export async function saveGameLocal(state, launchConfig, options = {}) {
  const packed = await packGameSave(state, launchConfig, options);
  return localSaveStore.writeSave({
    id: options.id || "autosave",
    label: packed.label,
    updatedAt: packed.savedAt,
    lengthKey: packed.launchConfig.lengthKey,
    round: state.round,
    phase: getPhase(state),
    status: state.status,
    compressed: packed.compressed,
    stateData: packed.stateData,
    launchConfig: packed.launchConfig,
  });
}

export async function loadGameLocal(id = "autosave") {
  const record = localSaveStore.readSave(id);
  if (!record) return null;
  return unpackGameSave(record);
}

export function listLocalSaves() {
  return localSaveStore.listSaves();
}

export function deleteLocalSave(id) {
  return localSaveStore.deleteSave(id);
}

export async function saveGameCloud(state, launchConfig, { playerName, label } = {}) {
  const parts = splitNameHint(playerName);
  const validated = validateScoreName(parts.first, parts.last);
  if (!validated.ok) throw new Error(validated.message);
  const packed = await packGameSave(state, launchConfig, { label, playerName: validated.name });
  return activeStore().saveGame({
    name: validated.name,
    label: packed.label,
    lengthKey: packed.launchConfig.lengthKey,
    round: state.round,
    phase: getPhase(state),
    status: state.status,
    compressed: packed.compressed,
    stateData: packed.stateData,
    launchConfig: packed.launchConfig,
  });
}

export async function listCloudSaves(name) {
  if (isStandaloneMode()) {
    return { saves: listLocalSaves(), local: true, setupRequired: false };
  }
  return remoteSaveStore.listSaves(name);
}

export async function loadCloudSave(id) {
  const record = isStandaloneMode()
    ? localSaveStore.readSave(id)
    : await remoteSaveStore.loadSave(id);
  if (!record) return null;
  return unpackGameSave(record);
}

export async function deleteCloudSave(id) {
  if (isStandaloneMode()) {
    deleteLocalSave(id);
    return { ok: true };
  }
  return remoteSaveStore.deleteSave(id);
}
