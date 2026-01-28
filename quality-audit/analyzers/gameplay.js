const fs = require('fs')
const path = require('path')

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

function runGameplayAudit({ repoRoot }) {
  const projectConfig = readJsonSafe(path.join(repoRoot, 'project.config.json'))
  const appConfig = readJsonSafe(path.join(repoRoot, 'app.json'))

  return {
    platformSupport: {
      wechat: Boolean(projectConfig),
      pwa: fs.existsSync(path.join(repoRoot, 'manifest.webmanifest')),
      electron: fs.existsSync(path.join(repoRoot, 'electron')),
    },
    metadata: {
      appName: appConfig?.pages ? 'miniprogram' : 'web',
      appId: projectConfig?.appid || 'unknown',
    },
  }
}

module.exports = {
  runGameplayAudit,
}
