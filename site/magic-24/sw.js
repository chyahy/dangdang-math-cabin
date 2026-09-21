const CACHE_VERSION = 'dangdang-magic-24-2026.09.21.2';

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(key => key.startsWith('dangdang-magic-24-') && key !== CACHE_VERSION).map(key => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    if (event.request.mode !== 'navigate') return;
    event.respondWith(
        fetch(new Request(event.request, { cache: 'reload' }))
            .catch(() => fetch(event.request))
    );
});
