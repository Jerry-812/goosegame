import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_TIMEOUT_MS = 30000;

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

const ensureDir = async (dir) => {
  if (!dir) return;
  await fs.mkdir(dir, { recursive: true });
};

const capture = async ({ url, outputPath, timeoutMs }) => {
  let browser;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 900, height: 1600 } });
    page.setDefaultTimeout(timeoutMs);
    page.setDefaultNavigationTimeout(timeoutMs);
    await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs });

    const maybeClick = async (label) => {
      const locator = page.locator(`text=${label}`);
      if (await locator.count()) {
        await locator.first().click({ timeout: 2000 }).catch(() => {});
      }
    };

    await maybeClick('开始');
    await maybeClick('继续');
    await page.waitForTimeout(1500);

    await ensureDir(path.dirname(outputPath));
    await page.screenshot({ path: outputPath, fullPage: true });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  const url = args.url ?? 'http://127.0.0.1:4173';
  const outputPath = args.output ?? 'debug-screenshots/loop-latest.png';
  const timeoutMs = Number(args['timeout-ms'] ?? DEFAULT_TIMEOUT_MS);

  await capture({ url, outputPath, timeoutMs });
}
