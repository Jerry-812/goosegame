const CACHE_NAME = 'goosegame-v23'

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
  './assets/goose-catch/cheese.glb',
  './assets/goose-catch/coockie-man.glb',
  './assets/goose-catch/hotdog.glb',
  './assets/goose-catch/ice-cream.glb',
  './assets/goose-catch/pancake-big.glb',
  './assets/goose-catch/sandwich-toast.glb',
  './assets/goose-catch/sandwich.glb',
  './assets/goose-catch/scene.bin',
  './assets/goose-catch/scene.gltf',
  './assets/goose-catch/toast.glb',
  './assets/goose-catch/textures/Food_Pack_Materials_1_10_baseColor.png',
  './assets/goose-catch/textures/Food_Pack_Materials_1_10_normal.png',
  './assets/goose-catch/textures/Foodback_Materials_10_20_baseColor.png',
  './assets/goose-catch/textures/Foodback_Materials_10_20_normal.png',
  './images/decor_brushes.svg',
  './images/decor_palette.svg',
  './images/decor_powder.svg',
  './images/doll_astronaut.svg',
  './images/doll_chef.svg',
  './images/doll_classic.svg',
  './images/doll_dancer.svg',
  './images/doll_diver.svg',
  './images/doll_doctor.svg',
  './images/doll_fairy.svg',
  './images/doll_model.svg',
  './images/doll_princess.svg',
  './images/doll_rockstar.svg',
  './images/item_camp_can.svg',
  './images/item_camp_canteen.svg',
  './images/item_camp_compass.svg',
  './images/item_camp_flashlight.svg',
  './images/item_desk_notebook.svg',
  './images/item_desk_ruler.svg',
  './images/item_desk_stapler.svg',
  './images/item_desk_tape.svg',
  './images/item_food_cheese.svg',
  './images/item_food_cookie.svg',
  './images/item_food_hotdog.svg',
  './images/item_food_icecream.svg',
  './images/item_food_pancake.svg',
  './images/item_food_sandwich.svg',
  './images/item_food_toast.svg',
  './images/item_kitchen_kettle.svg',
  './images/item_kitchen_mug.svg',
  './images/item_kitchen_pan.svg',
  './images/item_kitchen_spatula.svg',
  './images/item_plant_pot.svg',
  './images/item_snack_donut.svg',
  './images/item_tech_camera.svg',
  './images/item_toy_duck.svg',
  './images/pot.svg'
]

const NETWORK_FIRST_DESTS = new Set(['document', 'script', 'style', 'manifest'])

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: true })
  if (cached) return cached
  const res = await fetch(request)
  const url = new URL(request.url)
  if (url.origin === self.location.origin && res.ok) {
    const cache = await caches.open(CACHE_NAME)
    cache.put(request, res.clone())
  }
  return res
}

async function networkFirst(request) {
  try {
    const res = await fetch(request)
    const url = new URL(request.url)
    if (url.origin === self.location.origin && res.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, res.clone())
    }
    return res
  } catch (err) {
    const cached = await caches.match(request, { ignoreSearch: true })
    if (cached) return cached
    if (request.mode === 'navigate') {
      const fallback = await caches.match('./index.html')
      if (fallback) return fallback
    }
    throw err
  }
}

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

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    (async () => {
      if (request.mode === 'navigate' || NETWORK_FIRST_DESTS.has(request.destination)) {
        return networkFirst(request)
      }
      return cacheFirst(request)
    })()
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
