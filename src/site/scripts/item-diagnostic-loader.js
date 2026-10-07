/**
 * Loads the Tech Escape question bank, then replaces it when a teacher has
 * published a spreadsheet. The built-in bank stays available for restore.
 */
import { ALL_QUESTIONS } from "/tech-escape/js/data/questions.js";

const BANK_URL = "/api/item-diagnostic-submissions?bank=1";

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
window.ITEMDiagnosticBankStorage = "ready";

let readySent = false;

function finishBankLoad() {
  const name = readySent ? "item-diagnostic-bank-updated" : "item-diagnostic-ready";
  readySent = true;
  window.dispatchEvent(new CustomEvent(name));
}

async function loadPublishedBank() {
  const res = await fetch(BANK_URL, { cache: "no-store" });
  if (!res.ok) return;
  const data = await res.json();
  window.ITEMDiagnosticBankStorage = data.storage || "ready";
  if (data.source === "upload" && Array.isArray(data.questions) && data.questions.length) {
    window.ITEMDiagnosticBank = data.questions;
    window.ITEMDiagnosticBankMeta = {
      source: "upload",
      label: data.label || "Uploaded spreadsheet",
      updatedAt: data.updatedAt || null,
      count: data.questions.length,
    };
  }
}

const giveUp = setTimeout(finishBankLoad, 4000);
loadPublishedBank()
  .catch(() => {})
  .finally(() => {
    clearTimeout(giveUp);
    finishBankLoad();
  });
