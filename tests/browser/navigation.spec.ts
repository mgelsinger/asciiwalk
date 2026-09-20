import { test, expect } from '@playwright/test';
test('drag and keyboard turning, compass, intersection names and landmark viewpoints', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('#start')).toBeVisible();
  await page.locator('#map-toggle').click();
  await page.locator('#map-close').click();
  expect(await page.evaluate(() => (window as any).__asciiWalk.walker.enabled)).toBe(false);
  await page.locator('#start').click();
  expect(await page.evaluate(() => !!document.pointerLockElement)).toBe(false);
  const pose = () => page.evaluate(() => (window as any).__asciiWalk.walker.pose);
  let p = await pose();
  await page.mouse.move(650, 400);
  await page.mouse.down();
  await page.mouse.move(800, 420, { steps: 8 });
  await page.mouse.up();
  expect(Math.abs((await pose()).yaw - p.yaw)).toBeGreaterThan(0.15);
  p = await pose();
  await page.keyboard.down('q');
  await page.waitForTimeout(400);
  await page.keyboard.up('q');
  expect((await pose()).yaw - p.yaw).toBeGreaterThan(0.3);
  await page.evaluate(() => (window as any).__asciiWalk.setPose({ x: 0, z: 0, yaw: -Math.PI / 2 }));
  await expect(page.locator('#heading')).toContainText('E / 090');
  await expect(page.locator('#cross-street')).toContainText('Main Street & Buffalo Street');
  await page.locator('#color-toggle').click();
  p = await pose();
  await page.keyboard.down('w');
  await page.waitForTimeout(500);
  await page.keyboard.up('w');
  expect(Math.hypot((await pose()).x - p.x, (await pose()).z - p.z)).toBeGreaterThan(0.4);
  await page.keyboard.press('m');
  await expect(page.locator('#map-panel')).toBeVisible();
  p = await pose();
  await page.keyboard.down('w');
  await page.waitForTimeout(150);
  await page.keyboard.up('w');
  expect(await pose()).toEqual(p);
  await page.keyboard.press('m');
  await expect(page.locator('#map-panel')).toBeHidden();
  await page.keyboard.down('w');
  await page.waitForTimeout(300);
  await page.keyboard.up('w');
  expect((await pose()).x).toBeGreaterThan(p.x);
  for (const name of ['Civil War Monument', 'Wyoming County Courthouse', 'Warsaw Shopping Center']) {
    await page.keyboard.press('m');
    await page
      .locator('#landmarks')
      .getByRole('button', { name: new RegExp(name) })
      .click();
    await expect(page.locator('#map-panel')).toBeHidden();
    if (name === 'Civil War Monument')
      await expect(page.locator('#street-name')).toHaveText('Monument Circle');
    expect(
      await page.evaluate(() => {
        const a = (window as any).__asciiWalk;
        return a.walker.blocked(a.walker.pose.x, a.walker.pose.z);
      }),
    ).toBe(false);
  }
  expect(errors).toEqual([]);
});
