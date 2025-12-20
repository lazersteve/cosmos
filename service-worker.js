const CACHE_NAME = 'cosmo-map-cache-v4';
const DATA_CACHE_NAME = 'cosmo-map-data-cache-v4';

const coreUrlsToCache = [
  '/',
  'index.html',
  'style.css',
  'app.js',
  'lib/d3.v7.min.js' // Corrected path
];

const dataUrlsToCache = [
  'data/solar_system_data.json', 
  'data/interstellar_data.json', 
  'data/milky_way_data.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(coreUrlsToCache)).then(() =>
    caches.open(DATA_CACHE_NAME).then(cache => cache.addAll(dataUrlsToCache))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);

    if (dataUrlsToCache.includes(requestUrl.pathname)) {
        event.respondWith(
            fetch(event.request)
                .then(networkResponse => {
                    return caches.open(DATA_CACHE_NAME).then(cache => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                })
                .catch(() => {
                    return caches.match(event.request) || caches.match('index.html');
                })
        );
    } else {
        event.respondWith(
            caches.match(event.request).then(response => response || fetch(event.request))
        );
    }
});

self.addEventListener('periodicsync', event => {
  if (event.tag === 'update-cosmic-data') {
    console.log('Periodic background sync triggered: update-cosmic-data');
    event.waitUntil(updateAllDataCaches());
  }
});

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
