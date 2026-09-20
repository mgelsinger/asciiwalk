import { z } from 'zod';
import { containsGrid, nearestSegment, pointInRing, sampleGrid } from '../geography/math';
import type { Features, Manifest, Road, Point2 } from './types';

const number = z.number().finite(),
  point = z.tuple([number, number]),
  ring = z.array(point).min(3).max(50000);
export const manifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string(),
    revision: z.string(),
    features: z.string(),
    seed: number,
    spawn: z.object({ x: number, z: number, yaw: number }),
    origin: z.object({
      lon: number,
      lat: number,
      east: number,
      north: number,
      elevation: number,
      crs: number,
    }),
    terrain: z
      .array(
        z
          .object({
            file: z.string(),
            x: number,
            z: number,
            width: z.number().int().min(2).max(4096),
            height: z.number().int().min(2).max(4096),
            step: z.number().positive(),
            units: z.literal('meters'),
          })
          .passthrough(),
      )
      .min(1)
      .max(4),
    sources: z.array(z.object({ name: z.string(), url: z.url(), license: z.string() }).passthrough()),
    bounds: z.tuple([number, number, number, number]),
  })
  .passthrough();
export const featuresSchema = z.object({
  buildings: z
    .array(
      z
        .object({
          id: z.string(),
          name: z.string(),
          address: z.string(),
          type: z.string(),
          ring,
          holes: z.array(ring),
          x: number,
          z: number,
          ground: number,
          height: number.positive().max(1000),
          floors: number.int().min(1).max(300),
          roof: z.string(),
          color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
          residential: z.boolean(),
          details: z.record(z.string(), z.unknown()),
          provenance: z.record(z.string(), z.string()),
        })
        .passthrough(),
    )
    .max(24000),
  roads: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
        width: number.positive().max(200),
        bridge: z.boolean(),
        oneway: z.string(),
        layer: number,
        nodes: z.array(number),
        anchors: z.array(z.tuple([number, number, number])).optional(),
        points: z
          .array(z.tuple([number, number, number]))
          .min(2)
          .max(100000),
      }),
    )
    .max(24000),
  areas: z.array(
    z.object({ id: z.string(), type: z.enum(['forest', 'water', 'park', 'parking']), ring, height: number }),
  ),
  streams: z.array(
    z.object({ id: z.string(), name: z.string(), points: z.array(z.tuple([number, number, number])) }),
  ),
  landmarks: z.array(
    z.object({ id: z.string(), name: z.string(), x: number, z: number, monument: z.boolean().optional() }),
  ),
  facilities: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(['basketball', 'tennis', 'baseball', 'playground', 'pool']),
        name: z.string(),
        ring,
        height: number,
      }),
    )
    .max(3000)
    .default([]),
});
const safeFile = (name: string) => {
  if (!/^[a-zA-Z0-9_.-]+$/.test(name)) throw new Error('Invalid world file name');
  return name;
};

export class WorldData {
  detailExclusions: Point2[][] = [];
  roadCells = new Map<string, { road: Road; index: number }[]>();
  facilityBounds: { facility: { ring: Point2[]; height: number }; bounds: number[] }[] = [];
  constructor(
    public manifest: Manifest,
    public features: Features,
  ) {
    this.facilityBounds = (features.facilities ?? [])
      .filter((f) => f.type !== 'baseball')
      .map((facility) => ({
        facility,
        bounds: [
          Math.min(...facility.ring.map((p) => p[0])) - 2,
          Math.max(...facility.ring.map((p) => p[0])) + 2,
          Math.min(...facility.ring.map((p) => p[1])) - 2,
          Math.max(...facility.ring.map((p) => p[1])) + 2,
        ],
      }));
    for (const road of features.roads)
      for (let i = 0; i < road.points.length - 1; i++) {
        const a = road.points[i],
          b = road.points[i + 1],
          margin = road.width / 2 + 4;
        for (
          let x = Math.floor((Math.min(a[0], b[0]) - margin) / 32);
          x <= Math.floor((Math.max(a[0], b[0]) + margin) / 32);
          x++
        )
          for (
            let z = Math.floor((Math.min(a[2], b[2]) - margin) / 32);
            z <= Math.floor((Math.max(a[2], b[2]) + margin) / 32);
            z++
          ) {
            const key = `${x},${z}`;
            if (!this.roadCells.has(key)) this.roadCells.set(key, []);
            this.roadCells.get(key)!.push({ road, index: i });
          }
      }
  }
  terrain(x: number, z: number) {
    const grids = this.manifest.terrain;
    for (let i = grids.length - 1; i > 0; i--)
      if (containsGrid(grids[i], x, z)) {
        const g = grids[i],
          edge = Math.min(
            x - g.x,
            z - g.z,
            g.x + (g.width - 1) * g.step - x,
            g.z + (g.height - 1) * g.step - z,
          );
        const weight = Math.min(1, edge / 24);
        return sampleGrid(g, x, z) * weight + sampleGrid(grids[0], x, z) * (1 - weight);
      }
    return sampleGrid(grids[0], x, z);
  }
  nearbyRoad(x: number, z: number, includePaths = true) {
    let best: (ReturnType<typeof nearestSegment> & { road: Road; index: number }) | undefined;
    for (const { road, index } of this.roadCells.get(`${Math.floor(x / 32)},${Math.floor(z / 32)}`) ?? []) {
      if (!includePaths && road.width < 3) continue;
      const near = nearestSegment(x, z, road.points[index], road.points[index + 1]);
      if (!best || near.distance - road.width / 2 < best.distance - best.road.width / 2)
        best = { ...near, road, index };
    }
    return best;
  }
  ground(x: number, z: number) {
    const ground = this.roadGround(x, z);
    let closest = 2,
      level = ground;
    for (const { facility: f, bounds: b } of this.facilityBounds) {
      if (x < b[0] || x > b[1] || z < b[2] || z > b[3]) continue;
      if (pointInRing(x, z, f.ring)) return f.height;
      let distance = 2;
      for (let i = 0; i < f.ring.length; i++) {
        const a = f.ring[i],
          c = f.ring[(i + 1) % f.ring.length];
        distance = Math.min(distance, nearestSegment(x, z, [a[0], 0, a[1]], [c[0], 0, c[1]]).distance);
      }
      if (distance < closest) {
        closest = distance;
        level = f.height;
      }
    }
    const t = closest / 2,
      blend = t * t * (3 - 2 * t);
    return level * (1 - blend) + ground * blend;
  }
  private roadGround(x: number, z: number) {
    const natural = this.terrain(x, z),
      near = this.nearbyRoad(x, z);
    if (!near) return natural;
    const half = near.road.width / 2,
      distance = near.distance;
    if (near.road.bridge && distance <= half + 1.5) return near.y + 0.12;
    if (near.road.layer < 0) return natural;
    const path = near.road.width < 3,
      edge = half + (path ? 0.25 : 2.5);
    if (distance < edge) return near.y + (distance > half && !path ? 0.16 : 0.04);
    const weight = Math.max(0, 1 - (distance - edge) / 3);
    return natural * (1 - weight) + (near.y + 0.16) * weight;
  }
  static async load(id: string, onProgress: (value: string) => void) {
    if (!/^[a-z0-9-]+$/.test(id)) throw new Error('Invalid location');
    const base = `${import.meta.env.BASE_URL}worlds/${id}/`;
    const get = async (file: string) => {
      const r = await fetch(base + safeFile(file));
      if (!r.ok) throw new Error(`World data unavailable (${r.status}). Run npm run data:warsaw.`);
      return r;
    };
    const manifest = manifestSchema.parse(await (await get('manifest.json')).json()) as unknown as Manifest;
    onProgress('Reading streets and buildings');
    const features = featuresSchema.parse(await (await get(manifest.features)).json()) as Features;
    onProgress('Following the contours');
    await Promise.all(
      manifest.terrain.map(async (grid) => {
        const buffer = await (await get(grid.file)).arrayBuffer();
        if (buffer.byteLength !== grid.width * grid.height * 4) throw new Error('Incomplete terrain file');
        grid.values = new Float32Array(buffer);
        for (const value of grid.values)
          if (!Number.isFinite(value)) throw new Error('Invalid terrain elevation');
      }),
    );
    return new WorldData(manifest, features);
  }
}
