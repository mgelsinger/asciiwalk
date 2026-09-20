import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

test('park equipment, nearby interaction, animation preferences and continuous walking', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const start = Date.now();
  await page.goto('/');
  await expect(page.locator('#start')).toBeVisible();
  const loadMs = Date.now() - start;
  await page.locator('#intro-destinations').click();
  await page.locator('[data-destination="park"]').click();
  await expect(page.locator('#world')).toBeFocused();
  const dir = 'docs/validation/park';
  mkdirSync(dir, { recursive: true });
  const views = [
    { id: 'arrival', x: -486, z: 549, yaw: 2.38, pitch: 0.04 },
    { id: 'playground', x: -489, z: 562, yaw: 1.72, pitch: -0.06 },
    { id: 'basketball', x: -478, z: 561, yaw: -2.25, pitch: -0.04 },
    { id: 'tennis', x: -419, z: 605, yaw: 1.59, pitch: -0.06 },
    { id: 'pool', x: -522, z: 623, yaw: 1.35, pitch: -0.15 },
    { id: 'ball-field', x: -600, z: 545, yaw: 0.65, pitch: 0 },
    { id: 'picnic', x: -518, z: 541, yaw: 0.91, pitch: 0.06 },
  ];
  for (const view of views) {
    expect(await page.evaluate((p) => (window as any).__asciiWalk.setPose(p), view), view.id).toBe(true);
    await page.waitForTimeout(250);
    if (info.project.name === 'chrome') {
      for (const mode of ['color', 'mono', 'geometry']) {
        await page.evaluate((m) => {
          const a = (window as any).__asciiWalk;
          a.debug(m === 'geometry' ? 1 : 0);
          a.renderer.pass.uniforms.uMono.value = m === 'mono' ? 1 : 0;
        }, mode);
        await page.screenshot({ path: `${dir}/${view.id}-${mode}.png` });
      }
    }
  }
  await page.evaluate(() => {
    const a = (window as any).__asciiWalk;
    a.debug(0);
    a.renderer.pass.uniforms.uMono.value = 0;
  });
  const interactionPose = await page.evaluate(() => {
    const a = (window as any).__asciiWalk;
    const item = a.world.recreation.interactions.find((i: any) => i.label.includes('merry'));
    item.object.updateWorldMatrix(true, false);
    const e = item.object.matrixWorld.elements;
    for (let n = 0; n < 16; n++) {
      const x = e[12] + Math.cos((n * Math.PI) / 8) * 3.5,
        z = e[14] + Math.sin((n * Math.PI) / 8) * 3.5;
      if (!a.walker.blocked(x, z)) {
        const pose = { x, z, yaw: Math.atan2(x - e[12], z - e[14]), pitch: -0.15 };
        a.setPose(pose);
        return pose;
      }
    }
  });
  expect(interactionPose).toBeTruthy();
  await expect(page.locator('#interact')).toHaveText('[f] Spin the merry-go-round');
  await page.keyboard.press('f');
  await expect(page.locator('#notice')).toHaveText('Round we go.');
  const rotation = () =>
    page.evaluate(
      () =>
        (window as any).__asciiWalk.world.recreation.interactions.find((i: any) => i.label.includes('merry'))
          .object.rotation.y,
    );
  const angle = await rotation();
  await page.waitForTimeout(400);
  expect((await rotation()) - angle).toBeGreaterThan(0.25);
  if (info.project.name === 'chrome') await page.screenshot({ path: `${dir}/merry-go-round.png` });
  await page.locator('#settings-open').click();
  await page.locator('#activity').selectOption('still');
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.locator('#resume').click();
  const stopped = await rotation();
  await page.waitForTimeout(300);
  expect(await rotation()).toBe(stopped);
  await expect(page.locator('#interact')).toBeHidden();
  await page.reload();
  await expect(page.locator('#start')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__asciiWalk.world.recreation.live)).toBe(false);
  await page.locator('#start').click();
  await page.locator('#settings-open').click();
  await page.locator('#activity').selectOption('live');
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.locator('#resume').click();
  // Actual held-key walking along the open edge of basketball/playgrounds, without route teleports.
  expect(
    await page.evaluate(() =>
      (window as any).__asciiWalk.setPose({ x: -414, z: 583, yaw: Math.PI / 2, pitch: -0.02 }),
    ),
  ).toBe(true);
  const before = await page.evaluate(() => (window as any).__asciiWalk.walker.distance);
  await page.evaluate(() => {
    const a = (window as any).__asciiWalk;
    a.parkTimings = {};
    for (const [object, method, name] of [
      [a.renderer, 'render', 'render'],
      [a.data, 'ground', 'ground'],
      [a.walker, 'blocked', 'collision'],
      [a.world.recreation, 'tick', 'recreation'],
    ]) {
      const original = object[method].bind(object);
      const sample = (a.parkTimings[name] = { calls: 0, totalMs: 0, maxMs: 0 });
      object[method] = (...args: any[]) => {
        const start = performance.now(),
          result = original(...args),
          dt = performance.now() - start;
        sample.calls++;
        sample.totalMs += dt;
        sample.maxMs = Math.max(sample.maxMs, dt);
        return result;
      };
    }
  });
  await page.keyboard.down('Shift');
  await page.keyboard.down('w');
  await page.waitForTimeout(20000);
  await page.keyboard.up('w');
  await page.keyboard.up('Shift');
  const report = await page.evaluate(() => {
    const a = (window as any).__asciiWalk;
    const gl = a.renderer.renderer.getContext(),
      ext = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      ...a.stats(),
      distance: a.walker.distance,
      revision: a.data.manifest.revision,
      blocked: a.walker.blocked(a.walker.pose.x, a.walker.pose.z),
      facilities: a.data.features.facilities.length,
      gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      timings: a.parkTimings,
    };
  });
  expect(report.distance - before).toBeGreaterThan(60);
  expect(report.blocked).toBe(false);
  await page.keyboard.press('m');
  await expect(page.locator('#ascii-map')).toContainText('B');
  await expect(page.locator('#ascii-map')).toContainText('T');
  await expect(page.locator('#ascii-map')).toContainText('P');
  if (info.project.name === 'chrome') await page.screenshot({ path: `${dir}/map.png` });
  writeFileSync(
    `${dir}/checks-${info.project.name}.json`,
    JSON.stringify({ loadMs, ...report, walkedMeters: report.distance - before, views }, null, 2),
  );
  expect(errors).toEqual([]);
});
