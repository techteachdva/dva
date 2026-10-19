/**
 * Use a set: all twelve Archetypes as small pills in one grid (no scrolling).
 * Hover or focus a pill to read its power; tap one to pick it, then Acquire.
 * Archetypes already yours or already on the Dreamscape show but can't be picked.
 */

let lastKey = "";
let picked = null;

function esc(text) {
  return String(text ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[ch]);
}

const SUIT_NAME = { lucidity: "Lucidity", elasticity: "Elasticity", willpower: "Willpower" };

function powerLine(choice) {
  if (!choice.power) return "";
  return /^\+\d/.test(choice.power) ? `Passive: ${choice.power}` : `1⚡: ${choice.power}`;
}

export function hideSetArchetypeScreen() {
  const host = document.getElementById("set-archetype");
  if (!host || host.hidden) return;
  host.hidden = true;
  host.innerHTML = "";
  lastKey = "";
  picked = null;
  document.body.classList.remove("set-archetype-open");
}

export function renderSetArchetypeScreen(pending, { pieces = [], onPick, onCancel } = {}) {
  const host = document.getElementById("set-archetype");
  if (!host) return;
  const choices = pending?.choices || [];
  const key = `${pending?.title}:${choices.map((c) => `${c.id}${c.disabled ? "x" : ""}`).join(",")}:${picked || ""}`;
  host.hidden = false;
  document.body.classList.add("set-archetype-open");
  if (key === lastKey) return;
  lastKey = key;
  const chosen = choices.find((c) => c.id === picked && !c.disabled) || null;

  host.innerHTML = `
    <div class="lf-veil" aria-hidden="true"></div>
    <section class="lf-window sa-window" role="dialog" aria-modal="true" aria-labelledby="sa-title">
      <header class="lf-titlebar">
        <span class="vault-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <h3 id="sa-title" class="lf-title">${esc(pending.title)}</h3>
      </header>
      <div class="sa-pieces" aria-label="Set pieces">
        ${pieces.map((card, i) => `<span class="sa-piece suit-${esc(card.suit)}" style="--i:${i};background-image:url('${esc(card.image)}')" title="${esc(card.name)}"></span>`).join("")}
      </div>
      <p class="lf-whisper">${esc(pending.message)} The set leaves play for good.</p>
      <div class="sa-grid" role="listbox" aria-label="Archetypes">
        ${choices.map((c) => `
          <button type="button" role="option" class="sa-pill suit-${esc(c.suit)}${c.disabled ? " is-taken" : ""}${c.id === picked ? " is-picked" : ""}"
            data-sa="${esc(c.id)}" aria-selected="${c.id === picked}" ${c.disabled ? `aria-disabled="true"` : ""}
            aria-describedby="sa-tip-${esc(c.id)}">
            <span class="sa-face" style="background-image:url('${esc(c.image)}')"></span>
            <span class="sa-name">${esc(c.label)}</span>
            <span class="sa-tip" role="tooltip" id="sa-tip-${esc(c.id)}">
              <b>${esc(c.label)}</b>
              <small>${esc(SUIT_NAME[c.suit] || "")}${c.disabled ? " · Not in the deck" : ""}</small>
              ${esc(powerLine(c))}
            </span>
          </button>`).join("")}
      </div>
      <div class="sa-detail${chosen ? " has-pick" : ""}" aria-live="polite">
        ${chosen
          ? `<span class="sa-detail-face" style="background-image:url('${esc(chosen.image)}')"></span>
             <span class="sa-detail-text"><b>${esc(chosen.label)}</b>${esc(powerLine(chosen))}</span>`
          : `<span class="sa-detail-text sa-hint">Pick an Archetype.</span>`}
      </div>
      <div class="lf-item-foot sa-foot">
        <button type="button" class="lf-btn sa-cancel" data-sa-cancel>Not now</button>
        <button type="button" class="lf-btn lf-continue sa-go" data-sa-go ${chosen ? "" : "disabled"}>${chosen ? `Acquire ${esc(chosen.label)}` : "Acquire"}</button>
      </div>
    </section>`;

  host.querySelectorAll("[data-sa]").forEach((el) => {
    el.addEventListener("click", () => {
      if (el.getAttribute("aria-disabled") === "true") return;
      picked = picked === el.dataset.sa ? null : el.dataset.sa;
      renderSetArchetypeScreen(pending, { pieces, onPick, onCancel });
      host.querySelector(`[data-sa="${CSS.escape(el.dataset.sa)}"]`)?.focus();
    });
    el.addEventListener("dblclick", () => {
      if (el.getAttribute("aria-disabled") === "true") return;
      const id = el.dataset.sa;
      hideSetArchetypeScreen();
      onPick?.(id);
    });
  });
  host.querySelector("[data-sa-go]")?.addEventListener("click", () => {
    if (!chosen) return;
    const id = chosen.id;
    hideSetArchetypeScreen();
    onPick?.(id);
  });
  host.querySelector("[data-sa-cancel]")?.addEventListener("click", () => {
    hideSetArchetypeScreen();
    onCancel?.();
  });
}
