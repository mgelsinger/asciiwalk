import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
test.use({ video: { mode: 'on', size: { width: 1280, height: 720 } } });
test('ten-minute continuous downtown, residential and hill route', async ({ page, browser }, info) => {
  test.skip(
    process.env.ASCII_BENCH !== '1' || info.project.name !== 'chrome',
    'Opt-in ten-minute benchmark.',
  );
  test.setTimeout(660000);
  mkdirSync('docs/validation', { recursive: true });
  const start = Date.now();
  await page.goto('/');
  await expect(page.locator('#start')).toBeVisible({ timeout: 30000 });
  const loadMs = Date.now() - start;
  const environment = await page.evaluate(() => {
    const a = (window as any).__asciiWalk,
      gl = a.renderer.renderer.getContext(),
      ext = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      revision: a.data.manifest.revision,
    };
  });
  await page.evaluate(() => {
    const a = (window as any).__asciiWalk;
    a.start();
    a.walker.reset();
    const roads = a.data.features.roads;
    const main = roads
      .find((r: any) => r.id === '20650787')
      .points.filter((p: number[]) => p[2] > -244)
      .map((p: number[]) => ({ x: p[0], z: p[2] }));
    const west = roads
      .filter((r: any) => r.name === 'West Buffalo Street')
      .flatMap((r: any) => r.points)
      .filter((p: number[]) => p[0] > -910 && p[0] < 0)
      .sort((a: number[], b: number[]) => b[0] - a[0])
      .map((p: number[]) => ({ x: p[0], z: p[2] }));
    const route = [
      { x: 0, z: 0 },
      ...main,
      ...[...main].reverse(),
      { x: 0, z: 0 },
      ...west,
      ...[...west].reverse(),
    ];
    const record = {
      dt: [] as number[],
      samples: [] as any[],
      index: 0,
      start: performance.now(),
      previous: performance.now(),
      nextSample: 0,
      routeLength: route.length,
    };
    (window as any).__bench = record;
    function update(now: number) {
      const elapsed = (now - record.start) / 1000;
      record.dt.push(now - record.previous);
      record.previous = now;
      const p = route[Math.min(record.index, route.length - 1)],
        pose = a.walker.pose;
      if (Math.hypot(p.x - pose.x, p.z - pose.z) < 0.8 && record.index < route.length - 1) record.index++;
      a.walker.pose.yaw = Math.atan2(-(p.x - pose.x), -(p.z - pose.z));
      a.walker.keys.add('KeyW');
      a.walker.keys.add('ShiftLeft');
      if (elapsed >= record.nextSample) {
        record.samples.push({
          seconds: elapsed,
          ...a.stats(),
          distance: a.walker.distance,
          elevation: a.data.ground(pose.x, pose.z),
          heap: (performance as any).memory?.usedJSHeapSize,
        });
        record.nextSample += 10;
      }
      if (elapsed < 600) requestAnimationFrame(update);
      else a.walker.keys.clear();
    }
    requestAnimationFrame(update);
  });
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(30000);
    if ([1, 5, 11, 19].includes(i))
      await page.screenshot({ path: `docs/validation/route-${(i + 1) * 30}s.png` });
  }
  const result = await page.evaluate(() => {
    const b = (window as any).__bench,
      a = (window as any).__asciiWalk,
      s = b.dt.slice(120).sort((a: number, b: number) => a - b);
    return {
      samples: b.samples,
      frames: s.length,
      medianMs: s[Math.floor(s.length * 0.5)],
      p95Ms: s[Math.floor(s.length * 0.95)],
      p99Ms: s[Math.floor(s.length * 0.99)],
      maxMs: Math.max(...s),
      distance: a.walker.distance,
      waypointsReached: b.index,
      waypoints: b.routeLength,
      final: a.stats(),
    };
  });
  writeFileSync(
    'docs/validation/performance.json',
    JSON.stringify(
      {
        date: new Date().toISOString(),
        browser: browser.version(),
        cpu: os.cpus()[0]?.model,
        os: `${os.type()} ${os.release()} ${os.arch()}`,
        viewport: '1920x1080',
        density: 'balanced 7x11',
        loadMs,
        recording: '1280x720 WebM video enabled',
        ...environment,
        ...result,
      },
      null,
      2,
    ),
  );
  expect(result.distance).toBeGreaterThan(1700);
  expect(result.p95Ms).toBeLessThan(33.4);
});
