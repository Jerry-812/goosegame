const fs = require('fs')
const path = require('path')

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8')
  } catch {
    return ''
  }
}

function parseDollTypes(source) {
  const match = source.match(/const DOLL_TYPES = \[(.*?)]\n\nconst DOLL_MAP/s)
  if (!match) return []
  const block = match[1]
  const entries = block
    .split(/\n\s*},\n/)
    .map((chunk) => chunk.replace(/^[\s,{]+|[\s}]+$/g, ''))
    .filter(Boolean)

  return entries.map((entry) => {
    const typeMatch = entry.match(/type: '([^']+)'/)
    const labelMatch = entry.match(/label: '([^']+)'/)
    const scoreMatch = entry.match(/score: ([0-9.]+)/)
    const modelMatch = entry.match(/modelUrl: ([^,]+),?/)
    const iconMatch = entry.match(/icon: '([^']+)'/)
    return {
      type: typeMatch ? typeMatch[1] : 'unknown',
      label: labelMatch ? labelMatch[1] : '',
      score: scoreMatch ? Number(scoreMatch[1]) : 10,
      hasModel: Boolean(modelMatch),
      icon: iconMatch ? iconMatch[1] : '',
    }
  })
}

function analyzeAssets(repoRoot) {
  const assetDirs = ['assets', 'images', 'icons']
  const totals = { bytes: 0, files: 0, byDir: {} }

  for (const dir of assetDirs) {
    const full = path.join(repoRoot, dir)
    if (!fs.existsSync(full)) continue
    const stack = [full]
    let bytes = 0
    let files = 0
    while (stack.length) {
      const current = stack.pop()
      const stats = fs.statSync(current)
      if (stats.isDirectory()) {
        fs.readdirSync(current).forEach((child) => stack.push(path.join(current, child)))
      } else {
        files += 1
        bytes += stats.size
      }
    }
    totals.byDir[dir] = { bytes, files }
    totals.bytes += bytes
    totals.files += files
  }

  return totals
}

function analyzeMainFile(repoRoot) {
  const mainPath = path.join(repoRoot, 'main.js')
  const source = readFileSafe(mainPath)
  const dollTypes = parseDollTypes(source)
  const scoreValues = dollTypes.map((d) => d.score)
  const scoreMin = Math.min(...scoreValues)
  const scoreMax = Math.max(...scoreValues)
  const scoreAvg = scoreValues.reduce((sum, v) => sum + v, 0) / (scoreValues.length || 1)
  const modelCount = dollTypes.filter((d) => d.hasModel).length
  const uniqueScores = new Set(scoreValues)

  return {
    dollTypes,
    scoreStats: {
      min: Number.isFinite(scoreMin) ? scoreMin : 0,
      max: Number.isFinite(scoreMax) ? scoreMax : 0,
      avg: Number.isFinite(scoreAvg) ? Number(scoreAvg.toFixed(2)) : 0,
      unique: uniqueScores.size,
    },
    modelCount,
  }
}

function runStaticAudit({ repoRoot }) {
  const assets = analyzeAssets(repoRoot)
  const main = analyzeMainFile(repoRoot)

  return {
    assets,
    gameplayConfig: {
      dollCount: main.dollTypes.length,
      modelCount: main.modelCount,
      scoreStats: main.scoreStats,
      sample: main.dollTypes.slice(0, 6),
    },
  }
}

module.exports = {
  runStaticAudit,
}
