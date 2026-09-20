import { beforeAll, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { WorldData } from '../../src/world/data';
import { PlaceDetails } from '../../src/world/place-details';
import { Recreation } from '../../src/world/recreation';
import { Walker } from '../../src/movement/controller';
import { warsawDestinations } from '../../src/app/destinations';
import type { Features, Manifest } from '../../src/world/types';
const root = 'public/worlds/warsaw/';
const manifest = JSON.parse(readFileSync(root + 'manifest.json', 'utf8')) as Manifest;
const features = JSON.parse(readFileSync(root + manifest.features, 'utf8')) as Features;
for (const grid of manifest.terrain) {
  const bytes = readFileSync(root + grid.file);
  grid.values = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}
const data = new WorldData(manifest, features);
let places: PlaceDetails, walker: Walker;
beforeAll(() => {
  places = new PlaceDetails(data, new THREE.MeshBasicMaterial());
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('document', new EventTarget());
  walker = new Walker(data, new THREE.PerspectiveCamera(), new EventTarget() as HTMLCanvasElement, [
    ...new Recreation(data, new THREE.MeshBasicMaterial()).obstacles,
    ...places.obstacles,
  ]);
});
it('keeps all eight arrivals and their first five meters open', () => {
  for (const d of warsawDestinations) {
    expect(walker.teleport(d.pose), d.id).toBe(true);
    for (let step = 0; step <= 10; step++)
      expect(
        walker.blocked(
          d.pose.x - Math.sin(d.pose.yaw) * step * 0.5,
          d.pose.z - Math.cos(d.pose.yaw) * step * 0.5,
        ),
        `${d.id} ${step / 2}m`,
      ).toBe(false);
  }
});
it('keeps the narrow theater and shopping sidewalks connected', () => {
  for (const [x, a, b] of [
    [-8.8, 32, 53],
    [-19.4, -2265, -2130],
  ])
    for (let z = a; z <= b; z += 0.5) expect(walker.blocked(x, z), `sidewalk ${x},${z}`).toBe(false);
});
it('puts every new interaction within reach of a walkable position', () => {
  for (const action of places.interactions) {
    const p = action.object.position;
    const reachable = Array.from({ length: 32 }, (_, i) => (i * Math.PI) / 16).some(
      (a) => !walker.blocked(p.x + Math.sin(a) * 2.5, p.z + Math.cos(a) * 2.5),
    );
    expect(reachable, action.label).toBe(true);
  }
});
it('keeps moving visitors outside buildings and solid fixtures along their routes', () => {
  const failures = new Set<string>();
  for (let t = 0; t < 130; t += 2)
    for (const site of places.sites) {
      for (const animate of site.animations) animate(t, 0.1);
      for (const actor of site.group.children.filter((c) => c.name === 'walking-visitor'))
        if (walker.blocked(actor.position.x, actor.position.z))
          failures.add(`${site.id}: ${actor.position.x.toFixed(1)},${actor.position.z.toFixed(1)}`);
    }
  expect([...failures]).toEqual([]);
});
it('freezes all detail motion but keeps readable signs and manual marquee changes available', () => {
  const snapshot = () =>
    places.sites.map((s) => s.group.children.map((c) => [...c.position.toArray(), ...c.rotation.toArray()]));
  places.live = false;
  const before = snapshot(),
    time = places.time;
  places.tick(3, 0, 0);
  expect(snapshot()).toEqual(before);
  expect(places.time).toBe(time);
  const action = places.nearestInteraction(-8.5, 44)!;
  expect(action.label).toBe('Change the marquee');
  expect(action.push()).toContain('WALK THE VALLEY');
  places.live = true;
  places.tick(0, 0, 0);
  expect(snapshot()).toEqual(before);
  places.tick(1, 0, 0);
  expect(snapshot()).not.toEqual(before);
  places.tick(0.1, 4000, 4000);
  expect(places.sites.every((s) => !s.group.visible)).toBe(true);
});
