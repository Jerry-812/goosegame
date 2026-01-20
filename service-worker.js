const CACHE_NAME = 'goosegame-v20'

const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './main.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './vendor/three/three.module.js',
  './vendor/three/examples/jsm/postprocessing/EffectComposer.js',
  './vendor/three/examples/jsm/postprocessing/RenderPass.js',
  './vendor/three/examples/jsm/postprocessing/OutlinePass.js',
  './vendor/three/examples/jsm/postprocessing/ShaderPass.js',
  './vendor/three/examples/jsm/postprocessing/Pass.js',
  './vendor/three/examples/jsm/postprocessing/MaskPass.js',
  './vendor/three/examples/jsm/shaders/FXAAShader.js',
  './vendor/three/examples/jsm/shaders/CopyShader.js',
  './vendor/cannon-es/cannon-es.js',
  './images/decor_palette.svg',
  './images/decor_brushes.svg',
  './images/decor_powder.svg',
  './images/item_kitchen_kettle.svg',
  './images/item_kitchen_pan.svg',
  './images/item_kitchen_spatula.svg',
  './images/item_kitchen_mug.svg',
  './images/item_desk_notebook.svg',
  './images/item_desk_ruler.svg',
  './images/item_desk_stapler.svg',
  './images/item_desk_tape.svg',
  './images/item_camp_canteen.svg',
  './images/item_camp_flashlight.svg',
  './images/item_camp_compass.svg',
  './images/item_camp_can.svg'
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
