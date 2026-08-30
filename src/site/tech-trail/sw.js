/**
 * Global Tech Gauntlet — service worker with network-first for scripts/styles.
 */
const CACHE_NAME = "gtg-v76";

function offlineResponse(message = "Offline") {
  return new Response(message, {
    status: 503,
    statusText: "Service Unavailable",
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function isCacheableRequest(request) {
  try {
    const url = new URL(request.url);
    return request.method === "GET" && (url.protocol === "http:" || url.protocol === "https:");
  } catch {
    return false;
  }
}

function maybeCache(request, response) {
  if (!isCacheableRequest(request) || !response || response.status !== 200 || response.type !== "basic") {
    return;
  }
  const clone = response.clone();
  caches.open(CACHE_NAME).then((cache) => cache.put(request, clone).catch(() => {}));
}

function networkFirst(request) {
  if (!isCacheableRequest(request)) return fetch(request);
  return fetch(request)
    .then((res) => {
      maybeCache(request, res);
      return res;
    })
    .catch(() => caches.match(request).then((cached) => cached || offlineResponse()));
}
const PRECACHE = [
  "/styles/write-platform.css?v=gtg76",
  "/styles/custom-style.css?v=gtg76",
  "/scripts/vendor/three.module.js",
  "/scripts/tech-trail-world3d-props.js",
  "/scripts/tech-trail-world3d.js",
  "/scripts/tech-trail-glitch.js",
  "/scripts/write-test-core.js",
  "/scripts/diagnostic-writing-calibration.js",
  "/scripts/write-analysis-engine.js",
  "/scripts/tech-trail-pedagogy.js",
  "/scripts/tech-trail-typing-engine.js",
  "/scripts/tech-trail-visuals.js",
  "/scripts/tech-trail-story.js",
  "/scripts/tech-trail-state.js",
  "/scripts/tech-trail-audio.js",
  "/scripts/tech-trail-phrase-tracks.js",
  "/scripts/tech-trail-room-phrases.js",
  "/scripts/tech-trail-rhythm.js",
  "/scripts/tech-trail-minigames.js",
  "/scripts/tech-trail-app.js?v=gtg76",
  "/tech-trail/images/scenes/scene-dragons-briefing.png",
  "/tech-trail/images/scenes/scene-collaboration-bridge.png",
  "/tech-trail/images/scenes/scene-data-vault.png",
  "/tech-trail/images/scenes/scene-design-lab.png",
  "/tech-trail/images/scenes/scene-gauntlet-arena.png",
  "/tech-trail/images/scenes/scene-network-closet.png",
  "/tech-trail/images/scenes/scene-sources-library.png",
  "/tech-trail/images/heroes/hero-babbage.png",
  "/tech-trail/images/heroes/hero-campbell.png",
  "/tech-trail/images/heroes/hero-conway.png",
  "/tech-trail/images/heroes/hero-crawford.png",
  "/tech-trail/images/heroes/hero-guide.png",
  "/tech-trail/images/heroes/hero-phil.png",
  "/tech-trail/images/heroes/hero-hopper.png",
  "/tech-trail/images/heroes/hero-johnson.png",
  "/tech-trail/images/heroes/hero-lovelace.png",
  "/tech-trail/images/heroes/hero-meier.png",
  "/tech-trail/images/heroes/hero-turing-stylized.png",
  "/tech-trail/images/heroes/hero-wright.png",
  "/tech-trail/images/heroes/hero-lamarr.png",
  "/tech-trail/images/heroes/hero-hamilton.png",
  "/tech-trail/images/heroes/hero-perlman.png",
  "/tech-trail/images/heroes/hero-sweeney.png",
  "/tech-trail/images/heroes/hero-buolamwini.png",
  "/tech-trail/images/heroes/hero-west.png",
  "/tech-trail/images/heroes/hero-noble.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") {
    self.skipWaiting().then(() => {
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => client.postMessage("reload"));
      });
    });
  }
});

self.addEventListener("fetch", (e) => {
  const { request } = e;

  // Let the browser handle HTML navigations; only cache static assets.
  if (request.mode === "navigate") return;

  if (!isCacheableRequest(request)) return;

  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(
      fetch(request).catch(() => offlineResponse("Offline — connect to load roster."))
    );
    return;
  }

  if (/\.(mp3|wav|ogg|m4a)$/i.test(url.pathname)) {
    e.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((cached) => cached || offlineResponse())
      )
    );
    return;
  }

  const isScriptOrStyle =
    url.pathname.startsWith("/scripts/") || url.pathname.startsWith("/styles/");

  if (isScriptOrStyle) {
    e.respondWith(networkFirst(request));
    return;
  }

  e.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((res) => {
          maybeCache(request, res);
          return res;
        })
        .catch(() => offlineResponse());
    })
  );
});
