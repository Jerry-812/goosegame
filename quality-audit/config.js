const DEFAULTS = {
  runtime: {
    durationMs: 12000,
    warmupMs: 2000,
    maxClicks: 45,
    clickIntervalMs: 160,
  },
  scoring: {
    weights: {
      performance: 0.28,
      stability: 0.22,
      responsiveness: 0.18,
      gameplay: 0.2,
      resource: 0.12,
    },
    targets: {
      fps: 60,
      p95FrameMs: 22,
      longTaskRatio: 0.08,
      inputLatencyMs: 90,
      transferMb: 25,
      memoryMb: 450,
    },
    subpoints: {
      performance: {
        fpsAvg: { target: 60, weight: 0.4 },
        p95FrameMs: { target: 22, weight: 0.35 },
        longTaskRate: { target: 0.08, weight: 0.25 },
      },
      stability: {
        errorCount: { target: 0, weight: 0.5 },
        consoleErrorRate: { target: 0.01, weight: 0.25 },
        longTaskBurst: { target: 3, weight: 0.25 },
      },
      responsiveness: {
        inputP50: { target: 90, weight: 0.5 },
        inputP95: { target: 140, weight: 0.35 },
        clickSuccessRate: { target: 0.9, weight: 0.15 },
      },
      gameplay: {
        itemVariety: { target: 20, weight: 0.4 },
        scoreSpread: { target: 4, weight: 0.3 },
        modelCoverage: { target: 0.6, weight: 0.3 },
      },
      resource: {
        transferMb: { target: 25, weight: 0.5 },
        encodedMb: { target: 28, weight: 0.25 },
        memoryMb: { target: 450, weight: 0.25 },
      },
    },
  },
}

module.exports = {
  DEFAULTS,
}
