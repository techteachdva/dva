/**
 * Somnia PWA: register the worker, offer Add to Home Screen, and
 * prompt Reload when a new cache is waiting.
 */

import { isStandaloneMode } from "./standalone.js";

const UPDATE_TOAST_ID = "pwa-update-toast";
const INSTALL_SHEET_ID = "pwa-install-sheet";

let deferredPrompt = null;
let reloading = false;

function isStandaloneDisplay() {
  return window.matchMedia("(display-mode: standalone)").matches
    || window.navigator.standalone === true;
}

function isAppleTouchDevice() {
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function pwaEnabled() {
  return "serviceWorker" in navigator
    && location.protocol !== "file:"
    && !isStandaloneMode();
}

function ensureUpdateToast() {
  let toast = document.getElementById(UPDATE_TOAST_ID);
  if (toast) return toast;
  toast = document.createElement("div");
  toast.id = UPDATE_TOAST_ID;
  toast.className = "pwa-toast hidden";
  toast.setAttribute("role", "status");
  toast.innerHTML = `
    <p>New dreamscape available.</p>
    <button type="button" class="btn btn-sm primary" data-pwa-reload>Reload</button>
  `;
  document.body.appendChild(toast);
  toast.querySelector("[data-pwa-reload]")?.addEventListener("click", async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    registration?.waiting?.postMessage("SKIP_WAITING");
  });
  return toast;
}

function showUpdateToast() {
  const toast = ensureUpdateToast();
  toast.classList.remove("hidden");
}

function hideUpdateToast() {
  document.getElementById(UPDATE_TOAST_ID)?.classList.add("hidden");
}

function watchRegistration(registration) {
  if (!registration) return;
  if (registration.waiting && navigator.serviceWorker.controller) {
    showUpdateToast();
  }
  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    worker?.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        showUpdateToast();
      }
    });
  });
}

async function registerWorker() {
  if (!pwaEnabled()) return null;
  const swUrl = new URL("../sw.js", import.meta.url);
  try {
    const registration = await navigator.serviceWorker.register(swUrl);
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
    watchRegistration(registration);
    registration.update().catch(() => {});
    window.addEventListener("focus", () => registration.update().catch(() => {}));
    return registration;
  } catch {
    return null;
  }
}

function ensureInstallSheet() {
  let sheet = document.getElementById(INSTALL_SHEET_ID);
  if (sheet) return sheet;
  sheet = document.createElement("div");
  sheet.id = INSTALL_SHEET_ID;
  sheet.className = "pwa-sheet hidden";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.setAttribute("aria-labelledby", "pwa-sheet-title");
  sheet.innerHTML = `
    <div class="pwa-sheet-backdrop" data-pwa-sheet-close></div>
    <div class="pwa-sheet-card">
      <h2 id="pwa-sheet-title">Add Somnia to your Home Screen</h2>
      <ol>
        <li>Tap <strong>Share</strong> in Safari.</li>
        <li>Choose <strong>Add to Home Screen</strong>.</li>
        <li>Open the new Somnia icon for a full-bleed table.</li>
      </ol>
      <button type="button" class="btn primary" data-pwa-sheet-close>Got it</button>
    </div>
  `;
  document.body.appendChild(sheet);
  sheet.querySelectorAll("[data-pwa-sheet-close]").forEach((el) => {
    el.addEventListener("click", () => sheet.classList.add("hidden"));
  });
  return sheet;
}

function installButton() {
  return document.getElementById("btn-pwa-install");
}

function setInstallVisible(show) {
  const btn = installButton();
  if (!btn) return;
  btn.classList.toggle("hidden", !show);
  btn.hidden = !show;
}

async function requestInstall() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => {});
    deferredPrompt = null;
    setInstallVisible(false);
    return;
  }
  ensureInstallSheet().classList.remove("hidden");
}

function bindInstall() {
  const btn = installButton();
  if (isStandaloneDisplay() || isStandaloneMode()) {
    setInstallVisible(false);
    return;
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    setInstallVisible(true);
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    setInstallVisible(false);
    hideUpdateToast();
  });

  if (isAppleTouchDevice()) setInstallVisible(true);

  btn?.addEventListener("click", () => {
    requestInstall().catch(() => {});
  });
}

export function showInstallHint() {
  const hint = document.getElementById("pwa-install-hint");
  if (!hint) return;
  hint.hidden = isStandaloneDisplay() || isStandaloneMode();
}

export function registerSomniaPwa() {
  registerWorker();
}

export function initSomniaPwa() {
  registerWorker();
  bindInstall();
  showInstallHint();
}
