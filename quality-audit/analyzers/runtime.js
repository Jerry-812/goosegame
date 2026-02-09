const { chromium } = require('playwright')
const path = require('path')
const http = require('http')
const fs = require('fs')
const { DEFAULTS } = require('../config')

function ensureDebugUrl(url) {
  const parsed = new URL(url)
  if (!parsed.searchParams.get('debug')) {
    parsed.searchParams.set('debug', '1')
  }
  return parsed.toString()
}

function serveStatic(rootDir) {
  const server = http.createServer((req, res) => {
    const safePath = decodeURIComponent(req.url.split('?')[0])
    const filePath = path.join(rootDir, safePath === '/' ? 'index.html' : safePath.slice(1))
    if (!filePath.startsWith(rootDir)) {
      res.writeHead(403)
      res.end('Forbidden')
      return
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404)
        res.end('Not found')
        return
      }
      res.writeHead(200)
      res.end(data)
    })
  })

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      resolve({ server, url: `http://127.0.0.1:${port}/index.html` })
    })
  })
}

async function runRuntimeAudit({ url, repoRoot, config = DEFAULTS }) {
  const runtimeConfig = config.runtime
  let serverInfo = null
  let targetUrl = url

  if (!targetUrl) {
    serverInfo = await serveStatic(repoRoot)
    targetUrl = serverInfo.url
  }

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })

  const errors = []
  const consoleLogs = []

  page.on('pageerror', (err) => {
    errors.push({ type: 'pageerror', message: String(err) })
  })
  page.on('console', (msg) => {
    consoleLogs.push({ type: msg.type(), text: msg.text() })
  })

  await page.goto(ensureDebugUrl(targetUrl), { waitUntil: 'domcontentloaded' })

  await page.waitForTimeout(runtimeConfig.warmupMs)

  const metrics = await page.evaluate(async (durationMs, clickCount, clickIntervalMs) => {
    const rafSamples = []
    const longTasks = []
    const inputLatencies = []
    const navigation = performance.getEntriesByType('navigation')[0]
    let clickAttempts = 0
    let clickSuccesses = 0

    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.duration > 50) longTasks.push(entry.duration)
        })
      })
      try {
        observer.observe({ entryTypes: ['longtask'] })
      } catch {
        // ignore
      }
    }

    let last = performance.now()
    let running = true
    function rafLoop(now) {
      if (!running) return
      rafSamples.push(now - last)
      last = now
      requestAnimationFrame(rafLoop)
    }
    requestAnimationFrame(rafLoop)

    function measureLatency() {
      const start = performance.now()
      requestAnimationFrame(() => {
        inputLatencies.push(performance.now() - start)
      })
    }

    function pickAvailable() {
      const goose = window.__goosegame
      if (!goose || !goose.state || !goose.pickDoll) return null
      const candidate = goose.state.dolls.find((d) => !d.blocked && !d.animating)
      if (candidate) {
        goose.pickDoll(candidate.id)
        clickSuccesses += 1
      }
      return candidate
    }

    for (let i = 0; i < clickCount; i += 1) {
      clickAttempts += 1
      measureLatency()
      pickAvailable()
      await new Promise((resolve) => setTimeout(resolve, clickIntervalMs))
    }

    await new Promise((resolve) => setTimeout(resolve, durationMs))

    running = false

    const resources = performance.getEntriesByType('resource')
    const transferSize = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0)
    const encodedBodySize = resources.reduce((sum, r) => sum + (r.encodedBodySize || 0), 0)

    return {
      rafSamples,
      longTasks,
      inputLatencies,
      navigation: navigation
        ? {
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.startTime,
            loadEvent: navigation.loadEventEnd - navigation.startTime,
          }
        : null,
      transferSize,
      encodedBodySize,
      memory: performance.memory
        ? {
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
          }
        : null,
      clickAttempts,
      clickSuccesses,
    }
  }, runtimeConfig.durationMs, runtimeConfig.maxClicks, runtimeConfig.clickIntervalMs)

  await browser.close()
  if (serverInfo) serverInfo.server.close()

  const fpsSamples = metrics.rafSamples.map((ms) => (ms > 0 ? 1000 / ms : 0))
  const avgFps = fpsSamples.reduce((sum, v) => sum + v, 0) / (fpsSamples.length || 1)
  const sortedFrames = [...metrics.rafSamples].sort((a, b) => a - b)
  const p95Index = Math.floor(sortedFrames.length * 0.95)
  const p95FrameMs = sortedFrames[p95Index] || 0

  return {
    performance: {
      avgFps: Number(avgFps.toFixed(1)),
      p95FrameMs: Number(p95FrameMs.toFixed(1)),
      longTaskCount: metrics.longTasks.length,
      longTaskAvgMs: metrics.longTasks.length
        ? Number((metrics.longTasks.reduce((sum, v) => sum + v, 0) / metrics.longTasks.length).toFixed(1))
        : 0,
    },
    responsiveness: {
      inputLatencyP50: percentile(metrics.inputLatencies, 0.5),
      inputLatencyP95: percentile(metrics.inputLatencies, 0.95),
      samples: metrics.inputLatencies.length,
    },
    input: {
      clickAttempts: metrics.clickAttempts,
      clickSuccesses: metrics.clickSuccesses,
      clickSuccessRate: metrics.clickAttempts ? metrics.clickSuccesses / metrics.clickAttempts : 0,
    },
    resources: {
      transferBytes: metrics.transferSize,
      encodedBytes: metrics.encodedBodySize,
    },
    memory: metrics.memory,
    navigation: metrics.navigation,
    sampleSeconds: Number((runtimeConfig.durationMs / 1000).toFixed(1)),
    errors,
    consoleLogs,
  }
}

function percentile(list, p) {
  if (!list.length) return 0
  const sorted = [...list].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p))
  return Number(sorted[idx].toFixed(1))
}

module.exports = {
  runRuntimeAudit,
  ensureDebugUrl,
}
