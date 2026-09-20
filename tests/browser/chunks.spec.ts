import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
test('repeated town traversal retains bounded GPU geometry', async ({ page }, info) => {
  test.setTimeout(120000);
  await page.goto('/');
  await expect(page.locator('#start')).toBeVisible({ timeout: 30000 });
  await page.evaluate(() => (window as any).__asciiWalk.start());
  const samples = [];
  for (let loop = 0; loop < 3; loop++) {
    for (const pose of [
      { x: 0, z: 0, yaw: 0 },
      { x: -740, z: 44, yaw: 1.55 },
      { x: -21, z: -590, yaw: Math.PI },
      { x: 8, z: 400, yaw: 0 },
      { x: 0, z: 0, yaw: 0 },
    ]) {
      expect(await page.evaluate((p) => (window as any).__asciiWalk.setPose(p), pose)).toBe(true);
      await page.waitForTimeout(550);
    }
    samples.push(await page.evaluate(() => (window as any).__asciiWalk.stats()));
  }
  writeFileSync(`docs/validation/chunks-${info.project.name}.json`, JSON.stringify(samples, null, 2));
  expect(samples[2].geometries).toBeLessThanOrEqual(samples[1].geometries + 5);
  expect(samples[2].activeChunks).toBeLessThan(100);
});
