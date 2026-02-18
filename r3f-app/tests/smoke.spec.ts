import { test, expect } from '@playwright/test';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('game loads and accepts interaction', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });

  const startBtn = page.getByRole('button', { name: '开始游戏' });
  await expect(startBtn).toBeVisible();
  await startBtn.click();

  const canvas = page.locator('canvas[data-engine]');
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();
  if (box) {
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  }

  await sleep(800);
  await page.screenshot({ path: 'artifacts/smoke.png', fullPage: true });
});
