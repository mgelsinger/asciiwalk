import type { Point2, Point3, TerrainGrid } from '../world/types';

export function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash(value: string) {
  let h = 2166136261;
  for (const c of value) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
export function pointInRing(x: number, z: number, ring: Point2[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[i],
      [bx, bz] = ring[j];
    if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}
export function nearestSegment(x: number, z: number, a: Point3, b: Point3) {
  const dx = b[0] - a[0],
    dz = b[2] - a[2];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz || 1)));
  const px = a[0] + dx * t,
    pz = a[2] + dz * t;
  return { x: px, z: pz, y: a[1] + (b[1] - a[1]) * t, distance: Math.hypot(px - x, pz - z), t, dx, dz };
}
export function sampleGrid(grid: TerrainGrid, x: number, z: number) {
  const a = grid.values!;
  const c = Math.max(0, Math.min(grid.width - 1.001, (x - grid.x) / grid.step));
  const r = Math.max(0, Math.min(grid.height - 1.001, (z - grid.z) / grid.step));
  const ix = Math.floor(c),
    iz = Math.floor(r),
    fx = c - ix,
    fz = r - iz,
    offset = iz * grid.width + ix;
  return (
    (a[offset] * (1 - fx) + a[offset + 1] * fx) * (1 - fz) +
    (a[offset + grid.width] * (1 - fx) + a[offset + grid.width + 1] * fx) * fz
  );
}
export function containsGrid(grid: TerrainGrid, x: number, z: number, margin = 0) {
  return (
    x >= grid.x + margin &&
    z >= grid.z + margin &&
    x <= grid.x + (grid.width - 1) * grid.step - margin &&
    z <= grid.z + (grid.height - 1) * grid.step - margin
  );
}
