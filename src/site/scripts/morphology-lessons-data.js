/**
 * Mini-lessons for Morphology Garden — written for students (about grades 6–10): say what the pieces mean,
 * why the word is built that way, and how that helps reading and spelling—not presenter jargon.
 * @typedef {{ segment: string, origin?: string, note?: string }} EtymoPart
 */

/** Plain-language glosses for morpheme tags used in lesson lists. */
export const AFFIX_ORIGIN_HINT = {
  "pfx:in-":
    '<strong>in-</strong> (and <strong>im-, il-, ir-</strong> before certain letters): adds “not” or “without.” Examples: <em>illegal, impossible, irregular</em>.',
  "pfx:re-":
    '<strong>re-</strong>: “again,” or sometimes “back” or “against.” Examples: <em>rewrite, rethink, resist</em>.',
  "pfx:un-":
    '<strong>un-</strong>: “not” or “reverse.” Common on everyday words: <em>unhappy, unzip</em>. Not the same family as Latin-type <strong>in-</strong>.',
  "pfx:de-": '<strong>de-</strong>: often “remove,” “reverse,” or “down.” Example: <em>decode</em>.',
  "pfx:pre-": '<strong>pre-</strong>: “before.” Examples: <em>preview, predict</em>.',
  "pfx:trans-": '<strong>trans-</strong>: “across” or “through.” Examples: <em>transport, translate</em>.',
  "sfx:-tion":
    '<strong>-tion / -ation</strong>: turns a verb-ish stem into a noun naming an act, process, or result. Example: <em>inform → information</em>.',
  "sfx:-ation": '<strong>-ation</strong>: same job as <strong>-tion</strong>—noun built from a stem.',
  "sfx:-ment": '<strong>-ment</strong>: noun suffix—“the result or product of ___ing.” Example: <em>develop → development</em>.',
  "sfx:-al": '<strong>-al</strong>: “related to” or “like a ___.” Example: <em>nation → national</em>.',
  "sfx:-ous": '<strong>-ous</strong>: “full of” or “having lots of ___.” Example: <em>dangerous</em>.',
  "sfx:-able":
    '<strong>-able</strong>: “can be ___ed” or “capable of being ___ed.” Example: <em>read → readable</em>.',
  "sfx:-ize": '<strong>-ize</strong>: turns a word into a verb meaning “make into” or “treat as.” Example: <em>hospital → hospitalize</em>.',
  "sfx:-ity": '<strong>-ity</strong>: turns many adjectives into abstract nouns. Example: <em>sincere → sincerity</em>.',
  "sfx:-er":
    '<strong>-er</strong>: two big jobs—(1) “more ___” on short adjectives (<em>wiser</em>), or (2) “person or thing that ___s” (<em>teacher</em>). Use sentence grammar to tell which.',
  "sfx:-ful": '<strong>-ful</strong>: “full of” or “having.” Example: <em>careful</em>.',
  "sfx:-less": '<strong>-less</strong>: “without.” Example: <em>hopeless</em>.',
  "sfx:-dom":
    '<strong>-dom</strong>: turns a word into a noun about a state or realm. Examples: <em>freedom, kingdom</em>.',
};

/**
 * Optional fallback — lessons read `w.deep` on each word in `morphology-words-data.js` first.
 * @type {Record<string, { summary?: string, etymology?: EtymoPart[], formation?: string, tense?: string, embedded?: { text: string, note: string }[], spelling?: { from: string, to: string, note: string }[] }>}
 */
export const MORPH_DEEP_NOTES = {};

function morphLessonPieces(w, morphemeRegistry) {
  const deep = w.deep || MORPH_DEEP_NOTES[w.id];
  const pieces = [];

  const headParts = [];
  headParts.push(`<h3 class="morph-lesson__h"><em>${w.label}</em> — how it breaks apart</h3>`);
  if (w.focusMorpheme) {
    headParts.push(
      `<p class="morph-lesson__focus"><strong>Morpheme focus:</strong> ${escapeHtml(w.focusMorpheme)}</p>`
    );
  }
  headParts.push(`<p class="morph-lesson__bracket-caption">How the pieces nest (outer brackets = bigger meaning units):</p>`);
  headParts.push(`<div class="morph-lesson__bracket" translate="no">${w.bracket}</div>`);
  if (deep?.summary) headParts.push(`<p class="morph-lesson__lead">${deep.summary}</p>`);
  else if (w.note) headParts.push(`<p class="morph-lesson__lead">${stripPara(w.note)}</p>`);
  if (w.tier) {
    const tierLabel =
      w.tier === "tier1"
        ? "Tier 1 — everyday / high-frequency"
        : w.tier === "tier2"
          ? "Tier 2 — academic / cross-subject utility"
          : w.tier === "tier3"
            ? "Tier 3 — lower-frequency or domain-heavy"
            : String(w.tier);
    headParts.push(
      `<section class="morph-lesson__sec morph-lesson__sec--tier"><h4>Vocabulary tier</h4><p><strong>${escapeHtml(tierLabel)}</strong>.</p></section>`
    );
  }
  pieces.push(headParts.join(""));

  if (deep?.formation) {
    pieces.push(
      `<section class="morph-lesson__sec"><h4>Why the nesting matters</h4><p>${deep.formation}</p></section>`
    );
  }

  if (deep?.etymology?.length) {
    let b =
      `<section class="morph-lesson__sec"><h4>What each piece means</h4><ul class="morph-lesson__ul">`;
    for (const e of deep.etymology) {
      b += `<li><strong>${escapeHtml(e.segment)}</strong> — ${e.origin || ""}`;
      if (e.note) b += ` <span class="morph-lesson__note">${escapeHtml(e.note)}</span>`;
      b += `</li>`;
    }
    b += `</ul></section>`;
    pieces.push(b);
  }

  if (deep?.spelling?.length) {
    let b = `<section class="morph-lesson__sec morph-lesson__sec--callout"><h4>Spelling tip</h4><ul>`;
    for (const s of deep.spelling) {
      b += `<li><code>${escapeHtml(s.from)}</code> → <code>${escapeHtml(s.to)}</code> — ${escapeHtml(s.note)}</li>`;
    }
    b += `</ul></section>`;
    pieces.push(b);
  }

  if (deep?.embedded?.length) {
    let b =
      `<section class="morph-lesson__sec"><h4>Smaller words inside this word</h4><ul>`;
    for (const emb of deep.embedded) {
      b += `<li><strong>${escapeHtml(emb.text)}</strong> — ${escapeHtml(emb.note)}</li>`;
    }
    b += `</ul></section>`;
    pieces.push(b);
  }

  if (deep?.tense) {
    pieces.push(`<section class="morph-lesson__sec"><h4>What kind of word is this?</h4><p>${deep.tense}</p></section>`);
  }

  const keys = [];
  walkKeys(w.tree, keys);
  const uniqKeys = [...new Set(keys)].filter(Boolean);
  const sharedBullets = [];
  for (const k of uniqKeys) {
    const reg = morphemeRegistry[k];
    if (!reg || reg.length < 2) continue;
    const others = [...new Set(reg.map((x) => x.wordId))]
      .filter((id) => id !== w.id)
      .map((id) => WORDS_LOOKUP_LABEL(id))
      .filter(Boolean);
    if (!others.length) continue;
    const shortKey = k.replace(/^(pfx|sfx|root|lex):/, "");
    sharedBullets.push(
      `<li>The piece <strong>${escapeHtml(shortKey)}</strong> also appears in: ${others.map((x) => `<em>${escapeHtml(x)}</em>`).join(", ")} (same word list).</li>`
    );
  }
  if (sharedBullets.length) {
    pieces.push(
      `<section class="morph-lesson__sec morph-lesson__sec--web"><h4>Same piece in other words (in this list)</h4><ul class="morph-lesson__ul">${sharedBullets.join(
        ""
      )}</ul><p class="morph-lesson__meta">Follow the pink links on the diagram to jump between words that share a chunk.</p></section>`
    );
  }

  return pieces;
}

/**
 * @param {object} w — word record from Morphology Garden
 * @param {Record<string, { mesh?: unknown; wordId: string }[]>} morphemeRegistry
 */
export function renderMorphLessonHtml(w, morphemeRegistry) {
  const pieces = morphLessonPieces(w, morphemeRegistry);
  if (!pieces.length) return "";

  if (pieces.length === 1) {
    return `<div class="morph-lesson morph-lesson--single">${pieces[0]}</div>`;
  }

  const mid = Math.ceil(pieces.length / 2);
  const leftInner = `<div class="morph-lesson-wing morph-lesson-wing--left">${pieces.slice(0, mid).join("")}</div>`;
  const rightInner = `<div class="morph-lesson-wing morph-lesson-wing--right">${pieces.slice(mid).join("")}</div>`;
  return `<div class="morph-detail-lesson morph-detail-lesson--flank">${leftInner}${rightInner}</div>`;
}

/**
 * Combined mini-lesson for dual compare layout: centred on overlapping morpheme keys between two lemmas.
 * @param {object} wa
 * @param {object} wb
 * @param {Record<string, { mesh?: unknown; wordId: string }[]>} morphemeRegistry
 */
export function renderMorphDualLessonHtml(wa, wb, morphemeRegistry) {
  const ka = [];
  walkKeys(wa.tree, ka);
  const kb = [];
  walkKeys(wb.tree, kb);
  const kbSet = new Set(kb);
  const sharedKeys = [...new Set(ka)].filter(Boolean).filter((k) => kbSet.has(k));
  sharedKeys.sort();

  let html =
    `<div class="morph-lesson morph-lesson--dual"><h3 class="morph-lesson__h">Comparing ` +
    `<em>${escapeHtml(wa.label)}</em> &amp; <em>${escapeHtml(wb.label)}</em></h3>`;

  if (!sharedKeys.length) {
    html +=
      `<p class="morph-lesson__lead">These two words don’t share a labelled chunk in this vocabulary list. If you still see pink lines between spheres on the diagram, those show links the view draws between shared pieces.</p></div>`;
    return html;
  }

  html += `<p class="morph-lesson__lead">Below are pieces that show up on <em>both</em> trees. Pink arcs on the diagram connect matching chunks so you can see one morpheme doing similar work in two words.</p>`;
  html += `<section class="morph-lesson__sec morph-lesson__sec--overlap"><h4>What both words share</h4><ul class="morph-lesson__ul">`;

  for (const key of sharedKeys) {
    const shortKey = key.replace(/^(pfx|sfx|root|lex):/, "");
    let glossHtml = AFFIX_ORIGIN_HINT[key];
    if (!glossHtml) {
      glossHtml = `This piece <strong>${escapeHtml(shortKey)}</strong> is tagged on both words—hover the diagram for glosses and see how the meaning fits each tree.`;
    }
    const reg = morphemeRegistry[key];
    const regOthers = reg
      ? [...new Set(reg.map((x) => x.wordId))]
          .filter((id) => id !== wa.id && id !== wb.id)
          .map((id) => WORDS_LOOKUP_LABEL(id))
          .filter(Boolean)
      : [];
    const sibling =
      regOthers.length > 0 ?
        `<span class="morph-lesson__meta"> Also tagged in other loaded words: ${regOthers.map((x) => `<em>${escapeHtml(x)}</em>`).join(", ")}.</span>` :
        "";
    html += `<li>${glossHtml}${sibling}</li>`;
  }
  html += `</ul></section></div>`;
  return html;
}

/** @type {(id: string) => string} */
let WORDS_LOOKUP_LABEL = () => "";

export function configureLessonWordLookup(fn) {
  WORDS_LOOKUP_LABEL = fn;
}

function stripPara(htmlish) {
  return String(htmlish).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function walkKeys(node, out) {
  if (node.morphemeKey) out.push(node.morphemeKey);
  for (const c of node.children || []) walkKeys(c, out);
}
