// Service worker: hace la app instalable, guarda el cascarón para abrir sin señal y muestra las notificaciones push.
const CACHE = 'olimpo-v2';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // la API nunca se guarda
  e.respondWith(
    fetch(e.request).then((r) => {
      if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); }
      return r;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match(self.registration.scope))));
});

// Aviso al personal (cita nueva, cancelada o cambiada)
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data.json(); } catch { /* sin datos */ }
  e.waitUntil(self.registration.showNotification(d.titulo || 'Olimpo Barber Club', {
    body: d.cuerpo || '', tag: d.etiqueta, renotify: !!d.etiqueta,
    icon: 'icono-192.png', badge: 'icono-192.png', data: { url: d.url || '' },
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const destino = new URL(e.notification.data?.url || '', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    const abierta = cs.find((c) => c.url.startsWith(self.registration.scope));
    return abierta ? abierta.navigate(destino).then((c) => (c || abierta).focus()) : self.clients.openWindow(destino);
  }));
});
