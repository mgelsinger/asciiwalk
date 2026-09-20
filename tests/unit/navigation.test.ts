import { describe, it, expect } from 'vitest';
import { bearing, cardinal, compassTape, streetJunctions, Navigation } from '../../src/app/navigation';
import { WorldData } from '../../src/world/data';
import type { Road, Manifest, Features } from '../../src/world/types';
const road = (name: string, points: number[][], layer = 0): Road => ({
  id: name,
  name,
  width: 7,
  type: 'residential',
  bridge: false,
  oneway: 'no',
  layer,
  nodes: [],
  points: points as Road['points'],
  anchors: points as Road['points'],
});
describe('street navigation', () => {
  it('keeps east/west correct and wraps bearings at north', () => {
    expect(bearing(-Math.PI / 2)).toBe(90);
    expect(bearing(Math.PI / 2)).toBe(270);
    expect(bearing(2 * Math.PI)).toBe(0);
    expect(cardinal(359)).toBe('N');
    expect(compassTape(0).charAt(27)).toBe('N');
    expect(compassTape(-Math.PI / 2).charAt(27)).toBe('E');
  });
  it('recognizes original road nodes and ignores grade-separated crossings', () => {
    const main = road('North Main Street', [
      [0, 0, -50],
      [0, 0, 0],
      [0, 0, 50],
    ]);
    main.points = [
      [0, 0, -50],
      [0, 0, 50],
    ];
    const side = road('Buffalo Street', [
      [-50, 0, 0],
      [0, 0, 0],
      [50, 0, 0],
    ]);
    expect(streetJunctions([main, side])).toHaveLength(1);
    side.layer = 1;
    expect(streetJunctions([main, side])).toHaveLength(0);
  });
  it('does not claim a cross street is ahead while looking perpendicular to the road', () => {
    const roads = [
      road('Main Street', [
        [0, 0, -100],
        [0, 0, 0],
        [0, 0, 100],
      ]),
      road('Buffalo Street', [
        [-50, 0, 0],
        [0, 0, 0],
        [50, 0, 0],
      ]),
    ];
    const d = new WorldData(
      { id: 'fixture' } as Manifest,
      { roads, buildings: [], areas: [], streams: [], landmarks: [] } as Features,
    );
    const n = new Navigation(d);
    expect(n.describe({ x: 0, z: 50, yaw: 0 }).crossing).toContain('Buffalo Street ahead');
    expect(n.describe({ x: 0, z: 50, yaw: Math.PI / 2 }).crossing).not.toContain('ahead');
    expect(n.describe({ x: 0, z: 0, yaw: 0 }).crossing).toContain('Main Street & Buffalo Street');
  });
});
