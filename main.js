const STORAGE = {
  bestScore: 'goosegame.bestScore',
  sound: 'goosegame.sound',
}

const APPROX_ASPECT = 1.35

const MODES = {
  easy: { key: 'easy', label: '轻松', seconds: 60, itemsPerType: 3, maxTray: 7, layerMax: 6 },
  normal: { key: 'normal', label: '标准', seconds: 75, itemsPerType: 6, maxTray: 7, layerMax: 7 },
  hard: { key: 'hard', label: '高手', seconds: 75, itemsPerType: 6, maxTray: 6, layerMax: 8 },
}

const DOLL_TYPES = [
  { type: 'classic', label: '经典', scale: 1.7 },
  { type: 'princess', label: '公主', scale: 3.0 },
  { type: 'doctor', label: '医生', scale: 1.0 },
  { type: 'astronaut', label: '宇航', scale: 2.4 },
  { type: 'model', label: '模特', scale: 1.35 },
  { type: 'rockstar', label: '摇滚', scale: 1.85 },
  { type: 'chef', label: '厨师', scale: 1.75 },
  { type: 'dancer', label: '舞者', scale: 1.05 },
  { type: 'diver', label: '潜水', scale: 1.25 },
  { type: 'fairy', label: '仙子', scale: 2.7 },
]

const ASSETS = ['./images/pot.png', ...DOLL_TYPES.map((t) => `./images/barbie_${t.type}.png`)]

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
  timer: qs('#timer'),
  timerPill: qs('#timerPill'),
  board: qs('#board'),
  traySlots: qs('#traySlots'),
  trayCount: qs('#trayCount'),
  trayMax: qs('#trayMax'),
  mergeFx: qs('#mergeFx'),
  confetti: qs('#confetti'),

  overlay: qs('#overlay'),
  dialogTitle: qs('#dialogTitle'),
  dialogSub: qs('#dialogSub'),

  restartBtn: qs('#restartBtn'),
  againBtn: qs('#againBtn'),
  shareBtn: qs('#shareBtn'),
  shareEndBtn: qs('#shareEndBtn'),
  soundBtn: qs('#soundBtn'),

  helpBtn: qs('#helpBtn'),
  help: qs('#help'),
  closeHelpBtn: qs('#closeHelpBtn'),
  copySeedBtn: qs('#copySeedBtn'),
  modeDesc: qs('#modeDesc'),

  toast: qs('#toast'),

  loading: qs('#loading'),
  loadingText: qs('#loadingText'),
  loadingFill: qs('#loadingFill'),
}

const state = {
  rng: Math.random,
  seed: 0,
  modeKey: 'easy',
  config: MODES.easy,

  score: 0,
  bestScore: 0,
  timer: 0,
  dolls: [],
  selected: [],

  running: false,
  busy: false,
  pausedByHelp: false,
  initialized: false,

  interval: null,
  sound: null,
  lastMergeAt: 0,
  mergeCombo: 0,
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

function showLoading(visible, text = '') {
  ui.loading.hidden = !visible
  if (text) ui.loadingText.textContent = text
}

function setTimerUI(value) {
  ui.timer.textContent = String(value)
  ui.timerPill.classList.toggle('danger', value <= 10)
}

function setScoreUI(value) {
  ui.score.textContent = String(value)
}

function setBestUI(value) {
  ui.best.textContent = String(value)
}

function setRemainUI(value) {
  ui.remain.textContent = String(value)
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
  ui.modeDesc.textContent = `${total} 个娃娃 · ${state.config.seconds} 秒 · ${state.config.maxTray} 格待合成栏 · 局号 ${state.seed}`
}

function initTray(maxTray) {
  ui.traySlots.style.setProperty('--slots', String(maxTray))
  ui.trayMax.textContent = String(maxTray)
  ui.traySlots.innerHTML = ''
  for (let i = 0; i < maxTray; i++) {
    const slot = document.createElement('div')
    slot.className = 'slot'
    slot.dataset.slot = String(i)
    ui.traySlots.appendChild(slot)
  }
}

function renderTray({ popIndex = -1 } = {}) {
  ui.trayCount.textContent = String(state.selected.length)
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

function computeSizes(boardW) {
  const minSize = clamp(Math.round(boardW * 0.085), 44, 92)
  const maxSize = minSize * 3
  const sizes = Object.fromEntries(
    DOLL_TYPES.map((t) => [t.type, Math.round(clamp(minSize * t.scale, minSize, maxSize))])
  )
  return { minSize, maxSize, sizes }
}

function randTri01(rng) {
  return (rng() + rng()) / 2
}

function bias01(value01, power) {
  const v = clamp(value01, 0, 1)
  return 1 - Math.pow(1 - v, power)
}

function iconSvg(type) {
  const common = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'
  switch (type) {
    case 'princess':
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path ${common} d="M4 9l4 3 4-6 4 6 4-3v9H4z"/><path ${common} d="M6 18h12"/></svg>`
    case 'doctor':
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path ${common} d="M12 5v14"/><path ${common} d="M5 12h14"/></svg>`
    case 'astronaut':
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><circle ${common} cx="12" cy="11" r="6"/><path ${common} d="M8 20h8"/></svg>`
    case 'model':
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path ${common} d="M12 3l7 9-7 9-7-9z"/></svg>`
    case 'rockstar':
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path ${common} d="M12 2l3 7h7l-6 4 2 7-6-4-6 4 2-7-6-4h7z"/></svg>`
    case 'chef':
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path ${common} d="M7 9c-2 0-3-1-3-3 0-2 2-4 4-3 1-2 5-2 6 0 2-1 4 1 4 3 0 2-1 3-3 3"/><path ${common} d="M7 9v11h10V9"/></svg>`
    case 'dancer':
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path ${common} d="M14 3v9a3 3 0 1 1-2-2.83"/><path ${common} d="M14 3h6"/></svg>`
    case 'diver':
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path ${common} d="M3 15c3-3 6 3 9 0s6 3 9 0"/><path ${common} d="M3 19c3-3 6 3 9 0s6 3 9 0"/></svg>`
    case 'fairy':
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path ${common} d="M4 14c4-1 4-6 8-6s4 5 8 6"/><path ${common} d="M12 3v18"/><path ${common} d="M9 6l3 3 3-3"/></svg>`
    default:
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path ${common} d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.5-7 10-7 10z"/></svg>`
  }
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
      const h = size * APPROX_ASPECT

      const minX = 8
      const maxX = Math.max(minX, boardW - w - 8)
      const minY = 8
      const maxY = Math.max(minY, boardH - h - 96)
      const x = Math.round(minX + randTri01(rng) * (maxX - minX))
      const y = Math.round(minY + bias01(randTri01(rng), 1.7) * (maxY - minY))

      const layer = Math.floor(rng() * cfg.layerMax) + 1
      const rotate = Math.round((rng() * 2 - 1) * 16)
      const floatDelay = Math.round(rng() * 1800)

      dolls.push({
        id: dollId,
        type: t.type,
        label: t.label,
        image: `./images/barbie_${t.type}.png`,
        size,
        x,
        y,
        w,
        h,
        layer,
        z: layer * 1000 + dollId,
        rotate,
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

function computeVisibility(dolls) {
  for (const d of dolls) d.visible = false
  if (!dolls.length) return dolls

  const samples = [
    { rx: 0.3, ry: 0.22 },
    { rx: 0.5, ry: 0.22 },
    { rx: 0.7, ry: 0.22 },
    { rx: 0.5, ry: 0.35 },
  ]

  for (const d of dolls) {
    let visible = false
    for (const s of samples) {
      const px = d.x + d.w * s.rx
      const py = d.y + d.h * s.ry

      let topZ = -Infinity
      for (const other of dolls) {
        if (px < other.x || px > other.x + other.w || py < other.y || py > other.y + other.h) continue
        if (other.z > topZ) topZ = other.z
      }

      if (d.z === topZ) {
        visible = true
        break
      }
    }
    d.visible = visible
  }

  return dolls
}

function renderDolls() {
  ui.board.querySelectorAll('.doll').forEach((n) => n.remove())
  const frag = document.createDocumentFragment()

  for (const d of state.dolls) {
    const el = document.createElement('div')
    el.className = `doll ${d.visible ? 'visible' : 'blocked'}`
    el.style.left = `${d.x}px`
    el.style.top = `${d.y}px`
    el.style.width = `${d.w}px`
    el.style.zIndex = String(d.z)
    el.dataset.id = String(d.id)
    el.dataset.type = d.type
    el.style.setProperty('--rot', `${d.rotate}deg`)
    el.style.animationDelay = `${d.floatDelay}ms`

    const img = document.createElement('img')
    img.className = 'img'
    img.src = d.image
    img.alt = d.label
    img.draggable = false

    const badge = document.createElement('div')
    badge.className = 'badge'
    badge.textContent = d.label

    const typeIcon = document.createElement('div')
    typeIcon.className = 'type-icon'
    typeIcon.innerHTML = iconSvg(d.type)

    el.appendChild(img)
    el.appendChild(badge)
    el.appendChild(typeIcon)
    frag.appendChild(el)
  }

  ui.board.appendChild(frag)
  setRemainUI(state.dolls.length)
}

function startTimer() {
  stopTimer()
  state.interval = window.setInterval(() => {
    if (!state.running) return
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

function setSoundUI() {
  const on = state.sound.enabled
  ui.soundBtn.querySelector('.icon').textContent = on ? '🔊' : '🔇'
  ui.soundBtn.setAttribute('aria-label', on ? '关闭声音' : '开启声音')
}

function endGame(title, sub) {
  state.running = false
  state.busy = false
  stopTimer()
  setOverlay(true, title, sub)
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

async function animateIntoTray(dollEl) {
  const from = dollEl.getBoundingClientRect()
  const tray = ui.traySlots.getBoundingClientRect()
  const toX = tray.left + tray.width / 2
  const toY = tray.top + tray.height / 2

  const dx = toX - (from.left + from.width / 2)
  const dy = toY - (from.top + from.height / 2)
  const scale = clamp((48 / from.width) * 0.9, 0.22, 0.75)
  const rot = Number(getComputedStyle(dollEl).getPropertyValue('--rot').replace('deg', '')) || 0

  const anim = dollEl.animate(
    [
      { transform: `rotate(${rot}deg)`, opacity: 1, filter: 'saturate(1)' },
      { transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${scale})`, opacity: 0.1, filter: 'saturate(1.15)' },
    ],
    { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' }
  )
  await anim.finished.catch(() => {})
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

async function pickDoll(dollId, dollEl) {
  if (!state.running || state.busy) return

  const idx = state.dolls.findIndex((d) => d.id === dollId)
  if (idx < 0) return
  const doll = state.dolls[idx]
  if (!doll.visible) {
    dollEl?.animate([{ transform: `rotate(${doll.rotate}deg)` }, { transform: `rotate(${doll.rotate}deg) translateX(-2px)` }, { transform: `rotate(${doll.rotate}deg) translateX(2px)` }, { transform: `rotate(${doll.rotate}deg)` }], { duration: 160, easing: 'ease-out' })
    return
  }

  if (!canPlaceIntoTray(doll.type)) {
    state.sound.lose()
    endGame('栏已满', '待合成栏放不下新的娃娃了')
    return
  }

  state.busy = true
  state.sound.click()

  if (dollEl) await animateIntoTray(dollEl)

  // Remove from board
  state.dolls.splice(idx, 1)

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
    if (now - state.lastMergeAt <= 1800) state.mergeCombo += 1
    else state.mergeCombo = 1
    state.lastMergeAt = now

    const base = 10
    const mult = 1 + Math.min(0.6, (state.mergeCombo - 1) * 0.15)
    const add = Math.round(base * mult)
    state.score += add
    setScoreUI(state.score)
    showFloatScore(`+${add}${state.mergeCombo >= 2 ? ` 连消×${state.mergeCombo}` : ''}`)

    // remove from end to start
    const sorted = [...merge.indexes].sort((a, b) => b - a)
    for (const i of sorted) state.selected.splice(i, 1)
    renderTray()
  }

  // Reveal new top items
  state.dolls = computeVisibility(state.dolls)
  renderDolls()

  // Win / lose check
  if (state.dolls.length === 0) {
    state.sound.win()
    startConfetti()
    if (state.score > state.bestScore) {
      state.bestScore = state.score
      localStorage.setItem(STORAGE.bestScore, String(state.bestScore))
      setBestUI(state.bestScore)
    }
    endGame('通关成功！', `得分：${state.score} · 剩余时间：${state.timer}s`)
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
  state.seed = seed >>> 0
  state.rng = mulberry32(state.seed)
  setUrlConfig({ modeKey, seed: state.seed })
  setMode(modeKey)

  initTray(state.config.maxTray)
  setOverlay(false)

  state.score = 0
  state.timer = state.config.seconds
  state.selected = []
  state.busy = false
  state.running = true
  state.lastMergeAt = 0
  state.mergeCombo = 0

  setScoreUI(state.score)
  setTimerUI(state.timer)
  renderTray()

  const { width, height } = measureBoard()
  state.dolls = computeVisibility(generateDolls(width, height, state.config, state.rng))
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
      await navigator.share({ title: '芭比消除', text: '来玩芭比消除～', url })
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
  ui.shareBtn.addEventListener('click', shareLink)
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

  ui.helpBtn.addEventListener('click', () => {
    if (state.running) {
      state.running = false
      state.pausedByHelp = true
      stopTimer()
    }
    setMode(state.modeKey)
    setHelp(true)
  })

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
    ui.modeDesc.textContent = `${total} 个娃娃 · ${cfg.seconds} 秒 · ${cfg.maxTray} 格待合成栏 · 局号 ${state.seed}`
  })

  ui.board.addEventListener('pointerdown', (e) => {
    const target = e.target instanceof Element ? e.target.closest('.doll') : null
    if (!target) return
    if (!state.running || state.busy) return
    if (!target.classList.contains('visible')) return
    target.classList.add('pressed')
  })
  ui.board.addEventListener('pointerup', (e) => {
    const target = e.target instanceof Element ? e.target.closest('.doll') : null
    target?.classList.remove('pressed')
  })
  ui.board.addEventListener('pointercancel', (e) => {
    const target = e.target instanceof Element ? e.target.closest('.doll') : null
    target?.classList.remove('pressed')
  })

  ui.board.addEventListener('click', (e) => {
    const target = e.target instanceof Element ? e.target.closest('.doll') : null
    if (!target) return
    const id = readInt(target.dataset.id, -1)
    if (id < 0) return
    pickDoll(id, target)
  })

  window.addEventListener('resize', () => {
    if (!state.initialized) return
    const { width, height } = measureBoard()
    for (const d of state.dolls) {
      d.w = d.size
      d.h = d.size * APPROX_ASPECT
      d.x = clamp(d.x, 8, Math.max(8, width - d.w - 8))
      d.y = clamp(d.y, 8, Math.max(8, height - d.h - 96))
    }
    state.dolls = computeVisibility(state.dolls)
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

  setHelp(true)

  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./service-worker.js')
    } catch {
      // ignore
    }
  }
}

boot()
