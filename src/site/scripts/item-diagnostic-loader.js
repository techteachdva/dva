/**
 * Loads the Tech Escape question bank. A teacher CSV saved in this browser
 * replaces it for quizzes opened here. The built-in bank stays available.
 */
import { ALL_QUESTIONS } from "/tech-escape/js/data/questions.js";

const LOCAL_KEY = "item-diagnostic-question-bank";

function topicFromId(id) {
  if (id.startsWith("DES-")) return "design";
  if (id.startsWith("SYS-")) return "systems";
  if (id.startsWith("DAT-")) return "data";
  if (id.startsWith("COD-")) return "code";
  return "general";
}

function parseStd(std) {
  const m = String(std || "").match(/ITEM\s+([\d.]+)/);
  return m ? m[1] : "";
}

function cloneBank(list) {
  return list.map((q) => ({
    ...q,
    a: Array.isArray(q.a) ? [...q.a] : [],
    correct: Array.isArray(q.correct) ? [...q.correct] : [],
  }));
}

const mapped = ALL_QUESTIONS.map((q) => ({
  id: q.id,
  std: parseStd(q.std),
  stdLabel: String(q.std || "").split("|")[0].replace(/^ITEM\s+[\d.]+\s*-\s*/, "").trim(),
  topic: topicFromId(q.id),
  q: q.q,
  a: q.a,
  correct: q.correct,
  why: q.why,
  level: q.level ?? 2,
}));

window.ITEMDiagnosticBuiltinBank = cloneBank(mapped);
window.ITEMDiagnosticBank = cloneBank(mapped);
window.ITEMDiagnosticBankMeta = { source: "builtin" };

try {
  const saved = JSON.parse(localStorage.getItem(LOCAL_KEY) || "null");
  if (saved && Array.isArray(saved.questions) && saved.questions.length) {
    window.ITEMDiagnosticBank = saved.questions;
    window.ITEMDiagnosticBankMeta = {
      source: "upload",
      label: saved.label || "Uploaded CSV",
      updatedAt: saved.updatedAt || null,
      count: saved.questions.length,
    };
  }
} catch {
  /* keep the built-in bank */
}

window.dispatchEvent(new CustomEvent("item-diagnostic-ready"));
