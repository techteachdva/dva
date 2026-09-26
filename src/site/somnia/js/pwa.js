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

const WARM_DATA = [
  "./data/card-manifest.json",
  "./data/landscapes.json",
  "./data/dreamers.json",
  "./data/archetypes.json",
  "./data/dreambeasts.json",
  "./data/dreams.json",
  "./data/psyche.json",
  "./data/mindstream.json",
  "./data/objects.json",
  "./data/event-landscapes.json",
  "./data/landscape-sfx.json",
];

function collectAssetUrls(value, into) {
  if (typeof value === "string") {
    if (/^https?:/i.test(value)) return;
    if (/\.(png|jpe?g|webp|gif|svg|mp3|wav|ogg)(\?|$)/i.test(value)) {
      into.add(value.replace(/^\.\//, ""));
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectAssetUrls(entry, into));
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((entry) => collectAssetUrls(entry, into));
  }
}

let warming = false;

/** Pull card art and landscape stings into the cache while the first visit is online. */
export async function warmOfflineLibrary() {
  if (warming || !navigator.onLine) return;
  warming = true;
  try {
    const urls = new Set();
    await Promise.all(WARM_DATA.map(async (url) => {
      try {
        const response = await fetch(url);
        if (!response.ok) return;
        collectAssetUrls(await response.json(), urls);
      } catch {
        /* a missing list should not stop the rest */
      }
    }));
    const queue = [...urls];
    const batchSize = 6;
    for (let i = 0; i < queue.length; i += batchSize) {
      const batch = queue.slice(i, i + batchSize);
      await Promise.all(batch.map((url) => fetch(url).catch(() => null)));
    }
  } finally {
    warming = false;
  }
}

function claimFirstInstall(registration) {
  if (navigator.serviceWorker.controller) return;
  const worker = registration.installing || registration.waiting;
  if (!worker) return;
  const skip = () => {
    if (navigator.serviceWorker.controller) return;
    registration.waiting?.postMessage("SKIP_WAITING");
    if (worker.state === "installed") worker.postMessage?.("SKIP_WAITING");
  };
  if (worker.state === "installed") skip();
  else worker.addEventListener("statechange", () => {
    if (worker.state === "installed") skip();
  });
}

async function registerWorker() {
  if (!pwaEnabled()) return null;
  const swUrl = new URL("../sw.js", import.meta.url);
  try {
    let seenController = !!navigator.serviceWorker.controller;
    const registration = await navigator.serviceWorker.register(swUrl);
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!seenController) {
        seenController = true;
        warmOfflineLibrary();
        return;
      }
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
    watchRegistration(registration);
    claimFirstInstall(registration);
    if (navigator.serviceWorker.controller) warmOfflineLibrary();
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
        <li>Open the new Somnia icon. After this visit, that icon plays with no internet.</li>
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
