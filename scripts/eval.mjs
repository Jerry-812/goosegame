import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_FPS_DURATION_MS = 3000;

const ensureDir = async (dir) => {
  if (!dir) return;
  await fs.mkdir(dir, { recursive: true });
};

const listAssetSizes = async (dir) => {
  let totalBytes = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      totalBytes += await listAssetSizes(fullPath);
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.js') || entry.name.endsWith('.css')) {
        const stat = await fs.stat(fullPath);
        totalBytes += stat.size;
      }
    }
  }
  return totalBytes;
};

const computeBundleKb = async (distDir) => {
  if (!distDir) return null;
  const assetsDir = path.join(distDir, 'assets');
  try {
    const bytes = await listAssetSizes(assetsDir);
    return Number((bytes / 1024).toFixed(2));
  } catch (error) {
    return null;
  }
};

const measureFps = async (page, durationMs) => {
  const result = await page.evaluate(async (duration) => {
    return await new Promise((resolve) => {
      let frames = 0;
      const start = performance.now();

      const tick = (now) => {
        frames += 1;
        if (now - start >= duration) {
          resolve({ frames, elapsed: now - start });
          return;
        }
        requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    });
  }, durationMs);

  return Number((result.frames / (result.elapsed / 1000)).toFixed(2));
};

export const runEval = async ({
  url,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fpsDurationMs = DEFAULT_FPS_DURATION_MS,
  screenshotDir,
  distDir,
}) => {
  const startedAt = new Date().toISOString();
  let browser;
  let page;
  const consoleErrors = [];

  try {
    browser = await chromium.launch();
    page = await browser.newPage();

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (error) => {
      consoleErrors.push(error.message);
    });

    page.setDefaultTimeout(timeoutMs);
    page.setDefaultNavigationTimeout(timeoutMs);

    const navigationStart = Date.now();
    await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs });
    const loadMs = Date.now() - navigationStart;

    const maybeClick = async (label) => {
      const locator = page.locator(`text=${label}`);
      if (await locator.count()) {
        await locator.first().click({ timeout: 2000 }).catch(() => {});
        return true;
      }
      return false;
    };

    await maybeClick('开始');
    await maybeClick('继续');

    const canvasHandle = await page
      .waitForSelector('canvas', { timeout: 15000 })
      .catch(() => null);
    const smokeOk = Boolean(canvasHandle);
    if (canvasHandle) {
      const box = await canvasHandle.boundingBox();
      if (box) {
        const clicks = [
          [0.5, 0.5],
          [0.35, 0.45],
          [0.65, 0.55],
        ];
        for (const [rx, ry] of clicks) {
          await page.mouse.click(box.x + box.width * rx, box.y + box.height * ry);
        }
      }
    }

    const fps = await measureFps(page, fpsDurationMs);
    const bundleKb = await computeBundleKb(distDir);

    return {
      success: true,
      url,
      load_ms: loadMs,
      fps,
      smoke_ok: smokeOk,
      console_errors: {
        count: consoleErrors.length,
        samples: consoleErrors.slice(0, 20),
      },
      bundle_kb: bundleKb,
      timestamp: startedAt,
    };
  } catch (error) {
    let screenshotPath = null;
    if (page && screenshotDir) {
      await ensureDir(screenshotDir);
      screenshotPath = path.join(
        screenshotDir,
        `eval-failure-${Date.now()}.png`,
      );
      try {
        await page.screenshot({ path: screenshotPath, fullPage: true });
      } catch (screenshotError) {
        screenshotPath = null;
      }
    }

    return {
      success: false,
      url,
      load_ms: null,
      fps: null,
      console_errors: {
        count: consoleErrors.length,
        samples: consoleErrors.slice(0, 20),
      },
      bundle_kb: await computeBundleKb(distDir),
      timestamp: startedAt,
      error: error instanceof Error ? error.message : String(error),
      screenshot: screenshotPath,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

const parseArgs = (argv) => {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    const value = argv[i + 1];
    args[key.slice(2)] = value;
    i += 1;
  }
  return args;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  const url = args.url ?? 'http://127.0.0.1:4173';
  const timeoutMs = Number(args['timeout-ms'] ?? DEFAULT_TIMEOUT_MS);
  const fpsDurationMs = Number(args['fps-duration-ms'] ?? DEFAULT_FPS_DURATION_MS);
  const screenshotDir = args['screenshot-dir'];
  const distDir = args['dist-dir'];

  const result = await runEval({
    url,
    timeoutMs,
    fpsDurationMs,
    screenshotDir,
    distDir,
  });

  const outputPath = args.output;
  if (outputPath) {
    await ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, JSON.stringify(result, null, 2));
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.success) {
    process.exitCode = 1;
  }
}
