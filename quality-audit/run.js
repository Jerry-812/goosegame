const fs = require('fs')
const path = require('path')
const { runRuntimeAudit } = require('./analyzers/runtime')
const { runStaticAudit } = require('./analyzers/static')
const { runGameplayAudit } = require('./analyzers/gameplay')
const { buildReport, formatMarkdown } = require('./analyzers/report')
const { DEFAULTS } = require('./config')

function parseArgs() {
  const args = process.argv.slice(2)
  const options = { outDir: 'quality-audit/output', url: null }
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === '--url') options.url = args[i + 1]
    if (arg === '--out') options.outDir = args[i + 1]
  }
  return options
}

async function run() {
  const repoRoot = path.resolve(__dirname, '..')
  const { outDir, url } = parseArgs()

  const staticAudit = runStaticAudit({ repoRoot })
  const gameplayAudit = runGameplayAudit({ repoRoot })
  const runtime = await runRuntimeAudit({ url, repoRoot, config: DEFAULTS })

  const report = buildReport({ runtime, staticAudit, gameplayAudit, config: DEFAULTS })

  fs.mkdirSync(outDir, { recursive: true })
  const jsonPath = path.join(outDir, 'quality-report.json')
  const mdPath = path.join(outDir, 'quality-report.md')

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2))
  fs.writeFileSync(mdPath, formatMarkdown(report))

  console.log(`报告已生成：${jsonPath}`)
  console.log(`报告已生成：${mdPath}`)
}

run().catch((err) => {
  console.error('[quality-audit] failed', err)
  process.exit(1)
})
