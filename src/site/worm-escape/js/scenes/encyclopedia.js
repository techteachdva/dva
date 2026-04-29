/**
 * INNER GUTS CODEX — opened via cheat `lore` (alias: loredump).
 * ═══════════════════════════════════════════════════════════════════════════
 * Mirror gameplay edits in ../content/encyclopediaData.js so this stays truthful.
 */

import {
  W, H, COLORS,
  drawText, drawPanel, drawBanner, wrapText, roundRect,
} from "../engine/render.js";
import { pointInRect } from "../engine/pointer.js";
import { SFX } from "../engine/audio.js";
import { buildCodexEntries } from "../content/encyclopediaData.js";

const CODEX_SOURCE = buildCodexEntries();

const CATEGORY_ORDER = [
  { key: "all", label: "★ ALL", predicate: () => true },
  { key: "class", label: "CLASSES", predicate: (e) => e.category === "class" },
  { key: "weapon", label: "WEAPONS", predicate: (e) => e.category === "weapon" },
  { key: "enemy", label: "ENEMIES", predicate: (e) => e.category === "enemy" },
  { key: "synergy", label: "SYNERGY", predicate: (e) => e.category === "synergy" },
  { key: "mechanic", label: "RULES+", predicate: (e) => e.category === "mechanic" },
];

function flattenBlob(e) {
  return `${e.title} ${e.subtitle} ${e.facts.join(" ")} ${e.flavor}`.toLowerCase();
}

/** @typedef {typeof CODEX_SOURCE[number]} CodexRow */

export class EncyclopediaScene {
  constructor() {
    this.catKey = "all";
    this.selIndex = 0;
    this.listScrollRow = 0;
    /** first visible wrapped line inside detail pane */
    this.detailScrollLine = 0;
    /** @type {string} */
    this.filterStr = "";

    /** @type {CodexRow[]} */
    this._filtered = CODEX_SOURCE.slice();

    /** @type {Array<{ key: string, x: number, y: number, w: number, h: number }>} */
    this.tabRects = [];
    /** @type {Array<{ index: number, x: number, y: number, w: number, h: number }>} */
    this.listRowRects = [];
  }

  rebuildFilter() {
    const catDef = CATEGORY_ORDER.find((c) => c.key === this.catKey) || CATEGORY_ORDER[0];
    const q = this.filterStr.trim().toLowerCase();

    /** @type {CodexRow[]} */
    let next = CODEX_SOURCE.filter((e) => catDef.predicate(e));
    if (q) next = next.filter((e) => flattenBlob(e).includes(q));
    next.sort((a, b) => {
      const order = CATEGORY_ORDER.map((x) => x.key);
      const ia = order.indexOf(a.category);
      const ib = order.indexOf(b.category);
      return ia !== ib ? ia - ib : a.title.localeCompare(b.title);
    });

    this._filtered = next;
    this.selIndex = Math.max(
      0,
      Math.min(this.selIndex, Math.max(0, this._filtered.length - 1)),
    );
    this.listScrollRow = 0;
    this.detailScrollLine = 0;
  }

  enter() {
    this.rebuildFilter();
  }

  exit() {}

  clampListScroll(visibleRows) {
    const total = this._filtered.length;
    const maxScr = Math.max(0, total - visibleRows);
    this.listScrollRow = Math.max(0, Math.min(this.listScrollRow, maxScr));
    if (this.selIndex < this.listScrollRow) this.listScrollRow = this.selIndex;
    if (this.selIndex >= this.listScrollRow + visibleRows) {
      this.listScrollRow = Math.max(0, this.selIndex - visibleRows + 1);
    }
  }

  wrappedDetailLines(ctx, entry, innerW) {
    const size = 13;
    /** @type {string[]} */
    const lines = [];
    wrapText(ctx, entry.title.toUpperCase(), innerW, 18, { bold: true }).forEach((l) =>
      lines.push(l),
    );
    lines.push("");
    wrapText(ctx, entry.subtitle, innerW - 8, size - 1, { italic: true }).forEach((l) =>
      lines.push(l),
    );
    lines.push("");
    entry.facts.forEach((fact) => {
      if (!String(fact).trim()) {
        lines.push("");
        return;
      }
      wrapText(ctx, String(fact), innerW - 12, size, {}).forEach((l) => lines.push(l));
    });
    lines.push("");
    lines.push("━━━━━━━━ FLAVOR VORTEX ━━━━━━━━");
    wrapText(ctx, entry.flavor, innerW - 12, size - 1, { italic: true }).forEach((l) =>
      lines.push(l),
    );
    return lines;
  }

  update(_dt, game) {
    const inp = game.input;

    if (inp.wasPressed("Escape")) {
      game.scenes.pop(game);
      SFX.click();
      return;
    }

    /** filter typing */
    const chars =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789`'-/:;,!?.*@#%+><_=\\";
    let dirty = false;
    for (const ch of chars) {
      if (inp.wasPressed(ch)) {
        this.filterStr += ch;
        dirty = true;
      }
    }
    if (inp.wasPressed(" ") || inp.wasPressed("Space")) {
      this.filterStr += " ";
      dirty = true;
    }
    if (inp.wasPressed("Backspace", "Delete")) {
      if (this.filterStr.length) {
        this.filterStr = this.filterStr.slice(0, -1);
        dirty = true;
      }
    }
    if (dirty) {
      this.rebuildFilter();
      SFX.click();
    }

    if (inp.wasPressed("Tab")) {
      const i = CATEGORY_ORDER.findIndex((c) => c.key === this.catKey);
      this.catKey = CATEGORY_ORDER[(i + 1) % CATEGORY_ORDER.length].key;
      this.rebuildFilter();
      SFX.click();
    }

    for (let n = 0; n <= 6; n++) {
      const tab = CATEGORY_ORDER[n];
      if (!tab) break;
      if (inp.wasPressed(String(n)) && this.catKey !== tab.key) {
        this.catKey = tab.key;
        this.rebuildFilter();
        SFX.click();
      }
    }

    /** layout matches render constants */
    const rowH = 22;
    const rowGap = 6;
    const listTopGuess = Math.floor(H * 0.30);
    const listBotGuess = H - 38;
    const visibleRows = Math.max(
      4,
      Math.floor(((listBotGuess - listTopGuess) - 40) / (rowH + rowGap)),
    );

    const filt = this._filtered;
    const moveSel = (d) => {
      if (!filt.length) return;
      this.selIndex = Math.max(0, Math.min(filt.length - 1, this.selIndex + d));
      this.detailScrollLine = 0;
      SFX.click();
    };
    if (inp.wasPressed("ArrowUp")) moveSel(-1);
    if (inp.wasPressed("ArrowDown")) moveSel(+1);

    if (inp.wasPressed("Home") && filt.length) {
      this.selIndex = 0;
      this.detailScrollLine = 0;
      SFX.click();
    }
    if (inp.wasPressed("End") && filt.length) {
      this.selIndex = filt.length - 1;
      this.detailScrollLine = 0;
      SFX.click();
    }

    this.clampListScroll(visibleRows);

    /** detail scroll PageUp/PageDown codes (works even if unparsed as text) */
    if (inp.wasCodePressed("PageUp")) this.detailScrollLine -= 6;
    if (inp.wasCodePressed("PageDown")) this.detailScrollLine += 6;

    if (inp.wasPressed("[") || inp.wasCodePressed("BracketLeft")) {
      this.listScrollRow = Math.max(0, this.listScrollRow - 1);
    }
    if (inp.wasPressed("]") || inp.wasCodePressed("BracketRight")) {
      this.listScrollRow++;
    }

    this.clampListScroll(visibleRows);

    if (inp.wasPressed("Mouse0")) {
      const mx = inp.mouseX, my = inp.mouseY;
      for (const tr of this.tabRects) {
        if (pointInRect(mx, my, tr.x, tr.y, tr.w, tr.h)) {
          if (this.catKey !== tr.key) {
            this.catKey = tr.key;
            this.rebuildFilter();
            SFX.click();
          }
          break;
        }
      }
      for (const rr of this.listRowRects) {
        if (pointInRect(mx, my, rr.x, rr.y, rr.w, rr.h)) {
          if (this.selIndex !== rr.index) {
            this.selIndex = rr.index;
            this.detailScrollLine = 0;
            SFX.click();
          }
          break;
        }
      }
    }
  }

  render(ctx, game) {
    this.tabRects.length = 0;
    this.listRowRects.length = 0;

    const filt = this._filtered;

    ctx.save();
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0d0618");
    bg.addColorStop(1, "#020205");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    drawBanner(ctx, "THE INNER GUTS CODEX", W / 2, 54, 30, COLORS.bile, COLORS.blood);
    drawText(ctx, '\\ cheat summoned this nerd shelf · ESC exit · TAB or 0–6 tabs · FILTER types words · PgUp/PgDn detail · [ ] list chunk', W / 2, 94, {
      size: 12,
      color: COLORS.boneDim,
      align: "center",
      maxWidth: W - 20,
    });

    /** category buttons */
    let tx = 20;
    const ty = 118;
    const th = 36;
    for (let ti = 0; ti < CATEGORY_ORDER.length; ti++) {
      const tab = CATEGORY_ORDER[ti];
      const tw = ctx.measureText(`(${ti})`).width + ctx.measureText(tab.label).width + 54;
      const sel = tab.key === this.catKey;

      roundRect(ctx, tx, ty, tw, th, 8);
      ctx.fillStyle = sel ? "rgba(60,162,226,0.33)" : "rgba(32,26,62,0.55)";
      ctx.fill();
      ctx.strokeStyle = sel ? COLORS.bileGlow : "rgba(255,255,255,0.2)";
      ctx.lineWidth = sel ? 2.2 : 1;
      ctx.stroke();

      drawText(ctx, `${tab.label} (${ti})`, tx + tw / 2, ty + th / 2, {
        size: 13 + (sel ? 1 : 0),
        bold: sel,
        align: "center",
        baseline: "middle",
        color: sel ? "#fffefb" : COLORS.bone,
      });

      this.tabRects.push({ key: tab.key, x: tx, y: ty, w: tw, h: th });
      tx += tw + 8;
    }

    const filterTop = ty + th + 8;
    drawPanel(ctx, 16, filterTop, W - 32, 42);
    drawText(ctx, "> " + this.filterStr + "_", 28, filterTop + 14, {
      size: 16,
      color: "#bfffe6",
      maxWidth: W - 200,
      bold: true,
      glow: "#052018",
    });
    drawText(ctx, filt.length + " hits", W - 38, filterTop + 14, {
      size: 14,
      align: "right",
      color: COLORS.boneDim,
    });

    const listLeft = 18;
    const listW = 344;
    const listTop = filterTop + 56;
    const listBot = H - 42;
    const listInner = listBot - listTop;

    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    roundRect(ctx, 12, listTop - 6, listW + 42, listInner + 24, 12);
    ctx.fill();

    const rowH = 22;
    const rowGap = 6;

    /** visible listing rows calculation */
    const visibleRows = Math.max(
      4,
      Math.floor((listInner - 38) / (rowH + rowGap)),
    );
    this.clampListScroll(visibleRows);

    let ry = listTop + 18;
    for (
      let idx = this.listScrollRow;
      idx < filt.length && idx < this.listScrollRow + visibleRows;
      idx++
    ) {
      const row = filt[idx];
      const hi = idx === this.selIndex;

      ctx.fillStyle = hi ? "rgba(85,154,246,0.22)" : "rgba(255,255,255,0.04)";
      roundRect(ctx, listLeft + 8, ry - 4, listW - 34, rowH + 10, 5);
      ctx.fill();

      ctx.font = `${hi ? "bold " : ""}13px Courier New, monospace`;

      ctx.fillStyle = CATEGORY_COLOR(row.category);
      ctx.fillText("[" + row.category.slice(0, 3).toUpperCase() + "]", listLeft + 16, ry + rowH / 2 + 5);

      ctx.fillStyle = hi ? "#fffff8" : COLORS.bone;
      ctx.fillText(clampUi(row.title, 37), listLeft + 98, ry + rowH / 2 + 5);

      this.listRowRects.push({
        index: idx,
        x: listLeft,
        y: ry - 10,
        w: listW - 26,
        h: rowH + rowGap + 10,
      });
      ry += rowH + rowGap;
    }

    const detailX = listLeft + listW + 48;
    const detailW = W - detailX - 34;

    roundRect(ctx, detailX - 16, listTop - 6, detailW + 32, listInner + 24, 16);
    ctx.strokeStyle = "rgba(253,229,173,0.25)";
    ctx.lineWidth = 2;
    ctx.stroke();

    const pick = filt[this.selIndex] || null;

    ctx.save();
    ctx.beginPath();
    ctx.rect(detailX + 4, listTop + 18, detailW - 8, listInner - 32);
    ctx.clip();

    const lineStride = 16;

    if (!pick) {
      drawText(ctx, "(zero matches… delete some keystrokes nerd)", detailX + 16, listTop + 80, {
        size: 16,
        italic: true,
        color: COLORS.boneDim,
      });
      ctx.restore();
      ctx.restore();
      return;
    }

    const wrapped = this.wrappedDetailLines(ctx, pick, detailW - 18);

    /** scroll clamp AFTER wrap count known */
    const maxVisibleLines = Math.max(
      3,
      Math.floor((listInner - 54) / lineStride),
    );
    const maxScr = Math.max(0, wrapped.length - maxVisibleLines);
    this.detailScrollLine = Math.max(
      0,
      Math.min(this.detailScrollLine, maxScr),
    );

    let gy = listTop + 22;
    for (
      let i = this.detailScrollLine;
      i < wrapped.length && gy < listBot - lineStride;
      i++
    ) {
      const ln = wrapped[i];
      const div = /\b━━━━━━━━/.test(ln);
      const flav = /\bFLAVOR\b/.test(ln) || div;

      const col = flav ? COLORS.wormHi : /\bMATCHUP|SYNERGY|MATCH|PACT|CHEAT|dmg/i.test(ln)
        ? "#def8d0"
        : COLORS.bone;

      drawText(ctx, ln, detailX + 16, gy, {
        size: div ? 12 : lineStride - 3,
        color: col,
        maxWidth: detailW - 28,
        bold: div,
      });
      gy += lineStride;
    }

    drawText(
      ctx,
      `detail lines ${this.detailScrollLine + 1}-${Math.min(
        wrapped.length,
        this.detailScrollLine + maxVisibleLines,
      )} / ${wrapped.length}`,
      detailX + 16,
      listBot - 18,
      { size: 12, color: COLORS.boneDim },
    );

    ctx.restore();
    ctx.restore();
  }
}

function CATEGORY_COLOR(cat) {
  switch (cat) {
    case "class": return "#7fd7ff";
    case "weapon": return "#ffd966";
    case "enemy": return "#ff7a74";
    case "synergy": return "#e49cff";
    case "mechanic": return "#8effc2";
    default: return COLORS.boneDim;
  }
}


function clampUi(s, mx) {
  if (!s) return "";
  if (s.length <= mx) return s;
  return s.slice(0, mx - 1).trimEnd() + "…";
}


