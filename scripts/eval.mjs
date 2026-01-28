import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const RUNS = Math.max(1, Number.parseInt(process.env.EVAL_RUNS || "3", 10));

function sumBundleKb(distDir = "dist") {
  const assetsDir = path.join(distDir, "assets");
  if (!fs.existsSync(assetsDir)) return 0;
  const files = fs
    .readdirSync(assetsDir)
    .filter((f) => f.endsWith(".js") || f.endsWith(".css"));
  const bytes = files.reduce((acc, f) => acc + fs.statSync(path.join(assetsDir, f)).size, 0);
  return Math.round(bytes / 1024);
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

async function measureOnce(url) {
  let browser;
  let page;
  try {
    browser = await chromium.launch();
    page = await browser.newPage({ viewport: { width: 450, height: 800 } });
    page.setDefaultTimeout(20000);
    page.setDefaultNavigationTimeout(45000);

    let consoleErrors = 0;
    const consoleErrorDetails = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors += 1;
        consoleErrorDetails.push(`[console:${msg.type()}] ${msg.text()}`);
      }
    });
    page.on("pageerror", (err) => {
      consoleErrors += 1;
      consoleErrorDetails.push(`[pageerror] ${err?.message ?? String(err)}`);
    });

    const t0 = Date.now();
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    const loadMs = Date.now() - t0;

    // Try to start the game if a start/resume button exists.
    const startButton = page.locator("text=开始");
    if (await startButton.count()) {
      await startButton.first().click();
    }
    const resumeButton = page.locator("text=继续");
    if (await resumeButton.count()) {
      await resumeButton.first().click();
    }

    const canvasHandle = await page.waitForSelector("canvas", { timeout: 15000 }).catch(() => null);
    const smokeOk = Boolean(canvasHandle);
    await page.waitForTimeout(500);

    // FPS: count rAF over 3 seconds.
    const fps = await page.evaluate(async () => {
      const durationMs = 3000;
      let frames = 0;
      let start = performance.now();
      return await new Promise((resolve) => {
        function tick(now) {
          frames += 1;
          if (now - start >= durationMs) {
            const secs = (now - start) / 1000;
            resolve(frames / secs);
            return;
          }
          requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      });
    });

    return {
      load_ms: loadMs,
      fps: Math.round(fps * 10) / 10,
      console_errors: consoleErrors,
      console_error_details: consoleErrorDetails,
      smoke_ok: smokeOk,
    };
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

async function measure(url) {
  const runs = [];
  const errorDetails = new Set();
  let maxConsoleErrors = 0;
  let smokeOkAll = true;

  for (let i = 0; i < RUNS; i += 1) {
    const result = await measureOnce(url);
    runs.push(result);
    maxConsoleErrors = Math.max(maxConsoleErrors, result.console_errors);
    smokeOkAll = smokeOkAll && result.smoke_ok;
    for (const detail of result.console_error_details) {
      errorDetails.add(detail);
    }
  }

  const loadMsValues = runs.map((r) => r.load_ms);
  const fpsValues = runs.map((r) => r.fps);

  return {
    load_ms: Math.round(median(loadMsValues)),
    fps: Math.round(median(fpsValues) * 10) / 10,
    console_errors: maxConsoleErrors,
    console_error_details: Array.from(errorDetails),
    bundle_kb: sumBundleKb(process.env.DIST_DIR || "dist"),
    smoke_ok: smokeOkAll,
    runs,
    ts: new Date().toISOString(),
  };
}

const url = process.argv[2];
if (!url) {
  console.error("Usage: node scripts/eval.mjs <url>");
  process.exit(1);
}

const result = await measure(url);
console.log(JSON.stringify(result, null, 2));
