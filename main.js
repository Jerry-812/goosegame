const DEFAULT_SECONDS = 60
const MAX_TRAY = 7

const APPROX_ASPECT = 1.35

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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function randBetween(min, max) {
  return min + Math.random() * (max - min)
}

function randTri01() {
  return (Math.random() + Math.random()) / 2
}

function bias01(value01, power) {
  const v = clamp(value01, 0, 1)
  return 1 - Math.pow(1 - v, power)
}

function countByType(items) {
  const counts = Object.create(null)
  for (const item of items) counts[item.type] = (counts[item.type] || 0) + 1
  return counts
}

function qs(sel) {
  const el = document.querySelector(sel)
  if (!el) throw new Error(`Missing element: ${sel}`)
  return el
}

const ui = {
  score: qs('#score'),
  timer: qs('#timer'),
  timerPill: qs('#timerPill'),
  board: qs('#board'),
  traySlots: qs('#traySlots'),
  trayCount: qs('#trayCount'),
  mergeFx: qs('#mergeFx'),
  overlay: qs('#overlay'),
  dialogTitle: qs('#dialogTitle'),
  dialogSub: qs('#dialogSub'),
  restartBtn: qs('#restartBtn'),
  againBtn: qs('#againBtn'),
  shareBtn: qs('#shareBtn'),
  helpBtn: qs('#helpBtn'),
  help: qs('#help'),
  closeHelpBtn: qs('#closeHelpBtn'),
  toast: qs('#toast'),
}

const state = {
  score: 0,
  timer: DEFAULT_SECONDS,
  dolls: [],
  selected: [],
  running: false,
  busy: false,
  interval: null,
  initialized: false,
  pausedByHelp: false,
}

function initTray() {
  ui.traySlots.innerHTML = ''
  for (let i = 0; i < MAX_TRAY; i++) {
    const slot = document.createElement('div')
    slot.className = 'slot'
    slot.dataset.slot = String(i)
    ui.traySlots.appendChild(slot)
  }
}

function setOverlay(visible, title = '', sub = '') {
  ui.overlay.hidden = !visible
  ui.dialogTitle.textContent = title
  ui.dialogSub.textContent = sub
}

function setHelp(visible) {
  ui.help.hidden = !visible
}

function toast(msg) {
  ui.toast.textContent = msg
  ui.toast.hidden = false
  window.clearTimeout(toast._t)
  toast._t = window.setTimeout(() => (ui.toast.hidden = true), 1800)
}

function setTimerUI(value) {
  ui.timer.textContent = String(value)
  ui.timerPill.classList.toggle('danger', value <= 10)
}

function setScoreUI(value) {
  ui.score.textContent = String(value)
}

function setTrayUI() {
  ui.trayCount.textContent = String(state.selected.length)
  const slots = [...ui.traySlots.querySelectorAll('.slot')]
  slots.forEach((slot, i) => {
    slot.classList.toggle('filled', Boolean(state.selected[i]))
    slot.innerHTML = ''
    if (state.selected[i]) {
      const img = document.createElement('img')
      img.src = state.selected[i].image
      img.alt = state.selected[i].label
      slot.appendChild(img)
    }
  })
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
  return { width: rect.width, height: rect.height }
}

function computeSizes(boardW) {
  const minSize = clamp(Math.round(boardW * 0.085), 44, 86)
  const maxSize = minSize * 3
  const sizes = Object.fromEntries(
    DOLL_TYPES.map((t) => [t.type, Math.round(clamp(minSize * t.scale, minSize, maxSize))])
  )
  return { minSize, maxSize, sizes }
}

function generateDolls(boardW, boardH) {
  const { sizes } = computeSizes(boardW)
  const itemsPerType = 3
  const dolls = []
  let id = 1

  for (const t of DOLL_TYPES) {
    for (let i = 0; i < itemsPerType; i++) {
      const dollId = id++
      const size = sizes[t.type]
      const w = size
      const h = size * APPROX_ASPECT

      const minX = 8
      const maxX = Math.max(minX, boardW - w - 8)
      const minY = 8
      const maxY = Math.max(minY, boardH - h - 96)
      const x = Math.round(minX + randTri01() * (maxX - minX))
      const y = Math.round(minY + bias01(randTri01(), 1.7) * (maxY - minY))

      const layer = Math.floor(randBetween(1, 6))
      const rotate = Math.round(randBetween(-16, 16))

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
        visible: false,
      })
    }
  }

  dolls.sort(() => Math.random() - 0.5)
  return dolls
}

function computeVisibility(dolls) {
  for (const d of dolls) d.visible = false
  if (!dolls.length) return dolls

  const samples = [
    { rx: 0.3, ry: 0.22 },
    { rx: 0.5, ry: 0.22 },
    { rx: 0.7, ry: 0.22 },
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

  for (const d of state.dolls) {
    const el = document.createElement('div')
    el.className = `doll ${d.visible ? 'visible' : 'blocked'}`
    el.style.left = `${d.x}px`
    el.style.top = `${d.y}px`
    el.style.width = `${d.w}px`
    el.style.zIndex = String(d.z)
    el.dataset.id = String(d.id)
    el.dataset.rot = String(d.rotate)
    el.style.setProperty('--rot', `${d.rotate}deg`)

    const img = document.createElement('img')
    img.className = 'img'
    img.src = d.image
    img.alt = d.label
    img.draggable = false

    const badge = document.createElement('div')
    badge.className = 'badge'
    badge.textContent = d.label

    el.appendChild(img)
    el.appendChild(badge)

    el.addEventListener('pointerdown', () => {
      if (!state.running || state.busy) return
      if (!d.visible) return
      el.classList.add('pressed')
    })
    el.addEventListener('pointerup', () => el.classList.remove('pressed'))
    el.addEventListener('pointercancel', () => el.classList.remove('pressed'))

    el.addEventListener('click', () => onDollClick(d.id))

    ui.board.appendChild(el)
  }
}

function startTimer() {
  stopTimer()
  state.interval = window.setInterval(() => {
    if (!state.running) return
    state.timer -= 1
    if (state.timer <= 0) {
      state.timer = 0
      setTimerUI(state.timer)
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

function endGame(title, sub) {
  state.running = false
  state.busy = false
  stopTimer()
  setOverlay(true, title, sub)
}

function mergeSelected(selected) {
  let addScore = 0
  let triggerFx = false

  while (true) {
    const counts = countByType(selected)
    const mergeType = Object.keys(counts).find((t) => counts[t] >= 3)
    if (!mergeType) break

    triggerFx = true
    addScore += 10

    let removed = 0
    const next = []
    for (const item of selected) {
      if (item.type === mergeType && removed < 3) {
        removed += 1
        continue
      }
      next.push(item)
    }
    selected = next
  }

  return { selected, addScore, triggerFx }
}

function canPlaceIntoTray(nextType) {
  if (state.selected.length < MAX_TRAY) return true
  const same = state.selected.filter((s) => s.type === nextType).length
  return same >= 2 // 放下去立刻三消才允许
}

async function animateIntoTray(dollEl, slotEl) {
  const from = dollEl.getBoundingClientRect()
  const to = slotEl.getBoundingClientRect()

  const dx = to.left + to.width / 2 - (from.left + from.width / 2)
  const dy = to.top + to.height / 2 - (from.top + from.height / 2)
  const scale = clamp((to.width / from.width) * 0.9, 0.25, 0.8)
  const rot = Number(dollEl.dataset.rot || '0')

  const anim = dollEl.animate(
    [
      { transform: `rotate(${rot}deg)`, opacity: 1, filter: 'saturate(1)' },
      {
        transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${scale})`,
        opacity: 0.2,
        filter: 'saturate(1.1)',
      },
    ],
    { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' }
  )
  await anim.finished.catch(() => {})
}

async function onDollClick(dollId) {
  if (!state.running || state.busy) return

  const idx = state.dolls.findIndex((d) => d.id === dollId)
  if (idx < 0) return
  const doll = state.dolls[idx]
  if (!doll.visible) return

  if (!canPlaceIntoTray(doll.type)) {
    endGame('栏已满', '待合成栏放不下新的娃娃了')
    return
  }

  const dollEl = ui.board.querySelector(`.doll[data-id="${dollId}"]`)
  if (!dollEl) return

  state.busy = true

  const slotIndex = Math.min(state.selected.length, MAX_TRAY - 1)
  const slotEl = ui.traySlots.querySelector(`.slot[data-slot="${slotIndex}"]`)
  if (slotEl) await animateIntoTray(dollEl, slotEl)

  // Remove from board
  state.dolls.splice(idx, 1)

  // Add to tray
  state.selected.push({ type: doll.type, label: doll.label, image: doll.image })

  const merged = mergeSelected(state.selected)
  state.selected = merged.selected
  if (merged.addScore) {
    state.score += merged.addScore
    setScoreUI(state.score)
  }
  if (merged.triggerFx) triggerMergeFx()

  setTrayUI()

  // Recompute visibility and re-render
  state.dolls = computeVisibility(state.dolls)
  renderDolls()

  if (state.dolls.length === 0) {
    endGame('通关成功！', `得分：${state.score}`)
    return
  }

  state.busy = false
}

function startNewGame() {
  stopTimer()
  setOverlay(false)
  state.score = 0
  state.timer = DEFAULT_SECONDS
  state.selected = []
  state.busy = false
  state.running = true
  setScoreUI(state.score)
  setTimerUI(state.timer)
  setTrayUI()

  const { width, height } = measureBoard()
  state.dolls = computeVisibility(generateDolls(width, height))
  renderDolls()
  startTimer()
}

function bindEvents() {
  ui.restartBtn.addEventListener('click', startNewGame)
  ui.againBtn.addEventListener('click', startNewGame)
  ui.shareBtn.addEventListener('click', async () => {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title: '芭比消除', text: '来玩芭比消除～', url })
        return
      }
    } catch {
      // ignore and fallback to clipboard
    }

    try {
      await navigator.clipboard.writeText(url)
      toast('链接已复制，可以发给朋友啦')
    } catch {
      toast('复制失败：请手动复制地址栏链接')
    }
  })
  ui.helpBtn.addEventListener('click', () => {
    if (state.running) {
      state.running = false
      state.pausedByHelp = true
      stopTimer()
    }
    setHelp(true)
  })
  ui.closeHelpBtn.addEventListener('click', () => {
    setHelp(false)
    if (!state.initialized) {
      state.initialized = true
      startNewGame()
      return
    }
    if (!state.pausedByHelp) return
    state.pausedByHelp = false
    if (!ui.overlay.hidden) return
    state.running = true
    startTimer()
  })

  window.addEventListener('resize', () => {
    if (!state.running) return
    const { width, height } = measureBoard()

    // Keep relative layout by clamping current dolls into the new board.
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

initTray()
bindEvents()
setHelp(true)
