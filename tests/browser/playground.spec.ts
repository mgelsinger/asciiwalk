import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

test.use({ video: { mode: 'on', size: { width: 1280, height: 720 } } });
test('reduced motion starts posed swings frozen and the nearby push button works', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#start')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__asciiWalk.world.recreation.live)).toBe(false);
  await page.locator('#intro-destinations').click();
  await page.locator('[data-destination="park"]').click();
  const positioned = await page.evaluate(() => {
    const a = (window as any).__asciiWalk;
    const item = a.world.recreation.interactions.find(
      (i: any) => i.label === 'Push the swings' && i.object.parent.name === 'playground-477964576',
    );
    item.object.updateWorldMatrix(true, false);
    const e = item.object.matrixWorld.elements;
    for (const side of [-1, 1]) {
      const x = e[12] + e[8] * 5.4 * side,
        z = e[14] + e[10] * 5.4 * side;
      if (a.setPose({ x, z, yaw: Math.atan2(x - e[12], z - e[14]), pitch: 0.04 })) return true;
    }
    return false;
  });
  expect(positioned).toBe(true);
  const angles = () =>
    page.evaluate(() => {
      const r = (window as any).__asciiWalk.world.recreation;
      return r.interactions
        .find((i: any) => i.label === 'Push the swings' && i.object.parent.name === 'playground-477964576')
        .object.parent.children.filter((c: any) => c.position.y === 3.35)
        .map((c: any) => c.rotation.x);
    });
  const still = await angles();
  expect(still).toHaveLength(3);
  expect(still.some((n: number) => Math.abs(n) > 0.1)).toBe(true);
  await page.waitForTimeout(300);
  expect(await angles()).toEqual(still);
  await page.locator('#settings-open').click();
  await page.locator('#activity').selectOption('live');
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.locator('#resume').click();
  await expect(page.locator('#interact')).toHaveText('[f] Push the swings');
  await page.locator('#interact').click();
  await expect(page.locator('#world')).toBeFocused();
  await expect(page.locator('#notice')).toHaveText('A little higher.');
  const moving = await angles();
  await page.waitForTimeout(3500);
  expect(await angles()).not.toEqual(moving);
  if (info.project.name === 'chrome') {
    mkdirSync('docs/validation/park', { recursive: true });
    await page.screenshot({ path: 'docs/validation/park/swings-color.png' });
    await page.keyboard.press('c');
    await page.waitForTimeout(3500);
    await page.screenshot({ path: 'docs/validation/park/swings-mono.png' });
  }
});
