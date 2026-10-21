#!/usr/bin/env node
/**
 * CyberMorph — minigame family coverage audit (levels plan, Fix 3, decision 11).
 *
 * Checks js/data/families.js against the morpheme table:
 *   - every non-Lingo morpheme has exactly one family
 *   - no family lists an unknown or Lingo morpheme
 *   - at most six single-morpheme families
 *   - a family over 60 morphemes must split into subs of 25 or fewer (its plan for variety)
 * Then prints family → count → sample morphemes, and the count per origin.
 *
 * Usage:  node scripts/audit-cybermorph-families.mjs          (exit 1 on any error)
 *         node scripts/audit-cybermorph-families.mjs --all    (print every member, not a sample)
 */

import { MORPHEMES, ORIGIN_LABEL } from '../src/site/cybermorph/js/data/morphemes.js';
import { FAMILIES, FAMILY_OF, SUB_OF, FAMILY_ROWS } from '../src/site/cybermorph/js/data/families.js';

const all = process.argv.includes('--all');
const errors = [];
const MAX_SINGLES = 6;
const BIG = 60;
const MAX_SUB = 25;

// Every row points at a real, non-Lingo morpheme, and no morpheme sits in two families.
const seen = new Map();
for (const [id, fam] of FAMILY_ROWS) {
  const m = MORPHEMES[id];
  if (!m) errors.push(`${fam}: unknown morpheme "${id}"`);
  else if (m.origin === 'lingo') errors.push(`${fam}: "${id}" is Lingo, which has no family`);
  if (seen.has(id)) errors.push(`"${id}" is in both ${seen.get(id)} and ${fam}`);
  else seen.set(id, fam);
}

// Every non-Lingo morpheme has a family.
const bank = Object.values(MORPHEMES).filter((m) => m.origin !== 'lingo');
const missing = bank.filter((m) => !FAMILY_OF[m.id]);
for (const m of missing) errors.push(`no family: "${m.id}" (${m.origin} ${m.type}, "${m.meaning}")`);

// Family sizes, singles budget, and the variety plan for big families.
const byFamily = new Map(Object.keys(FAMILIES).map((f) => [f, []]));
for (const [id, fam] of Object.entries(FAMILY_OF)) byFamily.get(fam).push(id);
const singles = Object.values(FAMILIES).filter((f) => f.single);
if (singles.length > MAX_SINGLES) errors.push(`${singles.length} single-morpheme families (at most ${MAX_SINGLES})`);
for (const f of singles) if (byFamily.get(f.id).length !== 1) errors.push(`${f.id} is marked single but holds ${byFamily.get(f.id).length}`);
for (const [fam, ids] of byFamily) {
  if (!ids.length) errors.push(`${fam} is empty`);
  if (ids.length <= BIG) continue;
  if (!FAMILIES[fam].subs) { errors.push(`${fam} holds ${ids.length} (over ${BIG}) with no subs for variety`); continue; }
  const subCount = {};
  for (const id of ids) subCount[SUB_OF[id]] = (subCount[SUB_OF[id]] || 0) + 1;
  for (const [sub, n] of Object.entries(subCount)) if (n > MAX_SUB) errors.push(`${fam}/${sub} holds ${n} (over ${MAX_SUB})`);
}

// ── Report ────────────────────────────────────────────────────────
const origins = Object.keys(ORIGIN_LABEL).filter((o) => o !== 'lingo');
const pad = (s, n) => String(s).padEnd(n);
const rows = [...byFamily].map(([fam, ids]) => {
  const f = FAMILIES[fam];
  const per = origins.map((o) => ids.filter((id) => MORPHEMES[id]?.origin === o).length);
  const subs = f.subs ? Object.keys(f.subs).map((s) => `${s} ${ids.filter((id) => SUB_OF[id] === s).length}`).join(', ') : '';
  const sample = all ? ids.join(' ') : ids.slice(0, 8).join(' ') + (ids.length > 8 ? ' …' : '');
  return { name: f.name + (f.single ? ' (single)' : ''), n: ids.length, per, subs, sample };
});

console.log(`\nCyberMorph minigame families — ${Object.keys(FAMILIES).length} families, ${singles.length} single`);
console.log(`${pad('Family', 22)}${pad('Count', 7)}${origins.map((o) => pad(o, 7)).join('')}Sample`);
for (const r of rows) {
  console.log(`${pad(r.name, 22)}${pad(r.n, 7)}${r.per.map((n) => pad(n, 7)).join('')}${r.sample}`);
  if (r.subs) console.log(`${pad('', 22 + 7 + 7 * origins.length)}subs: ${r.subs}`);
}

const covered = bank.filter((m) => FAMILY_OF[m.id]).length;
console.log('\nPer origin (covered / non-Lingo morphemes):');
for (const o of origins) {
  const inOrigin = bank.filter((m) => m.origin === o);
  console.log(`  ${pad(ORIGIN_LABEL[o], 12)} ${inOrigin.filter((m) => FAMILY_OF[m.id]).length} / ${inOrigin.length}`);
}
console.log(`  ${pad('Total', 12)} ${covered} / ${bank.length}`);
console.log(`  (Lingo, excluded: ${Object.values(MORPHEMES).length - bank.length})`);

if (errors.length) {
  console.error(`\n${errors.length} error(s):`);
  for (const e of errors) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log('\n✓ every non-Lingo morpheme has exactly one family');
