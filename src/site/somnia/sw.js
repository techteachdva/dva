/**
 * Somnia PWA worker. Bump CACHE_NAME on every ship so stale Home Screen
 * installs can pick up a new dreamscape after the player taps Reload.
 */

const CACHE_NAME = "somnia-39.4-corners";
const RUNTIME_CACHE = "somnia-runtime-39.4-corners";

const PRECACHE = [
  "./",
  "./index.html",
  "./play.html",
  "./manifest.webmanifest",
  "./css/game.css",
  "./css/glass.css",
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
  "./js/flow/action-history.js",
  "./js/dreamers/archetype-stats.js",
  "./js/dreamers/archetypes.js",
  "./js/audio/audio-settings.js",
  "./js/audio/audio.js",
  "./js/encounters/beast-mill-cinematic.js",
  "./js/board/board-fx.js",
  "./js/board/board-zoom.js",
  "./js/encounters/bosses.js",
  "./js/dev/bot-ai.js",
  "./js/cards/card-backs.js",
  "./js/cards/card-fx.js",
  "./js/meta/changelog.js",
  "./js/ui/click-feedback.js",
  "./js/ui/compact-chrome.js",
  "./js/core/data.js",
  "./js/cards/deck-pressure.js",
  "./js/dev/dev-commands.js",
  "./js/dev/dev-console.js",
  "./js/app/device-mode.js",
  "./js/ui/dialog-a11y.js",
  "./js/encounters/dice-battle.js",
  "./js/cards/dream-choices.js",
  "./js/cards/dream-deck.js",
  "./js/cards/dream-resolutions.js",
  "./js/cards/dream-replay.js",
  "./js/encounters/dreambeasts.js",
  "./js/dreamers/dreamer-powers.js",
  "./js/effects/effect-choices.js",
  "./js/effects/effects.js",
  "./js/effects/event-choices.js",
  "./js/board/event-landscapes.js",
  "./js/effects/event-resolutions.js",
  "./js/dreamers/final-recurrence-atmosphere.js",
  "./js/dreamers/final-recurrence-rules.js",
  "./js/ui/frame-metrics.js",
  "./js/ui/fx.js",
  "./js/ui/game-cursor.js",
  "./js/save/game-save.js",
  "./js/core/game.js",
  "./js/meta/guide.js",
  "./js/core/hex.js",
  "./js/save/highscores.js",
  "./js/flow/input-quarantine.js",
  "./js/board/landscape-actions.js",
  "./js/board/landscapes.js",
  "./js/app/launch-store.js",
  "./js/save/local-save-store.js",
  "./js/save/local-score-store.js",
  "./js/encounters/meet-phase-tax.js",
  "./js/encounters/meet-phase.js",
  "./js/cards/mindstream-choices.js",
  "./js/cards/mindstream-draw-cinematic.js",
  "./js/cards/mindstream-extra.js",
  "./js/cards/mindstream-supply.js",
  "./js/cards/mindstream.js",
  "./js/ui/moment-overlay.js",
  "./js/core/narrator.js",
  "./js/effects/object-effects.js",
  "./js/effects/objects.js",
  "./js/flow/opening-cinematic.js",
  "./js/flow/opening-hook.js",
  "./js/ui/panel-layout.js",
  "./js/ui/pause-menu.js",
  "./js/flow/phase-opener-menu.js",
  "./js/flow/phase-skip.js",
  "./js/app/play.js",
  "./js/ui/pointer-gestures.js",
  "./js/cards/power-tokens.js",
  "./js/cards/psyche-pressure.js",
  "./js/cards/psyche.js",
  "./js/app/pwa.js",
  "./js/dreamers/quests.js",
  "./js/save/remote-save-store.js",
  "./js/save/remote-score-store.js",
  "./js/effects/resolution-effects.js",
  "./js/core/rng.js",
  "./js/core/rules.js",
  "./js/core/scoring.js",
  "./js/app/setup.js",
  "./js/app/standalone.js",
  "./js/dreamers/stat-tier.js",
  "./js/core/state.js",
  "./js/dreamers/subconscious.js",
  "./js/tutorial/tutorial-advanced.js",
  "./js/tutorial/tutorial-canonical.js",
  "./js/tutorial/tutorial-mode.js",
  "./js/board/turn-halo.js",
  "./js/ui/ui.js",
  "./js/ui/victory-celebration.js",
  "./js/ui/viewport-sync.js",
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
  self.skipWaiting();
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
    if (fresh && fresh.ok) {
      putRuntime(request, fresh.clone()).catch(() => {});
      caches.open(CACHE_NAME).then((cache) => cache.put(request, fresh.clone())).catch(() => {});
    }
    return fresh;
  }).catch(() => null);
  return cached || fetching || Promise.reject(new Error("offline"));
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const fresh = await fetch(request, { cache: "reload" });
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
