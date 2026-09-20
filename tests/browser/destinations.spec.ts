import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { warsawDestinations } from '../../src/app/destinations';

test('Warsaw location selector places every destination on walkable ground and preserves the local start', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await expect(page.locator('#start')).toBeVisible();
  await page.locator('#intro-destinations').click();
  await expect(page.getByRole('dialog', { name: 'Where would you like to go?' })).toBeVisible();
  await expect(page.locator('#destination-list button')).toHaveCount(8);
  if (info.project.name === 'chrome') {
    mkdirSync('docs/validation/locations', { recursive: true });
    await page.screenshot({ path: 'docs/validation/locations/selector.png' });
  }
  await page.getByRole('button', { name: 'Close location selector' }).click();
  await expect(page.locator('#intro')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__asciiWalk.walker.enabled)).toBe(false);

  for (const d of warsawDestinations) {
    await page.locator('#destinations-open').click();
    await page.locator(`[data-destination="${d.id}"]`).click();
    await expect(page.locator('#destinations')).toBeHidden();
    await expect(page.locator('#intro')).toBeHidden();
    await expect(page.locator('#pause')).toBeHidden();
    await expect(page.locator('#world')).toBeFocused();
    const arrival = await page.evaluate(() => {
      const a = (window as any).__asciiWalk;
      return {
        pose: a.walker.pose,
        blocked: a.walker.blocked(a.walker.pose.x, a.walker.pose.z),
        enabled: a.walker.enabled,
        distance: a.walker.distance,
      };
    });
    expect(arrival.pose).toEqual(d.pose);
    expect(arrival.blocked).toBe(false);
    expect(arrival.enabled).toBe(true);
    expect(await page.evaluate(() => !!document.pointerLockElement)).toBe(false);
    await page.keyboard.down('w');
    await page.waitForTimeout(650);
    await page.keyboard.up('w');
    const after = await page.evaluate(() => (window as any).__asciiWalk.walker.pose);
    expect(Math.hypot(after.x - d.pose.x, after.z - d.pose.z), `${d.id} can walk forward`).toBeGreaterThan(
      0.5,
    );
    await page.keyboard.press('r');
    expect(await page.evaluate(() => (window as any).__asciiWalk.walker.pose)).toEqual(d.pose);
    if (info.project.name === 'chrome') {
      await page.screenshot({ path: `docs/validation/locations/${d.id}.png` });
    }
  }

  // Closing the selector resumes an active walk; selecting from the map clears both overlays.
  await page.keyboard.press('g');
  const before = await page.evaluate(() => (window as any).__asciiWalk.walker.pose);
  await page.keyboard.press('w');
  expect(await page.evaluate(() => (window as any).__asciiWalk.walker.pose)).toEqual(before);
  await page.keyboard.press('Escape');
  await expect(page.locator('#destinations')).toBeHidden();
  await expect(page.locator('#pause')).toBeHidden();
  await expect.poll(() => page.evaluate(() => (window as any).__asciiWalk.walker.enabled)).toBe(true);
  await page.keyboard.press('m');
  await page.locator('#destinations-open').click();
  await page.locator('[data-destination="park"]').click();
  await expect(page.locator('#map-panel')).toBeHidden();
  await expect(page.locator('#pause')).toBeHidden();
  await page.keyboard.down('w');
  await page.waitForTimeout(400);
  await page.keyboard.up('w');
  await page.reload();
  await expect(page.locator('#start')).toBeVisible();
  await page.locator('#start').click();
  await page.keyboard.press('r');
  expect(await page.evaluate(() => (window as any).__asciiWalk.walker.pose)).toEqual(
    warsawDestinations.find((d) => d.id === 'park')!.pose,
  );
  await page.keyboard.press('Escape');
  await page.locator('#pause-destinations').click();
  await page.getByRole('button', { name: 'Close location selector' }).click();
  await expect(page.locator('#pause')).toBeVisible();
  await page.locator('#pause-destinations').click();
  await page.locator('[data-destination="monument"]').click();
  await expect(page.locator('#pause')).toBeHidden();
  await page.locator('#mouse-capture').click();
  await page.keyboard.press('g');
  await expect(page.locator('#destinations')).toBeVisible();
  await page.locator('[data-destination="movie-theater"]').click();
  await expect.poll(() => page.evaluate(() => (window as any).__asciiWalk.walker.enabled)).toBe(true);
  expect(await page.evaluate(() => !!document.pointerLockElement)).toBe(false);
  expect(errors).toEqual([]);
});

test('Warsaw destinations are hidden in another prepared town', async ({ page }) => {
  await page.goto('/?world=area-42p7156-78p0056-1000');
  await expect(page.locator('#start')).toBeVisible();
  await expect(page.locator('#destinations-open')).toBeHidden();
  await expect(page.locator('#intro-destinations')).toBeHidden();
  await page.locator('#start').click();
  await page.keyboard.press('g');
  await expect(page.locator('#destinations')).toBeHidden();
});
