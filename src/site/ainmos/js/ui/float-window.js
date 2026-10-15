/**
 * Floating table windows (Dreamscape Vault, Archetypes): drag by the title bar,
 * minimize to the title bar, and stay where you left them. Positions are kept
 * per viewer in localStorage; if storage is unavailable they simply reset.
 *
 * Works by delegation on the host, so windows that re-render their insides keep
 * their position and handlers.
 */

const STORE = "ainmos.floatWindows.v1";

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORE) || "{}") || {};
  } catch {
    return {};
  }
}

function save(all) {
  try {
    localStorage.setItem(STORE, JSON.stringify(all));
  } catch {
    /* per-viewer convenience only */
  }
}

function clamp(host) {
  const parent = host.offsetParent || host.parentElement;
  if (!parent) return;
  const pw = parent.clientWidth;
  const ph = parent.clientHeight;
  const w = host.offsetWidth;
  const h = host.offsetHeight;
  const left = Math.min(Math.max(0, host.offsetLeft), Math.max(0, pw - Math.min(w, pw)));
  const top = Math.min(Math.max(0, host.offsetTop), Math.max(0, ph - Math.min(h, 40)));
  host.style.left = `${left}px`;
  host.style.top = `${top}px`;
}

/** Re-apply a window's saved place and minimized state (call after it renders). */
export function restoreFloatWindow(host, key) {
  if (!host) return;
  const saved = load()[key];
  if (saved?.moved) {
    host.style.left = `${saved.left}px`;
    host.style.top = `${saved.top}px`;
    host.style.right = "auto";
    host.style.bottom = "auto";
    host.classList.add("is-moved");
    requestAnimationFrame(() => clamp(host));
  }
  host.classList.toggle("is-minimized", !!saved?.minimized);
  const btn = host.querySelector("[data-float-min]");
  if (btn) {
    btn.setAttribute("aria-expanded", saved?.minimized ? "false" : "true");
    btn.textContent = saved?.minimized ? "▢" : "–";
    btn.title = saved?.minimized ? "Open" : "Minimize";
  }
}

/** Make a host draggable by its [data-float-handle] and minimizable by [data-float-min]. */
export function initFloatWindow(host, key) {
  if (!host || host.dataset.floatInit === "1") return;
  host.dataset.floatInit = "1";
  let drag = null;

  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("[data-float-min], button:not([data-float-handle]), a, input")) return;
    const handle = event.target.closest("[data-float-handle]");
    if (!handle || !host.contains(handle)) return;
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: host.offsetLeft,
      top: host.offsetTop,
      moved: false,
    };
    handle.setPointerCapture?.(event.pointerId);
  });

  host.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    host.classList.add("is-moved", "is-dragging");
    host.style.right = "auto";
    host.style.bottom = "auto";
    host.style.left = `${drag.left + dx}px`;
    host.style.top = `${drag.top + dy}px`;
    clamp(host);
  });

  const end = (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    host.classList.remove("is-dragging");
    if (drag.moved) {
      const all = load();
      all[key] = { ...(all[key] || {}), moved: true, left: host.offsetLeft, top: host.offsetTop };
      save(all);
    }
    drag = null;
  };
  host.addEventListener("pointerup", end);
  host.addEventListener("pointercancel", end);

  host.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-float-min]");
    if (!btn || !host.contains(btn)) return;
    event.stopPropagation();
    const all = load();
    const minimized = !host.classList.contains("is-minimized");
    all[key] = { ...(all[key] || {}), minimized };
    save(all);
    restoreFloatWindow(host, key);
  });

  window.addEventListener("resize", () => {
    if (host.classList.contains("is-moved")) clamp(host);
  });
}
