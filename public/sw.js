self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open("acai-da-hora-v1");
      await cache.addAll(["/", "/manifest.webmanifest", "/icon", "/apple-icon"]);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== "acai-da-hora-v1")
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const accept = request.headers.get("accept") || "";
  const isHtml = request.mode === "navigate" || accept.includes("text/html");

  if (isHtml) {
    event.respondWith(
      (async () => {
        const cache = await caches.open("acai-da-hora-v1");
        try {
          const response = await fetch(request);
          cache.put(request, response.clone());
          return response;
        } catch {
          const cached = await cache.match(request);
          if (cached) return cached;
          const fallback = await cache.match("/");
          return fallback || Response.error();
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open("acai-da-hora-v1");
      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    })(),
  );
});

