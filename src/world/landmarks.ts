import { Batch } from './geometry';
import { SURFACE as S } from '../renderer/material';
import type { Point3 } from './types';

// Dimensions are reference estimates. The 2013 Monument Circle photograph supplies
// the stepped pedestal, fluting, broad capital, standing soldier and four cannons.
export function makeMonument(batch: Batch, x: number, ground: number, z: number) {
  const stone = '#c9c9bd',
    pale = '#e4e0ce',
    bronze = '#6a827a';
  const box = (y: number, w: number, h: number, d = w, color = stone, surface: number = S.stone) =>
    batch.box(x, ground + y, z, w, h, d, color, surface);
  batch.cylinder(x, ground + 0.02, z, 5.1, 0.25, pale, S.stone, 48);
  batch.cylinder(x, ground + 0.28, z, 4.8, 0.12, '#677653', S.ground, 48);
  box(0.65, 4.3, 0.6);
  box(1.05, 3.7, 0.25, 3.7, pale);
  box(1.95, 3.15, 1.6);
  box(2.8, 3.4, 0.24, 3.4, pale);
  box(3.65, 2.7, 1.5);
  // Recessed tablets on four faces give the pedestal distinct tiers in monochrome.
  for (let side = 0; side < 4; side++) {
    const a = (side * Math.PI) / 2,
      nx = Math.sin(a),
      nz = Math.cos(a);
    batch.box(x + nx * 1.365, ground + 3.66, z + nz * 1.365, 1.96, 1.06, 0.035, '#92968c', S.stone, a);
  }
  box(4.48, 3.2, 0.25, 3.2, pale);
  box(4.7, 2.7, 0.2);
  batch.cylinder(x, ground + 4.8, z, 1.02, 0.25, pale, S.stone, 32);
  batch.cylinder(x, ground + 5.05, z, 0.84, 0.26, pale, S.stone, 32);
  // Alternating radii model the grooves, rather than painting vertical stripes.
  for (let i = 0; i < 96; i++) {
    const a = (i * Math.PI) / 48,
      b = ((i + 1) * Math.PI) / 48;
    const r = (k: number) => (k % 4 === 0 ? 0.63 : 0.72);
    const p = (angle: number, radius: number, y: number): Point3 => [
      x + Math.cos(angle) * radius,
      ground + y,
      z + Math.sin(angle) * radius,
    ];
    batch.quad(
      p(a, r(i), 5.31),
      p(b, r(i + 1), 5.31),
      p(b, r(i + 1) * 0.91, 12.3),
      p(a, r(i) * 0.91, 12.3),
      stone,
      S.fluted,
    );
  }
  batch.cylinder(x, ground + 12.3, z, 0.75, 0.22, pale, S.stone, 32);
  batch.tube([x, ground + 12.52, z], [x, ground + 13.1, z], 0.76, 1.14, stone, S.stone, 24);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    batch.cone(x + Math.cos(a) * 0.83, ground + 12.5, z + Math.sin(a) * 0.83, 0.22, 0.68, pale, S.stone, 5);
  }
  box(13.2, 2.3, 0.22, 2.3, pale);
  box(13.45, 1.25, 0.25);
  // Soldier silhouette: boots, separated legs, coat, shoulders, head, cap and rifle.
  for (const side of [-1, 1])
    batch.box(x + side * 0.2, ground + 13.95, z, 0.22, 0.78, 0.28, bronze, S.person);
  batch.tube([x, ground + 14.25, z], [x, ground + 15.1, z], 0.47, 0.32, bronze, S.person, 8);
  batch.box(x, ground + 15.03, z, 0.84, 0.35, 0.38, bronze, S.person);
  batch.cylinder(x, ground + 15.26, z, 0.2, 0.33, bronze, S.person, 10);
  batch.box(x, ground + 15.63, z + 0.025, 0.47, 0.11, 0.47, bronze, S.person);
  batch.tube(
    [x - 0.36, ground + 14.62, z + 0.12],
    [x - 0.29, ground + 15.05, z],
    0.12,
    0.14,
    bronze,
    S.person,
    8,
  );
  batch.tube(
    [x + 0.35, ground + 15.02, z],
    [x - 0.3, ground + 14.72, z + 0.3],
    0.14,
    0.11,
    bronze,
    S.person,
    8,
  );
  batch.tube(
    [x - 0.45, ground + 13.68, z + 0.35],
    [x - 0.3, ground + 15.15, z + 0.26],
    0.045,
    0.045,
    bronze,
    S.metal,
    8,
  );
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2,
      dx = Math.sin(a),
      dz = Math.cos(a),
      cx = x + dx * 3.15,
      cz = z + dz * 3.15;
    batch.box(cx, ground + 0.88, cz, 1.0, 1, 1.2, stone, S.stone, a);
    batch.tube(
      [cx - dx * 0.8, ground + 1.55, cz - dz * 0.8],
      [cx + dx * 1.3, ground + 1.6, cz + dz * 1.3],
      0.26,
      0.19,
      bronze,
      S.metal,
      16,
    );
    batch.tube(
      [cx + dx * 1.28, ground + 1.6, cz + dz * 1.28],
      [cx + dx * 1.39, ground + 1.6, cz + dz * 1.39],
      0.23,
      0.23,
      bronze,
      S.metal,
      16,
    );
  }
}
