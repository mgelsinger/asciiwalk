import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

test('destination details render in color and monochrome, and the marquee works while motion is frozen', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#start')).toBeVisible();
  await page.locator('#start').click();
  const cameras = [
    { id: 'school', x: -337, z: -374, yaw: 0, pitch: 0.15 },
    { id: 'elementary-school', x: -397, z: 9, yaw: 0, pitch: 0.1 },
    { id: 'movie-theater', x: 6, z: 44, yaw: Math.PI / 2, pitch: 0.12 },
    { id: 'shopping-center', x: 9, z: -2180, yaw: 0.6, pitch: 0.03 },
    { id: 'athletic-field', x: -308, z: -609, yaw: Math.PI / 2, pitch: -0.12 },
    { id: 'monument', x: 22, z: -281, yaw: 1.72, pitch: 0.2 },
    { id: 'courthouse', x: -16, z: -308, yaw: 1.76, pitch: 0.13 },
    { id: 'downtown', x: -9.5, z: 12, yaw: -0.72, pitch: 0.09 },
    { id: 'library', x: 0, z: -237, yaw: -1.2, pitch: 0.12 },
    { id: 'postoffice', x: 4, z: 80, yaw: 1.7, pitch: 0.09 },
    { id: 'methodist', x: -10, z: -243, yaw: Math.PI / 2, pitch: 0.2 },
    { id: 'trinity', x: -137, z: 4, yaw: Math.PI, pitch: 0.14 },
    { id: 'baptist', x: 3, z: 136, yaw: 1.57, pitch: 0.21 },
  ];
  mkdirSync('docs/validation/details', { recursive: true });
  const results = [];
  for (const c of cameras) {
    expect(await page.evaluate((p) => (window as any).__asciiWalk.setPose(p), c), c.id).toBe(true);
    await page.waitForTimeout(400);
    const detail = await page.evaluate((id) => {
      const a = (window as any).__asciiWalk,
        s = a.world.places.sites.find((s: any) => s.id === id);
      return { id, visible: s.group.visible, inventory: [...s.inventory], stats: a.stats() };
    }, c.id);
    expect(detail.visible).toBe(true);
    expect(detail.inventory.length).toBeGreaterThan(1);
    results.push(detail);
    if (info.project.name === 'chrome')
      for (const mode of ['color', 'mono', 'geometry']) {
        await page.evaluate((mode) => {
          const a = (window as any).__asciiWalk;
          a.debug(mode === 'geometry' ? 1 : 0);
          a.renderer.pass.uniforms.uMono.value = mode === 'mono' ? 1 : 0;
        }, mode);
        await page.screenshot({ path: `docs/validation/details/${c.id}-${mode}.png` });
      }
  }
  await page.evaluate(() => {
    const a = (window as any).__asciiWalk;
    a.debug(0);
    a.setPose({ x: -8.5, z: 44, yaw: Math.PI / 2, pitch: 0.18 });
  });
  await expect(page.locator('#interact')).toHaveText('[f] Change the marquee');
  await page.keyboard.press('f');
  await expect(page.locator('#notice')).toHaveText('Now on the marquee: WALK THE VALLEY.');
  expect(
    await page.evaluate(() =>
      (window as any).__asciiWalk.world.places.signs.some((s: any) => s.text === 'WALK THE VALLEY'),
    ),
  ).toBe(true);
  await page.locator('#settings-open').click();
  await page.locator('#activity').selectOption('live');
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.locator('#resume').click();
  const before = await page.evaluate(() => (window as any).__asciiWalk.world.places.time);
  await page.waitForTimeout(450);
  expect(await page.evaluate(() => (window as any).__asciiWalk.world.places.time)).toBeGreaterThan(
    before + 0.2,
  );
  await page.keyboard.press('Escape');
  const frozen = await page.evaluate(() => (window as any).__asciiWalk.world.places.time);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => (window as any).__asciiWalk.world.places.time)).toBe(frozen);
  writeFileSync(
    `docs/validation/details/checks-${info.project.name}.json`,
    JSON.stringify({ errors, results }, null, 2),
  );
  expect(errors).toEqual([]);
});
