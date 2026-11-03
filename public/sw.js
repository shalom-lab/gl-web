/* ArtLens Service Worker — caches ffmpeg.wasm core assets for GitHub Pages (/gl-web/).
 * Scope is /gl-web/ when registered with { scope: base }.
 * Strategy: CacheFirst for /ffmpeg/ffmpeg-core.js|wasm only.
 * IMPORTANT: never intercept /assets/*.js HTML — hashed Vite chunks must always
 * hit the network so deploys cannot leave the app pointing at a deleted chunk.
 */
const CACHE_NAME = 'gl-web-ffmpeg-v2';
const FFMPEG_ASSET_RE = /\/ffmpeg\/ffmpeg-core\.(js|wasm)$/;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith('gl-web-ffmpeg-') && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || !FFMPEG_ASSET_RE.test(url.pathname)) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(event.request);
      if (cached) return cached;

      const response = await fetch(event.request);
      if (response.ok) {
        cache.put(event.request, response.clone());
      }
      return response;
    })()
  );
});
