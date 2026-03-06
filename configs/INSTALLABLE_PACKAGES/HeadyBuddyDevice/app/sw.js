// ─── HeadyBuddy Service Worker ─── Cloud-Connected Thin Client ───
// Caches the UI shell locally, routes all ops to cloud bees
const CACHE_NAME = 'heady-buddy-v3457890';
const SHELL_ASSETS = [
    './',
    './index.html',
    './manifest.json',
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(SHELL_ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Cloud API calls — always network (never cache API responses)
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // UI shell — cache-first for instant offline startup
    event.respondWith(
        caches.match(event.request)
            .then(cached => cached || fetch(event.request))
    );
});
