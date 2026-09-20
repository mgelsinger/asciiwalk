import { beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { WorldData } from '../../src/world/data';
import { Recreation } from '../../src/world/recreation';
import { Walker } from '../../src/movement/controller';
import { facilityFrame } from '../../src/world/facility-layout';
import type { Facility, Manifest, Features } from '../../src/world/types';

const root = 'public/worlds/warsaw/';
const manifest = JSON.parse(readFileSync(root + 'manifest.json', 'utf8')) as Manifest;
const features = JSON.parse(readFileSync(root + manifest.features, 'utf8')) as Features;
for (const grid of manifest.terrain) {
  const bytes = readFileSync(root + grid.file);
  grid.values = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}
const data = new WorldData(manifest, features);
let park: Recreation;
beforeAll(() => {
  park = new Recreation(data, new THREE.MeshBasicMaterial());
});

describe('mapped recreation', () => {
  it('keeps the Village Park courts, playgrounds, pools and fields distinct', () => {
    const facilities = features.facilities!.filter((f) => {
      const p = facilityFrame(f);
      return p.x > -720 && p.x < -375 && p.z > 400 && p.z < 680;
    });
    expect(
      Object.fromEntries(
        ['basketball', 'tennis', 'playground', 'pool', 'baseball'].map((type) => [
          type,
          facilities.filter((f) => f.type === type).length,
        ]),
      ),
    ).toEqual({ basketball: 2, tennis: 6, playground: 3, pool: 2, baseball: 4 });
    const court = facilities.find((f) => f.id === '1412126585')!;
    const frame = facilityFrame(court);
    expect(frame.width).toBeCloseTo(11.2, 0);
    expect(frame.length).toBeCloseTo(24.2, 0);
    frame.ring.forEach(([x, z], i) => {
      const p = frame.point(x, 0, z);
      expect(p[0]).toBeCloseTo(court.ring[i][0], 8);
      expect(p[2]).toBeCloseTo(court.ring[i][1], 8);
    });
  });

  it('uses the actual court underfoot before blending a neighboring court edge', () => {
    const f = (x: number, height: number): Facility => ({
      id: String(x),
      type: 'tennis',
      name: '',
      height,
      ring: [
        [x, 0],
        [x + 10, 0],
        [x + 10, 20],
        [x, 20],
      ],
    });
    const d = new WorldData(manifest, {
      buildings: [],
      roads: [],
      areas: [],
      streams: [],
      landmarks: [],
      facilities: [f(0, 3), f(11, 4)],
    });
    expect(d.ground(11.5, 10)).toBe(4);
    expect(d.ground(9.5, 10)).toBe(3);
    expect(Math.abs(d.ground(10.999, 10) - d.ground(11.001, 10))).toBeLessThan(0.001);
  });

  it('blocks tennis nets and pools while leaving the court gate open', () => {
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('document', new EventTarget());
    const w = new Walker(
      data,
      new THREE.PerspectiveCamera(),
      new EventTarget() as HTMLCanvasElement,
      park.obstacles,
    );
    const court = facilityFrame(features.facilities!.find((f) => f.id === '1412126585')!);
    expect(w.blocked(court.x, court.z)).toBe(true);
    expect(w.blocked(-419, 599)).toBe(true);
    expect(w.blocked(-419, 605)).toBe(false);
    expect(w.blocked(-550.7, 618)).toBe(true);
    expect(w.teleport({ x: -414, z: 605, yaw: Math.PI / 2 })).toBe(true);
    w.move(-9, 0);
    expect(w.pose.x).toBeLessThan(-422);
    expect(w.blocked(w.pose.x, w.pose.z)).toBe(false);
    w.dispose();
    vi.unstubAllGlobals();
  });

  it('animates a push, freezes in still mode and culls distant facilities', () => {
    const merry = park.interactions.find((i) => i.label.includes('merry'))!;
    const p = new THREE.Vector3();
    merry.object.getWorldPosition(p);
    const angle = merry.object.rotation.y;
    park.tick(0.1, p.x, p.z);
    const baseline = merry.object.rotation.y - angle;
    expect(park.interact(p.x + 3, p.z)).toContain('merry');
    const before = merry.object.rotation.y;
    park.tick(0.1, p.x, p.z);
    expect(merry.object.rotation.y - before).toBeGreaterThan(baseline * 4);
    park.live = false;
    const stopped = merry.object.rotation.y;
    park.tick(1, p.x, p.z);
    expect(merry.object.rotation.y).toBe(stopped);
    expect(park.nearestInteraction(p.x, p.z)).toBeUndefined();
    park.tick(1, 5000, 5000);
    expect(park.sites.every((s) => !s.group.visible)).toBe(true);
    park.live = true;
  });

  it('builds finite equipment meshes with printable-ASCII surface classes', () => {
    let meshes = 0;
    park.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      meshes++;
      const g = object.geometry;
      expect(Array.from(g.getAttribute('position').array).every(Number.isFinite)).toBe(true);
      expect(
        Array.from(g.getAttribute('surface').array as Float32Array).every((s) => s >= 1 && s <= 15),
      ).toBe(true);
    });
    expect(meshes).toBeGreaterThan(50);
  });
});
