import { test, expect } from '@playwright/test';
test('walk, pause, map, monochrome, persistence and safe reset', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#start')).toBeVisible({ timeout: 30000 });
  await page.locator('#start').click();
  await page.evaluate(() => document.exitPointerLock());
  await page.evaluate(() => {
    (window as any).__asciiWalk.start();
    document.getElementById('world')!.focus();
  });
  const before = await page.evaluate(() => (window as any).__asciiWalk.walker.pose);
  await page.keyboard.down('w');
  await page.waitForTimeout(1200);
  await page.keyboard.up('w');
  const after = await page.evaluate(() => (window as any).__asciiWalk.walker.pose);
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(0.8);
  await page.keyboard.press('c');
  await expect(page.locator('#color-toggle')).toHaveText('[c] Mono');
  const unchanged = await page.evaluate(() => (window as any).__asciiWalk.walker.pose);
  expect(unchanged).toEqual(after);
  await page.keyboard.press('m');
  await expect(page.locator('#ascii-map')).toContainText('@');
  await page.keyboard.press('Escape');
  await expect(page.locator('#pause')).toBeVisible();
  await page.keyboard.down('w');
  await page.waitForTimeout(200);
  await page.keyboard.up('w');
  expect(await page.evaluate(() => (window as any).__asciiWalk.walker.pose)).toEqual(after);
  await page.locator('#settings-open').click();
  await page.locator('#density').selectOption('fine');
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.reload();
  await expect(page.locator('#start')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('#color-toggle')).toHaveText('[c] Mono');
  expect(await page.evaluate(() => (window as any).__asciiWalk.walker.pose)).toEqual(after);
  await page.setViewportSize({ width: 950, height: 650 });
  await page.locator('#start').click();
  await page.keyboard.press('r');
  expect(
    await page.evaluate(() => {
      const a = (window as any).__asciiWalk;
      return a.walker.blocked(a.walker.pose.x, a.walker.pose.z);
    }),
  ).toBe(false);
  expect(errors).toEqual([]);
});
