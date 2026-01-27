const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function readPackageJson() {
  const pkgPath = path.join(__dirname, '..', 'package.json');
  const text = fs.readFileSync(pkgPath, 'utf8');
  return JSON.parse(text);
}

function extractVersion(spec) {
  if (!spec) return null;
  const match = String(spec).match(/\d+\.\d+\.\d+/);
  return match ? match[0] : null;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function fileExists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function main() {
  const pkg = readPackageJson();
  const version = extractVersion(pkg?.devDependencies?.electron);
  if (!version) {
    console.warn('[ensure-electron] Could not determine Electron version.');
    return;
  }

  const electronDir = path.join(__dirname, '..', 'node_modules', 'electron');
  const distDir = path.join(electronDir, 'dist');
  const pathTxt = path.join(electronDir, 'path.txt');
  const appPath = path.join(distDir, 'Electron.app');
  const executableRel = 'Electron.app/Contents/MacOS/Electron';

  if (fileExists(appPath) && fileExists(pathTxt)) {
    return;
  }

  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const zipName = `electron-v${version}-darwin-${arch}.zip`;
  const cacheZip = path.join(os.homedir(), 'Library', 'Caches', 'electron', zipName);

  if (!fileExists(cacheZip)) {
    console.warn(`[ensure-electron] Missing cached Electron zip: ${cacheZip}`);
    console.warn('[ensure-electron] Run "npm run electron:dist" once to populate the cache.');
    return;
  }

  ensureDir(distDir);
  const unzip = spawnSync('unzip', ['-q', cacheZip, '-d', distDir], { stdio: 'inherit' });
  if (unzip.status !== 0) {
    throw new Error('[ensure-electron] Failed to unzip cached Electron binary.');
  }

  fs.writeFileSync(pathTxt, executableRel, 'utf8');
  console.log('[ensure-electron] Electron binary restored from cache.');
}

main();
