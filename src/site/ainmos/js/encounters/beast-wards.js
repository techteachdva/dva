/**
 * Ainmos 0.25: Dreambeast wards and Cycle-scaled Power.
 *
 * Every Dreambeast takes any suit of Psyche. Instead, each one wards a single
 * Dream Form: if your spread counts as that Form, its dice are cut by the
 * ward (1 to 5, by how strong the beast is). The spread then counts as
 * whichever Form it makes that earns the most dice after the ward.
 *
 * Every Dreambeast also grows with the night: it arrives at its Power plus the
 * number of the Cycle it arrives in (Cycle 1 +1, Cycle 2 +2, ...).
 */

import { formById } from "../cards/dream-forms.js";

/** Which Form each Dreambeast wards. */
export const BEAST_WARD_FORM = Object.freeze({
  double: "echo",
  mandrake: "echo",
  "ghost-light": "echo",
  pooka: "echo",
  watcher: "echo",
  nixie: "echo",
  "winged-turtle": "ladder",
  jackalope: "ladder",
  minotaur: "ladder",
  automaton: "ladder",
  "goofus-bird": "ladder",
  leviathan: "chord",
  merperson: "chord",
  sincubus: "chord",
  "masked-figure": "chord",
  cerberus: "trinity",
  chimera: "trinity",
  mindless: "trinity",
  basilisk: "trinity",
  "cheshire-cat": "trinity",
  oni: "trifecta",
  devourer: "trifecta",
  werewolf: "trifecta",
  vampyre: "trifecta",
  "black-dog": "trifecta",
  guardian: "trifecta",
  baku: "unity",
  sandman: "unity",
  unicorn: "unity",
  shadows: "unity",
  gorgon: "unity",
  bogey: "unity",
  "trash-gremlin": "unity",
});

const FALLBACK_FORMS = ["echo", "ladder", "chord", "trinity", "trifecta", "unity"];
export const MAX_WARD = 5;

function hashOf(text) {
  let h = 0;
  for (const ch of String(text || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

function beastId(encounter) {
  return encounter?.refId || encounter?.id || "";
}

/** Ward strength from the beast's own Power (before the Cycle): Power 4 wards 1, Power 11+ wards 5. */
export function wardAmountForPower(power) {
  return Math.max(1, Math.min(MAX_WARD, Math.ceil(((Number(power) || 0) - 2) / 2)));
}

/** The ward this Dreambeast carries: { formId, amount }, or null for anything that is not a beast. */
export function beastWard(encounter) {
  if (!encounter) return null;
  if (encounter.ward) return encounter.ward;
  const id = beastId(encounter);
  const formId = BEAST_WARD_FORM[id] || FALLBACK_FORMS[hashOf(id) % FALLBACK_FORMS.length];
  const base = encounter.basePower ?? encounter.accept;
  return { formId, amount: wardAmountForPower(base) };
}

/** "Wards Echo −3" (or "Wards every Form −5"). */
export function beastWardText(encounter) {
  const ward = beastWard(encounter);
  if (!ward) return "";
  const name = ward.formId === "all" ? "every Form" : (formById(ward.formId)?.name || ward.formId);
  return `Wards ${name} −${ward.amount}`;
}

/**
 * The power curve (0.30). Dreambeasts grow slowly with the night: +1 every
 * 4 Cycles (Cycles 1-4 +0, 5-8 +1, 9-12 +2, 13-16 +3 ...). Nothing in the night
 * passes the Leviathan: ordinary beasts top out at 11, the ladder's Leviathan at 12,
 * and only Endless Mode's Leviathans (fixed 13, 14, 16, 20, 99) stand above it.
 */
export const BEAST_POWER_CAP = 11;
export const LEVIATHAN_POWER_CAP = 12;

export function cycleGrowth(cycle) {
  return Math.max(0, Math.floor(((Number(cycle) || 1) - 1) / 4));
}

export function beastPowerCap(encounter) {
  return beastId(encounter) === "leviathan" ? LEVIATHAN_POWER_CAP : BEAST_POWER_CAP;
}

/** The Power a beast printed at `printed` arrives with in this Cycle. */
export function powerForCycle(encounter, printed, cycle) {
  return Math.min(beastPowerCap(encounter), printed + cycleGrowth(cycle));
}

/** Stamp a fresh Dreambeast with its ward and the Cycle it arrived in. */
export function stampBeastForCycle(encounter, cycle) {
  if (!encounter || encounter.cycleBonus != null) return encounter;
  const before = Number(encounter.accept) || 0;
  if (!encounter.ward) encounter.ward = beastWard(encounter);
  if (encounter.fixedPower) {
    encounter.cycleBonus = 0;
    return encounter;
  }
  const power = powerForCycle(encounter, before, cycle);
  if (encounter.basePower == null) encounter.basePower = Math.min(before, power);
  encounter.cycleBonus = Math.max(0, power - encounter.basePower);
  encounter.accept = power;
  encounter.reject = power;
  encounter.repress = power;
  return encounter;
}
