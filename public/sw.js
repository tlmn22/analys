/* Only the public offline page is cached. Authenticated pages and API data
   always come from the network; mutations are never queued or retried. */
const CACHE = "hoopslab-offline-v1";
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add("/offline.html")));
});
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith("hoopslab-offline-") && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.mode !== "navigate" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(request).catch(async () => {
    const cache = await caches.open(CACHE);
    return await cache.match("/offline.html") || new Response("HoopsLab: Интернет холболтоо шалгана уу.", {
      status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }));
});
