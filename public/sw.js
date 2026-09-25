// Service worker for offline attendance marking.
//
// Scope: keep the app shell (the HTML/JS/CSS needed to open pages that were
// already visited) available with no network, and let already-loaded pages
// keep working offline. It does NOT try to cache or serve Supabase API
// responses — those go through the IndexedDB roster cache + outbox in
// src/lib/offline-attendance-db.ts instead, which is a better fit for data
// that needs syncing later than an HTTP cache would be.
//
// Strategy: cache-first for same-origin GET requests (navigations, JS, CSS),
// falling back to network and caching the response as it goes. Anything
// that fails offline and isn't already cached just fails — the attendance
// page itself is built to keep working from IndexedDB in that case.

const CACHE_NAME = "school-portal-shell-v1";
const SHELL_URLS = ["/", "/lecturer/dashboard", "/lecturer/attendance", "/lecturer/login"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(SHELL_URLS).catch(() => {
        // Best-effort: a route that 404s locally (e.g. during dev) shouldn't
        // block install of the rest of the shell.
      })
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never intercept Supabase/API calls
  if (url.pathname.startsWith("/api")) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
