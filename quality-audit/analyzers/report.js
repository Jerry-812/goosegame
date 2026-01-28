const { DEFAULTS } = require('../config')
const { buildSubpoints, scoreSubpoints, buildDiagnostics } = require('./diagnostics')

function scoreClamp(value) {
  return Math.max(0, Math.min(100, value))
}

function scoreFromRatio(actual, target) {
  if (!target) return 100
  return scoreClamp((actual / target) * 100)
}

function inverseScore(actual, target) {
  if (!target) return 100
  const diff = Math.max(0, actual - target)
  return scoreClamp(100 - diff * 1.6)
}

function grade(score) {
  if (score >= 90) return 'S'
  if (score >= 80) return 'A'
  if (score >= 70) return 'B'
  if (score >= 60) return 'C'
  if (score >= 50) return 'D'
  return 'E'
}

function buildReport({ runtime, staticAudit, gameplayAudit, config = DEFAULTS }) {
  const { weights, targets } = config.scoring
  const perfScore = scoreClamp(
    scoreFromRatio(runtime.performance.avgFps, targets.fps) * 0.55 +
      inverseScore(runtime.performance.p95FrameMs, targets.p95FrameMs) * 0.45
  )

  const stabilityScore = scoreClamp(
    inverseScore(runtime.performance.longTaskCount, targets.longTaskRatio * 100) * 0.6 +
      (runtime.errors.length ? Math.max(0, 100 - runtime.errors.length * 12) : 100) * 0.4
  )

  const responsivenessScore = scoreClamp(
    inverseScore(runtime.responsiveness.inputLatencyP50, targets.inputLatencyMs) * 0.7 +
      inverseScore(runtime.responsiveness.inputLatencyP95, targets.inputLatencyMs * 1.6) * 0.3
  )

  const resourceScore = scoreClamp(
    inverseScore(bytesToMb(runtime.resources.transferBytes), targets.transferMb) * 0.6 +
      inverseScore(bytesToMb(runtime.resources.encodedBytes), targets.transferMb * 1.1) * 0.4
  )

  const gameplayScore = scoreClamp(
    staticAudit.gameplayConfig.dollCount >= 18 ? 80 : 65 + staticAudit.gameplayConfig.dollCount
  )

  const overall = scoreClamp(
    perfScore * weights.performance +
      stabilityScore * weights.stability +
      responsivenessScore * weights.responsiveness +
      gameplayScore * weights.gameplay +
      resourceScore * weights.resource
  )

  const subpoints = buildSubpoints({ runtime, staticAudit, gameplayAudit, config })
  const scoredSubpoints = scoreSubpoints(subpoints, config)
  const { diagnostics, suggestions } = buildDiagnostics(scoredSubpoints)

  return {
    summary: {
      score: Math.round(overall),
      grade: grade(overall),
    },
    dimensions: {
      performance: Math.round(perfScore),
      stability: Math.round(stabilityScore),
      responsiveness: Math.round(responsivenessScore),
      gameplay: Math.round(gameplayScore),
      resource: Math.round(resourceScore),
    },
    subpoints: scoredSubpoints,
    diagnostics,
    suggestions,
    runtime,
    static: staticAudit,
    gameplay: gameplayAudit,
  }
}

function bytesToMb(bytes) {
  return Number((bytes / (1024 * 1024)).toFixed(2))
}

function formatMarkdown(report) {
  const { summary, dimensions, runtime, static: staticAudit, gameplay, subpoints, diagnostics, suggestions } = report
  const lines = [
    `# Goosegame 质量评估报告`,
    '',
    `**综合评分**：${summary.score} (${summary.grade})`,
    '',
    `## 维度评分`,
    `- 性能：${dimensions.performance}`,
    `- 稳定性：${dimensions.stability}`,
    `- 响应性：${dimensions.responsiveness}`,
    `- 玩法深度：${dimensions.gameplay}`,
    `- 资源负载：${dimensions.resource}`,
    '',
    `## 细分子项评分`,
    ...formatSubpoints(subpoints),
    '',
    `## 运行时指标`,
    `- 平均 FPS：${runtime.performance.avgFps}`,
    `- P95 帧时间：${runtime.performance.p95FrameMs} ms`,
    `- 长任务数量：${runtime.performance.longTaskCount}`,
    `- 输入延迟 P50：${runtime.responsiveness.inputLatencyP50} ms`,
    `- 输入延迟 P95：${runtime.responsiveness.inputLatencyP95} ms`,
    `- 点击命中率：${(runtime.input.clickSuccessRate * 100).toFixed(1)}%`,
    `- 传输体积：${bytesToMb(runtime.resources.transferBytes)} MB`,
    `- JS Heap 使用：${runtime.memory ? bytesToMb(runtime.memory.used) : 'N/A'} MB`,
    '',
    `## 静态配置`,
    `- 物品类型：${staticAudit.gameplayConfig.dollCount}`,
    `- 模型数量：${staticAudit.gameplayConfig.modelCount}`,
    `- 分值区间：${staticAudit.gameplayConfig.scoreStats.min} ~ ${staticAudit.gameplayConfig.scoreStats.max}`,
    `- 资源文件：${staticAudit.assets.files} 个，共 ${bytesToMb(staticAudit.assets.bytes)} MB`,
    '',
    `## 平台覆盖`,
    `- 微信小游戏：${gameplay.platformSupport.wechat ? '是' : '否'}`,
    `- PWA：${gameplay.platformSupport.pwa ? '是' : '否'}`,
    `- Electron：${gameplay.platformSupport.electron ? '是' : '否'}`,
    '',
    `## 错误与日志`,
    `- 运行错误：${runtime.errors.length}`,
    `- Console 日志：${runtime.consoleLogs.length}`,
    '',
    `## 诊断结果`,
    ...formatDiagnostics(diagnostics),
    '',
    `## 优化建议`,
    ...formatSuggestions(suggestions),
  ]

  return lines.join('\n')
}

function formatSubpoints(subpoints) {
  const lines = []
  for (const [dimension, data] of Object.entries(subpoints)) {
    lines.push(`### ${labelDimension(dimension)}（${data.score} / ${data.grade}）`)
    data.subpoints.forEach((point) => {
      lines.push(`- ${labelSubpoint(dimension, point.key)}：${point.score} (${point.grade})`)
    })
  }
  return lines
}

function formatDiagnostics(diagnostics) {
  if (!diagnostics.length) return ['- 暂无异常']
  return diagnostics.map(
    (item) => `- [${labelDimension(item.dimension)}·${labelSubpoint(item.dimension, item.subpoint)}] ${item.issue}：${item.reason}`
  )
}

function formatSuggestions(suggestions) {
  if (!suggestions.length) return ['- 暂无建议']
  return suggestions.map(
    (item) => `- [${labelDimension(item.dimension)}·${labelSubpoint(item.dimension, item.subpoint)}] ${item.recommendation}`
  )
}

function labelDimension(key) {
  const map = {
    performance: '性能',
    stability: '稳定性',
    responsiveness: '响应性',
    gameplay: '玩法深度',
    resource: '资源负载',
  }
  return map[key] || key
}

function labelSubpoint(dimension, key) {
  const labels = {
    performance: {
      fpsAvg: '平均 FPS',
      p95FrameMs: 'P95 帧时间',
      longTaskRate: '长任务速率',
    },
    stability: {
      errorCount: '运行错误数',
      consoleErrorRate: 'Console 错误率',
      longTaskBurst: '长任务峰值',
    },
    responsiveness: {
      inputP50: '输入延迟 P50',
      inputP95: '输入延迟 P95',
      clickSuccessRate: '点击命中率',
    },
    gameplay: {
      itemVariety: '物品类型丰富度',
      scoreSpread: '分值跨度',
      modelCoverage: '模型覆盖率',
    },
    resource: {
      transferMb: '传输体积',
      encodedMb: '编码体积',
      memoryMb: 'JS Heap 占用',
    },
  }
  return labels[dimension]?.[key] || key
}

module.exports = {
  buildReport,
  formatMarkdown,
}
