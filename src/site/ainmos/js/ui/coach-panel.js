/**
 * The Guided First Ante hint card: a small floating note, never a lock.
 */

import { currentCoachHint, dismissCoachHint, hideCoach, isGuided } from "../tutorial/coach.js";

let lastId = "";

export function renderCoach(state, { onChange } = {}) {
  const host = document.getElementById("coach-hint");
  if (!host) return;
  const hint = isGuided(state) ? currentCoachHint(state) : null;
  if (!hint) {
    host.hidden = true;
    host.innerHTML = "";
    lastId = "";
    return;
  }
  host.hidden = false;
  if (hint.id === lastId) return;
  lastId = hint.id;
  host.innerHTML = `
    <div class="coach-card" role="status" aria-live="polite">
      <span class="coach-spark" aria-hidden="true">✧</span>
      <div class="coach-body">
        <p class="coach-title">${hint.title}</p>
        <p class="coach-text">${hint.text}</p>
      </div>
      <div class="coach-actions">
        <button type="button" class="coach-btn" data-coach-ok>Got it</button>
        <button type="button" class="coach-btn coach-btn-quiet" data-coach-hide>Hide hints</button>
      </div>
    </div>`;
  host.querySelector("[data-coach-ok]")?.addEventListener("click", () => {
    dismissCoachHint(state, hint.id);
    lastId = "";
    onChange?.();
  });
  host.querySelector("[data-coach-hide]")?.addEventListener("click", () => {
    hideCoach(state);
    lastId = "";
    onChange?.();
  });
}
