// Listo – działanie offline. Pliki aplikacji z pamięci podręcznej, dane synchronizują się przez internet.
// Przy każdej nowej wersji zmień numer poniżej (robi to automatycznie scripts/build-dist.ps1).
const VERSION = 'listo-dev';
const SHELL = ['./', 'index.html', 'app.js', 'styles.css', 'config.js', 'manifest.webmanifest', 'icon.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // biblioteka Supabase z CDN – zapamiętaj, żeby aplikacja startowała też bez internetu
  if (['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) {
    e.respondWith(caches.open(VERSION).then(async c => (await c.match(e.request)) || fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; })));
    return;
  }
  if (url.origin !== location.origin) return; // zapytania do serwera danych zawsze przez sieć
  // najpierw sieć (świeża wersja), a gdy jej brak – kopia z pamięci
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); } return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
