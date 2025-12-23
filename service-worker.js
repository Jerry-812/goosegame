const CACHE_NAME = 'goosegame-v5'

const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './main.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './images/pot.svg',
  './images/doll_classic.svg',
  './images/doll_princess.svg',
  './images/doll_doctor.svg',
  './images/doll_astronaut.svg',
  './images/doll_model.svg',
  './images/doll_rockstar.svg',
  './images/doll_chef.svg',
  './images/doll_dancer.svg',
  './images/doll_diver.svg',
  './images/doll_fairy.svg'
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
