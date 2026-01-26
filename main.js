import * as THREE from './vendor/three/three.module.js'
import * as CANNON from './vendor/cannon-es/cannon-es.js'
import { EffectComposer } from './vendor/three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from './vendor/three/examples/jsm/postprocessing/RenderPass.js'
import { OutlinePass } from './vendor/three/examples/jsm/postprocessing/OutlinePass.js'
import { ShaderPass } from './vendor/three/examples/jsm/postprocessing/ShaderPass.js'
import { FXAAShader } from './vendor/three/examples/jsm/shaders/FXAAShader.js'

const STORAGE = {
  bestScore: 'goosegame.bestScore',
  sound: 'goosegame.sound',
}

const APPROX_ASPECT = 1.1
const ITEM_SCALE = 0.66
const BLOCKED_OVERLAP_RATIO = 0.12
const BLOCKED_DIM_OPACITY = 0.45
const BLOCKED_CHECK_INTERVAL = 220
const COMBO_WINDOW = 1800
const HINT_DURATION = 2400
const FREEZE_DURATION = 6000
const BONUS_STEP = 120

const MODES = {
  easy: { key: 'easy', label: '轻松', seconds: 300, itemsPerType: 12, maxTray: 7, layerMax: 6 },
  normal: { key: 'normal', label: '标准', seconds: 375, itemsPerType: 19, maxTray: 7, layerMax: 7 },
  hard: { key: 'hard', label: '高手', seconds: 375, itemsPerType: 23, maxTray: 6, layerMax: 8 },
}

const DOLL_TYPES = [
  { type: 'kitchen_kettle', label: '茶壶', scale: 1.3 },
  { type: 'kitchen_pan', label: '煎锅', scale: 1.8, aspect: 0.85 },
  { type: 'kitchen_spatula', label: '锅铲', scale: 2.0, aspect: 0.45 },
  { type: 'kitchen_mug', label: '马克杯', scale: 1.15 },
  { type: 'desk_notebook', label: '笔记本', scale: 1.35, aspect: 1.1 },
  { type: 'desk_ruler', label: '尺子', scale: 2.1, aspect: 0.32 },
  { type: 'desk_stapler', label: '订书机', scale: 1.3, aspect: 0.8 },
  { type: 'desk_tape', label: '胶带', scale: 1.2 },
  { type: 'camp_canteen', label: '水壶', scale: 1.3, aspect: 1.1 },
  { type: 'camp_flashlight', label: '手电', scale: 1.7, aspect: 0.45 },
  { type: 'camp_compass', label: '指南针', scale: 1.05 },
  { type: 'camp_can', label: '罐头', scale: 1.15, aspect: 1.0 },
  { type: 'toy_duck', label: '小黄鸭', scale: 1.1, score: 12 },
  { type: 'snack_donut', label: '甜甜圈', scale: 1.05, score: 12 },
  { type: 'tech_camera', label: '相机', scale: 1.3, aspect: 0.9, score: 13 },
  { type: 'plant_pot', label: '盆栽', scale: 1.35, aspect: 1.05, score: 11 },
]

const DOLL_MAP = Object.fromEntries(DOLL_TYPES.map((t) => [t.type, t]))

const TOOL_LABELS = {
  remove: '移出',
  match: '凑齐',
  hint: '提示',
  undo: '撤回',
  freeze: '停时',
  shuffle: '打乱',
}

const BONUS_TOOL_POOL = ['remove', 'remove', 'match', 'hint', 'undo', 'freeze', 'shuffle']

const COLLISION_SPECS = {
  kitchen_kettle: { kind: 'sphere', r: 0.36 },
  kitchen_pan: { kind: 'box', w: 0.98, h: 0.5 },
  kitchen_spatula: { kind: 'box', w: 1.05, h: 0.2 },
  kitchen_mug: { kind: 'sphere', r: 0.33 },
  desk_notebook: { kind: 'box', w: 0.86, h: 0.7 },
  desk_ruler: { kind: 'box', w: 1.1, h: 0.16 },
  desk_stapler: { kind: 'box', w: 0.82, h: 0.48 },
  desk_tape: { kind: 'sphere', r: 0.42 },
  camp_canteen: { kind: 'box', w: 0.78, h: 0.82 },
  camp_flashlight: { kind: 'box', w: 0.96, h: 0.22 },
  camp_compass: { kind: 'sphere', r: 0.34 },
  camp_can: { kind: 'sphere', r: 0.35 },
  toy_duck: { kind: 'box', w: 0.86, h: 0.68 },
  snack_donut: { kind: 'sphere', r: 0.42 },
  tech_camera: { kind: 'box', w: 0.9, h: 0.62 },
  plant_pot: { kind: 'box', w: 0.8, h: 0.86 },
}

function getCollisionSpec(type, w, h) {
  const spec = COLLISION_SPECS[type] || { kind: 'sphere', r: 0.36 }
  if (spec.kind === 'box') {
    const halfX = (w * spec.w) * 0.5
    const halfZ = (h * spec.h) * 0.5
    const radius = Math.hypot(halfX, halfZ)
    return { kind: 'box', halfX, halfZ, radius }
  }
  const radius = Math.min(w, h) * spec.r
  return { kind: 'sphere', radius }
}

const ASSETS = [
  './images/decor_palette.svg',
  './images/decor_brushes.svg',
  './images/decor_powder.svg',
  ...DOLL_TYPES.map((t) => `./images/item_${t.type}.svg`),
]

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function qs(sel) {
  const el = document.querySelector(sel)
  if (!el) throw new Error(`Missing element: ${sel}`)
  return el
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function readInt(value, fallback) {
  const n = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(n) ? n : fallback
}

function formatTime(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

function getDollMeta(type) {
  return DOLL_MAP[type] || DOLL_TYPES[0]
}

function getScoreForType(type) {
  const meta = getDollMeta(type)
  return Number.isFinite(meta.score) ? meta.score : 10
}

function makeSeed() {
  try {
    const buf = new Uint32Array(1)
    crypto.getRandomValues(buf)
    return buf[0] >>> 0
  } catch {
    return Math.floor(Math.random() * 2 ** 32) >>> 0
  }
}

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function parseUrlConfig() {
  const url = new URL(window.location.href)
  const modeKey = url.searchParams.get('mode') || 'easy'
  const seed = readInt(url.searchParams.get('seed'), 0) >>> 0
  return {
    modeKey: MODES[modeKey] ? modeKey : 'easy',
    seed: seed || 0,
  }
}

function setUrlConfig({ modeKey, seed }) {
  const url = new URL(window.location.href)
  url.searchParams.set('mode', modeKey)
  url.searchParams.set('seed', String(seed >>> 0))
  window.history.replaceState({}, '', url)
}

function preloadAssets(urls, onProgress) {
  let done = 0
  const total = urls.length
  onProgress(0, total)
  return Promise.all(
    urls.map(
      (src) =>
        new Promise((resolve) => {
          const img = new Image()
          img.onload = () => {
            done += 1
            onProgress(done, total)
            resolve()
          }
          img.onerror = () => {
            done += 1
            onProgress(done, total)
            resolve()
          }
          img.src = src
        })
    )
  )
}

class Sound {
  constructor(enabled) {
    this.enabled = enabled
    this.ctx = null
  }

  setEnabled(enabled) {
    this.enabled = enabled
  }

  _ctx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)()
    }
    return this.ctx
  }

  _beep({ freq = 440, dur = 0.06, gain = 0.08, type = 'sine' } = {}) {
    if (!this.enabled) return
    try {
      const ctx = this._ctx()
      const t0 = ctx.currentTime
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = type
      osc.frequency.value = freq
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
      osc.connect(g)
      g.connect(ctx.destination)
      osc.start(t0)
      osc.stop(t0 + dur + 0.02)
    } catch {
      // ignore
    }
  }

  click() {
    this._beep({ freq: 640, dur: 0.05, gain: 0.06, type: 'triangle' })
  }

  merge() {
    this._beep({ freq: 880, dur: 0.08, gain: 0.08, type: 'sine' })
    setTimeout(() => this._beep({ freq: 1120, dur: 0.08, gain: 0.06, type: 'sine' }), 60)
  }

  win() {
    this._beep({ freq: 660, dur: 0.08, gain: 0.08, type: 'sine' })
    setTimeout(() => this._beep({ freq: 880, dur: 0.10, gain: 0.09, type: 'sine' }), 90)
    setTimeout(() => this._beep({ freq: 990, dur: 0.12, gain: 0.08, type: 'sine' }), 190)
  }

  lose() {
    this._beep({ freq: 240, dur: 0.12, gain: 0.06, type: 'sawtooth' })
  }
}

const ui = {
  score: qs('#score'),
  best: qs('#best'),
  remain: qs('#remain'),
  scoreMain: qs('#scoreMain'),
  bestMain: qs('#bestMain'),
  remainMain: qs('#remainMain'),
  timer: qs('#timer'),
  timerPill: qs('#timerPill'),
  timerTrack: qs('#timerTrack'),
  timerFill: qs('#timerFill'),
  board: qs('#board'),
  tray: qs('.tray'),
  traySlots: qs('#traySlots'),
  mergeFx: qs('#mergeFx'),
  confetti: qs('#confetti'),

  overlay: qs('#overlay'),
  dialogTitle: qs('#dialogTitle'),
  dialogSub: qs('#dialogSub'),

  pause: qs('#pause'),
  pauseBtn: qs('#pauseBtn'),
  resumeBtn: qs('#resumeBtn'),
  menuBtn: qs('#menuBtn'),

  restartBtn: qs('#restartBtn'),
  againBtn: qs('#againBtn'),
  shareEndBtn: qs('#shareEndBtn'),
  soundBtn: qs('#soundBtn'),

  toolRemove: qs('#toolRemove'),
  toolMatch: qs('#toolMatch'),
  toolHint: qs('#toolHint'),
  toolUndo: qs('#toolUndo'),
  toolFreeze: qs('#toolFreeze'),
  toolShuffle: qs('#toolShuffle'),
  toolRemoveCount: qs('#toolRemoveCount'),
  toolMatchCount: qs('#toolMatchCount'),
  toolHintCount: qs('#toolHintCount'),
  toolUndoCount: qs('#toolUndoCount'),
  toolFreezeCount: qs('#toolFreezeCount'),
  toolShuffleCount: qs('#toolShuffleCount'),

  help: qs('#help'),
  closeHelpBtn: qs('#closeHelpBtn'),
  copySeedBtn: qs('#copySeedBtn'),
  modeDesc: qs('#modeDesc'),

  toast: qs('#toast'),

  loading: qs('#loading'),
  loadingText: qs('#loadingText'),
  loadingFill: qs('#loadingFill'),

  comboChip: qs('#comboChip'),
  comboValue: qs('#comboValue'),
  comboBar: qs('#comboBar'),
}

const state = {
  rng: Math.random,
  seed: 0,
  nextId: 1,
  modeKey: 'easy',
  config: MODES.easy,

  score: 0,
  bestScore: 0,
  timer: 0,
  dolls: [],
  selected: [],
  totalItems: 0,
  pool: [],
  maxVisible: 0,
  containerRadius: 0,
  spawnRadius: 0,

  running: false,
  busy: false,
  pausedByHelp: false,
  initialized: false,

  interval: null,
  sound: null,
  lastMergeAt: 0,
  mergeCombo: 0,
  lastBlockUpdate: 0,
  comboTimer: null,
  hint: null,
  hoverTarget: null,
  freezeUntil: 0,
  bonusAt: BONUS_STEP,
  reloadAfterGame: false,
  tools: {
    remove: 2,
    match: 2,
    hint: 3,
    undo: 2,
    freeze: 2,
    shuffle: 1,
  },
}

const three = {
  ready: false,
  renderer: null,
  composer: null,
  scene: null,
  camera: null,
  raycaster: new THREE.Raycaster(),
  pointer: new THREE.Vector2(),
  itemsGroup: null,
  outlinePass: null,
  fxaaPass: null,
  meshes: new Map(),
  width: 1,
  height: 1,
  lastTime: 0,
  cameraDistance: 0,
  bowlGroup: null,
  bowlParts: [],
}

const input = {
  dragging: false,
  dragDistance: 0,
  lastBoard: null,
  lastPushAt: 0,
}

const physics = {
  world: null,
  itemMat: null,
  wallMat: null,
  bodies: new Map(),
  walls: [],
  accumulator: 0,
  ready: false,
}

function toast(msg) {
  ui.toast.textContent = msg
  ui.toast.hidden = false
  window.clearTimeout(toast._t)
  toast._t = window.setTimeout(() => (ui.toast.hidden = true), 1800)
}

function setOverlay(visible, title = '', sub = '') {
  ui.overlay.hidden = !visible
  ui.dialogTitle.textContent = title
  ui.dialogSub.textContent = sub
}

function setHelp(visible) {
  ui.help.hidden = !visible
}

function setPause(visible) {
  ui.pause.hidden = !visible
  if (visible) setOutlineTarget(null)
}

function pauseGame(message = '') {
  if (!state.running || state.busy) return
  state.running = false
  stopTimer()
  setPause(true)
  clearHint()
  setFreezeUI(false)
  if (message) toast(message)
}

function initThree() {
  if (three.ready) return
  const canvas = qs('#scene')
  let renderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  } catch (err) {
    setOverlay(true, '无法启动 3D 渲染', '当前浏览器不支持 WebGL 或被禁用')
    return
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.98
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 4000)
  const envMap = makeEnvTexture()
  if (envMap) scene.environment = envMap
  const ambient = new THREE.AmbientLight(0xffffff, 0.8)
  const hemi = new THREE.HemisphereLight(0xffffff, 0xffe8ef, 0.4)
  const dir = new THREE.DirectionalLight(0xffffff, 0.7)
  dir.position.set(120, 380, 160)
  const fill = new THREE.DirectionalLight(0xffe5ee, 0.35)
  fill.position.set(-140, 260, -120)
  dir.castShadow = true
  dir.shadow.mapSize.set(1024, 1024)
  dir.shadow.camera.near = 10
  dir.shadow.camera.far = 1000

  scene.add(ambient, hemi, dir, fill)

  const itemsGroup = new THREE.Group()
  scene.add(itemsGroup)
  const bowlGroup = new THREE.Group()
  scene.add(bowlGroup)

  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const outlinePass = new OutlinePass(new THREE.Vector2(1, 1), scene, camera)
  outlinePass.visibleEdgeColor.set('#ffd400')
  outlinePass.hiddenEdgeColor.set('#ffd400')
  outlinePass.edgeStrength = 4.6
  outlinePass.edgeGlow = 0.6
  outlinePass.edgeThickness = 2.2
  composer.addPass(outlinePass)

  const fxaaPass = new ShaderPass(FXAAShader)
  composer.addPass(fxaaPass)

  three.renderer = renderer
  three.composer = composer
  three.scene = scene
  three.camera = camera
  three.itemsGroup = itemsGroup
  three.bowlGroup = bowlGroup
  if (envMap) {
    for (const mat of Object.values(MATERIALS)) {
      mat.envMap = envMap
      mat.envMapIntensity = 0.55
      mat.needsUpdate = true
    }
  }
  three.outlinePass = outlinePass
  three.fxaaPass = fxaaPass
  three.ready = true

  resizeThree()
  animateThree()
}

function initPhysics() {
  if (physics.ready) return
  const world = new CANNON.World()
  world.gravity.set(0, 0, 0)
  world.allowSleep = true
  world.solver.iterations = 12
  world.solver.tolerance = 0.001
  world.broadphase = new CANNON.SAPBroadphase(world)

  const itemMat = new CANNON.Material('item')
  const wallMat = new CANNON.Material('wall')
  world.addContactMaterial(
    new CANNON.ContactMaterial(itemMat, itemMat, {
      friction: 0.8,
      restitution: 0.0,
      contactEquationStiffness: 1e7,
      contactEquationRelaxation: 4,
      frictionEquationStiffness: 1e7,
      frictionEquationRelaxation: 4,
    })
  )
  world.addContactMaterial(
    new CANNON.ContactMaterial(itemMat, wallMat, {
      friction: 0.85,
      restitution: 0.0,
      contactEquationStiffness: 1e7,
      contactEquationRelaxation: 4,
      frictionEquationStiffness: 1e7,
      frictionEquationRelaxation: 4,
    })
  )

  physics.world = world
  physics.itemMat = itemMat
  physics.wallMat = wallMat
  physics.ready = true
}

function removePhysicsWalls() {
  if (!physics.ready) return
  for (const body of physics.walls) {
    physics.world.removeBody(body)
  }
  physics.walls = []
}

function buildBowlPhysics() {
  if (!physics.ready) return
  removePhysicsWalls()
  const { width, height } = measureBoard()
  const { centerY, radius } = getBowlMetrics(width, height)
  const worldCenter = new CANNON.Vec3(0, 0, centerY - height / 2)

  const segments = 32
  const wallThickness = 14
  const wallHeight = Math.max(80, radius * 0.35)
  const circumference = Math.PI * 2 * radius
  const segmentLength = circumference / segments
  const ringRadius = radius - wallThickness * 0.5

  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2
    const x = Math.cos(angle) * ringRadius
    const z = Math.sin(angle) * ringRadius + worldCenter.z
    const shape = new CANNON.Box(new CANNON.Vec3(segmentLength * 0.5, wallHeight * 0.5, wallThickness * 0.5))
    const body = new CANNON.Body({ mass: 0, material: physics.wallMat })
    body.addShape(shape)
    body.position.set(x, 0, z)
    body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle + Math.PI / 2)
    physics.world.addBody(body)
    physics.walls.push(body)
  }
}

function createPhysicsBody(doll) {
  const { width, height } = measureBoard()
  const startX = Number.isFinite(doll.x) ? doll.x : doll.tx
  const startY = Number.isFinite(doll.y) ? doll.y : doll.ty
  const worldX = startX + doll.w / 2 - width / 2
  const worldZ = startY + doll.h / 2 - height / 2
  const spec = getCollisionSpec(doll.type, doll.w, doll.h)
  const physRadius = Math.max(10, spec.radius)
  doll.physRadius = physRadius
  const thickness = Math.max(6, Math.min(doll.w, doll.h) * 0.2)
  const halfY = thickness * 0.5
  let shape
  if (spec.kind === 'box') {
    shape = new CANNON.Box(new CANNON.Vec3(spec.halfX, halfY, spec.halfZ))
  } else {
    shape = new CANNON.Sphere(physRadius)
  }
  const body = new CANNON.Body({ mass: 1, material: physics.itemMat })
  body.addShape(shape)
  body.position.set(worldX, 0, worldZ)
  body.linearDamping = 0.85
  body.angularDamping = 0.9
  body.linearFactor.set(1, 0, 1)
  body.angularFactor.set(0, 0, 0)
  body.fixedRotation = true
  body.updateMassProperties()
  body.sleepSpeedLimit = 0.12
  body.sleepTimeLimit = 0.2
  physics.world.addBody(body)
  return body
}

function syncBodies() {
  if (!physics.ready) return
  const keep = new Set()
  for (const doll of state.dolls) {
    keep.add(doll.id)
    if (!physics.bodies.has(doll.id)) {
      const body = createPhysicsBody(doll)
      physics.bodies.set(doll.id, body)
      doll.body = body
    }
  }
  for (const [id, body] of physics.bodies.entries()) {
    if (keep.has(id)) continue
    physics.world.removeBody(body)
    physics.bodies.delete(id)
  }
}

function rebuildBodies() {
  if (!physics.ready) return
  for (const body of physics.bodies.values()) {
    physics.world.removeBody(body)
  }
  physics.bodies.clear()
  for (const doll of state.dolls) {
    doll.body = null
  }
  syncBodies()
}

function settlePhysics(steps = 6) {
  if (!physics.ready) return
  for (let i = 0; i < steps; i++) {
    physics.world.step(1 / 60)
  }
}

function buildBowl() {
  if (!three.ready || !three.bowlGroup) return
  const { width, height } = measureBoard()
  const { radius, centerY } = getBowlMetrics(width, height)

  for (const part of three.bowlParts) {
    three.bowlGroup.remove(part)
    disposeObject(part)
  }
  three.bowlParts = []

  const wallMat = makeMaterial(0xf7f7f7, 0.38, 0.04)
  const rimMat = makeMaterial(0xffffff, 0.18, 0.08)
  const baseMat = makeMaterial(0xf1f1f1, 0.55, 0.0)
  const innerMat = makeMaterial(0xe6e6ea, 0.65, 0.0)
  const wallHeight = Math.max(52, radius * 0.28)

  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 0.98, wallHeight, 64, 1, true),
    wallMat
  )
  wall.position.set(0, wallHeight * 0.3, centerY - height / 2)
  wall.receiveShadow = true

  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 5, 16, 64), rimMat)
  rim.rotation.x = Math.PI / 2
  rim.position.set(0, wallHeight * 0.6, centerY - height / 2)
  rim.receiveShadow = true

  const base = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.975, 64), baseMat)
  base.rotation.x = -Math.PI / 2
  base.position.set(0, 0, centerY - height / 2)
  base.receiveShadow = true

  const innerWall = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.96, radius * 0.94, wallHeight * 0.85, 64, 1, true),
    innerMat
  )
  innerWall.position.set(0, wallHeight * 0.28, centerY - height / 2)
  innerWall.receiveShadow = true

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.9, 64),
    new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0.08 })
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.set(0, 1, centerY - height / 2)

  const gooseMat = makeMaterial(0xf7f7f7, 0.25, 0.1)
  const beakMat = makeMaterial(0xf2b740, 0.35, 0.08)
  const goose = new THREE.Group()
  const body = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.08, 20, 14), gooseMat)
  body.scale.set(1.2, 0.85, 1.1)
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.02, radius * 0.03, radius * 0.12, 12),
    gooseMat
  )
  neck.position.set(radius * 0.08, radius * 0.08, 0)
  neck.rotation.z = -0.4
  const head = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.04, 16, 12), gooseMat)
  head.position.set(radius * 0.14, radius * 0.16, 0)
  const beak = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.02, radius * 0.06, 12), beakMat)
  beak.rotation.z = -Math.PI / 2
  beak.position.set(radius * 0.19, radius * 0.16, 0)
  goose.add(body, neck, head, beak)
  goose.position.set(-radius * 0.35, wallHeight * 0.5, centerY - height / 2 - radius * 0.18)
  goose.rotation.y = Math.PI * 0.08
  goose.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true
      child.receiveShadow = true
    }
  })

  three.bowlGroup.add(wall, rim, base, innerWall, shadow, goose)
  three.bowlParts.push(wall, rim, base, innerWall, shadow, goose)
}

function resizeThree() {
  if (!three.ready) return
  const { width, height } = measureBoard()
  three.width = width
  three.height = height
  three.renderer.setSize(width, height, false)
  three.composer.setSize(width, height)
  if (three.outlinePass) {
    three.outlinePass.resolution.set(width, height)
  }
  const fov = (three.camera.fov * Math.PI) / 180
  const dist = (height / 2) / Math.tan(fov / 2)
  if (!three.cameraDistance) three.cameraDistance = dist
  const cameraDist = three.cameraDistance
  three.camera.aspect = width / height
  three.camera.position.set(0, cameraDist, 0.001)
  three.camera.up.set(0, 0, -1)
  three.camera.lookAt(0, 0, 0)
  three.camera.updateProjectionMatrix()
  const { centerY, radius } = getBowlMetrics(width, height)
  ui.board.style.setProperty('--bowl-size', `${radius * 2}px`)
  ui.board.style.setProperty('--bowl-center-y', `${centerY}px`)
  if (three.fxaaPass) {
    three.fxaaPass.material.uniforms.resolution.value.set(1 / width, 1 / height)
  }
  buildBowl()
  buildBowlPhysics()
}

function animateThree() {
  if (!three.ready) return
  const tick = () => {
    if (!physics.ready) initPhysics()
    updateMeshes()
    three.composer.render()
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

function makeMaterial(color, roughness = 0.35, metalness = 0.15) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness })
  mat.userData.shared = true
  return mat
}

function makeGradientTexture(colors) {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const grad = ctx.createLinearGradient(0, 0, 64, 64)
  const step = 1 / (colors.length - 1 || 1)
  colors.forEach((c, i) => grad.addColorStop(i * step, c))
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 64, 64)
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * 64
    const y = Math.random() * 64
    const a = Math.random() * 0.12
    ctx.fillStyle = `rgba(255,255,255,${a})`
    ctx.fillRect(x, y, 1.2, 1.2)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(1.5, 1.5)
  return tex
}

function makeEnvTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height)
  grad.addColorStop(0, '#fff5f7')
  grad.addColorStop(0.5, '#f6d2de')
  grad.addColorStop(1, '#f0a8ba')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const tex = new THREE.CanvasTexture(canvas)
  tex.mapping = THREE.EquirectangularReflectionMapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

const MATERIALS = {
  pink: makeMaterial(0xff7f98, 0.28, 0.2),
  rose: makeMaterial(0xe35b74, 0.3, 0.15),
  peach: makeMaterial(0xffb36f, 0.35, 0.15),
  blue: makeMaterial(0x6aa9ff, 0.25, 0.3),
  teal: makeMaterial(0x5fd6b8, 0.35, 0.15),
  yellow: makeMaterial(0xf2c15e, 0.4, 0.12),
  green: makeMaterial(0x6bc67f, 0.35, 0.15),
  gray: makeMaterial(0xcfd2d8, 0.5, 0.1),
  dark: makeMaterial(0x3d3f47, 0.6, 0.2),
}

function addBase(geometry, material, yOffset = 0) {
  geometry.translate(0, yOffset, 0)
  return new THREE.Mesh(geometry, material)
}

function createItemMesh(doll) {
  const group = new THREE.Group()
  const w = doll.w
  const h = doll.h
  const base = Math.min(w, h)
  const thickness = Math.max(8, base * 0.28)

  const pink = MATERIALS.pink
  const rose = MATERIALS.rose
  const peach = MATERIALS.peach
  const blue = MATERIALS.blue
  const teal = MATERIALS.teal
  const yellow = MATERIALS.yellow
  const green = MATERIALS.green
  const gray = MATERIALS.gray
  const dark = MATERIALS.dark

  switch (doll.type) {
    case 'kitchen_kettle': {
      if (!pink.map) pink.map = makeGradientTexture(['#ffd3dc', '#ff7f98', '#e35b74'])
      const body = addBase(new THREE.SphereGeometry(base * 0.32, 24, 16), pink, base * 0.28)
      body.scale.y = 0.7
      if (!gray.map) gray.map = makeGradientTexture(['#f1f1f1', '#c9c9c9'])
      const lid = addBase(new THREE.CylinderGeometry(base * 0.14, base * 0.16, thickness * 0.25, 18), gray, thickness * 0.6)
      const knob = addBase(new THREE.SphereGeometry(base * 0.08, 16, 12), gray, thickness * 0.82)
      const spout = addBase(new THREE.ConeGeometry(base * 0.12, thickness * 0.5, 18), rose, base * 0.2)
      spout.rotation.z = -0.8
      spout.position.x = base * 0.34
      const handle = addBase(new THREE.TorusGeometry(base * 0.28, base * 0.05, 12, 24), dark, base * 0.3)
      handle.rotation.z = Math.PI / 2
      handle.position.x = -base * 0.3
      group.add(body, lid, knob, spout, handle)
      break
    }
    case 'kitchen_pan': {
      if (!dark.map) dark.map = makeGradientTexture(['#444854', '#2a2e35'])
      const pan = addBase(new THREE.CylinderGeometry(base * 0.42, base * 0.46, thickness * 0.3, 24), dark, thickness * 0.2)
      const inner = addBase(new THREE.CylinderGeometry(base * 0.36, base * 0.4, thickness * 0.15, 24), gray, thickness * 0.25)
      const handle = addBase(new THREE.BoxGeometry(base * 0.7, thickness * 0.16, base * 0.18), gray, thickness * 0.14)
      handle.position.x = base * 0.65
      group.add(pan, inner, handle)
      break
    }
    case 'kitchen_spatula': {
      if (!rose.map) rose.map = makeGradientTexture(['#ff93a8', '#e35b74'])
      const handle = addBase(new THREE.BoxGeometry(w * 0.7, thickness * 0.18, h * 0.18), rose, thickness * 0.12)
      const head = addBase(new THREE.BoxGeometry(w * 0.24, thickness * 0.2, h * 0.45), gray, thickness * 0.12)
      head.position.x = w * 0.32
      group.add(handle, head)
      break
    }
    case 'kitchen_mug': {
      if (!blue.map) blue.map = makeGradientTexture(['#8ec3ff', '#6aa9ff', '#4d7cc2'])
      const body = addBase(new THREE.CylinderGeometry(base * 0.32, base * 0.35, thickness * 0.7, 24), blue, thickness * 0.35)
      const inner = addBase(new THREE.CylinderGeometry(base * 0.26, base * 0.28, thickness * 0.55, 24), gray, thickness * 0.38)
      const handle = addBase(new THREE.TorusGeometry(base * 0.22, base * 0.06, 12, 20), teal, thickness * 0.35)
      handle.rotation.z = Math.PI / 2
      handle.position.x = base * 0.34
      group.add(body, inner, handle)
      break
    }
    case 'desk_notebook': {
      if (!yellow.map) yellow.map = makeGradientTexture(['#ffe7a6', '#f2c15e'])
      const cover = addBase(new THREE.BoxGeometry(w * 0.8, thickness * 0.25, h * 0.9), yellow, thickness * 0.12)
      const spine = addBase(new THREE.BoxGeometry(w * 0.1, thickness * 0.32, h * 0.9), peach, thickness * 0.16)
      spine.position.x = -w * 0.35
      group.add(cover, spine)
      break
    }
    case 'desk_ruler': {
      if (!yellow.map) yellow.map = makeGradientTexture(['#ffe7a6', '#f2c15e'])
      const rule = addBase(new THREE.BoxGeometry(w * 0.95, thickness * 0.2, h * 0.22), yellow, thickness * 0.1)
      group.add(rule)
      break
    }
    case 'desk_stapler': {
      if (!blue.map) blue.map = makeGradientTexture(['#8ec3ff', '#6aa9ff', '#4d7cc2'])
      const top = addBase(new THREE.BoxGeometry(w * 0.75, thickness * 0.25, h * 0.5), blue, thickness * 0.16)
      top.position.y += thickness * 0.08
      const basePart = addBase(new THREE.BoxGeometry(w * 0.8, thickness * 0.18, h * 0.6), gray, thickness * 0.08)
      group.add(top, basePart)
      break
    }
    case 'desk_tape': {
      if (!teal.map) teal.map = makeGradientTexture(['#b7f3df', '#5fd6b8'])
      const ring = addBase(new THREE.TorusGeometry(base * 0.36, base * 0.12, 16, 32), teal, thickness * 0.2)
      ring.rotation.x = Math.PI / 2
      const core = addBase(new THREE.CylinderGeometry(base * 0.18, base * 0.18, thickness * 0.25, 18), gray, thickness * 0.2)
      group.add(ring, core)
      break
    }
    case 'camp_canteen': {
      if (!teal.map) teal.map = makeGradientTexture(['#7fd7a6', '#3aa368'])
      const body = addBase(new THREE.CylinderGeometry(base * 0.34, base * 0.36, thickness * 0.8, 24), teal, thickness * 0.4)
      const cap = addBase(new THREE.CylinderGeometry(base * 0.14, base * 0.16, thickness * 0.25, 18), gray, thickness * 0.8)
      cap.position.x = -base * 0.2
      group.add(body, cap)
      break
    }
    case 'camp_flashlight': {
      if (!peach.map) peach.map = makeGradientTexture(['#ffd2a8', '#f07b3a'])
      const tube = addBase(new THREE.CylinderGeometry(base * 0.18, base * 0.2, w * 0.7, 20), peach, w * 0.35)
      tube.rotation.z = Math.PI / 2
      const head = addBase(new THREE.CylinderGeometry(base * 0.26, base * 0.26, w * 0.2, 20), gray, w * 0.35)
      head.position.x = w * 0.35
      group.add(tube, head)
      break
    }
    case 'camp_compass': {
      if (!gray.map) gray.map = makeGradientTexture(['#f7f7f7', '#d2d6dc'])
      const body = addBase(new THREE.CylinderGeometry(base * 0.38, base * 0.4, thickness * 0.35, 24), gray, thickness * 0.18)
      const face = addBase(new THREE.CylinderGeometry(base * 0.3, base * 0.3, thickness * 0.12, 20), peach, thickness * 0.24)
      const needle = addBase(new THREE.ConeGeometry(base * 0.1, thickness * 0.3, 14), rose, thickness * 0.25)
      needle.rotation.z = Math.PI / 2
      group.add(body, face, needle)
      break
    }
    case 'camp_can': {
      if (!blue.map) blue.map = makeGradientTexture(['#a9c2ff', '#5576db'])
      const body = addBase(new THREE.CylinderGeometry(base * 0.32, base * 0.32, thickness * 0.8, 24), blue, thickness * 0.4)
      const label = addBase(new THREE.CylinderGeometry(base * 0.34, base * 0.34, thickness * 0.25, 24), yellow, thickness * 0.4)
      group.add(body, label)
      break
    }
    case 'toy_duck': {
      if (!yellow.map) yellow.map = makeGradientTexture(['#ffe7a6', '#f2c15e'])
      if (!peach.map) peach.map = makeGradientTexture(['#ffd2a8', '#f07b3a'])
      const body = addBase(new THREE.SphereGeometry(base * 0.34, 24, 16), yellow, base * 0.18)
      body.scale.y = 0.7
      const head = addBase(new THREE.SphereGeometry(base * 0.18, 20, 14), yellow, base * 0.34)
      head.position.x = base * 0.32
      const beak = addBase(new THREE.ConeGeometry(base * 0.08, base * 0.18, 14), peach, base * 0.34)
      beak.rotation.z = -Math.PI / 2
      beak.position.x = base * 0.5
      const wing = addBase(new THREE.SphereGeometry(base * 0.18, 18, 12), peach, base * 0.22)
      wing.scale.z = 0.5
      wing.position.set(-base * 0.06, base * 0.05, base * 0.08)
      group.add(body, head, beak, wing)
      break
    }
    case 'snack_donut': {
      if (!rose.map) rose.map = makeGradientTexture(['#ff93a8', '#e35b74'])
      if (!peach.map) peach.map = makeGradientTexture(['#ffd2a8', '#f07b3a'])
      const ring = addBase(new THREE.TorusGeometry(base * 0.36, base * 0.14, 18, 32), peach, thickness * 0.2)
      ring.rotation.x = Math.PI / 2
      const icing = addBase(new THREE.TorusGeometry(base * 0.34, base * 0.12, 18, 28), rose, thickness * 0.22)
      icing.rotation.x = Math.PI / 2
      icing.position.y += thickness * 0.06
      group.add(ring, icing)
      break
    }
    case 'tech_camera': {
      if (!blue.map) blue.map = makeGradientTexture(['#8ec3ff', '#6aa9ff', '#4d7cc2'])
      if (!gray.map) gray.map = makeGradientTexture(['#f2f2f2', '#c9c9c9'])
      const body = addBase(new THREE.BoxGeometry(w * 0.7, thickness * 0.3, h * 0.5), dark, thickness * 0.15)
      const lens = addBase(new THREE.CylinderGeometry(base * 0.18, base * 0.18, thickness * 0.28, 20), gray, thickness * 0.16)
      lens.position.x = w * 0.16
      const lensGlass = addBase(new THREE.CylinderGeometry(base * 0.12, base * 0.12, thickness * 0.12, 18), blue, thickness * 0.18)
      lensGlass.position.x = w * 0.16
      const flash = addBase(new THREE.BoxGeometry(w * 0.18, thickness * 0.12, h * 0.18), gray, thickness * 0.26)
      flash.position.set(-w * 0.18, thickness * 0.12, -h * 0.12)
      group.add(body, lens, lensGlass, flash)
      break
    }
    case 'plant_pot': {
      if (!peach.map) peach.map = makeGradientTexture(['#ffd2a8', '#f07b3a'])
      if (!green.map) green.map = makeGradientTexture(['#a4e4b6', '#4aa96c'])
      const pot = addBase(new THREE.CylinderGeometry(base * 0.32, base * 0.38, thickness * 0.5, 20), peach, thickness * 0.2)
      const rim = addBase(new THREE.CylinderGeometry(base * 0.36, base * 0.36, thickness * 0.12, 20), peach, thickness * 0.45)
      const leaf1 = addBase(new THREE.ConeGeometry(base * 0.16, thickness * 0.5, 12), green, thickness * 0.55)
      leaf1.position.set(-base * 0.12, thickness * 0.2, 0)
      leaf1.rotation.z = 0.3
      const leaf2 = addBase(new THREE.ConeGeometry(base * 0.18, thickness * 0.58, 12), green, thickness * 0.58)
      leaf2.position.set(base * 0.12, thickness * 0.22, 0)
      leaf2.rotation.z = -0.25
      const leaf3 = addBase(new THREE.ConeGeometry(base * 0.14, thickness * 0.46, 12), green, thickness * 0.6)
      leaf3.position.set(0, thickness * 0.22, base * 0.08)
      group.add(pot, rim, leaf1, leaf2, leaf3)
      break
    }
    default: {
      const box = addBase(new THREE.BoxGeometry(w * 0.8, thickness * 0.3, h * 0.8), pink, thickness * 0.15)
      group.add(box)
    }
  }

  group.userData.dollId = doll.id
  group.userData.type = doll.type
  group.traverse((child) => {
    if (!child.isMesh) return
    child.castShadow = true
    if (child.material?.userData?.shared) {
      child.material = child.material.clone()
      child.material.userData.shared = false
    }
    if (child.userData.baseOpacity == null) {
      child.userData.baseOpacity = Number.isFinite(child.material?.opacity) ? child.material.opacity : 1
    }
  })
  return group
}

function disposeObject(obj) {
  obj.traverse((child) => {
    if (child.geometry) child.geometry.dispose()
    if (child.material) {
      const disposeMat = (mat) => {
        if (mat?.userData?.shared) return
        mat?.dispose()
      }
      if (Array.isArray(child.material)) child.material.forEach(disposeMat)
      else disposeMat(child.material)
    }
  })
}

function syncMeshes() {
  if (!three.ready) return
  const toKeep = new Set()
  for (const doll of state.dolls) {
    toKeep.add(doll.id)
    if (!three.meshes.has(doll.id)) {
      const mesh = createItemMesh(doll)
      three.meshes.set(doll.id, mesh)
      three.itemsGroup.add(mesh)
      doll.mesh = mesh
    }
  }
  for (const [id, mesh] of three.meshes.entries()) {
    if (toKeep.has(id)) continue
    three.itemsGroup.remove(mesh)
    disposeObject(mesh)
    three.meshes.delete(id)
  }
}

function rebuildMeshes() {
  if (!three.ready) return
  for (const mesh of three.meshes.values()) {
    three.itemsGroup.remove(mesh)
    disposeObject(mesh)
  }
  three.meshes.clear()
  for (const doll of state.dolls) {
    doll.mesh = null
  }
  syncMeshes()
}

function updateMeshes() {
  if (!three.ready) return
  if (!physics.ready) return
  syncMeshes()
  syncBodies()
  const width = three.width
  const height = three.height
  const now = performance.now()
  const dt = three.lastTime ? Math.min(0.033, (now - three.lastTime) / 1000) : 0.016
  three.lastTime = now
  const { centerY, radius } = getBowlMetrics(width, height)
  const bowlCenterZ = centerY - height / 2
  if (!state.containerRadius) state.containerRadius = radius
  const physicsActive = input.dragging || now - input.lastPushAt < 360

  if (physicsActive) {
    const step = 1 / 60
    physics.accumulator += dt
    while (physics.accumulator >= step) {
      physics.world.step(step)
      physics.accumulator -= step
    }
  } else {
    physics.accumulator = 0
  }

  for (const doll of state.dolls) {
    if (!doll.body) continue
    if (doll.animating) continue
    const body = doll.body
    if (!Number.isFinite(body.position.x) || !Number.isFinite(body.position.z)) {
      const resetX = (Number.isFinite(doll.x) ? doll.x : doll.tx) + doll.w / 2 - width / 2
      const resetZ = (Number.isFinite(doll.y) ? doll.y : doll.ty) + doll.h / 2 - height / 2
      body.position.set(resetX, 0, resetZ)
      body.velocity.set(0, 0, 0)
      body.angularVelocity.set(0, 0, 0)
    }
    body.position.y = 0
    const maxRadius = Math.max(40, state.containerRadius - (doll.physRadius || doll.radius || 0) - 6)
    const dx = body.position.x
    const dz = body.position.z - bowlCenterZ
    const dist = Math.hypot(dx, dz) || 0.0001
    if (dist > maxRadius) {
      const nx = dx / dist
      const nz = dz / dist
      body.position.x = nx * maxRadius
      body.position.z = bowlCenterZ + nz * maxRadius
      body.velocity.set(0, 0, 0)
      body.angularVelocity.set(0, 0, 0)
    }
    if (!physicsActive) {
      body.velocity.set(0, 0, 0)
      body.angularVelocity.set(0, 0, 0)
      body.sleep()
    } else {
      const maxVel = 4
      body.velocity.x = clamp(body.velocity.x, -maxVel, maxVel)
      body.velocity.z = clamp(body.velocity.z, -maxVel, maxVel)
      if (Math.abs(body.velocity.x) < 0.02) body.velocity.x = 0
      if (Math.abs(body.velocity.z) < 0.02) body.velocity.z = 0
      body.angularVelocity.set(0, 0, 0)
    }
  }

  for (const doll of state.dolls) {
    if (!doll.mesh || !doll.body) continue
    if (doll.animating) continue
    const body = doll.body
    const boardX = body.position.x + width / 2 - doll.w / 2
    const boardY = body.position.z + height / 2 - doll.h / 2
    doll.x = boardX
    doll.y = boardY
    const centerX = body.position.x
    const centerZ = body.position.z
    const depth = Number.isFinite(doll.layer) ? doll.layer : 1
    const y = depth * 3
    doll.mesh.position.set(centerX, y, centerZ)
    const tilt = Number.isFinite(doll.tilt) ? doll.tilt : 0
    const yaw = Number.isFinite(doll.visualYaw) ? doll.visualYaw : 0
    doll.mesh.rotation.set(tilt, yaw, 0)
    const hintActive = state.hint && state.hint.id === doll.id && now < state.hint.until
    if (hintActive) {
      const phase = (now - state.hint.startedAt) / 140
      const scale = 1 + Math.sin(phase) * 0.06
      doll.mesh.scale.setScalar(scale)
    } else if (doll.mesh.scale.x !== 1) {
      doll.mesh.scale.setScalar(1)
    }
  }
  if (state.hint && now >= state.hint.until) clearHint()
  updateBlockedStates()
}

function raycastPointer(evt) {
  if (!three.ready) return null
  const rect = three.renderer.domElement.getBoundingClientRect()
  const nx = ((evt.clientX - rect.left) / rect.width) * 2 - 1
  const ny = -((evt.clientY - rect.top) / rect.height) * 2 + 1
  three.pointer.set(nx, ny)
  three.raycaster.setFromCamera(three.pointer, three.camera)
  const hits = three.raycaster.intersectObjects(three.itemsGroup.children, true)
  if (!hits.length) return null
  for (const hit of hits) {
    let obj = hit.object
    while (obj && !obj.userData.dollId) obj = obj.parent
    if (!obj) continue
    const dollId = obj.userData.dollId
    const doll = state.dolls.find((d) => d.id === dollId)
    if (!doll) continue
    if (isDollBlocked(doll)) continue
    return { doll, object: obj }
  }
  return null
}

function screenToWorldOnPlane(clientX, clientY, planeY = 0) {
  if (!three.ready) return null
  const rect = three.renderer.domElement.getBoundingClientRect()
  const nx = ((clientX - rect.left) / rect.width) * 2 - 1
  const ny = -((clientY - rect.top) / rect.height) * 2 + 1
  three.pointer.set(nx, ny)
  three.raycaster.setFromCamera(three.pointer, three.camera)
  const ray = three.raycaster.ray
  if (Math.abs(ray.direction.y) < 1e-4) return null
  const t = (planeY - ray.origin.y) / ray.direction.y
  if (!Number.isFinite(t) || t < 0) return null
  return ray.origin.clone().add(ray.direction.clone().multiplyScalar(t))
}

function worldToBoard(world) {
  return {
    x: world.x + three.width / 2,
    y: world.z + three.height / 2,
  }
}

function pushItemsAt(boardX, boardY, dx, dy) {
  const { radius } = getBowlMetrics(three.width, three.height)
  const range = Math.min(160, radius * 0.5)
  let pushed = false
  for (const doll of state.dolls) {
    if (doll.animating) continue
    const cx = doll.x + doll.w / 2
    const cy = doll.y + doll.h / 2
    const dist = Math.hypot(cx - boardX, cy - boardY)
    if (dist > range) continue
    const falloff = 1 - dist / range
    const body = doll.body
    if (!body) continue
    const impulse = new CANNON.Vec3(dx * 0.0045 * falloff, 0, dy * 0.0045 * falloff)
    body.wakeUp()
    body.applyImpulse(impulse, body.position)
    pushed = true
  }
  if (pushed) input.lastPushAt = performance.now()
}

function getHintMesh() {
  if (!state.hint) return null
  return three.meshes.get(state.hint.id) || null
}

function updateOutlineTargets() {
  if (!three.outlinePass) return
  const targets = []
  const hintMesh = getHintMesh()
  if (hintMesh) targets.push(hintMesh)
  if (state.hoverTarget && state.hoverTarget !== hintMesh) {
    targets.push(state.hoverTarget)
  }
  three.outlinePass.selectedObjects = targets
}

function setOutlineTarget(obj) {
  state.hoverTarget = obj
  updateOutlineTargets()
}

function clearHint() {
  if (!state.hint) return
  state.hint = null
  updateOutlineTargets()
}

function showLoading(visible, text = '') {
  ui.loading.hidden = !visible
  if (text) ui.loadingText.textContent = text
}

function setTimerUI(value) {
  ui.timer.textContent = formatTime(value)
  const danger = value <= 10
  ui.timerPill.classList.toggle('danger', danger)
  ui.timerTrack.classList.toggle('danger', danger)
  const total = Math.max(1, state.config?.seconds || 1)
  const ratio = clamp(value / total, 0, 1)
  ui.timerFill.style.width = `${Math.round(ratio * 100)}%`
}

function setFreezeUI(active) {
  ui.timerPill.classList.toggle('freeze', active)
  ui.timerTrack.classList.toggle('freeze', active)
}

function setScoreUI(value) {
  ui.score.textContent = String(value)
  ui.scoreMain.textContent = String(value)
}

function setBestUI(value) {
  ui.best.textContent = String(value)
  ui.bestMain.textContent = String(value)
}

function setRemainUI(value) {
  ui.remain.textContent = String(value)
  ui.remainMain.textContent = String(value)
}

function getSelectedModeKey() {
  const checked = ui.help.querySelector('input[name="mode"]:checked')
  const modeKey = checked ? checked.value : 'easy'
  return MODES[modeKey] ? modeKey : 'easy'
}

function setMode(modeKey) {
  const key = MODES[modeKey] ? modeKey : 'easy'
  state.modeKey = key
  state.config = MODES[key]
  const radio = ui.help.querySelector(`input[name="mode"][value="${key}"]`)
  if (radio) radio.checked = true

  const total = state.config.itemsPerType * DOLL_TYPES.length
  ui.modeDesc.textContent = `${total} 个物品 · 倒计时 ${formatTime(state.config.seconds)} · ${state.config.maxTray} 格待合成栏 · 局号 ${state.seed}`
}

function initTray(maxTray) {
  ui.traySlots.style.setProperty('--slots', String(maxTray))
  ui.traySlots.innerHTML = ''
  for (let i = 0; i < maxTray; i++) {
    const slot = document.createElement('div')
    slot.className = 'slot'
    slot.dataset.slot = String(i)
    ui.traySlots.appendChild(slot)
  }
}

function renderTray({ popIndex = -1 } = {}) {
  const slots = [...ui.traySlots.querySelectorAll('.slot')]
  slots.forEach((slot, i) => {
    slot.classList.toggle('filled', Boolean(state.selected[i]))
    slot.classList.remove('merge', 'pop')
    slot.innerHTML = ''
    const item = state.selected[i]
    if (item) {
      const img = document.createElement('img')
      img.src = item.image
      img.alt = item.label
      slot.appendChild(img)
    }
  })

  const dangerThreshold = Math.max(1, state.config.maxTray - 1)
  ui.tray.classList.toggle('danger', state.selected.length >= dangerThreshold)

  if (popIndex >= 0 && slots[popIndex]) {
    slots[popIndex].classList.add('pop')
    window.clearTimeout(renderTray._t)
    renderTray._t = window.setTimeout(() => slots[popIndex]?.classList.remove('pop'), 260)
  }
}

function triggerMergeFx() {
  ui.mergeFx.hidden = false
  ui.mergeFx.classList.remove('merge-fx')
  void ui.mergeFx.offsetWidth
  ui.mergeFx.classList.add('merge-fx')
  window.clearTimeout(triggerMergeFx._t)
  triggerMergeFx._t = window.setTimeout(() => (ui.mergeFx.hidden = true), 450)
}

function measureBoard() {
  const rect = ui.board.getBoundingClientRect()
  return { width: rect.width, height: rect.height, left: rect.left, top: rect.top }
}

function getBowlMetrics(width, height) {
  const radius = Math.min(width, height) * 0.44
  const centerX = width * 0.5
  const centerY = height * 0.55
  return { centerX, centerY, radius }
}

function clampPointToCircle(cx, cy, radius, x, y, margin = 0) {
  const dx = x - cx
  const dy = y - cy
  const dist = Math.hypot(dx, dy)
  const maxR = Math.max(0, radius - margin)
  if (dist <= maxR || dist === 0) return { x, y }
  const nx = dx / dist
  const ny = dy / dist
  return { x: cx + nx * maxR, y: cy + ny * maxR }
}

function computeSizes(boardW) {
  const baseMin = clamp(Math.round(boardW * 0.085), 44, 92)
  const baseMax = baseMin * 3
  const sizes = Object.fromEntries(
    DOLL_TYPES.map((t) => {
      const raw = Math.round(clamp(baseMin * t.scale, baseMin, baseMax))
      const scaled = Math.round(raw * ITEM_SCALE)
      return [t.type, Math.max(28, scaled)]
    })
  )
  const values = Object.values(sizes)
  const minSize = Math.min(...values)
  const maxSize = Math.max(...values)
  return { minSize, maxSize, sizes }
}

function randTri01(rng) {
  return (rng() + rng()) / 2
}

function bias01(value01, power) {
  const v = clamp(value01, 0, 1)
  return 1 - Math.pow(1 - v, power)
}

function generateDolls(boardW, boardH, cfg, rng) {
  const { sizes } = computeSizes(boardW)
  const dolls = []
  let id = 1

  for (const t of DOLL_TYPES) {
    for (let i = 0; i < cfg.itemsPerType; i++) {
      const dollId = id++
      const size = sizes[t.type]
      const w = size
      const aspect = t.aspect ?? APPROX_ASPECT
      const h = size * aspect

      const { centerX, centerY, radius } = getBowlMetrics(boardW, boardH)
      const minX = 8
      const maxX = Math.max(minX, boardW - w - 8)
      const minY = 8
      const maxY = Math.max(minY, boardH - h - 96)
      let x = 0
      let y = 0
      let tries = 0
      while (tries < 12) {
        const angle = rng() * Math.PI * 2
        const r = Math.sqrt(rng()) * (radius - Math.max(w, h) * 0.3)
        const rawX = Math.round(centerX + Math.cos(angle) * r - w / 2)
        const rawY = Math.round(centerY + Math.sin(angle) * r - h / 2)
        x = clamp(rawX, minX, maxX)
        y = clamp(rawY, minY, maxY)
        const cx = x + w / 2
        const cy = y + h / 2
        const minDist = w * 0.35
        let ok = true
        for (const other of dolls) {
          const ox = other.baseX + other.w / 2
          const oy = other.baseY + other.h / 2
          if (Math.hypot(cx - ox, cy - oy) < minDist) {
            ok = false
            break
          }
        }
        if (ok) break
        tries += 1
      }

      const layer = Math.floor(rng() * cfg.layerMax) + 1
      const rotate = Math.round((rng() * 2 - 1) * 16)
      const visualYaw = 0
      const tilt = 0
      const floatDelay = Math.round(rng() * 1800)
      const physRadius = Math.max(10, getCollisionSpec(t.type, w, h).radius)

      dolls.push({
        id: dollId,
        type: t.type,
        label: t.label,
        image: `./images/item_${t.type}.svg`,
        size,
        aspect,
        x,
        y,
        baseX: x,
        baseY: y,
        tx: x,
        ty: y,
        w,
        h,
        heightOffset: physRadius,
        radius: physRadius,
        physRadius,
        vx: 0,
        vy: 0,
        spin: 0,
        spinVel: 0,
        noiseSeed: rng() * Math.PI * 2,
        layer,
        z: layer * 1000 + dollId,
        rotate,
        visualYaw,
        tilt,
        floatDelay,
        visible: false,
      })
    }
  }

  // deterministic shuffle
  for (let i = dolls.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[dolls[i], dolls[j]] = [dolls[j], dolls[i]]
  }

  return dolls
}

function createDollFromType(type, rng) {
  const meta = getDollMeta(type)
  const { width } = measureBoard()
  const { sizes } = computeSizes(width)
  const size = sizes[type] || sizes[meta.type] || Math.max(28, Math.round(width * 0.06))
  const aspect = meta.aspect ?? APPROX_ASPECT
  const w = size
  const h = size * aspect
  const physRadius = Math.max(10, getCollisionSpec(type, w, h).radius)
  const layer = Math.floor(rng() * state.config.layerMax) + 1
  const dollId = state.nextId++
  return {
    id: dollId,
    type,
    label: meta.label,
    image: `./images/item_${type}.svg`,
    size,
    aspect,
    x: 0,
    y: 0,
    baseX: 0,
    baseY: 0,
    tx: 0,
    ty: 0,
    w,
    h,
    heightOffset: physRadius,
    radius: physRadius,
    physRadius,
    vx: 0,
    vy: 0,
    spin: 0,
    spinVel: 0,
    noiseSeed: rng() * Math.PI * 2,
    layer,
    z: layer * 1000 + dollId,
    rotate: Math.round((rng() * 2 - 1) * 16),
    visualYaw: 0,
    tilt: 0,
    floatDelay: Math.round(rng() * 1800),
    visible: false,
  }
}

function spawnDollFromType(type) {
  const { width, height } = measureBoard()
  const radius = state.containerRadius || Math.min(width, height) * 0.44
  const doll = createDollFromType(type, state.rng)
  placeDollInRadius(doll, width, height, radius, state.dolls, state.rng)
  state.dolls.push(doll)
  applyBowlCompression()
  syncMeshes()
  syncBodies()
  updateBlockedStates(true)
  setRemainUI(getRemainingCount())
}

function getRemainingCount() {
  return state.dolls.length + state.pool.length
}

function computeMaxVisible(width, height, cfg) {
  const { radius } = getBowlMetrics(width, height)
  const { sizes } = computeSizes(width)
  const avgSize =
    Object.values(sizes).reduce((sum, size) => sum + size, 0) / Math.max(1, DOLL_TYPES.length)
  const area = Math.PI * radius * radius
  const itemArea = avgSize * avgSize * 1.35
  const raw = Math.floor(area / itemArea)
  const total = cfg.itemsPerType * DOLL_TYPES.length
  const desired = Math.floor(raw * 0.6)
  return clamp(desired, Math.min(12, total), Math.min(36, total))
}

function updateSpawnRadius() {
  const { width, height } = measureBoard()
  const { radius } = getBowlMetrics(width, height)
  state.containerRadius = radius
  const remaining = getRemainingCount()
  const ratio = state.totalItems ? remaining / state.totalItems : 1
  const minFactor = 0.3
  const curve = Math.pow(clamp(ratio, 0, 1), 0.78)
  state.spawnRadius = radius * (minFactor + (1 - minFactor) * curve)
}

function placeDollInRadius(doll, width, height, radius, existing, rng) {
  const { centerX, centerY } = getBowlMetrics(width, height)
  const margin = Math.max(6, (doll.physRadius || 0) * 0.6)
  const minX = margin
  const maxX = Math.max(minX, width - doll.w - margin)
  const minY = margin
  const maxY = Math.max(minY, height - doll.h - margin)
  const safeRadius = Math.max(20, radius - (doll.physRadius || 0) - margin)
  let best = null
  let tries = 0
  while (tries < 48) {
    const angle = rng() * Math.PI * 2
    const r = Math.sqrt(rng()) * safeRadius
    const rawX = centerX + Math.cos(angle) * r - doll.w / 2
    const rawY = centerY + Math.sin(angle) * r - doll.h / 2
    let x = clamp(rawX, minX, maxX)
    let y = clamp(rawY, minY, maxY)
    let cx = x + doll.w / 2
    let cy = y + doll.h / 2
    const projected = clampPointToCircle(centerX, centerY, safeRadius, cx, cy, 0)
    cx = projected.x
    cy = projected.y
    x = cx - doll.w / 2
    y = cy - doll.h / 2
    let ok = true
    for (const other of existing) {
      const ox = other.x + other.w / 2
      const oy = other.y + other.h / 2
      const minDist = (doll.physRadius + (other.physRadius || other.radius || 0)) * 1.3
      if (Math.hypot(cx - ox, cy - oy) < minDist) {
        ok = false
        break
      }
    }
    if (ok) {
      best = { x, y }
      break
    }
    tries += 1
  }
  if (!best) {
    const angle = rng() * Math.PI * 2
    const r = Math.sqrt(rng()) * safeRadius
    let x = clamp(centerX + Math.cos(angle) * r - doll.w / 2, minX, maxX)
    let y = clamp(centerY + Math.sin(angle) * r - doll.h / 2, minY, maxY)
    const projected = clampPointToCircle(centerX, centerY, safeRadius, x + doll.w / 2, y + doll.h / 2, 0)
    x = projected.x - doll.w / 2
    y = projected.y - doll.h / 2
    best = { x, y }
  }
  doll.x = best.x
  doll.y = best.y
  doll.baseX = best.x
  doll.baseY = best.y
  doll.tx = best.x
  doll.ty = best.y
  doll.vx = 0
  doll.vy = 0
  if (doll.body) {
    const worldX = best.x + doll.w / 2 - width / 2
    const worldZ = best.y + doll.h / 2 - height / 2
    doll.body.position.set(worldX, 0, worldZ)
    doll.body.velocity.set(0, 0, 0)
    doll.body.angularVelocity.set(0, 0, 0)
    doll.body.sleep()
  }
}

function spawnFromPool(count) {
  const { width, height } = measureBoard()
  const existing = [...state.dolls]
  const radius = Math.min(state.spawnRadius || state.containerRadius, state.containerRadius || 0)
  const spawned = []
  for (let i = 0; i < count && state.pool.length; i++) {
    const doll = state.pool.shift()
    doll.layer = Math.floor(state.rng() * state.config.layerMax) + 1
    doll.visualYaw = 0
    doll.tilt = 0
    placeDollInRadius(doll, width, height, radius, existing, state.rng)
    existing.push(doll)
    spawned.push(doll)
  }
  if (spawned.length) {
    state.dolls.push(...spawned)
  }
}

function replenishBoard() {
  updateSpawnRadius()
  const remaining = getRemainingCount()
  const target = Math.min(state.maxVisible || remaining, remaining)
  const need = target - state.dolls.length
  if (need > 0) spawnFromPool(need)
}

function renderDolls() {
  setRemainUI(getRemainingCount())
  setOutlineTarget(null)
  syncMeshes()
  syncBodies()
  updateBlockedStates(true)
}

function setMeshDimmed(mesh, dimmed) {
  mesh.traverse((child) => {
    if (!child.isMesh || !child.material) return
    const baseOpacity =
      child.userData.baseOpacity ?? (Number.isFinite(child.material.opacity) ? child.material.opacity : 1)
    child.userData.baseOpacity = baseOpacity
    child.material.transparent = dimmed || baseOpacity < 1
    child.material.opacity = dimmed ? baseOpacity * BLOCKED_DIM_OPACITY : baseOpacity
    child.material.needsUpdate = true
  })
}

function getDollRect(doll) {
  const margin = Math.max(6, Math.min(doll.w, doll.h) * 0.12)
  return {
    left: doll.x + margin,
    right: doll.x + doll.w - margin,
    top: doll.y + margin,
    bottom: doll.y + doll.h - margin,
  }
}

function isDollBlocked(doll) {
  if (!doll || doll.animating) return false
  if (!Number.isFinite(doll.x) || !Number.isFinite(doll.y)) return false
  const baseLayer = Number.isFinite(doll.layer) ? doll.layer : 1
  const rect = getDollRect(doll)
  const area = Math.max(1, (rect.right - rect.left) * (rect.bottom - rect.top))
  for (const other of state.dolls) {
    if (other === doll || other.animating) continue
    if (!other.mesh) continue
    const otherLayer = Number.isFinite(other.layer) ? other.layer : 1
    if (otherLayer <= baseLayer) continue
    if (!Number.isFinite(other.x) || !Number.isFinite(other.y)) continue
    const oRect = getDollRect(other)
    const overlapX = Math.max(0, Math.min(rect.right, oRect.right) - Math.max(rect.left, oRect.left))
    const overlapY = Math.max(0, Math.min(rect.bottom, oRect.bottom) - Math.max(rect.top, oRect.top))
    if (overlapX <= 0 || overlapY <= 0) continue
    const overlapArea = overlapX * overlapY
    const oArea = Math.max(1, (oRect.right - oRect.left) * (oRect.bottom - oRect.top))
    const minArea = Math.min(area, oArea)
    if (overlapArea >= minArea * BLOCKED_OVERLAP_RATIO) return true
  }
  return false
}

function updateBlockedStates(force = false) {
  if (!state.dolls.length) return
  const now = performance.now()
  if (!force && now - state.lastBlockUpdate < BLOCKED_CHECK_INTERVAL) return
  state.lastBlockUpdate = now
  for (const doll of state.dolls) {
    const blocked = isDollBlocked(doll)
    if (doll.blocked === blocked) continue
    doll.blocked = blocked
    if (doll.mesh) setMeshDimmed(doll.mesh, blocked)
  }
}

function applyBowlCompression() {
  updateSpawnRadius()
}

function startTimer() {
  stopTimer()
  state.interval = window.setInterval(() => {
    if (!state.running) return
    const now = Date.now()
    const freezeActive = now < state.freezeUntil
    setFreezeUI(freezeActive)
    if (freezeActive) return
    state.timer -= 1
    if (state.timer <= 0) {
      state.timer = 0
      setTimerUI(state.timer)
      state.sound.lose()
      endGame('时间到！', '再试一次吧～')
      return
    }
    setTimerUI(state.timer)
  }, 1000)
}

function stopTimer() {
  if (state.interval) window.clearInterval(state.interval)
  state.interval = null
}

function showFloatScore(text) {
  const el = document.createElement('div')
  el.className = 'float-score'
  el.textContent = text
  ui.board.appendChild(el)
  window.setTimeout(() => el.remove(), 950)
}

function triggerComboUI() {
  if (state.mergeCombo < 2) {
    ui.comboChip.hidden = true
    return
  }
  ui.comboValue.textContent = `x${state.mergeCombo}`
  ui.comboChip.hidden = false
  ui.comboBar.style.animation = 'none'
  void ui.comboBar.offsetWidth
  ui.comboBar.style.animation = `combo-drain ${COMBO_WINDOW}ms linear forwards`
  window.clearTimeout(state.comboTimer)
  state.comboTimer = window.setTimeout(() => {
    ui.comboChip.hidden = true
  }, COMBO_WINDOW + 80)
}

function findHintCandidate() {
  const available = state.dolls.filter((d) => !d.animating && !isDollBlocked(d))
  if (!available.length) return null
  const counts = Object.create(null)
  for (const item of state.selected) counts[item.type] = (counts[item.type] || 0) + 1
  const scored = available.map((d) => {
    const count = counts[d.type] || 0
    const layer = Number.isFinite(d.layer) ? d.layer : 0
    return { doll: d, score: count * 100 + layer }
  })
  scored.sort((a, b) => b.score - a.score)
  if (state.hint && scored[0] && scored[0].doll.id === state.hint.id && scored[1]) {
    return scored[1].doll
  }
  return scored[0]?.doll || null
}

function activateHint(doll) {
  if (!doll) return
  const now = performance.now()
  state.hint = {
    id: doll.id,
    startedAt: now,
    until: now + HINT_DURATION,
  }
  updateOutlineTargets()
  window.clearTimeout(activateHint._t)
  activateHint._t = window.setTimeout(() => {
    if (state.hint && state.hint.id === doll.id) clearHint()
  }, HINT_DURATION + 60)
}

function awardBonusTool() {
  const key = BONUS_TOOL_POOL[Math.floor(state.rng() * BONUS_TOOL_POOL.length)]
  state.tools[key] += 1
  setToolUI()
  const label = TOOL_LABELS[key] || key
  toast(`奖励道具 +1：${label}`)
}

function maybeAwardBonus() {
  while (state.score >= state.bonusAt) {
    awardBonusTool()
    state.bonusAt += BONUS_STEP
  }
}

function setSoundUI() {
  const on = state.sound.enabled
  ui.soundBtn.querySelector('.icon').textContent = on ? 'ON' : 'OFF'
  ui.soundBtn.setAttribute('aria-label', on ? '关闭声音' : '开启声音')
}

function setToolUI() {
  const { remove, match, hint, undo, freeze, shuffle } = state.tools
  ui.toolRemoveCount.textContent = String(remove)
  ui.toolMatchCount.textContent = String(match)
  ui.toolHintCount.textContent = String(hint)
  ui.toolUndoCount.textContent = String(undo)
  ui.toolFreezeCount.textContent = String(freeze)
  ui.toolShuffleCount.textContent = String(shuffle)
  ui.toolRemove.disabled = remove <= 0
  ui.toolMatch.disabled = match <= 0
  ui.toolHint.disabled = hint <= 0
  ui.toolUndo.disabled = undo <= 0
  ui.toolFreeze.disabled = freeze <= 0
  ui.toolShuffle.disabled = shuffle <= 0
}

function endGame(title, sub) {
  const total = state.totalItems || getRemainingCount() || 1
  const done = total ? total - getRemainingCount() : 0
  const pct = total ? Math.round((done / total) * 100) : 0
  const progress = `完成度：${pct}%`
  const detail = sub ? `${sub} · ${progress}` : progress
  state.running = false
  state.busy = false
  stopTimer()
  setOutlineTarget(null)
  clearHint()
  ui.comboChip.hidden = true
  setFreezeUI(false)
  setPause(false)
  setOverlay(true, title, detail)
}

function canPlaceIntoTray(nextType) {
  if (state.selected.length < state.config.maxTray) return true
  const same = state.selected.filter((s) => s.type === nextType).length
  return same >= 2
}

function insertIndexForType(selected, type) {
  let last = -1
  for (let i = 0; i < selected.length; i++) if (selected[i].type === type) last = i
  return last >= 0 ? last + 1 : selected.length
}

function findFirstMerge(selected) {
  const pos = Object.create(null)
  for (let i = 0; i < selected.length; i++) {
    const t = selected[i].type
    if (!pos[t]) pos[t] = []
    pos[t].push(i)
    if (pos[t].length === 3) return { type: t, indexes: pos[t].slice(0, 3) }
  }
  return null
}

async function animateTrayMerge(indexes) {
  const slots = [...ui.traySlots.querySelectorAll('.slot')]
  for (const i of indexes) slots[i]?.classList.add('merge')
  await sleep(320)
}

async function animateMeshPickup(doll) {
  if (!doll?.mesh) return
  const mesh = doll.mesh
  doll.animating = true
  const tray = ui.traySlots.getBoundingClientRect()
  const target = screenToWorldOnPlane(tray.left + tray.width / 2, tray.top + tray.height / 2, 0)
  const startPos = mesh.position.clone()
  const endPos = target || startPos.clone().add(new THREE.Vector3(0, 40, 0))
  const start = performance.now()
  const duration = 320
  const fromScale = mesh.scale.x || 1
  return new Promise((resolve) => {
    const frame = (now) => {
      const t = clamp((now - start) / duration, 0, 1)
      const s = fromScale * (1 - t)
      mesh.scale.setScalar(Math.max(0.02, s))
      const ease = 1 - Math.pow(1 - t, 3)
      const pos = startPos.clone().lerp(endPos, ease)
      pos.y += Math.sin(t * Math.PI) * 40
      mesh.position.copy(pos)
      if (t < 1) {
        requestAnimationFrame(frame)
      } else {
        if (three.itemsGroup && mesh.parent) {
          three.itemsGroup.remove(mesh)
        }
        disposeObject(mesh)
        three.meshes.delete(doll.id)
        doll.mesh = null
        doll.animating = false
        resolve()
      }
    }
    requestAnimationFrame(frame)
  })
}

function consumeTool(key) {
  if (state.tools[key] <= 0) return false
  state.tools[key] -= 1
  setToolUI()
  return true
}

function useToolRemove() {
  if (!state.running || state.busy) return
  if (state.selected.length === 0) {
    toast('栏里没有可移出的物品')
    return
  }
  if (!consumeTool('remove')) {
    toast('移出道具不足')
    return
  }
  state.sound.click()
  state.selected.pop()
  renderTray()
  toast('已移出一个物品')
}

async function useToolMatch() {
  if (!state.running || state.busy) return
  const counts = Object.create(null)
  for (const item of state.selected) counts[item.type] = (counts[item.type] || 0) + 1
  const targetType = Object.keys(counts).find((t) => counts[t] >= 2)
  if (!targetType) {
    toast('栏里还没有可凑齐的类型')
    return
  }
  const camera = three.camera
  const candidate = state.dolls
    .filter((d) => d.type === targetType && !isDollBlocked(d))
    .sort((a, b) => {
      const da = a.mesh && camera ? camera.position.distanceTo(a.mesh.position) : -a.layer
      const db = b.mesh && camera ? camera.position.distanceTo(b.mesh.position) : -b.layer
      return da - db
    })[0]
  if (!candidate) {
    toast('场上没有同类型可用')
    return
  }
  if (!consumeTool('match')) {
    toast('凑齐道具不足')
    return
  }
  await pickDoll(candidate.id)
}

function useToolHint() {
  if (!state.running || state.busy) return
  const candidate = findHintCandidate()
  if (!candidate) {
    toast('暂无可提示的物品')
    return
  }
  if (!consumeTool('hint')) {
    toast('提示道具不足')
    return
  }
  state.sound.click()
  activateHint(candidate)
  toast(`提示：${candidate.label}`)
}

function useToolUndo() {
  if (!state.running || state.busy) return
  if (!state.selected.length) {
    toast('栏里没有可撤回的物品')
    return
  }
  if (!consumeTool('undo')) {
    toast('撤回道具不足')
    return
  }
  state.sound.click()
  const item = state.selected.pop()
  renderTray()
  if (item) {
    spawnDollFromType(item.type)
    toast(`已撤回一个${item.label}`)
  }
}

function useToolFreeze() {
  if (!state.running || state.busy) return
  if (!consumeTool('freeze')) {
    toast('停时道具不足')
    return
  }
  state.sound.click()
  const now = Date.now()
  state.freezeUntil = Math.max(state.freezeUntil, now) + FREEZE_DURATION
  setFreezeUI(true)
  toast(`时间冻结 ${Math.round(FREEZE_DURATION / 1000)} 秒`)
}

function useToolShuffle() {
  if (!state.running || state.busy) return
  if (!consumeTool('shuffle')) {
    toast('打乱道具不足')
    return
  }
  state.sound.click()
  clearHint()
  setOutlineTarget(null)
  const { width, height } = measureBoard()
  updateSpawnRadius()
  const radius = Math.min(state.spawnRadius || state.containerRadius, state.containerRadius || 0)
  const placed = []
  for (const d of state.dolls) {
    d.layer = Math.floor(state.rng() * state.config.layerMax) + 1
    d.z = d.layer * 1000 + d.id
    d.rotate = Math.round((state.rng() * 2 - 1) * 16)
    d.visualYaw = 0
    d.tilt = 0
    d.floatDelay = Math.round(state.rng() * 1800)
    d.vx = 0
    d.vy = 0
    d.spin = 0
    d.spinVel = 0
    placeDollInRadius(d, width, height, radius, placed, state.rng)
    placed.push(d)
  }
  applyBowlCompression()
  renderDolls()
  toast('已重新打乱')
}

function startConfetti() {
  const canvas = ui.confetti
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const rect = ui.board.getBoundingClientRect()
  canvas.width = Math.floor(rect.width * devicePixelRatio)
  canvas.height = Math.floor(rect.height * devicePixelRatio)
  canvas.style.width = `${rect.width}px`
  canvas.style.height = `${rect.height}px`
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
  canvas.hidden = false

  const colors = ['#ff4b9a', '#ff77b7', '#ffd1e7', '#fff6cc', '#ffffff']
  const parts = Array.from({ length: 140 }, () => ({
    x: Math.random() * rect.width,
    y: -20 - Math.random() * rect.height * 0.3,
    vx: (Math.random() * 2 - 1) * 2.2,
    vy: 2 + Math.random() * 3.2,
    rot: Math.random() * Math.PI,
    vr: (Math.random() * 2 - 1) * 0.2,
    w: 6 + Math.random() * 8,
    h: 6 + Math.random() * 10,
    c: colors[Math.floor(Math.random() * colors.length)],
  }))

  const t0 = performance.now()
  const dur = 1700
  function frame(now) {
    const t = now - t0
    ctx.clearRect(0, 0, rect.width, rect.height)
    for (const p of parts) {
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.03
      p.rot += p.vr
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.fillStyle = p.c
      ctx.globalAlpha = clamp(1 - t / dur, 0, 1)
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      ctx.restore()
    }
    if (t < dur) requestAnimationFrame(frame)
    else canvas.hidden = true
  }
  requestAnimationFrame(frame)
}

async function pickDoll(dollId) {
  if (!state.running || state.busy) return
  clearHint()

  const idx = state.dolls.findIndex((d) => d.id === dollId)
  if (idx < 0) return
  const doll = state.dolls[idx]

  if (isDollBlocked(doll)) {
    toast('物品被遮挡，先移开上层')
    return
  }

  if (!canPlaceIntoTray(doll.type)) {
    state.sound.lose()
    endGame('栏已满', '待合成栏放不下新的物品了')
    return
  }

  state.busy = true
  state.sound.click()
  setOutlineTarget(null)

  await animateMeshPickup(doll)

  // Remove from board
  state.dolls.splice(idx, 1)
  if (doll.body && physics.ready) {
    physics.world.removeBody(doll.body)
    physics.bodies.delete(doll.id)
    doll.body = null
  }

  // Insert into tray (same types stay together)
  const insertAt = insertIndexForType(state.selected, doll.type)
  state.selected.splice(insertAt, 0, { type: doll.type, label: doll.label, image: doll.image })
  renderTray({ popIndex: insertAt })

  // Merge loop (with animation)
  while (true) {
    const merge = findFirstMerge(state.selected)
    if (!merge) break

    await animateTrayMerge(merge.indexes)
    triggerMergeFx()
    state.sound.merge()

    const now = Date.now()
    if (now - state.lastMergeAt <= COMBO_WINDOW) state.mergeCombo += 1
    else state.mergeCombo = 1
    state.lastMergeAt = now

    const base = getScoreForType(merge.type)
    const mult = 1 + Math.min(0.6, (state.mergeCombo - 1) * 0.15)
    const add = Math.round(base * mult)
    state.score += add
    setScoreUI(state.score)
    showFloatScore(`+${add}${state.mergeCombo >= 2 ? ` 连消×${state.mergeCombo}` : ''}`)
    triggerComboUI()
    maybeAwardBonus()

    // remove from end to start
    const sorted = [...merge.indexes].sort((a, b) => b - a)
    for (const i of sorted) state.selected.splice(i, 1)
    renderTray()
  }

  // Reveal new items as progress advances
  applyBowlCompression()
  replenishBoard()
  renderDolls()

  // Win / lose check
  if (getRemainingCount() === 0) {
    state.sound.win()
    startConfetti()
    if (state.score > state.bestScore) {
      state.bestScore = state.score
      localStorage.setItem(STORAGE.bestScore, String(state.bestScore))
      setBestUI(state.bestScore)
    }
    endGame('通关成功！', `得分：${state.score} · 剩余时间：${formatTime(state.timer)}`)
    return
  }

  if (state.selected.length >= state.config.maxTray) {
    state.sound.lose()
    endGame('栏已满', '待合成栏已满，无法继续放置')
    return
  }

  state.busy = false
}

function resetGame(seed, modeKey) {
  if (state.reloadAfterGame) {
    state.reloadAfterGame = false
    window.location.reload()
    return
  }
  state.seed = seed >>> 0
  state.rng = mulberry32(state.seed)
  setUrlConfig({ modeKey, seed: state.seed })
  setMode(modeKey)

  initTray(state.config.maxTray)
  setOverlay(false)
  setPause(false)

  state.score = 0
  state.timer = state.config.seconds
  state.selected = []
  state.busy = false
  state.running = true
  state.pausedByHelp = false
  state.lastMergeAt = 0
  state.mergeCombo = 0
  state.lastBlockUpdate = 0
  state.totalItems = state.config.itemsPerType * DOLL_TYPES.length
  state.pool = []
  state.maxVisible = 0
  state.containerRadius = 0
  state.spawnRadius = 0
  state.tools = { remove: 2, match: 2, hint: 3, undo: 2, freeze: 2, shuffle: 1 }
  state.freezeUntil = 0
  state.bonusAt = BONUS_STEP
  state.hint = null
  state.hoverTarget = null
  window.clearTimeout(state.comboTimer)
  ui.comboChip.hidden = true
  setFreezeUI(false)

  setScoreUI(state.score)
  setTimerUI(state.timer)
  renderTray()
  setToolUI()

  const { width, height } = measureBoard()
  const allDolls = generateDolls(width, height, state.config, state.rng)
  state.pool = allDolls
  state.dolls = []
  state.nextId = allDolls.length + 1
  state.maxVisible = computeMaxVisible(width, height, state.config)
  applyBowlCompression()
  replenishBoard()
  rebuildBodies()
  renderDolls()
  startTimer()
}

function buildShareUrl() {
  const url = new URL(window.location.href)
  url.searchParams.set('mode', state.modeKey)
  url.searchParams.set('seed', String(state.seed >>> 0))
  return url.toString()
}

async function shareLink() {
  const url = buildShareUrl()
  try {
    if (navigator.share) {
      await navigator.share({ title: '日常收纳消除', text: '来玩日常收纳消除～', url })
      return
    }
  } catch {
    // ignore and fallback
  }
  try {
    await navigator.clipboard.writeText(url)
    toast('链接已复制，可以发给朋友啦')
  } catch {
    toast('复制失败：请手动复制地址栏链接')
  }
}

function bindEvents() {
  ui.shareEndBtn.addEventListener('click', shareLink)

  ui.soundBtn.addEventListener('click', () => {
    const next = !state.sound.enabled
    state.sound.setEnabled(next)
    localStorage.setItem(STORAGE.sound, next ? '1' : '0')
    setSoundUI()
    toast(next ? '声音已开启' : '声音已关闭')
  })

  ui.restartBtn.addEventListener('click', () => {
    const modeKey = state.modeKey
    resetGame(makeSeed(), modeKey)
  })
  ui.againBtn.addEventListener('click', () => resetGame(makeSeed(), state.modeKey))

  ui.pauseBtn.addEventListener('click', () => {
    pauseGame()
  })

  ui.resumeBtn.addEventListener('click', () => {
    setPause(false)
    if (ui.overlay.hidden && state.initialized) {
      state.running = true
      startTimer()
    }
  })

  ui.menuBtn.addEventListener('click', () => {
    if (state.running) {
      state.running = false
      state.pausedByHelp = true
      stopTimer()
    }
    clearHint()
    setPause(false)
    setMode(state.modeKey)
    setHelp(true)
  })

  ui.toolRemove.addEventListener('click', useToolRemove)
  ui.toolMatch.addEventListener('click', () => {
    useToolMatch()
  })
  ui.toolHint.addEventListener('click', useToolHint)
  ui.toolUndo.addEventListener('click', useToolUndo)
  ui.toolFreeze.addEventListener('click', useToolFreeze)
  ui.toolShuffle.addEventListener('click', useToolShuffle)

  ui.copySeedBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(buildShareUrl())
      toast('局号链接已复制')
    } catch {
      toast('复制失败：请手动复制地址栏链接')
    }
  })

  ui.closeHelpBtn.addEventListener('click', () => {
    setHelp(false)
    const nextMode = getSelectedModeKey()
    if (!state.initialized) {
      state.initialized = true
      const seed = state.seed || makeSeed()
      resetGame(seed, nextMode)
      return
    }

    if (nextMode !== state.modeKey) {
      toast('难度已切换：下一局生效')
      state.modeKey = nextMode
      state.config = MODES[nextMode]
    }

    if (!state.pausedByHelp) return
    state.pausedByHelp = false
    if (!ui.overlay.hidden) return
    if (!ui.pause.hidden) return
    state.running = true
    startTimer()
  })

  ui.help.addEventListener('change', (e) => {
    const t = e.target
    if (!(t instanceof HTMLInputElement)) return
    if (t.name !== 'mode') return
    const next = getSelectedModeKey()
    const cfg = MODES[next]
    const total = cfg.itemsPerType * DOLL_TYPES.length
    ui.modeDesc.textContent = `${total} 个物品 · 倒计时 ${formatTime(cfg.seconds)} · ${cfg.maxTray} 格待合成栏 · 局号 ${state.seed}`
  })

  ui.board.addEventListener('pointermove', (e) => {
    if (!state.running || state.busy) {
      setOutlineTarget(null)
      ui.board.style.cursor = 'default'
      return
    }
    if (input.dragging) {
      const world = screenToWorldOnPlane(e.clientX, e.clientY, 0)
      if (world && input.lastBoard) {
        const next = worldToBoard(world)
        const dx = next.x - input.lastBoard.x
        const dy = next.y - input.lastBoard.y
        input.dragDistance += Math.abs(dx) + Math.abs(dy)
        pushItemsAt(next.x, next.y, dx, dy)
        input.lastBoard = next
      }
    }
    const hit = raycastPointer(e)
    if (hit) {
      setOutlineTarget(hit.object)
      ui.board.style.cursor = 'pointer'
    } else {
      setOutlineTarget(null)
      ui.board.style.cursor = 'default'
    }
  })
  ui.board.addEventListener('pointerdown', (e) => {
    if (!state.running || state.busy) return
    input.dragging = true
    input.dragDistance = 0
    const world = screenToWorldOnPlane(e.clientX, e.clientY, 0)
    input.lastBoard = world ? worldToBoard(world) : null
    const hit = raycastPointer(e)
    setOutlineTarget(hit ? hit.object : null)
  })
  ui.board.addEventListener('pointerleave', () => {
    input.dragging = false
    input.lastBoard = null
    setOutlineTarget(null)
    ui.board.style.cursor = 'default'
  })
  ui.board.addEventListener('click', (e) => {
    if (!state.running || state.busy) return
    if (input.dragDistance > 6) return
    const hit = raycastPointer(e)
    if (!hit) return
    pickDoll(hit.doll.id)
  })
  ui.board.addEventListener('pointerup', () => {
    input.dragging = false
    input.lastBoard = null
  })
  ui.board.addEventListener('pointercancel', () => {
    input.dragging = false
    input.lastBoard = null
  })

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseGame('已自动暂停')
  })
  window.addEventListener('blur', () => {
    if (!document.hidden) pauseGame('已自动暂停')
  })

  document.addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
    const target = e.target
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
    const key = e.key.toLowerCase()
    let handled = true
    switch (key) {
      case '1':
        useToolRemove()
        break
      case '2':
        useToolMatch()
        break
      case '3':
        useToolHint()
        break
      case '4':
        useToolUndo()
        break
      case '5':
        useToolFreeze()
        break
      case '6':
        useToolShuffle()
        break
      case 'p':
      case ' ':
        if (!ui.pause.hidden) {
          ui.resumeBtn.click()
        } else if (ui.help.hidden && ui.overlay.hidden) {
          pauseGame()
        }
        break
      case 'h':
        if (!ui.help.hidden) ui.closeHelpBtn.click()
        else ui.menuBtn.click()
        break
      case 'r':
        ui.restartBtn.click()
        break
      case 's':
        ui.soundBtn.click()
        break
      case 'escape':
        if (!ui.help.hidden) ui.closeHelpBtn.click()
        else if (!ui.pause.hidden) ui.resumeBtn.click()
        break
      default:
        handled = false
    }
    if (handled) e.preventDefault()
  })

  window.addEventListener('resize', () => {
    if (!state.initialized) return
    const { width, height } = measureBoard()
    const { sizes } = computeSizes(width)
    for (const d of [...state.dolls, ...state.pool]) {
      const size = sizes[d.type] || d.size
      d.size = size
      d.w = size
      d.h = size * d.aspect
      d.physRadius = Math.max(10, getCollisionSpec(d.type, d.w, d.h).radius)
      d.heightOffset = d.physRadius
      d.radius = d.physRadius
      d.vx = 0
      d.vy = 0
      d.spin = 0
      d.spinVel = 0
    }
    state.maxVisible = computeMaxVisible(width, height, state.config)
    updateSpawnRadius()
    const radius = state.containerRadius || Math.min(width, height) * 0.46
    const placed = []
    for (const d of state.dolls) {
      placeDollInRadius(d, width, height, radius, placed, state.rng)
      placed.push(d)
    }
    applyBowlCompression()
    replenishBoard()
    resizeThree()
    buildBowlPhysics()
    rebuildBodies()
    rebuildMeshes()
    renderDolls()
  })
}

async function boot() {
  state.bestScore = readInt(localStorage.getItem(STORAGE.bestScore), 0)
  setBestUI(state.bestScore)

  const soundOn = localStorage.getItem(STORAGE.sound) !== '0'
  state.sound = new Sound(soundOn)
  setSoundUI()

  const urlCfg = parseUrlConfig()
  state.seed = urlCfg.seed || makeSeed()
  setMode(urlCfg.modeKey)
  initTray(MODES[urlCfg.modeKey].maxTray)
  renderTray()
  setToolUI()
  setPause(false)
  setRemainUI(0)
  setTimerUI(MODES[urlCfg.modeKey].seconds)
  setScoreUI(0)

  bindEvents()

  showLoading(true, '正在加载素材…')
  await preloadAssets(ASSETS, (done, total) => {
    const pct = total ? Math.round((done / total) * 100) : 0
    ui.loadingFill.style.width = `${pct}%`
    ui.loadingText.textContent = `正在加载素材… ${pct}%`
  })
  showLoading(false)
  initPhysics()
  initThree()

  setHelp(true)

  if ('serviceWorker' in navigator) {
    try {
      let reloaded = false
      const reg = await navigator.serviceWorker.register('./service-worker.js', { updateViaCache: 'none' })
      const requestUpdate = (worker) => worker && worker.postMessage({ type: 'SKIP_WAITING' })
      if (reg.waiting) requestUpdate(reg.waiting)
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing
        if (!worker) return
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            requestUpdate(worker)
          }
        })
      })
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return
        reloaded = true
        if (state.running) {
          state.reloadAfterGame = true
          toast('新版本已就绪，本局结束后刷新')
          return
        }
        window.location.reload()
      })
    } catch {
      // ignore
    }
  }
}

boot()
