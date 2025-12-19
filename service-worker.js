const CACHE_NAME = 'cosmo-map-cache-v4';
const DATA_CACHE_NAME = 'cosmo-map-data-cache-v4'; // New cache for data only

const coreUrlsToCache = [
  '/',
  'index.html',
  'style.css',
  'app.js',
  'd3js.org'
];

const dataUrlsToCache = [
  'data/solar_system_data.json', 
  'data/interstellar_data.json', 
  'data/milky_way_data.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    // Cache core assets
    caches.open(CACHE_NAME).then(cache => cache.addAll(coreUrlsToCache)).then(() =>
    // Cache initial data files
    caches.open(DATA_CACHE_NAME).then(cache => cache.addAll(dataUrlsToCache))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
    event.waitUntil(self.clients.claim());
});

// Cache-first strategy for core assets, Network-first (with fallback to cache) for data
self.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);

    if (dataUrlsToCache.includes(requestUrl.pathname)) {
        // Data file requests: Try network first, then cache
        event.respondWith(
            fetch(event.request)
                .then(networkResponse => {
                    // Update cache with fresh network data
                    return caches.open(DATA_CACHE_NAME).then(cache => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                })
                .catch(() => {
                    // If network fails, try fetching from the data cache
                    return caches.match(event.request) || caches.match('index.html'); // Fallback to index if nothing else works
                })
        );
    } else {
        // Core assets: Cache first
        event.respondWith(
            caches.match(event.request).then(response => response || fetch(event.request))
        );
    }
});

// Handle the periodic background sync event
self.addEventListener('periodicsync', event => {
  if (event.tag === 'update-cosmic-data') {
    console.log('Periodic background sync triggered: update-cosmic-data');
    event.waitUntil(updateAllDataCaches());
  }
});

// Function to force update all data caches from the network
function updateAllDataCaches() {
    return caches.open(DATA_CACHE_NAME).then(cache => {
        return Promise.all(
            dataUrlsToCache.map(url => {
                return fetch(url).then(networkResponse => {
                    return cache.put(url, networkResponse);
                }).catch(err => console.error(`Failed to update cache for ${url}`, err));
            })
        ).then(() => {
            console.log('All data caches updated.');
        });
    });
}