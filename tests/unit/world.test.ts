import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { nearestSegment, sampleGrid, pointInRing, seeded } from '../../src/geography/math';
import { WorldData } from '../../src/world/data';
import { Walker } from '../../src/movement/controller';
import { Batch, makeBuilding, makeRoadSegment } from '../../src/world/geometry';
import { SURFACE } from '../../src/renderer/material';
import type { Building, Manifest, Features, TerrainGrid } from '../../src/world/types';

const grid: TerrainGrid = {
  x: -100,
  z: -100,
  step: 100,
  width: 3,
  height: 3,
  file: 'terrain.bin',
  source: 'fixture',
  units: 'meters',
  values: new Float32Array(9),
};
const building: Building = {
  id: '1',
  x: 10,
  z: 10,
  ground: 0,
  height: 10,
  floors: 2,
  roof: 'gable',
  color: '#aabbcc',
  type: 'yes',
  residential: false,
  name: '',
  address: '',
  details: {},
  provenance: { footprint: 'fixture' },
  ring: [
    [0, 0],
    [20, 0],
    [20, 20],
    [0, 20],
  ],
  holes: [
    [
      [5, 5],
      [5, 15],
      [15, 15],
      [15, 5],
    ],
  ],
};
const manifest = {
  id: 'test',
  schemaVersion: 1,
  seed: 1,
  spawn: { x: -5, z: 10, yaw: 0 },
  bounds: [-100, -100, 100, 100],
  terrain: [grid],
} as Manifest;
function data(buildings: Building[] = [building]) {
  return new WorldData(manifest, { buildings, roads: [], areas: [], streams: [], landmarks: [] } as Features);
}
function walker(d = data()) {
  return new Walker(d, new THREE.PerspectiveCamera(), new EventTarget() as HTMLCanvasElement);
}
beforeEach(() => {
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('document', new EventTarget());
});

describe('coordinate and terrain math', () => {
  it('samples a sloping grid and clamps out-of-bounds values', () => {
    const slope = { ...grid, values: new Float32Array([0, 10, 20, 20, 30, 40, 40, 50, 60]) };
    expect(sampleGrid(slope, -50, -50)).toBeCloseTo(15);
    expect(sampleGrid(slope, -500, -500)).toBe(0);
  });
  it('projects onto a segment without inventing an intersection', () => {
    expect(nearestSegment(2, 3, [0, 10, 0], [4, 14, 0])).toMatchObject({ x: 2, z: 0, y: 12, distance: 3 });
  });
  it('keeps deterministic vegetation sequences', () => {
    const a = seeded(8),
      b = seeded(8);
    expect(Array.from({ length: 20 }, a)).toEqual(Array.from({ length: 20 }, b));
  });
  it('blends between nested terrain grids at their boundary', () => {
    const d = data([]);
    d.manifest = {
      ...manifest,
      terrain: [grid, { ...grid, x: -10, z: -10, step: 10, values: new Float32Array(9).fill(4) }],
    };
    expect(Math.abs(d.terrain(-10.001, 0) - d.terrain(-9.999, 0))).toBeLessThan(0.001);
  });
});
describe('walking', () => {
  it('allows a courtyard, blocks walls, and stops high-speed tunneling', () => {
    const w = walker();
    expect(w.blocked(10, 10)).toBe(false);
    expect(w.blocked(2, 10)).toBe(true);
    w.move(35, 0);
    expect(w.pose.x).toBeLessThan(-0.27);
    expect(w.pose.x).toBeGreaterThan(-0.5);
  });
  it('normalizes diagonal motion and caps long update intervals', () => {
    const a = walker(data([])),
      b = walker(data([]));
    a.enabled = b.enabled = true;
    a.keys.add('KeyW');
    b.keys.add('KeyW');
    b.keys.add('KeyD');
    a.update(0.016);
    b.update(0.016);
    expect(a.distance).toBeCloseTo(b.distance);
    b.update(4);
    expect(b.distance).toBeLessThan(0.1);
  });
  it('slides along a corner and rejects unsafe bookmarks and bounds', () => {
    const w = walker();
    w.move(10, 3);
    expect(w.pose.x).toBeLessThan(0);
    expect(w.pose.z).toBeGreaterThan(10);
    expect(w.teleport({ x: NaN, z: 0, yaw: 0 })).toBe(false);
    expect(w.teleport({ x: 2, z: 2, yaw: 0 })).toBe(false);
    expect(w.blocked(100, 0)).toBe(true);
    w.reset();
    expect(w.pose).toMatchObject(manifest.spawn);
  });
  it('allows the bridge deck over water but blocks open water', () => {
    const d = data([]);
    d.features.areas.push({
      id: 'water',
      type: 'water',
      height: 0,
      ring: [
        [-20, -20],
        [20, -20],
        [20, 20],
        [-20, 20],
      ],
    });
    expect(walker(d).blocked(0, 0)).toBe(true);
    const bridge = {
      id: 'bridge',
      name: '',
      type: 'road',
      width: 7,
      bridge: true,
      oneway: 'no',
      layer: 1,
      nodes: [1, 2],
      points: [
        [-30, 8, 0],
        [30, 8, 0],
      ],
    } as Features['roads'][number];
    const joined = new WorldData(manifest, { ...d.features, roads: [bridge] });
    expect(joined.ground(0, 0)).toBeCloseTo(8.12);
    expect(walker(joined).blocked(0, 0)).toBe(false);
  });
});
describe('geometry', () => {
  it('keeps roof triangles out of courtyard holes', () => {
    const batch = new Batch();
    makeBuilding(batch, building, true);
    for (let i = 0; i < batch.positions.length; i += 9)
      if (batch.surfaces[i / 3] === SURFACE.roof) {
        const x = (batch.positions[i] + batch.positions[i + 3] + batch.positions[i + 6]) / 3,
          z = (batch.positions[i + 2] + batch.positions[i + 5] + batch.positions[i + 8]) / 3;
        expect(pointInRing(x, z, building.holes[0])).toBe(false);
      }
  });
  it('assigns streams to the water character class', () => {
    const batch = new Batch();
    makeRoadSegment(batch, [0, 0, 0], [20, 0, 0], 3, 'water', false, false);
    expect(new Set(batch.surfaces)).toEqual(new Set([SURFACE.water]));
  });
});
