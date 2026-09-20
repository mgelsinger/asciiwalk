import { test, expect } from '@playwright/test';

test('static distribution loads from a subdirectory and switches bundled worlds without an API', async ({
  page,
}) => {
  test.skip(!process.env.ASCII_STATIC, 'Run against a production build with ASCII_STATIC=1');
  await page.setViewportSize({ width: 1280, height: 720 });
  const errors: string[] = [];
  const failed: string[] = [];
  const apiRequests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) failed.push(response.url());
  });
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.includes('/api/')) apiRequests.push(request.url());
  });
  await page.goto(process.env.ASCII_TEST_URL || 'http://127.0.0.1:4173/');
  await expect(page.locator('#start')).toBeVisible();
  await page.locator('#intro-destinations').click();
  await page.locator('[data-destination="movie-theater"]').click();
  await expect(page.locator('#world')).toBeFocused();
  const before = await page.evaluate(() => ({ ...(window as any).__asciiWalk.walker.pose }));
  await page.keyboard.down('w');
  try {
    // Software-rendered CI frames can be much slower than a desktop GPU.
    // Require real movement, without assuming a fixed number of frames in 700 ms.
    await expect
      .poll(async () => {
        const after = await page.evaluate(() => (window as any).__asciiWalk.walker.pose);
        return Math.hypot(before.x - after.x, before.z - after.z);
      })
      .toBeGreaterThan(0.5);
  } finally {
    await page.keyboard.up('w');
  }
  await page.keyboard.press('c');
  await expect(page.locator('#color-toggle')).toContainText('Mono');
  for (const name of ['Perry, NY', 'Buffalo, NY', 'Warsaw, New York']) {
    await page.keyboard.press('Escape');
    await page.locator('#pause-locations').click();
    await expect(page.locator('#saved-locations button')).toHaveCount(3);
    await expect(page.locator('#import-form')).toBeHidden();
    await expect(page.locator('#builder-info')).toContainText('get the local app');
    await page.locator('#saved-locations button').filter({ hasText: name }).click();
    await expect(page.locator('#start')).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as any).__asciiWalk.data.manifest.name)).toBe(name);
    await page.locator('#start').click();
  }
  const credits = page.locator('#about a[href$="DATA_LICENSES.txt"]');
  const response = await page.request.get(await credits.evaluate((a) => (a as HTMLAnchorElement).href));
  expect(response.ok()).toBe(true);
  expect(await response.text()).toContain('OpenStreetMap');
  expect(apiRequests).toEqual([]);
  expect(failed).toEqual([]);
  expect(errors).toEqual([]);
});
