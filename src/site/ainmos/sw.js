/**
 * Ainmos PWA worker. Bump CACHE_NAME on every ship so stale Home Screen
 * installs can pick up a new dreamscape after the player taps Reload.
 */

const CACHE_NAME = "ainmos-0.27.1-nan";
/** Versioned with the release, so a new ship never serves last version's modules. */
const RUNTIME_CACHE = `${CACHE_NAME}-runtime`;

const PRECACHE = [
  "./",
  "./index.html",
  "./how-to-play.html",
  "./play.html",
  "./manifest.webmanifest",
  "./css/game.css",
  "./css/glass.css",
  "./css/dreamscape.css",
  "./css/ainmos.css",
  "./css/ainmos-layout.css",
  "./css/ainmos-polish.css",
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
  "./js/board/dreamscape-vault.js",
  "./js/encounters/bosses.js",
  "./js/dev/bot-ai.js",
  "./js/dev/autoplay.js",
  "./js/dev/bot-policy.js",
  "./js/cards/card-backs.js",
  "./js/cards/card-fx.js",
  "./js/meta/changelog.js",
  "./js/ui/click-feedback.js",
  "./js/ui/vault-panel.js",
  "./js/ui/vault-screen.js",
  "./js/ui/cycle-screen.js",
  "./js/ui/keepsake-scroll.js",
  "./js/ui/fit-bar.js",
  "./js/ui/menu-bridge.js",
  "./js/ui/float-window.js",
  "./js/ui/archetype-window.js",
  "./js/ui/archetype-choice.js",
  "./js/dreamers/archetype-board.js",
  "./js/effects/object-sets.js",
  "./js/effects/set-search.js",
  "./js/core/cycle.js",
  "./js/ui/night-bar.js",
  "./js/cards/dream-forms.js",
  "./js/shop/lost-found.js",
  "./js/ui/lost-found-panel.js",
  "./js/ui/boon-panel.js",
  "./js/ui/run-summary.js",
  "./js/ui/coach-panel.js",
  "./js/ui/hand-drawer.js",
  "./js/tutorial/coach.js",
  "./js/dreamers/boons.js",
  "./js/encounters/boss-twists.js",
  "./js/encounters/boss-ladder.js",
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
  "./js/board/event-landscapes.js",
  "./js/effects/event-resolutions.js",
  "./js/dreamers/final-recurrence-atmosphere.js",
  "./js/dreamers/final-recurrence-rules.js",
  "./js/ui/frame-metrics.js",
  "./js/ui/fx.js",
  "./js/ui/game-cursor.js",
  "./js/save/game-save.js",
  "./js/core/game.js",
  "./js/meta/glossary.js",
  "./js/meta/guide.js",
  "./js/core/hex.js",
  "./js/save/highscores.js",
  "./js/flow/input-quarantine.js",
  "./js/board/landscape-actions.js",
  "./js/board/landscapes.js",
  "./js/app/launch-store.js",
  "./js/save/local-save-store.js",
  "./js/save/local-score-store.js",
  "./js/save/remote-save-store.js",
  "./js/save/remote-score-store.js",
  "./js/encounters/endless.js",
  "./js/encounters/beast-wards.js",
  "./js/dreamers/archetype-call.js",
  "./js/ui/bsod.js",
  "./js/ui/leviathan-finale.js",
  "./js/encounters/meet-phase.js",
  "./js/cards/mindstream-choices.js",
  "./js/cards/mindstream-draw-cinematic.js",
  "./js/cards/mindstream-supply.js",
  "./js/ui/moment-overlay.js",
  "./js/core/narrator.js",
  "./js/effects/object-effects.js",
  "./js/effects/objects.js",
  "./js/flow/opening-cinematic.js",
  "./js/ui/panel-layout.js",
  "./js/ui/pause-menu.js",
  "./js/ui/table-polish.js",
  "./js/flow/phase-opener-menu.js",
  "./js/flow/phase-skip.js",
  "./js/app/play.js",
  "./js/ui/pointer-gestures.js",
  "./js/cards/power-tokens.js",
  "./js/cards/psyche-pressure.js",
  "./js/cards/psyche.js",
  "./js/app/pwa.js",
  "./js/dreamers/quests.js",
  "./js/effects/remember.js",
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
    // Bypass the HTTP cache so the precache is this release, not a mix with the last one.
    await Promise.all(PRECACHE.map((url) => cache.add(new Request(url, { cache: "reload" })).catch(() => {})));
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith("ainmos-") && key !== CACHE_NAME && key !== RUNTIME_CACHE)
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

/** Pages and code: always try the network first so modules never mix versions; the cache is the offline fallback. */
async function networkFirst(request) {
  try {
    const fresh = await fetch(request, { cache: "no-cache" });
    if (fresh && fresh.ok) {
      const copy = fresh.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
      return fresh;
    }
    if (fresh) {
      const cached = await caches.match(request, { cacheName: CACHE_NAME }) || await caches.match(request);
      return cached || fresh;
    }
  } catch {
    // offline: fall through to the cache
  }
  const cached = await caches.match(request, { cacheName: CACHE_NAME }) || await caches.match(request);
  if (cached) return cached;
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
  if (/\.(js|mjs|css|json|webmanifest)$/i.test(url.pathname)) {
    event.respondWith(networkFirst(request));
    return;
  }
  if (isRuntimeAsset(url)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
