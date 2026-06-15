// Bracketeer service worker — static-asset offline only. Hand-rolled (no
// Workbox) to keep zero build dependencies.
//
// Deliberately does NOT cache navigations / HTML. Pages are server-rendered with
// the user's session, so a URL-keyed HTML cache could serve a stale or
// wrong-auth page (e.g. signed-in HTML shown after sign-out, or another user's
// page on a shared install). Live data is likewise never cached — the app's SSE
// + polling keep it fresh. The PWA win here is instant repeat loads of static,
// user-agnostic assets, plus a clean offline screen.
//
//   • static assets (_next/static, icons, fonts, css, js) → stale-while-revalidate
//   • GET navigations → network; on failure, a generic offline page
//   • everything else (API, SSE, auth, POSTs) → untouched
// Bump CACHE_VERSION to invalidate the static cache.

const CACHE_VERSION = "v1";
const STATIC_CACHE = `bracketeer-static-${CACHE_VERSION}`;

const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Offline — Bracketeer</title>
<style>html,body{margin:0;height:100%}body{display:flex;align-items:center;justify-content:center;
background:#0b6b3a;color:#f4c542;font-family:system-ui,sans-serif;text-align:center;padding:24px}
h1{font-size:1.25rem;margin:0 0 .5rem}p{color:#e8f5ee;opacity:.9;margin:0}</style></head>
<body><div><h1>You're offline</h1><p>Reconnect to see live scores and standings.</p></div></body></html>`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image") ||
    /\.(?:png|svg|jpg|jpeg|webp|avif|ico|woff2?|ttf|css|js)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // third-party (fonts CDN, Giphy, …)
  if (url.pathname.startsWith("/api/")) return; // live data, SSE, auth — always network

  // Navigations: network-only (never cache session HTML); generic offline page
  // as the fallback so a cold offline launch shows something honest.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(
        () => new Response(OFFLINE_HTML, { headers: { "content-type": "text/html; charset=utf-8" } }),
      ),
    );
    return;
  }

  // Static, user-agnostic assets: stale-while-revalidate.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});
