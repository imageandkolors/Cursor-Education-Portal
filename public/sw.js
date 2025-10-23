const CACHE_NAME = 'smartedu360-v1'
const urlsToCache = [
  '/',
  '/login',
  '/dashboard',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
]

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache)
      })
  )
})

// Fetch event
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request)
      })
  )
})

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
})

// Background sync for offline data
self.addEventListener('sync', (event) => {
  if (event.tag === 'license-sync') {
    event.waitUntil(syncLicenseData())
  }
})

async function syncLicenseData() {
  try {
    // Get cached license data
    const cache = await caches.open(CACHE_NAME)
    const response = await cache.match('/api/license/sync')
    
    if (response) {
      // Try to sync with server
      const result = await fetch('/api/license/sync', {
        method: 'POST',
        body: await response.text(),
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (result.ok) {
        // Remove from cache if sync successful
        await cache.delete('/api/license/sync')
      }
    }
  } catch (error) {
    console.error('Background sync failed:', error)
  }
}