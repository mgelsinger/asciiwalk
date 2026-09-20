import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
export const views = [
  { id: '01-main-north', x: -9.5, z: 24, yaw: -0.45, pitch: 0 },
  { id: '02-main-south', x: 6, z: -15, yaw: Math.PI - 0.25, pitch: 0.03 },
  { id: '03-buffalo-west', x: 35, z: 4, yaw: Math.PI / 2, pitch: 0.05 },
  { id: '04-buffalo-east', x: -55, z: 3, yaw: -Math.PI / 2, pitch: 0.07 },
  { id: '05-library-circle', x: -8, z: -218, yaw: -0.65, pitch: 0.07 },
  { id: '06-monument-court', x: 12, z: -290, yaw: 1.5, pitch: 0.12 },
  { id: '07-genesee-corner', x: -1, z: -99, yaw: -0.32, pitch: 0.04 },
  { id: '08-west-hill', x: -565, z: 25, yaw: 1.45, pitch: 0.04 },
  { id: '09-post-office', x: 4, z: 86, yaw: 1.2, pitch: 0.09 },
  { id: '10-courthouse', x: -10, z: -312, yaw: Math.PI / 2, pitch: 0.08 },
  { id: '11-methodist', x: 3, z: -268, yaw: 2.0, pitch: 0.17 },
  { id: '12-trinity', x: -132, z: 4, yaw: Math.PI, pitch: 0.12 },
  { id: '13-monument-approach', x: 22, z: -281, yaw: 1.72, pitch: 0.2 },
  { id: '14-shopping-plaza', x: 19, z: -2180, yaw: 0.85, pitch: 0.03 },
];
test('fixed recognition views and graphics modes', async ({ page }, info) => {
  test.skip(process.env.ASCII_VIEWS !== '1' || info.project.name !== 'chrome', 'Opt-in visual capture.');
  test.setTimeout(180000);
  await page.goto('/');
  await expect(page.locator('#start')).toBeVisible({ timeout: 30000 });
  await page.evaluate(() => {
    (window as any).__asciiWalk.start();
  });
  mkdirSync('docs/validation/views', { recursive: true });
  const accepted = [];
  for (const view of views) {
    const ok = await page.evaluate((p) => (window as any).__asciiWalk.setPose(p), view);
    expect(ok, view.id).toBe(true);
    await page.waitForTimeout(500);
    for (const mode of ['color', 'mono', 'geometry', 'unlabeled', 'mono-unlabeled']) {
      await page.evaluate((m) => {
        const a = (window as any).__asciiWalk;
        a.debug(m === 'geometry' ? 1 : 0);
        a.renderer.pass.uniforms.uMono.value = m.startsWith('mono') ? 1 : 0;
        a.savedSigns ??= a.renderer.signs.signs;
        a.renderer.signs.signs = m.includes('unlabeled') ? [] : a.savedSigns;
        document
          .querySelectorAll<HTMLElement>('.location-heading,.navigation-hud,#street-name')
          .forEach((e) => (e.style.visibility = m.includes('unlabeled') ? 'hidden' : 'visible'));
      }, mode);
      await page.waitForTimeout(80);
      await page.screenshot({ path: `docs/validation/views/${view.id}-${mode}.png` });
    }
    accepted.push(view);
  }
  writeFileSync('docs/validation/views/poses.json', JSON.stringify(accepted, null, 2));
});
