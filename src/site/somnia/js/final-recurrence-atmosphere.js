/** Final Recurrence veil + nightmare backdrop tied to Dreams remaining. */

export function snapshotFinalRecurrenceDreams(state) {
  if (!state?.finalRecurrence) return;
  if (state.finalRecurrenceDreamsAtStart == null) {
    state.finalRecurrenceDreamsAtStart = Math.max(1, state.dreamDeck?.length || 1);
  }
}

export function updateFinalRecurrenceAtmosphere(state) {
  const body = document.body;
  const backdrop = document.getElementById("final-nightmare-backdrop");
  const veil = document.getElementById("final-recurrence-veil");
  if (!body || !backdrop || !veil) return;

  if (!state?.finalRecurrence) {
    body.classList.remove("final-recurrence-active");
    backdrop.style.opacity = "0";
    veil.style.opacity = "0";
    return;
  }

  snapshotFinalRecurrenceDreams(state);
  const start = state.finalRecurrenceDreamsAtStart || 1;
  const left = Math.max(0, state.dreamDeck?.length || 0);
  const drained = 1 - Math.min(1, left / start);

  body.classList.add("final-recurrence-active");
  backdrop.style.opacity = String(0.12 + drained * 0.88);
  const veilStrength = 0.78 * (left / start) + 0.08;
  veil.style.opacity = String(Math.min(0.88, Math.max(0.06, veilStrength)));
}
