import { test, expect } from '@playwright/test';
test('prepare small-town and city areas, reopen from cache, and cancel safely', async ({ page }, info) => {
  test.skip(
    process.env.ASCII_IMPORTS !== '1' || info.project.name !== 'chrome',
    'Opt-in provider integration; set ASCII_IMPORTS=1.',
  );
  test.setTimeout(600000);
  await page.goto('/');
  await expect(page.locator('#start')).toBeVisible({ timeout: 30000 });
  for (const area of [
    { name: 'Perry, NY', lat: 42.7156, lon: -78.0056 },
    { name: 'Buffalo, NY', lat: 42.8864, lon: -78.8784 },
  ]) {
    await page.locator('#locations-open').click();
    await page.locator('#place-search').fill(area.name);
    await page.locator('#latitude').fill(String(area.lat));
    await page.locator('#longitude').fill(String(area.lon));
    await page.locator('#area-size').selectOption('1000');
    await page.locator('#preview-area').click();
    await expect(page.locator('#import-status')).toContainText('Ready to prepare.', { timeout: 240000 });
    await expect(page.locator('#area-preview')).toContainText('#');
    await page.screenshot({ path: `docs/validation/${area.name.split(',')[0].toLowerCase()}-preview.png` });
    await page.locator('#prepare-area').click();
    await expect(page.locator('#start')).toContainText(area.name.split(',')[0], { timeout: 240000 });
    await expect(page.locator('#start')).toBeVisible();
    expect(
      await page.evaluate(() => {
        const a = (window as any).__asciiWalk;
        return a.walker.blocked(a.walker.pose.x, a.walker.pose.z);
      }),
    ).toBe(false);
    await page.locator('#start').click();
    await page.evaluate(() => document.exitPointerLock());
    await page.screenshot({ path: `docs/validation/${area.name.split(',')[0].toLowerCase()}-world.png` });
    await page.evaluate(() => {
      (window as any).__asciiWalk.start();
    });
    await page.keyboard.press('Escape');
    await page.locator('#pause-locations').click();
    await page.locator('#saved-locations').getByRole('button', { name: area.name }).click();
    await expect(page.locator('#start')).toBeVisible({ timeout: 30000 });
  }
  await page.locator('#locations-open').click();
  await page.locator('#latitude').fill('42.7158');
  await page.locator('#longitude').fill('-78.0058');
  await page.locator('#prepare-area').click();
  await page.locator('#cancel-import').click();
  await expect(page.locator('#import-status')).toContainText('cancelled', { timeout: 10000 });
  await page.locator('#saved-locations').getByRole('button', { name: 'Warsaw, New York' }).click();
  await expect(page.locator('#start')).toContainText('Warsaw');
});
