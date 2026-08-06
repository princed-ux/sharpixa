/* Sharpixa production service worker.
 *
 * Strategy:
 *  - The static application shell is precached at install time.
 *  - Navigation requests use network-first so the site always shows the
 *    freshest deployed pages, with the precached shell and /offline.html as
 *    fallbacks when the network is unavailable.
 *  - Same-origin static assets (hashed JS/CSS, images) use
 *    stale-while-revalidate so updates never block rendering.
 *  - AI processing never leaves the browser (workers + object URLs), and
 *    model/wasm payloads are intentionally NOT cached to avoid exhausting
 *    storage quota.
 *  - Cross-origin requests (AdSense, analytics, external images) are never
 *    intercepted, and anything that is not a same-origin GET is passed
 *    straight to the network.
 */

const VERSION = "sharpixa-v1";

const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;

const PRECACHE_URLS = [
  "/",
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
];

const STATIC_EXTENSIONS = /\.(css|js|mjs|json|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|eot)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (request.destination === "document" || request.mode === "navigate") {
    event.respondWith(navigationResponse(request));
    return;
  }

  if (STATIC_EXTENSIONS.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
});

async function navigationResponse(request) {
  const cache = await caches.open(SHELL_CACHE);

  try {
    const fresh = await fetch(request);
    if (fresh.ok) {
      cache.put("/", fresh.clone());
    }
    return fresh;
  } catch {
    const cached = await cache.match(request.url);
    if (cached) {
      return cached;
    }

    const shell = await cache.match("/");
    if (shell) {
      return shell;
    }

    const offline = await cache.match("/offline.html");
    return offline || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);

  return cached || (await network) || Response.error();
}
