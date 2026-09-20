import type { Facility, Point2, Point3 } from './types';

export function facilityFrame(f: Facility) {
  let longest = 0,
    yaw = 0;
  for (let i = 0; i < f.ring.length; i++) {
    const a = f.ring[i],
      b = f.ring[(i + 1) % f.ring.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1];
    if (Math.hypot(dx, dz) > longest) {
      longest = Math.hypot(dx, dz);
      yaw = Math.atan2(dx, dz);
    }
  }
  const co = Math.cos(yaw),
    si = Math.sin(yaw);
  const projected = f.ring.map(([x, z]) => [x * co - z * si, x * si + z * co]);
  const minX = Math.min(...projected.map((p) => p[0])),
    maxX = Math.max(...projected.map((p) => p[0]));
  const minZ = Math.min(...projected.map((p) => p[1])),
    maxZ = Math.max(...projected.map((p) => p[1]));
  const u = (minX + maxX) / 2,
    v = (minZ + maxZ) / 2;
  const x = u * co + v * si,
    z = -u * si + v * co;
  return {
    x,
    z,
    yaw,
    width: maxX - minX,
    length: maxZ - minZ,
    ring: projected.map(([a, b]) => [a - u, b - v] as Point2),
    point: (a: number, y: number, b: number): Point3 => [
      x + a * co + b * si,
      f.height + y,
      z - a * si + b * co,
    ],
  };
}
