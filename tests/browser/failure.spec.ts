import { test, expect } from '@playwright/test';
test('provider failure preserves a playable location and accepts retry', async ({ page }) => {
  // This UI recovery check must also work on a clean install without Python.
  await page.route('**/api/status', (route) =>
    route.fulfill({ json: { ready: true, token: 'fixture-session' } }),
  );
  await page.goto('/');
  await expect(page.locator('#start')).toBeVisible({ timeout: 30000 });
  await page.route('**/api/imports', (route) =>
    route.fulfill({ status: 503, json: { error: 'Terrain provider unavailable. Retry later.' } }),
  );
  await page.locator('#locations-open').click();
  await page.locator('#prepare-area').click();
  await expect(page.locator('#import-status')).toContainText('Terrain provider unavailable');
  expect(await page.evaluate(() => (window as any).__asciiWalk.ready)).toBe(true);
  await expect(page.locator('#prepare-area')).toBeEnabled();
  await page.getByRole('button', { name: 'Close places' }).click();
  await page.locator('#start').click();
  expect(await page.evaluate(() => (window as any).__asciiWalk.walker.enabled)).toBe(true);
});
test('graphics loss offers a persistent reload path', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#start')).toBeVisible({ timeout: 30000 });
  await page.evaluate(() => (window as any).__asciiWalk.renderer.renderer.forceContextLoss());
  await expect(page.getByRole('button', { name: 'Reload world' })).toBeVisible();
  await page.getByRole('button', { name: 'Reload world' }).click();
  await expect(page.locator('#start')).toBeVisible({ timeout: 30000 });
});
