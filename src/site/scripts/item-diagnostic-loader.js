/**
 * Loads the full Tech Escape question bank for ITEM Diagnostic.
 */
import { ALL_QUESTIONS } from "/tech-escape/js/data/questions.js";

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

window.ITEMDiagnosticBank = ALL_QUESTIONS.map((q) => ({
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

window.dispatchEvent(new CustomEvent("item-diagnostic-ready"));
