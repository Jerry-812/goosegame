const CACHE_NAME = 'goosegame-v3'

const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './main.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './images/pot.png',
  './images/barbie_classic.png',
  './images/barbie_princess.png',
  './images/barbie_doctor.png',
  './images/barbie_astronaut.png',
  './images/barbie_model.png',
  './images/barbie_rockstar.png',
  './images/barbie_chef.png',
  './images/barbie_dancer.png',
  './images/barbie_diver.png',
  './images/barbie_fairy.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      await cache.addAll(CORE_ASSETS)
      self.skipWaiting()
    })()
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))))
      self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  event.respondWith(
    (async () => {
      const cached = await caches.match(request, { ignoreSearch: true })
      if (cached) return cached

      try {
        const res = await fetch(request)
        const url = new URL(request.url)
        if (url.origin === self.location.origin && res.ok) {
          const cache = await caches.open(CACHE_NAME)
          cache.put(request, res.clone())
        }
        return res
      } catch (err) {
        if (request.mode === 'navigate') {
          const fallback = await caches.match('./index.html')
          if (fallback) return fallback
        }
        throw err
      }
    })()
  )
})

