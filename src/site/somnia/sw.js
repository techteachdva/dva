/**
 * Somnia PWA worker. Bump CACHE_NAME on every ship so stale Home Screen
 * installs can pick up a new dreamscape after the player taps Reload.
 */

const CACHE_NAME = "somnia-27.0.1";
const RUNTIME_CACHE = "somnia-runtime-27.0.1";

const PRECACHE = [
  "./",
  "./index.html",
  "./play.html",
  "./manifest.webmanifest",
  "./css/game.css",
  "./js/setup.js",
  "./js/play.js",
  "./js/meet-phase.js",
  "./js/dice-battle.js",
  "./js/pwa.js",
  "./js/standalone.js",
  "./js/device-mode.js",
  "./js/panel-layout.js",
  "./js/launch-store.js",
  "./js/compact-chrome.js",
  "./js/game-save.js",
  "./js/local-save-store.js",
  "./js/data.js",
  "./data/dreamers.json",
  "./data/archetypes.json",
  "./data/landscapes.json",
  "./data/dreambeasts.json",
  "./data/dreams.json",
  "./data/psyche.json",
  "./data/mindstream.json",
  "./data/event-landscapes.json",
  "./data/objects.json",
  "./data/card-manifest.json",
  "./data/landscape-sfx.json",
  "./images/somnia-box-art.jpg",
  "./images/somnia-logo.png",
  "./images/backs/psyche.webp",
  "./images/backs/archetype.webp",
  "./images/backs/mindstream-lucidity.webp",
  "./images/backs/mindstream-elasticity.webp",
  "./images/backs/mindstream-willpower.webp",
  "./images/icons/somnia-192.png",
  "./images/icons/somnia-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => {})));
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith("somnia-") && key !== CACHE_NAME && key !== RUNTIME_CACHE)
        .map((key) => caches.delete(key)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

function sameOrigin(url) {
  return url.origin === self.location.origin;
}

function isDocument(request) {
  return request.mode === "navigate" || request.destination === "document";
}

function isRuntimeAsset(url) {
  return /\/(js|css|data|images|audio)\//.test(url.pathname)
    || /\.(js|css|json|webmanifest|png|jpe?g|webp|gif|svg|mp3|wav|woff2)$/i.test(url.pathname);
}

async function putRuntime(request, response) {
  if (!response.ok) return;
  const cache = await caches.open(RUNTIME_CACHE);
  await cache.put(request, response);
}

async function networkFirst(request) {
  const cached = await caches.match(request);
  try {
    const fresh = await fetch(request);
    const copy = fresh.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
    return fresh;
  } catch {
    if (cached) return cached;
    if (isDocument(request)) {
      return caches.match("./index.html");
    }
    throw new Error("offline");
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const fetching = fetch(request).then((fresh) => {
    putRuntime(request, fresh.clone()).catch(() => {});
    caches.open(CACHE_NAME).then((cache) => cache.put(request, fresh.clone())).catch(() => {});
    return fresh;
  }).catch(() => null);
  return cached || fetching || Promise.reject(new Error("offline"));
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  putRuntime(request, fresh.clone()).catch(() => {});
  return fresh;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (!sameOrigin(url)) return;

  if (isDocument(request)) {
    event.respondWith(networkFirst(request));
    return;
  }
  if (url.pathname.includes("/audio/") || url.pathname.includes("/images/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (isRuntimeAsset(url)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
