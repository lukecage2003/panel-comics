/* Panel — service worker
 * - Coquille de l'app (HTML, manifest, icônes) en cache : Panel s'ouvre hors ligne.
 * - Bibliothèques CDN (PDF.js, JSZip, lecteur de codes-barres zxing-wasm) et polices : cache puis mise à jour
 *   en arrière-plan (le scanner fonctionne hors ligne après une première utilisation).
 * - API Comic Vine, couvertures et tout le reste : réseau uniquement (données toujours fraîches,
 *   pas de réponses opaques qui gonfleraient le quota de stockage).
 * - Nouvelle version : l'app propose « Recharger » ; aucune mise à jour silencieuse en pleine lecture.
 */
const VERSION = 'panel-2026-11-08-lot31';
const SHELL_CACHE = 'panel-shell-' + VERSION;
const LIB_CACHE = 'panel-libs-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './fonts/barlow-condensed-600-latin.woff2',
  './fonts/barlow-condensed-700-latin.woff2',
  './fonts/barlow-condensed-800-latin.woff2'
];
const LIB_HOSTS = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('panel-shell-') && k !== SHELL_CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Pages de l'app : réseau d'abord (3 s max), sinon la version en cache
  if (req.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      try {
        const net = await Promise.race([
          fetch(req),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
        ]);
        if (net && net.ok) cache.put('./index.html', net.clone());
        return net;
      } catch (_) {
        return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }

  // Relais local (GCD) : toujours le réseau
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return;

  // Fichiers de l'app (manifest, icônes) : cache d'abord
  if (url.origin === self.location.origin) {
    event.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req)));
    return;
  }

  // Bibliothèques et polices : cache, puis rafraîchissement en arrière-plan
  if (LIB_HOSTS.includes(url.hostname)) {
    event.respondWith((async () => {
      const cache = await caches.open(LIB_CACHE);
      const hit = await cache.match(req);
      const refresh = fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      }).catch(() => hit);
      return hit || refresh;
    })());
  }
  // Tout le reste (Comic Vine, couvertures, OpenLibrary…) : comportement réseau normal
});
