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

// ---------- powiadomienia push (przypomnienia z serwera, gdy aplikacja jest zamknięta) ----------
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: 'Listo', body: e.data ? e.data.text() : '' }; }
  const opts = {
    body: d.body || '', tag: d.tag || 'listo', icon: 'icon-192.png', badge: 'icon-192.png', renotify: false,
    data: { url: d.url || './#today', task: d.task || null },
    actions: d.task ? [{ action: 'done', title: 'Zrobione' }, { action: 'snooze', title: 'Za 10 min' }] : [],
  };
  e.waitUntil(self.registration.showNotification(d.title || 'Listo', opts));
});
self.addEventListener('notificationclick', e => {
  const d = e.notification.data || {}, act = e.action || '';
  e.notification.close();
  const url = new URL(d.url || './#today', self.registration.scope);
  if (d.task) { url.searchParams.set('task', d.task); if (act) url.searchParams.set('act', act); }
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    const c = cs.find(x => x.url.startsWith(self.registration.scope));
    if (c) { if (d.task) c.postMessage({ type: 'listo-notif', task: d.task, act }); return c.focus(); }
    return self.clients.openWindow(url.href);
  }));
});
