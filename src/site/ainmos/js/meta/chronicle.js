/**
 * The night's chronicle (0.30): a small, saved record of what happened, and the
 * mad-lib play-by-play written from it.
 *
 * Every big moment calls one `tell*` function. It records a compact event on
 * `state.chronicle` (the end-of-night story is written from these) and adds one
 * varied, specific line to the play-by-play, with the moving parts wrapped in
 * <b class="pbp-v pbp-KIND"> so the log can glow them.
 *
 * Phrases are picked by a hash of the seed, the round and a counter, so a seed
 * replays the same telling and two nights read differently.
 *
 * No DOM, no imports from state.js (state.js calls in here).
 */

const MAX_EVENTS = 320;

const SUIT_NAME = { lucidity: "Lucidity", elasticity: "Elasticity", willpower: "Willpower" };

function hash(text) {
  let h = 2166136261;
  const s = String(text || "");
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function esc(text) {
  return String(text ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[ch]);
}

/** A glowing slot in a play-by-play line. */
function v(text, kind = "thing") {
  return `<b class="pbp-v pbp-${kind}">${esc(text)}</b>`;
}

export function chronicleOf(state) {
  if (!state) return null;
  if (!state.chronicle || typeof state.chronicle !== "object") {
    state.chronicle = { v: 1, events: [], visited: {}, firstVisit: [], n: 0 };
  }
  const c = state.chronicle;
  if (!Array.isArray(c.events)) c.events = [];
  if (!c.visited) c.visited = {};
  if (!Array.isArray(c.firstVisit)) c.firstVisit = [];
  return c;
}

function cycleOf(state) {
  const plan = state?.nightPlan || [];
  const drawn = plan.length - (state?.dreamDeck?.length || 0);
  return Math.max(1, Math.floor(Math.max(0, drawn - 1) / 3) + 1);
}

function record(state, type, data = {}) {
  const c = chronicleOf(state);
  if (!c) return null;
  const event = { t: type, r: state.round || 1, c: cycleOf(state), ...data };
  c.events.push(event);
  if (c.events.length > MAX_EVENTS) {
    // Keep the big moments; shed the small ones first.
    const small = c.events.findIndex((e) => e.t === "dream" || e.t === "buy" || e.t === "dusk");
    c.events.splice(small >= 0 ? small : 0, 1);
  }
  return event;
}

function choose(state, salt, list) {
  const c = chronicleOf(state);
  c.n = (c.n || 0) + 1;
  return list[hash(`${state?.seed || ""}|${state?.round || 0}|${salt}|${c.n}`) % list.length];
}

/** "a Lucidity 5", "a Wild". */
export function cardPhrase(card) {
  if (!card) return "a card";
  if (card.isWild || card.suit === "wild" || card.wild) return "a Wild";
  const suit = SUIT_NAME[card.suit] || "";
  const value = card.value ?? "";
  return `${/^[AEIOU]/.test(suit) ? "an" : "a"} ${suit} ${value}`.trim();
}

function cardsHtml(cards = []) {
  const parts = cards.slice(0, 4).map((c) => v(cardPhrase(c).replace(/^an? /, ""), c?.suit || "wild"));
  if (parts.length <= 1) return parts[0] || "nothing";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function snapCards(cards = []) {
  return cards.slice(0, 4).map((c) => ({ s: c?.isWild || c?.wild ? "wild" : c?.suit || "", n: c?.value ?? 0 }));
}

function say(state, html) {
  if (!state?.log) return;
  state.log.unshift(html);
  state.log = state.log.slice(0, globalThis.__AINMOS_LOG_CAP || 40);
}

// ---- The tellers --------------------------------------------------------------

/** A fight with a Dreambeast. ctx: { encounter, tile, actor, selected, played, needed, form }. */
function landName(tile) {
  if (!tile) return "the Dreamscape";
  return tile.id === "bed" || tile.center ? "The Bed" : tile.name || "the Dreamscape";
}

export function tellFight(state, ctx, won) {
  const beast = ctx?.encounter?.name || "a Dreambeast";
  const place = landName(ctx?.tile);
  const formName = ctx?.form?.name || "";
  const cards = ctx?.selected || [];
  record(state, "fight", {
    beast, id: ctx?.encounter?.refId || ctx?.encounter?.id, suit: ctx?.encounter?.suit, power: ctx?.needed || 0,
    dice: ctx?.played || 0, won: !!won, form: formName, cards: snapCards(cards), land: place,
    boss: !!ctx?.encounter?.boss, mega: ctx?.encounter?.megaTier || 0,
  });
  const B = v(beast, "beast");
  const L = v(place, "land");
  const C = cardsHtml(cards);
  const F = formName ? v(formName, "form") : "";
  const D = v(`${ctx?.played || 0}d6`, "num");
  const P = v(`Power ${ctx?.needed || 0}`, "num");
  const lines = won
    ? [
      `On ${L}, you lay down ${C}${F ? `, a ${F}` : ""}, and ${D} roll true. ${B} bows out.`,
      `${B} lunges across ${L}; ${C} answers${F ? ` as a ${F}` : ""}. ${D} beats ${P}.`,
      `${F ? `A ${F} of ${C}` : C} rolls ${D} against ${P}, and ${B} is yours to keep.`,
      `${L} goes quiet. ${C} was enough, ${D} to ${P}, and ${B} lowers its head.`,
      `You stare ${B} down on ${L}. ${C}${F ? `, shaped into a ${F},` : ""} roll ${D}. It yields.`,
    ]
    : [
      `${B} shrugs off ${C} on ${L}. ${D} was not ${P}.`,
      `${C}${F ? ` in a ${F}` : ""} breaks against ${B}. It keeps ${L}.`,
      `The dice go cold on ${L}: ${D} against ${P}. ${B} laughs and stays.`,
      `${B} swallows ${C} whole and is still hungry on ${L}.`,
    ];
  say(state, choose(state, won ? "fight-win" : "fight-loss", lines));
}

/** A fight with an Archetype. ctx: { arch, tile, cards, dice, power, side, label }. */
export function tellArchetypeFight(state, ctx, won) {
  const name = ctx?.arch?.name || "an Archetype";
  const place = landName(ctx?.tile);
  const form = ctx?.form || "";
  record(state, "afight", {
    arch: name, id: ctx?.arch?.id, land: place, won: !!won, dice: ctx?.dice || 0, power: ctx?.power || 12,
    side: ctx?.side || "", event: ctx?.label || "", form, cards: snapCards(ctx?.cards || []),
  });
  const A = v(name, "arch");
  const L = v(place, "land");
  const C = cardsHtml(ctx?.cards || []);
  const D = v(`${ctx?.dice || 0}d6`, "num");
  const E = ctx?.label && ctx.label !== "No Event" ? v(ctx.label, "event") : "";
  const lines = won
    ? [
      `${A} meets you on ${L}${E ? ` through ${E}` : ""}. ${C} roll ${D}, and it becomes part of you.`,
      `${E ? `${E} bends the air on ${L}. ` : ""}You answer ${A} with ${C}, ${D}, and it is yours.`,
      `On ${L}, ${A} reaches out. ${C} reach back${form ? ` as a ${v(form, "form")}` : ""}. ${D} seal it.`,
    ]
    : [
      `${A} slips through your fingers on ${L}. ${C} were not enough.`,
      `${E ? `${E} turns against you. ` : ""}${A} holds its ground on ${L}; ${D} fall short.`,
      `${A} only smiles. ${C} scatter across ${L}.`,
    ];
  say(state, choose(state, won ? "arch-win" : "arch-loss", lines));
}

/** An Archetype joins you, by fight or by set. */
export function tellAcquire(state, archetype, { how = "fight", set = "", land = "" } = {}) {
  record(state, "acquire", { arch: archetype?.name, id: archetype?.id, suit: archetype?.suit, how, set, land, power: archetype?.power || archetype?.passive || "" });
}

/** A step onto a Landscape. Only the first visit gets a line. */
export function tellMove(state, tile) {
  if (!tile?.id) return;
  const c = chronicleOf(state);
  c.visited[tile.id] = (c.visited[tile.id] || 0) + 1;
  if (c.visited[tile.id] > 1 || tile.id === "bed") return;
  if (!c.visitNames) c.visitNames = {};
  c.visitNames[tile.id] = tile.name;
  c.firstVisit.push({ id: tile.id, name: tile.name, suit: tile.suit, r: state.round || 1 });
  const L = v(tile.name, "land");
  say(state, choose(state, "move", [
    `You set foot on ${L} for the first time.`,
    `${L} unfolds under your feet, new and strange.`,
    `First steps into ${L}. It smells like a memory you never had.`,
    `You wander into ${L}, and it seems to have been waiting.`,
  ]));
}

export function tellDream(state, card) {
  if (!card?.name) return;
  record(state, "dream", { name: card.name, kind: card.type || card.kind || "" });
}

export function tellDeath(state, player, cause = "") {
  const land = player?.landscapeId || "";
  record(state, "death", { cause: String(cause || "").slice(0, 80), land });
  say(state, choose(state, "death", [
    `You come apart ${esc(cause || "in the dark")}, and wake gasping on ${v("The Bed", "land")}.`,
    `Everything goes white. ${v("The Bed", "land")} catches you again.`,
    `You fall out of the dream ${esc(cause || "")} and land, shaking, on ${v("The Bed", "land")}.`,
  ]));
}

export function tellForget(state, tile, by = "") {
  if (!tile?.name) return;
  record(state, "forget", { land: tile.name, id: tile.id, by });
}

export function tellDusk(state, { count = 0, beasts = [] } = {}) {
  if (!count) return;
  record(state, "dusk", { count, beasts: beasts.slice(0, 4) });
  if (count < 4) return;
  say(state, choose(state, "dusk", [
    `Dusk drags ${v(`${count} Psyche`, "num")} down into the dark${beasts.length ? `, ${v(beasts[0], "beast")} grinning loudest` : ""}.`,
    `The light fails. ${v(`${count} memories`, "num")} sink below the surface.`,
  ]));
}

export function tellWhole(state, placed) {
  record(state, "whole", { placed });
  say(state, `Every Landscape stands at once: ${v(`all ${placed}`, "num")}. ${v("The Dream is Whole", "event")}.`);
}

export function tellFold(state) {
  record(state, "fold", {});
}

export function tellSet(state, label, archetype, pieces = []) {
  record(state, "set", { set: label, arch: archetype?.name, pieces: pieces.map((p) => p.name).slice(0, 5) });
  say(state, `The ${v(label, "thing")} pieces spiral together into ${v(archetype?.name || "an Archetype", "arch")}.`);
}

export function tellBuy(state, card) {
  if (!card?.name) return;
  record(state, "buy", { name: card.name, suit: card.suit });
}

export function tellArrival(state, encounter, tile) {
  if (!encounter?.name) return;
  record(state, "arrive", { beast: encounter.name, id: encounter.refId || encounter.id, land: tile?.name || "", power: Number(encounter.accept) || 0, boss: !!encounter.boss, mega: encounter.megaTier || 0 });
}

export function tellEndless(state) {
  record(state, "endless", {});
}
