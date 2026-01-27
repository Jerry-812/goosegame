const fs = require('fs');
const http = require('http');
const path = require('path');
const { app, BrowserWindow, shell } = require('electron');

const isDev = !app.isPackaged;
const rootDir = path.join(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.gltf': 'model/gltf+json',
  '.glb': 'model/gltf-binary',
  '.bin': 'application/octet-stream',
  '.mp4': 'video/mp4',
  '.wasm': 'application/wasm',
};

let staticServer = null;
let staticPort = null;

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function toSafePath(urlPath) {
  const clean = urlPath.split('?')[0].split('#')[0] || '/';
  const decoded = decodeURIComponent(clean);
  const normalized = path.normalize(decoded);
  if (normalized === path.sep) return '/index.html';
  return normalized.replace(/^(\.\.(\/|\\|$))+/, '/');
}

function sendFile(res, filePath, statusCode = 200) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
    res.writeHead(statusCode, {
      'Content-Type': getMimeType(filePath),
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

function startStaticServer() {
  if (staticServer && staticPort) return Promise.resolve(staticPort);

  return new Promise((resolve, reject) => {
    staticServer = http.createServer((req, res) => {
      const safePath = toSafePath(req.url || '/');
      const filePath = path.join(rootDir, safePath);
      if (!filePath.startsWith(rootDir)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
      }

      fs.stat(filePath, (err, stats) => {
        if (!err && stats.isFile()) {
          sendFile(res, filePath);
          return;
        }

        const ext = path.extname(filePath);
        if (!ext) {
          sendFile(res, path.join(rootDir, 'index.html'));
          return;
        }

        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
      });
    });

    staticServer.once('error', (err) => {
      staticServer = null;
      staticPort = null;
      reject(err);
    });

    staticServer.listen(0, '127.0.0.1', () => {
      staticPort = staticServer.address().port;
      resolve(staticPort);
    });
  });
}

function stopStaticServer() {
  if (!staticServer) return;
  try {
    staticServer.close();
  } catch {
    // ignore
  }
  staticServer = null;
  staticPort = null;
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#f6d2de',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
    if (isDev) {
      win.webContents.openDevTools({ mode: 'detach' });
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  try {
    const port = await startStaticServer();
    await win.loadURL(`http://127.0.0.1:${port}/index.html`);
  } catch (err) {
    // Fall back to file:// if the local server fails for any reason.
    const indexPath = path.join(rootDir, 'index.html');
    await win.loadFile(indexPath);
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  stopStaticServer();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
