import type { Pose, Road } from '../world/types';
import type { WorldData } from '../world/data';
import { nearestSegment, pointInRing } from '../geography/math';

export const bearing = (yaw: number) => ((((-yaw * 180) / Math.PI) % 360) + 360) % 360;
export const cardinal = (degrees: number) =>
  ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(degrees / 45) % 8];
export const streetBase = (name: string) => name.replace(/^(North|South|East|West) /, '');
export const shortStreet = (name: string) =>
  name
    .replace(/North /g, 'N ')
    .replace(/South /g, 'S ')
    .replace(/East /g, 'E ')
    .replace(/West /g, 'W ')
    .replace(/Street/g, 'ST')
    .replace(/Avenue/g, 'AVE')
    .toUpperCase();

export function compassTape(yaw: number, columns = 55) {
  const center = Math.floor(columns / 2),
    heading = bearing(yaw),
    cells = Array<string>(columns).fill(' ');
  for (let angle = Math.floor((heading - center * 3) / 15) * 15; angle <= heading + center * 3; angle += 15) {
    const col = center + Math.round((angle - heading) / 3),
      value = ((angle % 360) + 360) % 360;
    const label = value % 45 === 0 ? cardinal(value) : '|';
    for (let i = 0; i < label.length; i++) if (col + i >= 0 && col + i < columns) cells[col + i] = label[i];
  }
  return cells.join('');
}

export type Junction = { x: number; z: number; names: string[] };
export function streetJunctions(roads: Road[]): Junction[] {
  const points = new Map<string, { x: number; z: number; names: Set<string> }>();
  for (const road of roads.filter((r) => r.name && r.width >= 4 && !r.bridge))
    for (const [x, , z] of road.anchors ?? road.points) {
      const key = `${x.toFixed(2)},${z.toFixed(2)},${road.layer}`;
      if (!points.has(key)) points.set(key, { x, z, names: new Set() });
      points.get(key)!.names.add(road.name);
    }
  return [...points.values()]
    .filter((p) => new Set([...p.names].map(streetBase)).size >= 2)
    .map((p) => ({ ...p, names: [...p.names] }));
}

export class Navigation {
  junctions: Junction[];
  constructor(public data: WorldData) {
    this.junctions = streetJunctions(data.features.roads);
    // The circle connects the streets through separately named approach ways.
    if (data.manifest.id === 'warsaw')
      this.junctions.push({ x: -11.46, z: -276.16, names: ['North Main Street', 'Court Street'] });
  }
  describe(pose: Pose) {
    if (this.data.manifest.id === 'warsaw') {
      const { x, z } = pose;
      if (x > -389 && x < -280 && z > -690 && z < -530)
        return {
          street: 'Warsaw school athletic grounds',
          crossing: 'Football, soccer & track / West Court Street to the south',
        };
      if (x > -420 && x < -230 && z > -530 && z < -340)
        return {
          street: 'Warsaw Middle/High School',
          crossing: '81 West Court Street / Athletic field behind the school',
        };
      if (x > -503 && x < -319 && z > -180 && z < -4)
        return {
          street: 'Warsaw Elementary School',
          crossing: '153 West Buffalo Street / Playground beside the west wing',
        };
      if (x > -98 && x < 36 && z > -2290 && z < -2110)
        return {
          street: 'Warsaw Shopping Center',
          crossing: '461 North Main Street / Shops along the covered walkway',
        };
    }
    const park =
      this.data.manifest.id === 'warsaw' && this.data.features.areas.find((a) => a.id === '40527328');
    if (park && pointInRing(pose.x, pose.z, park.ring)) {
      const facility = this.data.features.facilities?.find((f) => pointInRing(pose.x, pose.z, f.ring));
      const label =
        facility &&
        {
          basketball: 'Basketball courts',
          tennis: 'Tennis courts',
          playground: 'Playground',
          pool: 'Swimming pool',
          baseball: 'Ball fields',
        }[facility.type];
      return {
        street: 'Warsaw Village Park',
        crossing: label
          ? `${label} / M for the park map`
          : 'Courts, playgrounds & pools / M for the park map',
      };
    }
    if (this.data.manifest.id === 'warsaw' && Math.hypot(pose.x + 11.46, pose.z + 276.16) < 40)
      return { street: 'Monument Circle', crossing: 'North Main Street & Court Street' };
    let road = this.data.nearbyRoad(pose.x, pose.z, false)?.road;
    if (!road?.name) {
      let distance = 90;
      for (const candidate of this.data.features.roads.filter((r) => r.name && r.width >= 4))
        for (let i = 1; i < candidate.points.length; i++) {
          const n = nearestSegment(pose.x, pose.z, candidate.points[i - 1], candidate.points[i]);
          if (n.distance < distance) {
            distance = n.distance;
            road = candidate;
          }
        }
    }
    const street = road?.name || 'Away from a named street';
    const candidates = this.junctions
      .map((j) => ({ ...j, distance: Math.hypot(j.x - pose.x, j.z - pose.z) }))
      .filter((j) => j.distance < 180);
    const here = candidates.filter((j) => j.distance < 23).sort((a, b) => a.distance - b.distance)[0];
    if (here) return { street, crossing: `At ${[...new Set(here.names.map(streetBase))].join(' & ')}` };
    const next = candidates
      .filter(
        (j) =>
          j.names.some((n) => streetBase(n) === streetBase(street)) &&
          (j.x - pose.x) * -Math.sin(pose.yaw) + (j.z - pose.z) * -Math.cos(pose.yaw) > j.distance * 0.6,
      )
      .sort((a, b) => a.distance - b.distance)[0];
    return {
      street,
      crossing: next
        ? `${[...new Set(next.names.map(streetBase))].filter((n) => n !== streetBase(street)).join(' / ')} ahead / ${Math.round(next.distance)} m`
        : 'Free walking / M for the street map',
    };
  }
}
