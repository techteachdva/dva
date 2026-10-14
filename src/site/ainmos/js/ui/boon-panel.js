/**
 * Boss Boon draft window: after a ladder Boss falls, choose 1 of 3 Boons.
 */

let lastKey = "";

function esc(text) {
  return String(text ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[ch]);
}

function kindLabel(boon) {
  if (boon.kind === "archetype") return boon.archetype?.passive ? "Passive" : "Power · 1⚡";
  if (boon.kind === "power") return "Power · 1⚡";
  return "Rule";
}

export function renderBoonDraft(state, { onChoose } = {}) {
  const host = document.getElementById("boon-draft");
  if (!host) return;
  const draft = state?.pendingBoonDraft;
  if (!draft) {
    host.hidden = true;
    host.innerHTML = "";
    lastKey = "";
    return;
  }
  host.hidden = false;
  const key = draft.options.map((b) => b.id).join("|");
  if (key === lastKey) return;
  lastKey = key;
  host.innerHTML = `
    <div class="lf-veil" aria-hidden="true"></div>
    <section class="lf-window boon-window" role="dialog" aria-modal="true" aria-labelledby="boon-title">
      <header class="lf-titlebar">
        <span class="vault-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <h3 id="boon-title" class="lf-title">A Boon</h3>
        <span class="lf-round">${esc(draft.bossName)} is defeated</span>
      </header>
      <p class="lf-whisper">Something it guarded is yours now. Choose one, for the rest of the night.</p>
      <div class="lf-shelf boon-shelf">
        ${draft.options.map((boon) => `
          <article class="lf-item boon-card kind-${esc(boon.kind)}">
            ${boon.image
              ? `<div class="lf-item-art boon-art" style="background-image:url('${esc(boon.image)}')"></div>`
              : `<div class="lf-insight-sigil" aria-hidden="true">${esc(boon.glyph || "✦")}</div>`}
            <h4 class="lf-item-name">${esc(boon.name)}</h4>
            <p class="lf-item-kind">${kindLabel(boon)}</p>
            <p class="lf-item-text">${esc(boon.text)}</p>
            <div class="lf-item-foot">
              <button type="button" class="lf-btn lf-continue" data-boon="${esc(boon.id)}">Take this Boon</button>
            </div>
          </article>`).join("")}
      </div>
    </section>`;
  host.querySelectorAll("[data-boon]").forEach((el) => el.addEventListener("click", () => onChoose?.(el.dataset.boon)));
}
