const { DEFAULTS } = require('../config')

function grade(score) {
  if (score >= 90) return 'S'
  if (score >= 80) return 'A'
  if (score >= 70) return 'B'
  if (score >= 60) return 'C'
  if (score >= 50) return 'D'
  return 'E'
}

function toScore(value, target, invert = false) {
  if (target === 0) return 100
  if (invert) {
    const diff = Math.max(0, value - target)
    return Math.max(0, 100 - diff * 1.6)
  }
  return Math.max(0, Math.min(100, (value / target) * 100))
}

function buildSubpoints({ runtime, staticAudit, gameplayAudit, config = DEFAULTS }) {
  const subpoints = {
    performance: {
      fpsAvg: runtime.performance.avgFps,
      p95FrameMs: runtime.performance.p95FrameMs,
      longTaskRate: runtime.performance.longTaskCount / Math.max(runtime.sampleSeconds || 1, 1),
    },
    stability: {
      errorCount: runtime.errors.length,
      consoleErrorRate: runtime.consoleLogs.filter((l) => l.type === 'error').length /
        Math.max(runtime.consoleLogs.length || 1, 1),
      longTaskBurst: runtime.performance.longTaskCount,
    },
    responsiveness: {
      inputP50: runtime.responsiveness.inputLatencyP50,
      inputP95: runtime.responsiveness.inputLatencyP95,
      clickSuccessRate: runtime.input.clickSuccessRate,
    },
    gameplay: {
      itemVariety: staticAudit.gameplayConfig.dollCount,
      scoreSpread: staticAudit.gameplayConfig.scoreStats.max - staticAudit.gameplayConfig.scoreStats.min,
      modelCoverage: staticAudit.gameplayConfig.modelCount /
        Math.max(staticAudit.gameplayConfig.dollCount || 1, 1),
    },
    resource: {
      transferMb: bytesToMb(runtime.resources.transferBytes),
      encodedMb: bytesToMb(runtime.resources.encodedBytes),
      memoryMb: runtime.memory ? bytesToMb(runtime.memory.used) : 0,
    },
  }

  return subpoints
}

function scoreSubpoints(subpoints, config = DEFAULTS) {
  const spec = config.scoring.subpoints
  const scored = {}

  for (const [dimension, points] of Object.entries(subpoints)) {
    const dimensionSpec = spec[dimension]
    const entries = []
    let total = 0
    let weightSum = 0
    for (const [key, value] of Object.entries(points)) {
      const rule = dimensionSpec[key]
      const invert = shouldInvert(dimension, key)
      const score = toScore(value, rule.target, invert)
      const weight = rule.weight
      entries.push({ key, value, target: rule.target, weight, score: round(score), grade: grade(score) })
      total += score * weight
      weightSum += weight
    }
    const finalScore = weightSum ? total / weightSum : 0
    scored[dimension] = {
      score: round(finalScore),
      grade: grade(finalScore),
      subpoints: entries,
    }
  }

  return scored
}

function buildDiagnostics(scored) {
  const diagnostics = []
  const suggestions = []

  for (const [dimension, data] of Object.entries(scored)) {
    for (const point of data.subpoints) {
      if (point.score >= 80) continue
      const rule = describeIssue(dimension, point)
      if (!rule) continue
      diagnostics.push({
        dimension,
        subpoint: point.key,
        grade: point.grade,
        issue: rule.issue,
        reason: rule.reason,
      })
      suggestions.push({
        dimension,
        subpoint: point.key,
        recommendation: rule.recommendation,
      })
    }
  }

  return { diagnostics, suggestions }
}

function describeIssue(dimension, point) {
  const key = `${dimension}.${point.key}`
  const value = point.value
  switch (key) {
    case 'performance.fpsAvg':
      return {
        issue: '帧率偏低',
        reason: `平均 FPS ${value.toFixed(1)} 低于目标 ${point.target}`,
        recommendation: '减少渲染负载，降低阴影/后处理开销，减少场景内物体数量。',
      }
    case 'performance.p95FrameMs':
      return {
        issue: '高帧时间波动',
        reason: `P95 帧时间 ${value.toFixed(1)}ms 高于目标 ${point.target}ms`,
        recommendation: '优化热点逻辑，削减高频内存分配，避免每帧创建对象。',
      }
    case 'performance.longTaskRate':
      return {
        issue: '长任务过多',
        reason: `长任务速率 ${value.toFixed(2)} 超过目标 ${point.target}`,
        recommendation: '拆分主线程任务，避免长循环操作，推迟非关键逻辑。',
      }
    case 'stability.errorCount':
      return {
        issue: '运行错误',
        reason: `错误数量 ${value} 超过目标 ${point.target}`,
        recommendation: '检查最近的报错堆栈，优先修复影响渲染和交互的错误。',
      }
    case 'stability.consoleErrorRate':
      return {
        issue: 'Console 错误比例偏高',
        reason: `错误占比 ${(value * 100).toFixed(1)}% 超过目标 ${(point.target * 100).toFixed(1)}%`,
        recommendation: '减少噪音日志，定位第三方库或资源加载异常。',
      }
    case 'stability.longTaskBurst':
      return {
        issue: '长任务峰值偏高',
        reason: `长任务数量 ${value} 高于目标 ${point.target}`,
        recommendation: '检查资源加载与初始化流程，分批加载资源。',
      }
    case 'responsiveness.inputP50':
      return {
        issue: '输入响应延迟偏高',
        reason: `P50 延迟 ${value.toFixed(1)}ms 高于目标 ${point.target}ms`,
        recommendation: '减少输入事件到渲染响应之间的阻塞，避免同步重计算。',
      }
    case 'responsiveness.inputP95':
      return {
        issue: '输入延迟尾部偏高',
        reason: `P95 延迟 ${value.toFixed(1)}ms 高于目标 ${point.target}ms`,
        recommendation: '消除极端卡顿，检查 GC 峰值与合并逻辑的同步操作。',
      }
    case 'responsiveness.clickSuccessRate':
      return {
        issue: '可点击命中率偏低',
        reason: `有效点击率 ${(value * 100).toFixed(1)}% 低于目标 ${(point.target * 100).toFixed(1)}%`,
        recommendation: '优化可见物体判定与交互反馈，减少阻挡导致的无效点击。',
      }
    case 'gameplay.itemVariety':
      return {
        issue: '玩法类型不足',
        reason: `物品类型 ${value} 少于建议值 ${point.target}`,
        recommendation: '增加道具/物品类别，丰富组合策略。',
      }
    case 'gameplay.scoreSpread':
      return {
        issue: '分值梯度不足',
        reason: `分值跨度 ${value} 低于建议 ${point.target}`,
        recommendation: '拉开分值梯度，体现高价值物品的策略差异。',
      }
    case 'gameplay.modelCoverage':
      return {
        issue: '模型覆盖率不足',
        reason: `模型覆盖率 ${(value * 100).toFixed(1)}% 低于目标 ${(point.target * 100).toFixed(1)}%`,
        recommendation: '补充关键物品模型，提高视觉一致性。',
      }
    case 'resource.transferMb':
      return {
        issue: '资源体积过大',
        reason: `传输体积 ${value}MB 超过目标 ${point.target}MB`,
        recommendation: '压缩纹理与模型，开启资源分包或延迟加载。',
      }
    case 'resource.encodedMb':
      return {
        issue: '编码体积过大',
        reason: `编码体积 ${value}MB 超过目标 ${point.target}MB`,
        recommendation: '优化打包体积，移除冗余资源。',
      }
    case 'resource.memoryMb':
      return {
        issue: '内存占用过高',
        reason: `JS Heap ${value}MB 超过目标 ${point.target}MB`,
        recommendation: '释放不用的缓存与模型，避免重复创建对象。',
      }
    default:
      return null
  }
}

function shouldInvert(dimension, key) {
  const inverted = new Set([
    'performance.p95FrameMs',
    'performance.longTaskRate',
    'stability.errorCount',
    'stability.consoleErrorRate',
    'stability.longTaskBurst',
    'responsiveness.inputP50',
    'responsiveness.inputP95',
    'resource.transferMb',
    'resource.encodedMb',
    'resource.memoryMb',
  ])
  return inverted.has(`${dimension}.${key}`)
}

function bytesToMb(bytes) {
  return Number((bytes / (1024 * 1024)).toFixed(2))
}

function round(value) {
  return Number(value.toFixed(1))
}

module.exports = {
  buildSubpoints,
  scoreSubpoints,
  buildDiagnostics,
}
