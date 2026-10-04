#!/usr/bin/env node
/**
 * Human-readable design report from somnia-winrate-report.json
 * Run: node scripts/somnia-winrate-analysis.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const reportPath = join(__dirname, "somnia-winrate-report.json");
const outPath = join(__dirname, "somnia-winrate-design-report.md");

const report = JSON.parse(readFileSync(reportPath, "utf8"));

function pct(x) {
  return typeof x === "number" ? `${x}%` : "—";
}

function block(title, s) {
  if (!s) return `### ${title}\n\n_No data._\n`;
  const fr = s.n ? ((s.finalRecurrenceGames / s.n) * 100).toFixed(1) : "0.0";
  const reasons = Object.entries(s.reasons || {})
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
  return [
    `### ${title}`,
    "",
    `- **Games:** ${s.n} · **Wins:** ${s.wins} (${pct(s.winPct)}) · **95% CI:** ${s.ci95?.join("–")}%`,
    `- **Avg points:** ${s.avgPoints} · **Avg archetypes acquired:** ${s.avgArchetypes}`,
    `- **Avg rounds:** ${s.avgRounds} · **Avg deaths:** ${s.avgDeaths} · **Dreams left (avg):** ${s.avgDreamsLeft}`,
    `- **Final Recurrence reached:** ${s.finalRecurrenceGames} games (${fr}%)`,
    `- **Hit point goal but lost:** ${s.goalReachedButLost} · **Goal met, not all on Bed:** ${s.goalMetNotOnBed ?? 0}`,
    `- **Loss reasons:** ${reasons || "—"}`,
    "",
  ].join("\n");
}

const o = report.overall;
const sk = report.skilled;
const sl = report.sloppy || { n: 0, winPct: 0, wins: 0 };

let verdict = "";
let band = "unknown";
if (!sk?.n) {
  verdict = "**No skilled games in the report.**";
} else if (sk.winPct > 22) {
  band = "too-easy";
  verdict = "**Too easy for skilled tables** — bots win more than a skilled human group should; tighten economy or the Final Recurrence gate.";
} else if (sk.winPct > 15) {
  band = "slightly-easy";
  verdict = "**Slightly easy** — win rate is high but not broken; consider small nerfs if human groups report frequent wins.";
} else if (sk.winPct < 3) {
  band = sk.avgArchetypes < 0.5 ? "bots-weak-or-very-hard" : "very-hard";
  verdict = sk.avgArchetypes < 0.5
    ? "**Bots still look weak, or the table is extremely hard** — skilled AIs acquire almost no Archetypes. Treat this as a bot-capability check before nerfing humans."
    : "**Very hard** — skilled bots rarely close even after acquiring points; Final Recurrence is likely the wall.";
} else if (sk.winPct < 8) {
  band = "challenging";
  verdict = "**Challenging** — aligned with “shouldn’t win a whole lot”; human skill should still matter.";
} else {
  band = "in-band";
  verdict = "**In band** — skilled win rate sits in a reasonable challenge window for cooperative escape.";
}

const lines = [
  `# Somnia ${report.version || "?"} balance simulation — design report`,
  "",
  `**Engine:** ${report.engineNote || "Somnia winrate sim"}`,
  `**Ruleset:** Somnia ${report.version || "?"} · **Generated:** ${report.generatedAt}`,
  `**Sample:** ${report.totalGames} games in ${((report.elapsedMs || 0) / 1000).toFixed(1)}s`,
  `**Design:** ${report.combinationCount || 63} Dreamer combinations × ${report.comboRuns || 100} skilled games (lengths cycled Daydream / Nap / Deep Sleep).`,
  `**Crashes:** ${report.crashCount ?? 0}${report.crashKinds && Object.keys(report.crashKinds).length ? ` (${JSON.stringify(report.crashKinds)})` : ""}`,
  `**Difficulty band:** ${band}`,
  "",
  "## Executive summary",
  "",
  verdict,
  "",
  `Overall win rate **${o.winPct}%** (skilled **${sk.winPct}%**, sloppy **${sl.winPct}%**). Target intuition for skilled co-op: **8–18%** wins — earned, not routine.`,
  "",
  "Prior baselines: **2026-09-15** (pre–22.x, ~2000 games, 2–3p mix) skilled **~19.7%**, sloppy **0%**. **22.1 flawed 2000-game mix** skilled **~5%**, sloppy **0%**, ~91% Final Recurrence deck losses, ~0.2 archetypes acquired.",
  "",
  "## Aggregate results",
  "",
  block("All games", o),
  block("Skilled bots only (full combo matrix)", sk),
  block("Sloppy bots (small sample)", sl),
  "",
  "## By player count (skilled)",
  "",
];

const counts = report.byPlayerCount || {};
for (const n of ["1", "2", "3", "4", "5", "6"]) {
  if (counts[n]) lines.push(block(`${n} Dreamer${n === "1" ? "" : "s"}`, counts[n]));
}

lines.push("## By difficulty (length, all skilled+sloppy)\n");
for (const [key, label] of [
  ["daydream", "Daydream (8 pts)"],
  ["nap", "Nap (12 pts)"],
  ["deep", "Deep Sleep (24 pts — full deck)"],
]) {
  const s = report.byLength?.[key];
  if (s) lines.push(block(label, s));
}

lines.push("## Combo extremes (skilled)\n");
if (report.comboBest?.length) {
  lines.push("**Highest win rates**\n");
  for (const c of report.comboBest) {
    lines.push(`- \`${c.comboKey}\` (${c.playerCount}p): ${c.winPct}% (${c.wins}/${c.n}), avg ${c.avgPoints} pts, ${c.avgArchetypes} archetypes`);
  }
  lines.push("");
}
if (report.comboWorst?.length) {
  lines.push("**Lowest win rates**\n");
  for (const c of report.comboWorst) {
    lines.push(`- \`${c.comboKey}\` (${c.playerCount}p): ${c.winPct}% (${c.wins}/${c.n}), avg ${c.avgPoints} pts, ${c.avgArchetypes} archetypes`);
  }
  lines.push("");
}

lines.push(
  "## Design interpretation",
  "",
  "### Archetype progression",
  `Skilled tables average **${sk.avgArchetypes}** archetypes vs **${sk.avgPoints}** points (goals 8 / 12 / 24). Low acquisition usually means quest friction (Meet a Dreambeast on named Landscapes, boss gates, token starvation) or the Dream deck ending the run before the economy compounds.`,
  "",
  "### Final Recurrence",
  `${sk.n ? ((sk.finalRecurrenceGames / sk.n) * 100).toFixed(1) : "0"}% of skilled games enter Final Recurrence. Remaining Archetypes need **15 Psyche** with an opposing suit. Losses labeled **final-recurrence-deck** mean the table reached the nightmare and ran out of Dreams.`,
  "",
  "### Player-count effects",
  "Solo and duo tables have fewer Willpower openers, thinner Meet budgets, and a harsher Meet beast tax (each roaming Dreambeast Represses every Dreamer). Six-player tables have more hands to pool 15 Psyche in the endgame but also more deaths and more Forgets.",
  "",
  "### Bot skill gap",
  `Sloppy **${sl.winPct}%** vs skilled **${sk.winPct}%**. A large gap means play skill matters. If both sit near 0% and archetypes acquired stay near 0, improve bots before concluding the game is “fair-hard.”`,
  "",
  "### Recommended levers",
  "",
  "| Symptom | Direction |",
  "|---------|-----------|",
  "| Skilled wins > 20% | Raise final Psyche, Meet beast tax, or trim boons |",
  "| Skilled wins < 5% and avg archetypes < 1 | Bots/quests first; then consider token income or wasted-event tax |",
  "| Solo/duo much worse than 4–6p | Meet tax and 15-Psyche final scale poorly with table size |",
  "| final-recurrence-deck dominates | Endgame is the intended wall; soften only if humans never clear |",
  "",
  "---",
  "*Generated from `scripts/somnia-winrate-report.json`. Re-run: `node scripts/somnia-winrate-sim.mjs` then this script.*",
  "",
);

writeFileSync(outPath, lines.join("\n"));
console.log(`Wrote ${outPath}`);
console.log(`Band: ${band}; skilled ${sk.winPct}% (${sk.wins}/${sk.n})`);
