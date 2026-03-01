/**
 * Heady Universal Service Worker — Offline-First PWA for All Verticals
 * Caches auth state, core UI, and API responses for seamless cross-device experience.
 * Designed for maximum session duration (WARP: 365d, Device: 365d, OAuth: 180d)
 */

const CACHE_VERSION = 'heady-pwa-v2';
const VERTICALS = [
    'headyme', 'headysystems', 'headyconnection', 'headymcp', 'headyio',
    'headybuddy', 'headybot', 'headycreator', 'headymusic', 'headytube',
    'headycloud', 'headylearn', 'headystore', 'headystudio', 'headyagent',
    'headydata', 'headyapi'
];

const STATIC_ASSETS = [
    ...VERTICALS.map(v => `/verticals/${v}.html`),
    ...VERTICALS.map(v => `/manifests/${v}.json`),
];

// Install — cache all vertical pages
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then(async (cache) => {
            console.log('🔧 Heady SW: Caching all verticals');
            // Cache each asset individually to avoid partial failure
            for (const url of STATIC_ASSETS) {
                try { await cache.add(url); } catch { /* some may not exist yet */ }
            }
        })
    );
    self.skipWaiting();
});

// Activate — clean old caches, claim all clients
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((names) =>
            Promise.all(names.filter(n => n !== CACHE_VERSION).map(n => caches.delete(n)))
        )
    );
    self.clients.claim();
});

// Fetch — stale-while-revalidate for pages, network-first for API
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip auth API (sensitive)
    if (url.pathname.startsWith('/api/auth/')) return;

    // API calls: network-first with cache fallback
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_VERSION).then(c => c.put(event.request, clone));
                    }
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Pages & assets: stale-while-revalidate (fast + fresh)
    event.respondWith(
        caches.match(event.request).then((cached) => {
            const fetchPromise = fetch(event.request).then((response) => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_VERSION).then(c => c.put(event.request, clone));
                }
                return response;
            }).catch(() => cached);

            return cached || fetchPromise;
        })
    );
});

// Background sync for auth state
self.addEventListener('sync', (event) => {
    if (event.tag === 'heady-auth-sync') {
        event.waitUntil(syncAuthState());
    }
});

// Push notifications (future)
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : { title: 'Heady', body: 'New update available' };
    event.waitUntil(
        self.registration.showNotification(data.title || 'Heady', {
            body: data.body || 'Check your Heady dashboard',
            icon: '/heady-icon-192.png',
            badge: '/heady-icon-192.png',
            vibrate: [100, 50, 100],
            data: { url: data.url || '/' }
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || '/';
    event.waitUntil(clients.openWindow(url));
});

async function syncAuthState() {
    try {
        const allClients = await self.clients.matchAll();
        for (const client of allClients) {
            client.postMessage({ type: 'AUTH_SYNC_REQUEST' });
        }
    } catch { /* offline, will retry */ }
}
