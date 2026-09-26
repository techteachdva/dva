/**
 * Phone / tablet play chrome: overflow menu, deck rail, sidebar drawer.
 */

import { getCapabilityProfile } from "./device-mode.js";

const OVERFLOW_SEL = "[data-chrome-overflow]";

function isCompactForm(form = getCapabilityProfile().form) {
  return form === "phone" || form === "tablet";
}

function shouldOverflow(el, form) {
  const when = el.dataset.chromeOverflow || "";
  if (when === "compact") return isCompactForm(form);
  return when.split(",").includes(form);
}

function applyOverflow(form) {
  const home = document.getElementById("header-actions");
  const more = document.getElementById("header-more-menu");
  const panel = document.getElementById("header-more-panel");
  if (!home || !more || !panel) return;

  document.querySelectorAll(OVERFLOW_SEL).forEach((el) => {
    if (shouldOverflow(el, form)) panel.appendChild(el);
    else home.insertBefore(el, more);
  });

  const hasItems = panel.childElementCount > 0;
  more.hidden = !hasItems;
  if (!hasItems) closeMoreMenu();
}

function clearMorePanelPlacement(panel) {
  if (!panel) return;
  panel.classList.remove("header-more-panel-fixed");
  panel.style.top = "";
  panel.style.right = "";
  panel.style.left = "";
  panel.style.maxHeight = "";
}

function placeMorePanel(btn, panel) {
  const form = document.documentElement.dataset.form;
  if (form !== "phone" && form !== "tablet") return;
  const rect = btn.getBoundingClientRect();
  const margin = 8;
  panel.classList.add("header-more-panel-fixed");
  panel.style.top = `${Math.round(rect.bottom + 6)}px`;
  panel.style.right = `${Math.max(margin, Math.round(window.innerWidth - rect.right))}px`;
  panel.style.left = "auto";
  panel.style.maxHeight = `${Math.max(160, Math.round(window.innerHeight - rect.bottom - 16))}px`;
}

function closeMoreMenu() {
  const btn = document.getElementById("btn-header-more");
  const panel = document.getElementById("header-more-panel");
  panel?.classList.add("hidden");
  clearMorePanelPlacement(panel);
  btn?.setAttribute("aria-expanded", "false");
}

function bindMoreMenu() {
  const btn = document.getElementById("btn-header-more");
  const panel = document.getElementById("header-more-panel");
  if (!btn || !panel || btn.dataset.chromeBound) return;
  btn.dataset.chromeBound = "1";

  btn.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = panel.classList.contains("hidden");
    closeMoreMenu();
    if (willOpen) {
      placeMorePanel(btn, panel);
      panel.classList.remove("hidden");
      btn.setAttribute("aria-expanded", "true");
    }
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest("#header-more-menu")) return;
    closeMoreMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMoreMenu();
  });
}

export function setDeckExpanded(open) {
  document.body.classList.toggle("deck-expanded", Boolean(open));
  const btn = document.getElementById("btn-deck-drawer");
  btn?.setAttribute("aria-expanded", open ? "true" : "false");
}

export function setSidebarDrawerOpen(open) {
  document.body.classList.toggle("sidebar-drawer-open", Boolean(open));
  document.body.classList.toggle("sidebar-collapsed", !open && getCapabilityProfile().form === "tablet" && getCapabilityProfile().orientation === "landscape");
  const btn = document.getElementById("btn-sidebar-drawer");
  btn?.setAttribute("aria-expanded", open ? "true" : "false");
  document.getElementById("sidebar-drawer-backdrop")?.classList.toggle("hidden", !open || !isDrawerForm());
}

function isDrawerForm() {
  const { form, orientation } = getCapabilityProfile();
  return form === "phone" || (form === "tablet" && orientation === "portrait");
}

function defaultSidebarOpen() {
  const { form, orientation } = getCapabilityProfile();
  return form === "tablet" && orientation === "landscape";
}

function applyDrawerDefaults(form) {
  const compact = isCompactForm(form);
  document.body.classList.toggle("compact-chrome", compact);
  if (!compact) {
    document.body.classList.remove("deck-expanded", "sidebar-drawer-open", "sidebar-collapsed");
    document.getElementById("sidebar-drawer-backdrop")?.classList.add("hidden");
    document.getElementById("btn-deck-drawer")?.setAttribute("aria-expanded", "false");
    document.getElementById("btn-sidebar-drawer")?.setAttribute("aria-expanded", "false");
    return;
  }
  if (!document.body.classList.contains("deck-user-set")) {
    setDeckExpanded(false);
  }
  if (!document.body.classList.contains("sidebar-user-set")) {
    setSidebarDrawerOpen(defaultSidebarOpen());
  } else {
    setSidebarDrawerOpen(document.body.classList.contains("sidebar-drawer-open"));
  }
}

function bindEdgeToggles() {
  const deckBtn = document.getElementById("btn-deck-drawer");
  if (deckBtn && !deckBtn.dataset.chromeBound) {
    deckBtn.dataset.chromeBound = "1";
    deckBtn.addEventListener("click", () => {
      if (!isCompactForm()) return;
      document.body.classList.add("deck-user-set");
      setDeckExpanded(!document.body.classList.contains("deck-expanded"));
    });
  }

  const sideBtn = document.getElementById("btn-sidebar-drawer");
  if (sideBtn && !sideBtn.dataset.chromeBound) {
    sideBtn.dataset.chromeBound = "1";
    sideBtn.addEventListener("click", () => {
      if (!isCompactForm()) return;
      document.body.classList.add("sidebar-user-set");
      const open = !document.body.classList.contains("sidebar-drawer-open");
      setSidebarDrawerOpen(open);
    });
  }

  const backdrop = document.getElementById("sidebar-drawer-backdrop");
  if (backdrop && !backdrop.dataset.chromeBound) {
    backdrop.dataset.chromeBound = "1";
    backdrop.addEventListener("click", () => {
      document.body.classList.add("sidebar-user-set");
      setSidebarDrawerOpen(false);
    });
  }
}

function syncChrome() {
  const { form } = getCapabilityProfile();
  applyOverflow(form);
  applyDrawerDefaults(form);
}

export function initCompactChrome() {
  bindMoreMenu();
  bindEdgeToggles();
  syncChrome();
  window.addEventListener("somnia:capabilities", syncChrome);
}

export function revealCompactTarget(selector) {
  if (!isCompactForm()) return;
  if (selector.includes("sidebar") || selector.includes("active-archetype") || selector.includes("active-encounter")) {
    document.body.classList.add("sidebar-user-set");
    setSidebarDrawerOpen(true);
  }
  if (selector.includes("deck-column") || selector.includes("deck-rail")) {
    document.body.classList.add("deck-user-set");
    setDeckExpanded(true);
  }
}
