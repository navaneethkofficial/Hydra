/**
 * Hydra service worker.
 *
 * Scope is deliberately small. It makes the app shell available offline and
 * routes reminder notification clicks — it does not try to cache the API, since
 * stale hydration numbers are worse than a clearly offline screen. Offline
 * *writes* are handled by the outbox in the app, which is the part that matters.
 */

const CACHE = "hydra-shell-v1";
const SHELL = ["/", "/offline", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never serve hydration data from cache — a wrong number is worse than none.
  if (url.pathname.startsWith("/api/")) return;

  // Navigations: network first, falling back to the cached shell.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => (await caches.match(request)) ?? (await caches.match("/offline")) ?? Response.error()),
    );
    return;
  }

  // Static assets: cache first, they are content-hashed by the build.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});

self.addEventListener("push", (event) => {
  let payload = { title: "💧 Time for a sip", body: "A small top-up keeps you on pace." };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // Malformed payload: fall back to the friendly default above.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: "hydra-reminder",
      renotify: true,
      vibrate: [200, 100, 200, 100, 200],
      data: { url: "/today" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url ?? "/today";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Focus an open tab rather than piling up new ones.
      const existing = clients.find((client) => client.url.includes(target));
      if (existing) return existing.focus();
      return self.clients.openWindow(target);
    }),
  );
});
