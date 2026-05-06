/**
 * Shared run identity strip: class, weapon, sealed pacts — climb + combat.
 */
import { drawText, drawPanel, COLORS } from "./render.js";
import { PACTS } from "../content/pacts.js";

const PACT_NAME = Object.fromEntries(PACTS.map((p) => [p.id, p.name]));

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} p — player
 * @param {number} y0 — top Y of the strip
 * @returns {number} bottom Y (next content should start here + gap)
 */
export function drawRunIdentityStrip(ctx, p, y0 = 6) {
  if (!p) return y0;
  const pad = 10;
  const panelW = 420;
  const buildName = p.build?.name || p.name || String(p.buildId || "").toUpperCase();
  const weaponName = p.surfaceLoadoutName || p.loadout?.name || String(p.loadoutId || "");
  const ranks = p.pactRanks || {};
  const sealed = (p.pacts || []).length
    ? [...new Set(p.pacts)].map((id) => {
        const r = ranks[id] || 1;
        const nm = PACT_NAME[id] || id.replace(/_/g, " ");
        return `${nm} · r${r}`;
      })
    : [];
  const pactStr = sealed.length
    ? (sealed.length <= 3 ? sealed.join("   |   ") : `${sealed.slice(0, 2).join("   |   ")}   +${sealed.length - 2} more`)
    : "None sealed yet";

  const h = 82;
  drawPanel(ctx, pad, y0, panelW, h);
  drawText(ctx, "HERO", pad + 10, y0 + 8, {
    size: 12, color: COLORS.bile, bold: true,
  });
  drawText(ctx, `CLASS   ${buildName}`, pad + 10, y0 + 26, {
    size: 15, color: COLORS.bone, bold: true, maxWidth: panelW - 20,
  });
  drawText(ctx, `WEAPON   ${weaponName}`, pad + 10, y0 + 46, {
    size: 14, color: "#ffd966", bold: true, maxWidth: panelW - 20,
  });
  drawText(ctx, `PACTS   ${pactStr}`, pad + 10, y0 + 66, {
    size: 13, color: COLORS.boneDim, bold: false, maxWidth: panelW - 20,
  });

  return y0 + h;
}
