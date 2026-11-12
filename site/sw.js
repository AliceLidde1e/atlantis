importScripts('./sw-release.js');

const scope = new URL(self.registration.scope);
const namespace = 'atlantis:' + scope.pathname;
const shellPrefix = namespace + ':shell:';
const shellCache = shellPrefix + self.ATLANTIS_RELEASE;
const imageCache = namespace + ':images:v1';
const imageLimit = 160;
const shellFiles = [
  'index.html', 'app.mjs', 'pwa.mjs', 'core.mjs', 'deck-store.mjs', 'workbench.mjs',
  'autocomplete.mjs', 'publishing.mjs', 'japanese-names.mjs', 'deck-image.mjs',
  'style.css', 'museum.css', 'typography.css', 'presentation.css',
  'favicon.svg', 'atlantis-logo.svg', 'version.json', 'manifest.webmanifest',
  'icons/atlantis-180.png', 'icons/atlantis-192.png', 'icons/atlantis-512.png',
  'icons/atlantis-maskable-512.png',
];
const shellPaths = new Set(shellFiles.map(file => new URL(file, scope).pathname));
const homePath = new URL('index.html', scope).pathname;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(shellCache).then(cache => cache.addAll(
    shellFiles.map(file => new Request(new URL(file, scope), {cache: 'reload'})),
  )));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(shellPrefix) && name !== shellCache)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function cachedShell(request, path) {
  const cache = await caches.open(shellCache);
  // The installed release owns the HTML and its assets, including versioned import URLs.
  return await cache.match(new URL(path, scope)) || fetch(request);
}

async function cacheImage(cache, request, response) {
  await cache.put(request, response);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - imageLimit))
    .map(key => cache.delete(key)));
}

async function cardImage(event) {
  const {request} = event;
  const cache = await caches.open(imageCache).catch(() => null);
  const saved = await cache?.match(request).catch(() => null);
  if (saved) return saved;
  const response = await fetch(request);
  if (cache && response.ok && response.headers.get('Content-Type')?.startsWith('image/')) {
    event.waitUntil(cacheImage(cache, request, response.clone()).catch(() => {}));
  }
  return response;
}

self.addEventListener('fetch', event => {
  const {request} = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (request.destination === 'image' && request.mode === 'cors' &&
      url.origin === 'https://cards.scryfall.io') {
    event.respondWith(cardImage(event));
    return;
  }
  if (url.origin !== scope.origin) return;
  if (request.mode === 'navigate' && (url.pathname === scope.pathname || url.pathname === homePath)) {
    event.respondWith(cachedShell(request, homePath));
  } else if (shellPaths.has(url.pathname)) {
    event.respondWith(cachedShell(request, url.pathname));
  }
});
