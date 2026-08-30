/**
 * Global Tech Gauntlet — service worker with network-first for scripts/styles.
 */
const CACHE_NAME = "gtg-v50";
const PRECACHE = [
  "/styles/write-platform.css",
  "/styles/custom-style.css",
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
  "/scripts/tech-trail-rhythm.js",
  "/scripts/tech-trail-app.js",
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

function networkFirst(request) {
  return fetch(request)
    .then((res) => {
      if (res && res.status === 200 && res.type === "basic") {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      }
      return res;
    })
    .catch(() => caches.match(request));
}

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

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (/\.(mp3|wav|ogg|m4a)$/i.test(url.pathname)) {
    e.respondWith(fetch(request).catch(() => caches.match(request)));
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
      return fetch(request).then((res) => {
        if (!res || res.status !== 200 || res.type !== "basic") return res;
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return res;
      }).catch(() => cached);
    })
  );
});
