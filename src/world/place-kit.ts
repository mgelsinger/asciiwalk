import * as THREE from 'three';
import { Batch, makeTree } from './geometry';
import { bench, person, sphere, PALE, STEEL } from './park-models';
import type { Animation, Interaction } from './park-models';
import { SURFACE as S } from '../renderer/material';
import type { Sign } from '../renderer/signs';
import type { WorldData } from './data';
import type { FixtureObstacle, Point2, Point3 } from './types';
import { pointInRing, nearestSegment } from '../geography/math';

// Each site owns its geometry, motion, signs and collision, so distant details can sleep together.
export class PlaceSite {
  group = new THREE.Group();
  b = new Batch();
  animations: Animation[] = [];
  obstacles: FixtureObstacle[] = [];
  interactions: Interaction[] = [];
  signs: Sign[] = [];
  inventory = new Set<string>();
  constructor(
    public id: string,
    public x: number,
    public z: number,
    public data: WorldData,
    public material: THREE.Material,
  ) {
    this.group.name = `place-${id}`;
  }
  ground(x: number, z: number) {
    return this.data.ground(x, z);
  }
  obstacle(a: Point2, b = a, radius = 0.2) {
    this.obstacles.push({ a, b, radius });
  }
  place(batch: Batch, x: number, z: number, yaw = 0, y = this.ground(x, z)) {
    const mesh = batch.mesh(this.material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = yaw;
    this.group.add(mesh);
    return mesh;
  }
  sign(text: string, x: number, y: number, z: number, width: number, yaw = 0) {
    const s = { text, x, y, z, width, nx: Math.sin(yaw), nz: Math.cos(yaw) };
    this.signs.push(s);
    return s;
  }
  action(label: string, x: number, z: number, push: Interaction['push'], isStatic = false) {
    const object = new THREE.Object3D();
    object.position.set(x, this.ground(x, z), z);
    this.group.add(object);
    const item = { object, label, push, static: isStatic };
    this.interactions.push(item);
    return item;
  }
  clear(x: number, z: number, radius = 0.6, roadMargin = 0.3) {
    const road = this.data.nearbyRoad(x, z);
    if (road && road.distance < road.road.width / 2 + radius + roadMargin) return false;
    if (
      this.data.features.buildings.some(
        (b) =>
          pointInRing(x, z, b.ring) ||
          b.ring.some((p, i) => {
            const q = b.ring[(i + 1) % b.ring.length];
            return nearestSegment(x, z, [p[0], 0, p[1]], [q[0], 0, q[1]]).distance < radius;
          }),
      )
    )
      return false;
    return !this.obstacles.some(
      (o) => nearestSegment(x, z, [o.a[0], 0, o.a[1]], [o.b[0], 0, o.b[1]]).distance < radius + o.radius,
    );
  }
  paving(x0: number, z0: number, x1: number, z1: number, color = '#c0bcaa', surface: number = S.stone) {
    for (let x = x0; x < x1; x += 2)
      for (let z = z0; z < z1; z += 2) {
        const a = Math.min(x + 2, x1),
          c = Math.min(z + 2, z1);
        const p = (u: number, v: number): Point3 => [u, this.ground(u, v) + 0.035, v];
        this.b.quad(p(x, z), p(a, z), p(a, c), p(x, c), color, surface);
      }
  }
  seat(x: number, z: number, yaw = 0, picnic = false) {
    const b = new Batch();
    bench(b, 0, 0, yaw, picnic);
    this.place(b, x, z);
    this.obstacle(
      [x - Math.cos(yaw), z + Math.sin(yaw)],
      [x + Math.cos(yaw), z - Math.sin(yaw)],
      picnic ? 0.7 : 0.35,
    );
    this.inventory.add(picnic ? 'picnic tables' : 'benches');
  }
  planter(x: number, z: number, width = 1.6) {
    const y = this.ground(x, z),
      b = this.b;
    b.box(x, y + 0.27, z, width, 0.54, 0.9, '#bbb294', S.stone);
    b.box(x, y + 0.56, z, width - 0.14, 0.08, 0.76, '#485e46', S.ground);
    for (let i = 0; i < 7; i++) {
      const xx = x + ((i - 3) * width) / 8,
        zz = z + Math.sin(i * 8) * 0.22;
      b.tube([xx, y + 0.58, zz], [xx, y + 0.88, zz], 0.024, 0.015, '#81945b', S.leaf, 5);
      sphere(b, xx, y + 0.9, zz, 0.11, i % 2 ? '#ddbf85' : '#c79283', S.paint);
    }
    this.obstacle([x - width / 2 + 0.12, z], [x + width / 2 - 0.12, z], 0.45);
    this.inventory.add('planters');
  }
  lamp(x: number, z: number, height = 4.2) {
    const y = this.ground(x, z),
      b = this.b;
    b.cylinder(x, y, z, 0.09, height, STEEL, S.metal, 8);
    b.cylinder(x, y, z, 0.2, 0.35, STEEL, S.metal, 8);
    b.box(x, y + height - 0.15, z, 0.44, 0.5, 0.44, '#dad6b6', S.paint);
    b.cone(x, y + height + 0.1, z, 0.38, 0.28, STEEL, S.metal, 4);
    this.obstacle([x, z], undefined, 0.18);
    this.inventory.add('lamps');
  }
  tree(x: number, z: number, size = 6) {
    makeTree(this.b, x, this.ground(x, z), z, size, x * 17 + z);
    this.inventory.add('trees');
  }
  bikeRack(x: number, z: number, yaw = 0, bicycles = 2) {
    const b = new Batch();
    for (let i = 0; i < 4; i++) {
      const u = i * 0.8 - 1.2;
      b.tube([u, 0, -0.45], [u, 0.85, -0.45], 0.045, 0.045, STEEL, S.metal, 6);
      b.tube([u, 0.85, -0.45], [u, 0.85, 0.45], 0.045, 0.045, STEEL, S.metal, 6);
      b.tube([u, 0.85, 0.45], [u, 0, 0.45], 0.045, 0.045, STEEL, S.metal, 6);
    }
    for (let i = 0; i < bicycles; i++) {
      const u = -1 + i * 1.5;
      for (const z of [-0.6, 0.6])
        for (let k = 0; k < 20; k++) {
          const a = (k * Math.PI) / 10,
            c = ((k + 1) * Math.PI) / 10;
          b.tube(
            [u, 0.38 + Math.cos(a) * 0.35, z + Math.sin(a) * 0.35],
            [u, 0.38 + Math.cos(c) * 0.35, z + Math.sin(c) * 0.35],
            0.035,
            0.035,
            PALE,
            S.metal,
            5,
          );
          if (k % 5 === 0)
            b.tube(
              [u, 0.38, z],
              [u, 0.38 + Math.cos(a) * 0.34, z + Math.sin(a) * 0.34],
              0.012,
              0.012,
              STEEL,
              S.metal,
              4,
            );
        }
      for (const [a, c] of [
        [
          [0.38, -0.6],
          [0.88, -0.15],
        ],
        [
          [0.88, -0.15],
          [0.38, 0],
        ],
        [
          [0.38, 0],
          [0.38, -0.6],
        ],
        [
          [0.38, 0],
          [0.91, 0.5],
        ],
        [
          [0.91, 0.5],
          [0.38, 0.6],
        ],
        [
          [0.88, -0.15],
          [0.91, 0.5],
        ],
      ])
        b.tube([u, a[0], a[1]], [u, c[0], c[1]], 0.035, 0.035, '#bc9c6b', S.metal, 6);
      b.box(u, 0.96, -0.15, 0.32, 0.06, 0.24, PALE, S.metal);
      b.box(u, 1.14, 0.53, 0.54, 0.05, 0.05, STEEL, S.metal);
    }
    this.place(b, x, z, yaw);
    this.obstacle(
      [x - Math.cos(yaw) * 1.6, z + Math.sin(yaw) * 1.6],
      [x + Math.cos(yaw) * 1.6, z - Math.sin(yaw) * 1.6],
      0.85,
    );
    this.inventory.add('bicycle racks');
  }
  board(x: number, z: number, yaw: number, title: string, subtitle: string, message?: string, width = 3.8) {
    const b = new Batch(),
      y = this.ground(x, z);
    for (const s of [-1, 1]) b.box(s * (width / 2 - 0.25), 1.15, 0, 0.3, 2.3, 0.35, '#ad8e70', S.stone);
    b.box(0, 1.8, 0, width, 1.4, 0.18, '#879889', S.metal);
    b.box(0, 1.8, 0.105, width - 0.2, 1.15, 0.04, '#3b504e', S.window);
    this.place(b, x, z, yaw);
    const nx = Math.sin(yaw),
      nz = Math.cos(yaw);
    this.sign(title, x + nx * 0.14, y + 2.05, z + nz * 0.14, width - 0.4, yaw);
    this.sign(subtitle, x + nx * 0.14, y + 1.58, z + nz * 0.14, width - 0.4, yaw);
    this.obstacle(
      [x - (Math.cos(yaw) * width) / 2, z + (Math.sin(yaw) * width) / 2],
      [x + (Math.cos(yaw) * width) / 2, z - (Math.sin(yaw) * width) / 2],
      0.23,
    );
    if (message) this.action(`Read ${title.toLowerCase()}`, x + nx * 0.4, z + nz * 0.4, () => message, true);
    this.inventory.add('information boards');
  }
  flag(x: number, z: number, height = 8) {
    const y = this.ground(x, z),
      b = this.b;
    b.cylinder(x, y, z, 0.08, height, STEEL, S.metal, 10);
    sphere(b, x, y + height, z, 0.15, PALE, S.paint);
    const flag = new Batch();
    for (let i = 0; i < 13; i++)
      for (let j = 0; j < 16; j++) {
        const u = (j * 2.5) / 16,
          v = ((j + 1) * 2.5) / 16,
          top = -i * 0.1,
          bottom = top - 0.1;
        flag.quad(
          [u, top, 0],
          [v, top, 0],
          [v, bottom, 0],
          [u, bottom, 0],
          i < 7 && j < 7 ? '#68859b' : i % 2 ? '#e4dfc9' : '#c09281',
          S.paint,
        );
      }
    const mesh = this.place(flag, x, z, Math.PI / 4, y + height - 0.25),
      p = mesh.geometry.getAttribute('position');
    const base = new Float32Array(p.array as Float32Array);
    mesh.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(1.2, -0.65, 0), 2);
    this.animations.push((t) => {
      for (let i = 0; i < p.count; i++)
        p.setZ(i, Math.sin(base[i * 3] * 2.8 - t * 2.2) * 0.22 * (base[i * 3] / 2.5));
      p.needsUpdate = true;
    });
    this.obstacle([x, z], undefined, 0.14);
    this.inventory.add('waving flags');
  }
  visitor(
    path: Point2[],
    options: {
      scale?: number;
      bag?: boolean;
      backpack?: boolean;
      seated?: boolean;
      yaw?: number;
      color?: string;
    } = {},
  ) {
    const actor = person(this.material, options.color ?? '#c8b792');
    actor.group.name = options.seated ? 'seated-visitor' : 'walking-visitor';
    actor.group.scale.setScalar(options.scale ?? 1);
    if (options.bag || options.backpack) {
      const b = new Batch();
      b.box(
        options.backpack ? 0 : 0.5,
        options.backpack ? 1.15 : 0.6,
        options.backpack ? 0.25 : 0,
        0.33,
        0.4,
        0.2,
        '#a3b8af',
        S.metal,
      );
      actor.group.add(b.mesh(this.material));
    }
    this.group.add(actor.group);
    const lengths = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1])),
      total = lengths.reduce((a, b) => a + b, 0);
    this.animations.push((t) => {
      let d = total ? (t * 0.65) % (total * 2) : 0;
      const reverse = d > total;
      if (reverse) d = 2 * total - d;
      let i = 0;
      while (i < lengths.length - 1 && d > lengths[i]) {
        d -= lengths[i];
        i++;
      }
      const a = path[i],
        c = path[i + 1] ?? a,
        u = lengths[i] ? d / lengths[i] : 0;
      const x = a[0] + (c[0] - a[0]) * u,
        z = a[1] + (c[1] - a[1]) * u;
      actor.group.position.set(x, this.ground(x, z) + (options.seated ? -0.37 : 0), z);
      actor.group.rotation.y = options.yaw ?? Math.atan2(c[0] - a[0], c[1] - a[1]) + (reverse ? Math.PI : 0);
      actor.limbs[0].rotation.x = options.seated ? -1.25 : Math.sin(t * 4.5) * 0.3;
      actor.limbs[1].rotation.x = options.seated ? -1.25 : -actor.limbs[0].rotation.x;
      actor.limbs[2].rotation.x = options.seated ? -0.65 : Math.sin(t * 4.5) * 0.2;
      actor.limbs[3].rotation.x = options.seated ? -0.65 : -actor.limbs[2].rotation.x;
    });
    this.inventory.add('animated visitors');
    return actor;
  }
  finish() {
    this.group.add(this.b.mesh(this.material));
    for (const a of this.animations) a(0, 0);
    this.group.updateMatrixWorld(true);
    return this;
  }
}

export function vehicle(bus = false, color = '#9caeac') {
  const b = new Batch(),
    length = bus ? 9 : 4.3,
    width = bus ? 2.4 : 1.85;
  b.box(0, bus ? 1.35 : 0.7, 0, width, bus ? 1.9 : 0.8, length, bus ? '#d9b56a' : color, S.metal);
  b.box(
    0,
    bus ? 2.45 : 1.3,
    bus ? -1.3 : 0,
    width - 0.22,
    bus ? 0.4 : 0.65,
    bus ? 6.5 : 2.3,
    bus ? '#d9b56a' : color,
    S.metal,
  );
  for (const side of [-1, 1]) {
    for (const z of [-(length / 2 - 1), length / 2 - 1]) {
      b.box((side * width) / 2, 0.43, z, 0.26, 0.75, 0.76, '#35423e', S.metal);
      b.box(side * (width / 2 + 0.15), 0.43, z, 0.025, 0.31, 0.31, STEEL, S.paint);
    }
    const count = bus ? 8 : 2;
    for (let i = 0; i < count; i++)
      b.box(
        side * (width / 2 + 0.015),
        bus ? 2 : 1.4,
        bus ? -3.45 + i * 0.81 : -0.55 + i * 1.08,
        0.03,
        bus ? 0.66 : 0.42,
        bus ? 0.62 : 0.89,
        '#344e58',
        S.window,
      );
    b.box(side * 0.68, bus ? 1.1 : 0.78, length / 2 + 0.025, 0.3, 0.2, 0.04, PALE, S.paint);
    if (bus) b.box(side * (width / 2 + 0.025), 1.32, 0, 0.04, 0.14, 8.8, '#485550', S.metal);
  }
  b.box(
    0,
    bus ? 2 : 1.38,
    length / 2 - (bus ? 0.01 : 1.0),
    width - 0.3,
    bus ? 0.72 : 0.43,
    0.06,
    '#3a5158',
    S.window,
  );
  b.box(0, 0.45, length / 2 + 0.08, width, 0.17, 0.16, STEEL, S.metal);
  if (bus) {
    b.box(0.9, 1.22, 3.55, 0.08, 1.75, 0.82, '#374f50', S.window);
    b.box(0, 2.43, 4.55, 1.9, 0.3, 0.05, '#3a4b43', S.metal);
  }
  return b;
}

export function facade(site: PlaceSite, x: number, y: number, z: number, yaw: number) {
  const co = Math.cos(yaw),
    si = Math.sin(yaw);
  const point = (u: number, h: number, d: number): Point3 => [
    x + u * co + d * si,
    y + h,
    z - u * si + d * co,
  ];
  return {
    point,
    box: (
      u: number,
      h: number,
      d: number,
      w: number,
      hh: number,
      depth: number,
      color: string,
      surface: number = S.stone,
    ) => site.b.box(...point(u, h, d), w, hh, depth, color, surface, yaw),
    sign: (text: string, u: number, h: number, d: number, width: number) =>
      site.sign(text, ...point(u, h, d), width, yaw),
    window: (u: number, h: number, w: number, hh: number, d = 0.15) => {
      site.b.box(...point(u, h, d), w + 0.2, hh + 0.2, 0.08, PALE, S.trim, yaw);
      site.b.box(...point(u, h, d + 0.06), w, hh, 0.03, '#35535b', S.window, yaw);
      for (let i = 1; i < 4; i++)
        site.b.box(...point(u - w / 2 + (i * w) / 4, h, d + 0.09), 0.12, hh, 0.04, PALE, S.paint, yaw);
      site.b.box(...point(u, h, d + 0.09), w, 0.12, 0.04, PALE, S.paint, yaw);
    },
  };
}
