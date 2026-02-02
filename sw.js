/* أكاديمية عايد الرسمية — برنامج تحديد مستوى STEP (PWA) */
const CACHE = "ayed-step-free-v2026-02-01";
const PRECACHE = [
  "./",
  "./index.html",
  "./test.html",
  "./results.html",
  "./quiz.html",
  "./progress.html",
  "./support.html",
  "./privacy.html",
  "./terms.html",
  "./offline.html",
  "./assets/styles.css",
  "./assets/site-data.js",
  "./assets/app.js",
  "./assets/test.js",
  "./assets/results.js",
  "./assets/quiz.js",
  "./assets/progress.js",
  "./assets/support.js",
  "./assets/home.js",
  "./assets/questions.json",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon.svg",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if(req.method !== "GET") return;

  const url = new URL(req.url);

  // Only handle same-origin
  if(url.origin !== location.origin) return;

  // Navigation requests: network first, fallback to cache, then offline
  if(req.mode === "navigate"){
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(async () => {
        const cached = await caches.match(req);
        return cached || caches.match("./offline.html");
      })
    );
    return;
  }

  // Assets: cache first
  event.respondWith(
    caches.match(req).then((cached) => {
      if(cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match("./offline.html"));
    })
  );
});
