/**
 * Tech Trail State — localStorage persistence for Global Tech Gauntlet runs + profile.
 */
(() => {
  "use strict";

  const PREFIX = "techtrail";
  const RUN_KEY = "run";
  const PROFILE_KEY = "profile";
  const DRAFT_KEY = "draft";
  const OFFLINE_KEY = "offlineQueue";
  const TYPING_KEY = "typingProfile";
  const SUBMITTED_KEY = "submittedRuns";

  function now() {
    return Date.now();
  }

  function tryGet(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function trySet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function tryRemove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  function blankRun() {
    return {
      v: 1,
      currentNode: "start",
      badges: [],
      lessons: [],
      goldenRules: [],
      completedRooms: [],
      goldenQuizPassed: false,
      dataFragments: [],
      mentorPackets: [],
      journal: ["🌐 Mission accepted"],
      metCharacters: [],
      integrity: 100,
      reputation: 50,
      mentorTrust: {},
      strikes: 0,
      completedMinigames: [],
      startedAt: now(),
      updatedAt: now(),
    };
  }

  function blankProfile() {
    return {
      v: 2,
      totalRuns: 0,
      totalBadges: [],
      totalGoldenRules: [],
      totalMentorsMet: [],
      bestRun: null,
      hasBeatenGame: false,
      lastName: "",
      lastClassroom: "",
      rosterVerified: false,
      rosterVerifiedAt: null,
    };
  }

  function hasBeatenGame(profile) {
    const p = profile || loadProfile();
    if (p.hasBeatenGame) return true;
    const best = p.bestRun;
    return Boolean(best && (best.goldenCount || 0) >= 5 && (best.integrity || 0) >= 80);
  }

  function blankTypingProfile() {
    return {
      v: 4,
      diagnosed: false,
      testCpm: 0,
      targetCpm: 45,
      maxTypos: 2,
      lastPhrase: "",
      diagnosedAt: null,
      diagnosticAnalysis: null,
      pedagogy: null,
    };
  }

  function migrateTypingSpeed(raw) {
    if (typeof raw.testCpm === "number" && raw.testCpm > 0) {
      return {
        testCpm: raw.testCpm,
        targetCpm: typeof raw.targetCpm === "number" ? raw.targetCpm : 90,
      };
    }
    if (typeof raw.testWpm === "number" && raw.testWpm > 0) {
      const testCpm = Math.round(raw.testWpm * 5);
      const targetCpm = typeof raw.targetWpm === "number" ? Math.round(raw.targetWpm * 5) : Math.round(testCpm * 0.5);
      return { testCpm, targetCpm };
    }
    return { testCpm: 0, targetCpm: typeof raw.targetCpm === "number" ? raw.targetCpm : 90 };
  }

  function loadTypingProfile() {
    const raw = tryGet(`${PREFIX}:${TYPING_KEY}`);
    if (!raw || (raw.v !== 1 && raw.v !== 2 && raw.v !== 3 && raw.v !== 4)) return blankTypingProfile();
    const speeds = migrateTypingSpeed(raw);
    let targetCpm = speeds.targetCpm;
    let v = Number(raw.v) || 2;
    if (v < 3 && speeds.testCpm > 0) {
      targetCpm = Math.round(Math.min(95, Math.max(20, speeds.testCpm * 0.5)));
      v = 3;
    }
    const pedagogy = window.TechTrailPedagogy?.mergePedagogyProfile
      ? window.TechTrailPedagogy.mergePedagogyProfile(raw.pedagogy)
      : raw.pedagogy || null;
    return {
      v: 4,
      diagnosed: Boolean(raw.diagnosed),
      testCpm: speeds.testCpm,
      targetCpm,
      maxTypos: typeof raw.maxTypos === "number" ? raw.maxTypos : 2,
      lastPhrase: raw.lastPhrase || "",
      diagnosedAt: raw.diagnosedAt || null,
      diagnosticAnalysis: raw.diagnosticAnalysis || null,
      pedagogy,
    };
  }

  function saveTypingProfile(profile) {
    trySet(`${PREFIX}:${TYPING_KEY}`, { ...profile, v: 4 });
  }

  function normalizeArray(arr) {
    return Array.isArray(arr) ? arr : [];
  }

  function unionUnique(existing, incoming) {
    const set = new Set(existing);
    for (const item of normalizeArray(incoming)) set.add(item);
    return [...set];
  }

  function loadRun() {
    const raw = tryGet(`${PREFIX}:${RUN_KEY}`);
    if (!raw || raw.v !== 1) return null;
    return {
      currentNode: raw.currentNode || "start",
      badges: new Set(normalizeArray(raw.badges)),
      lessons: new Set(normalizeArray(raw.lessons)),
      goldenRules: new Set(normalizeArray(raw.goldenRules)),
      completedRooms: new Set(normalizeArray(raw.completedRooms)),
      goldenQuizPassed: Boolean(raw.goldenQuizPassed),
      dataFragments: normalizeArray(raw.dataFragments),
      mentorPackets: normalizeArray(raw.mentorPackets),
      journal: normalizeArray(raw.journal),
      metCharacters: new Set(normalizeArray(raw.metCharacters)),
      visitedRooms: new Set(normalizeArray(raw.visitedRooms).length ? raw.visitedRooms : [raw.currentNode || "start"]),
      integrity: typeof raw.integrity === "number" ? raw.integrity : 100,
      reputation: typeof raw.reputation === "number" ? raw.reputation : 50,
      mentorTrust: raw.mentorTrust && typeof raw.mentorTrust === "object" ? raw.mentorTrust : {},
      strikes: typeof raw.strikes === "number" ? raw.strikes : 0,
      completedMinigames: new Set(normalizeArray(raw.completedMinigames)),
      studentName: raw.studentName || "",
      classroom: raw.classroom || "",
      startedAt: raw.startedAt || now(),
      updatedAt: raw.updatedAt || now(),
    };
  }

  function saveRun(state) {
    const payload = {
      v: 1,
      currentNode: state.currentNode,
      badges: [...state.badges],
      lessons: [...state.lessons],
      goldenRules: [...state.goldenRules],
      completedRooms: [...(state.completedRooms || [])],
      goldenQuizPassed: Boolean(state.goldenQuizPassed),
      dataFragments: state.dataFragments || [],
      mentorPackets: state.mentorPackets || [],
      journal: state.journal,
      metCharacters: [...state.metCharacters],
      visitedRooms: [...(state.visitedRooms || [])],
      integrity: state.integrity ?? 100,
      reputation: state.reputation ?? 50,
      mentorTrust: state.mentorTrust || {},
      strikes: state.strikes ?? 0,
      completedMinigames: [...(state.completedMinigames || [])],
      studentName: state.studentName || "",
      classroom: state.classroom || "",
      startedAt: state.startedAt,
      updatedAt: now(),
    };
    trySet(`${PREFIX}:${RUN_KEY}`, payload);
  }

  function clearRun() {
    tryRemove(`${PREFIX}:${RUN_KEY}`);
    tryRemove(`${PREFIX}:${DRAFT_KEY}`);
  }

  function hasActiveRun() {
    const raw = tryGet(`${PREFIX}:${RUN_KEY}`);
    return !!(raw && raw.v === 1 && raw.currentNode && raw.currentNode !== "start");
  }

  function loadProfile() {
    const raw = tryGet(`${PREFIX}:${PROFILE_KEY}`);
    if (!raw || (raw.v !== 1 && raw.v !== 2)) return blankProfile();
    const bestRun = raw.bestRun || null;
    return {
      v: 2,
      totalRuns: raw.totalRuns || 0,
      totalBadges: normalizeArray(raw.totalBadges),
      totalGoldenRules: normalizeArray(raw.totalGoldenRules),
      totalMentorsMet: normalizeArray(raw.totalMentorsMet),
      bestRun,
      hasBeatenGame: Boolean(raw.hasBeatenGame)
        || Boolean(bestRun && (bestRun.goldenCount || 0) >= 5 && (bestRun.integrity || 0) >= 80),
      lastName: raw.lastName || "",
      lastClassroom: raw.lastClassroom || "",
      rosterVerified: Boolean(raw.rosterVerified),
      rosterVerifiedAt: raw.rosterVerifiedAt || null,
    };
  }

  function saveProfile(profile) {
    trySet(`${PREFIX}:${PROFILE_KEY}`, { ...profile, v: 2 });
  }

  function hasRosterProfile(profile) {
    const p = profile || loadProfile();
    return Boolean(p.rosterVerified && p.lastName && p.lastClassroom);
  }

  function summarizeRun(run) {
    const durationSec = Math.max(0, Math.round((now() - (run.startedAt || now())) / 1000));
    const integrity = run.integrity ?? 100;
    const goldenCount = run.goldenRules.size;
    const endingType = integrity >= 80 && goldenCount >= 5 ? "champion" : integrity >= 50 && goldenCount >= 3 ? "operative" : "probation";
    return {
      badgesCount: run.badges.size,
      goldenCount,
      mentorsCount: run.metCharacters.size,
      integrity,
      reputation: run.reputation ?? 50,
      durationSec,
      endingType,
    };
  }

  function mergeRunToProfile(run, profile) {
    const updated = { ...profile };
    updated.totalRuns = (updated.totalRuns || 0) + 1;
    updated.totalBadges = unionUnique(updated.totalBadges, [...run.badges]);
    updated.totalGoldenRules = unionUnique(updated.totalGoldenRules, [...run.goldenRules]);
    updated.totalMentorsMet = unionUnique(updated.totalMentorsMet, [...run.metCharacters]);

    const summary = summarizeRun(run);
    const currentBest = updated.bestRun;
    const isBetter =
      !currentBest ||
      summary.goldenCount > (currentBest.goldenCount || 0) ||
      (summary.goldenCount === (currentBest.goldenCount || 0) &&
        summary.integrity > (currentBest.integrity || 0)) ||
      (summary.goldenCount === (currentBest.goldenCount || 0) &&
        summary.integrity === (currentBest.integrity || 0) &&
        summary.badgesCount > (currentBest.badgesCount || 0));

    if (isBetter) {
      updated.bestRun = {
        badgesCount: summary.badgesCount,
        goldenCount: summary.goldenCount,
        mentorsCount: summary.mentorsCount,
        integrity: summary.integrity,
        reputation: summary.reputation,
        durationSec: summary.durationSec,
        endedAt: now(),
      };
    }
    if (summary.endingType === "champion") {
      updated.hasBeatenGame = true;
    }

    return updated;
  }

  function saveDraft(text) {
    trySet(`${PREFIX}:${DRAFT_KEY}`, { text: String(text || ""), savedAt: now() });
  }

  function loadDraft() {
    const raw = tryGet(`${PREFIX}:${DRAFT_KEY}`);
    if (!raw) return "";
    return String(raw.text || "");
  }

  function clearDraft() {
    tryRemove(`${PREFIX}:${DRAFT_KEY}`);
  }

  function loadSubmittedRuns() {
    const raw = tryGet(`${PREFIX}:${SUBMITTED_KEY}`);
    if (!raw || typeof raw !== "object") return {};
    return raw;
  }

  function saveSubmittedRuns(map) {
    trySet(`${PREFIX}:${SUBMITTED_KEY}`, map || {});
  }

  function submissionRunKey(name, classroom, runId) {
    const n = String(name || "").trim().toLowerCase();
    const c = String(classroom || "").trim().toLowerCase();
    const r = String(runId || "").trim();
    return `${n}|${c}|${r}`;
  }

  function hasSubmittedRun(name, classroom, runId) {
    if (!name || !classroom || !runId) return false;
    const map = loadSubmittedRuns();
    return Boolean(map[submissionRunKey(name, classroom, runId)]);
  }

  function markRunSubmitted(name, classroom, runId, submissionId) {
    if (!name || !classroom || !runId) return;
    const map = loadSubmittedRuns();
    map[submissionRunKey(name, classroom, runId)] = {
      submissionId: String(submissionId || ""),
      submittedAt: now(),
    };
    saveSubmittedRuns(map);
  }

  function queueOfflineSubmission(entry) {
    const queue = normalizeArray(tryGet(`${PREFIX}:${OFFLINE_KEY}`));
    const runId = entry?.runId;
    const name = entry?.name;
    const classroom = entry?.classroom;
    if (runId && name && classroom) {
      const key = submissionRunKey(name, classroom, runId);
      if (queue.some((q) => submissionRunKey(q.name, q.classroom, q.runId) === key)) return;
    }
    queue.push({ ...entry, queuedAt: now() });
    trySet(`${PREFIX}:${OFFLINE_KEY}`, queue);
  }

  function dequeueOfflineSubmissions() {
    const queue = normalizeArray(tryGet(`${PREFIX}:${OFFLINE_KEY}`));
    tryRemove(`${PREFIX}:${OFFLINE_KEY}`);
    return queue;
  }

  function hasOfflineSubmissions() {
    const queue = normalizeArray(tryGet(`${PREFIX}:${OFFLINE_KEY}`));
    return queue.length > 0;
  }

  window.TechTrailState = {
    loadRun,
    saveRun,
    clearRun,
    hasActiveRun,
    loadProfile,
    saveProfile,
    summarizeRun,
    mergeRunToProfile,
    saveDraft,
    loadDraft,
    clearDraft,
    queueOfflineSubmission,
    dequeueOfflineSubmissions,
    hasOfflineSubmissions,
    hasSubmittedRun,
    markRunSubmitted,
    submissionRunKey,
    hasRosterProfile,
    hasBeatenGame,
    blankRun,
    blankProfile,
    loadTypingProfile,
    saveTypingProfile,
    blankTypingProfile,
  };
})();
