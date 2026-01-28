const APPROX_ASPECT = 1.35
const DEFAULT_SECONDS = 60

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

Page({
  data: {
    score: 0,
    timer: DEFAULT_SECONDS,
    maxTray: 7,
    traySlots: [0, 1, 2, 3, 4, 5, 6],

    dolls: [],
    selected: [],

    mergeFx: false,
    result: { visible: false, title: '', sub: '' },
  },

  onLoad() {
    this.startNewGame()
  },

  onUnload() {
    this.stopTimer()
    clearTimeout(this.mergeFxTimeout)
  },

  onRestart() {
    this.startNewGame()
  },

  startNewGame() {
    this.stopTimer()
    this.setData({
      score: 0,
      timer: DEFAULT_SECONDS,
      dolls: [],
      selected: [],
      mergeFx: false,
      result: { visible: false, title: '', sub: '' },
    })

    wx.nextTick(() => {
      this.measureGameArea()
        .then(({ width, height }) => {
          const dolls = this.generateDolls(width, height)
          const withVisibility = this.computeVisibility(dolls)
          this.setData({ dolls: withVisibility })
          this.startTimer()
        })
        .catch(() => {
          const { windowWidth, windowHeight } = wx.getSystemInfoSync()
          const width = Math.max(280, windowWidth - 24)
          const height = Math.max(360, windowHeight - 220)
          const dolls = this.computeVisibility(this.generateDolls(width, height))
          this.setData({ dolls })
          this.startTimer()
        })
    })
  },

  measureGameArea() {
    return new Promise((resolve, reject) => {
      const query = wx.createSelectorQuery()
      query
        .select('#gameArea')
        .boundingClientRect((rect) => {
          if (!rect || !rect.width || !rect.height) return reject(new Error('no rect'))
          resolve({ width: rect.width, height: rect.height })
        })
        .exec()
    })
  },

  generateDolls(areaW, areaH) {
    const imageMap = Object.fromEntries(
      DOLL_TYPES.map((t) => [t.type, `/images/barbie_${t.type}.png`])
    )

    const minSize = clamp(Math.round(areaW * 0.085), 44, 86)
    const maxSize = minSize * 3

    const sizes = Object.fromEntries(
      DOLL_TYPES.map((t) => [t.type, Math.round(clamp(minSize * t.scale, minSize, maxSize))])
    )

    const itemsPerType = 3 // 30 个，总数可整除 3，保证理论可消完
    const dolls = []
    let id = 1

    for (const t of DOLL_TYPES) {
      for (let i = 0; i < itemsPerType; i++) {
        const dollId = id++
        const size = sizes[t.type]
        const w = size
        const h = size * APPROX_ASPECT
        const minX = 8
        const maxX = Math.max(minX, areaW - w - 8)
        const minY = 8
        const maxY = Math.max(minY, areaH - h - 110)

        const x = Math.round(minX + randTri01() * (maxX - minX))
        const y = Math.round(minY + bias01(randTri01(), 1.7) * (maxY - minY))
        const layer = Math.floor(randBetween(1, 6))
        const rotate = Math.round(randBetween(-16, 16))

        dolls.push({
          id: dollId,
          type: t.type,
          label: t.label,
          image: imageMap[t.type],
          size,
          x,
          y,
          layer,
          z: layer * 1000 + dollId,
          rotate,
          visible: false,
        })
      }
    }

    dolls.sort(() => Math.random() - 0.5)
    return dolls
  },

  computeVisibility(dolls) {
    if (!dolls.length) return dolls

    const boxes = dolls.map((d) => {
      const w = d.size
      const h = d.size * APPROX_ASPECT
      const tapX = d.x + w * 0.5
      const tapY = d.y + h * 0.25
      return { x: d.x, y: d.y, w, h, tapX, tapY, z: d.z }
    })

    for (let i = 0; i < dolls.length; i++) {
      const { tapX, tapY } = boxes[i]
      let topZ = -Infinity
      for (let j = 0; j < dolls.length; j++) {
        const b = boxes[j]
        if (tapX >= b.x && tapX <= b.x + b.w && tapY >= b.y && tapY <= b.y + b.h) {
          if (b.z > topZ) topZ = b.z
        }
      }
      dolls[i].visible = dolls[i].z === topZ
    }
    return dolls
  },

  startTimer() {
    this.stopTimer()
    this.interval = setInterval(() => {
      const next = this.data.timer - 1
      if (next <= 0) {
        this.setData({ timer: 0 })
        this.stopTimer()
        this.endGame({ title: '时间到！', sub: '再试一次吧～' })
        return
      }
      this.setData({ timer: next })
    }, 1000)
  },

  stopTimer() {
    if (this.interval) clearInterval(this.interval)
    this.interval = null
  },

  onDollTap(e) {
    if (this.data.result.visible) return

    const dollId = e.detail.dollId
    const dolls = this.data.dolls.slice()
    const idx = dolls.findIndex((d) => d.id === dollId)
    if (idx < 0) return
    const doll = dolls[idx]
    if (!doll.visible) return

    const selected = this.data.selected.slice()

    if (selected.length >= this.data.maxTray) {
      const typeCount = selected.filter((s) => s.type === doll.type).length
      if (typeCount < 2) {
        this.endGame({ title: '栏已满', sub: '待合成栏放不下新的娃娃了' })
        return
      }
    }

    selected.push({ type: doll.type, image: doll.image })
    dolls.splice(idx, 1)

    const merged = this.mergeSelected(selected)
    const visibleDolls = this.computeVisibility(dolls)
    const nextScore = this.data.score + merged.addScore

    this.setData({
      selected: merged.selected,
      score: nextScore,
      dolls: visibleDolls,
    })

    if (merged.triggerFx) this.triggerMergeFx()

    if (visibleDolls.length === 0) {
      this.stopTimer()
      this.endGame({ title: '通关成功！', sub: `得分：${nextScore}` })
      return
    }
  },

  mergeSelected(selected) {
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
  },

  triggerMergeFx() {
    this.setData({ mergeFx: true })
    clearTimeout(this.mergeFxTimeout)
    this.mergeFxTimeout = setTimeout(() => {
      this.setData({ mergeFx: false })
    }, 450)
  },

  endGame({ title, sub }) {
    this.stopTimer()
    this.setData({ result: { visible: true, title, sub } })
  },
})
