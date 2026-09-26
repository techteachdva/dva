/**
 * Somnia PWA worker. Bump CACHE_NAME on every ship so stale Home Screen
 * installs can pick up a new dreamscape after the player taps Reload.
 */

const CACHE_NAME = "somnia-29.8";
const RUNTIME_CACHE = "somnia-runtime-29.8";

const PRECACHE = [
  "./",
  "./index.html",
  "./play.html",
  "./manifest.webmanifest",
  "./css/game.css",
  "./css/fonts-local.css",
  "./fonts/font-0.woff2",
  "./fonts/font-1.woff2",
  "./fonts/font-2.woff2",
  "./fonts/font-3.woff2",
  "./fonts/font-4.woff2",
  "./fonts/font-5.woff2",
  "./fonts/font-6.woff2",
  "./fonts/font-7.woff2",
  "./fonts/font-8.woff2",
  "./fonts/font-9.woff2",
  "./fonts/font-10.woff2",
  "./fonts/font-11.woff2",
  "./fonts/font-12.woff2",
  "./fonts/font-13.woff2",
  "./fonts/font-14.woff2",
  "./fonts/font-15.woff2",
  "./fonts/font-16.woff2",
  "./fonts/font-17.woff2",
  "./fonts/font-18.woff2",
  "./fonts/font-19.woff2",
  "./fonts/font-20.woff2",
  "./fonts/font-21.woff2",
  "./js/action-history.js",
  "./js/archetype-stats.js",
  "./js/archetypes.js",
  "./js/audio-settings.js",
  "./js/audio.js",
  "./js/board-fx.js",
  "./js/board-zoom.js",
  "./js/bosses.js",
  "./js/card-backs.js",
  "./js/card-fx.js",
  "./js/changelog.js",
  "./js/click-feedback.js",
  "./js/compact-chrome.js",
  "./js/data.js",
  "./js/deck-pressure.js",
  "./js/dev-commands.js",
  "./js/dev-console.js",
  "./js/device-mode.js",
  "./js/dialog-a11y.js",
  "./js/dice-battle.js",
  "./js/dream-choices.js",
  "./js/dream-deck.js",
  "./js/dreambeasts.js",
  "./js/dreamer-powers.js",
  "./js/effect-choices.js",
  "./js/effects.js",
  "./js/event-choices.js",
  "./js/event-landscapes.js",
  "./js/final-recurrence-atmosphere.js",
  "./js/final-recurrence-rules.js",
  "./js/fx.js",
  "./js/game-cursor.js",
  "./js/game-save.js",
  "./js/game.js",
  "./js/guide.js",
  "./js/hex.js",
  "./js/highscores.js",
  "./js/landscape-actions.js",
  "./js/landscapes.js",
  "./js/launch-store.js",
  "./js/local-save-store.js",
  "./js/local-score-store.js",
  "./js/meet-phase-tax.js",
  "./js/meet-phase.js",
  "./js/mindstream-extra.js",
  "./js/mindstream-supply.js",
  "./js/mindstream.js",
  "./js/moment-overlay.js",
  "./js/narrator.js",
  "./js/object-effects.js",
  "./js/objects.js",
  "./js/panel-layout.js",
  "./js/pause-menu.js",
  "./js/phase-skip.js",
  "./js/play.js",
  "./js/pointer-gestures.js",
  "./js/power-tokens.js",
  "./js/psyche-pressure.js",
  "./js/psyche.js",
  "./js/pwa.js",
  "./js/quests.js",
  "./js/remote-save-store.js",
  "./js/remote-score-store.js",
  "./js/rules.js",
  "./js/scoring.js",
  "./js/setup.js",
  "./js/standalone.js",
  "./js/stat-tier.js",
  "./js/state.js",
  "./js/subconscious.js",
  "./js/tutorial-canonical.js",
  "./js/tutorial-mode.js",
  "./js/ui.js",
  "./js/victory-celebration.js",
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
  const freshPromise = fetch(request).then((fresh) => {
    if (fresh && fresh.ok) {
      const copy = fresh.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
    }
    return fresh;
  }).catch(() => null);

  if (cached) {
    freshPromise.catch(() => {});
    return cached;
  }

  const fresh = await freshPromise;
  if (fresh) return fresh;
  if (isDocument(request)) {
    const fallback = await caches.match("./index.html");
    if (fallback) return fallback;
  }
  throw new Error("offline");
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
