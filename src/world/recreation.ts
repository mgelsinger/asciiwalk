import * as THREE from 'three';
import { Batch, makeTree } from './geometry';
import { facilityFrame } from './facility-layout';
import { SURFACE as S } from '../renderer/material';
import {
  arc,
  bench,
  carousel,
  climber,
  fence,
  line,
  PALE,
  person,
  seesaw,
  slide,
  sphere,
  STEEL,
  swings,
} from './park-models';
import type { Animation, Interaction, ObstacleAdder } from './park-models';
import type { WorldData } from './data';
import type { Facility, FixtureObstacle, Point2, Point3 } from './types';

type Site = { group: THREE.Group; x: number; z: number; animations: Animation[] };
export class Recreation {
  group = new THREE.Group();
  sites: Site[] = [];
  obstacles: FixtureObstacle[] = [];
  interactions: Interaction[] = [];
  time = 0;
  live = true;
  constructor(
    public data: WorldData,
    public material: THREE.Material,
  ) {
    for (const f of data.features.facilities ?? []) this.makeFacility(f);
    if (data.manifest.id === 'warsaw') this.parkExtras();
    // Set a complete initial pose even when reduced motion starts the park frozen.
    for (const site of this.sites) for (const animate of site.animations) animate(0, 0);
    this.group.updateMatrixWorld(true);
  }
  makeFacility(f: Facility) {
    const frame = facilityFrame(f),
      group = new THREE.Group(),
      animations: Animation[] = [],
      b = new Batch();
    group.position.set(frame.x, f.height, frame.z);
    group.rotation.y = frame.yaw;
    group.name = `${f.type}-${f.id}`;
    const add: ObstacleAdder = (a, c = a, radius = 0.14) => {
      const p = frame.point(a[0], 0, a[1]),
        q = frame.point(c[0], 0, c[1]);
      this.obstacles.push({ a: [p[0], p[2]], b: [q[0], q[2]], radius });
    };
    const width = frame.width,
      length = frame.length;
    if (f.type === 'basketball' || f.type === 'tennis') {
      b.poly(frame.ring, [], 0.05, f.type === 'tennis' ? '#668d83' : '#777f85', S.court);
      const w = width * 0.46,
        l = length * 0.47;
      for (const sign of [-1, 1]) {
        line(b, [-w, sign * l], [w, sign * l]);
        line(b, [sign * w, -l], [sign * w, l]);
      }
      if (f.type === 'tennis') {
        for (const sign of [-1, 1]) {
          line(b, [sign * w * 0.76, -l], [sign * w * 0.76, l]);
          line(b, [-w * 0.76, sign * l * 0.54], [w * 0.76, sign * l * 0.54]);
        }
        line(b, [0, -l * 0.54], [0, l * 0.54]);
        for (const sign of [-1, 1]) b.cylinder(sign * (w + 0.2), 0, 0, 0.085, 1.15, STEEL, S.metal, 8);
        for (let i = 0; i < 12; i++) {
          const x = -w + (2 * w * i) / 12,
            u = -w + (2 * w * (i + 1)) / 12,
            y = 0.92 + 0.14 * (Math.abs(x) / w) ** 2,
            v = 0.92 + 0.14 * (Math.abs(u) / w) ** 2;
          b.quad([x, 0.06, 0], [u, 0.06, 0], [u, v, 0], [x, y, 0], '#c1d0c9', S.mesh);
          b.tube([x, y, 0], [u, v, 0], 0.04, 0.04, PALE, S.paint, 6);
        }
        add([-w - 0.15, 0], [w + 0.15, 0], 0.055);
        // One rally per pair of courts leaves room for quiet exploration.
        if (Number(f.id) % 2 === 0) this.tennisActivity(group, animations, l, w);
      } else {
        line(b, [-w, 0], [w, 0]);
        arc(b, 0, 0, 1.8, 0.075);
        for (const sign of [-1, 1]) {
          const free = sign * (l - Math.min(5.6, l * 0.42));
          line(b, [-2.45, sign * l], [-2.45, free]);
          line(b, [2.45, sign * l], [2.45, free]);
          line(b, [-2.45, free], [2.45, free]);
          arc(b, 0, free, 1.8, 0.075);
          arc(
            b,
            0,
            sign * (l - 1.4),
            Math.min(6.6, w - 0.5),
            0.075,
            sign === 1 ? Math.PI : 0,
            sign === 1 ? Math.PI * 2 : Math.PI,
          );
          b.tube([0, 0, sign * (l + 0.5)], [0, 3.8, sign * (l + 0.5)], 0.12, 0.12, STEEL, S.metal, 10);
          b.tube([0, 3.4, sign * (l + 0.5)], [0, 3.4, sign * (l - 0.75)], 0.1, 0.1, STEEL, S.metal, 8);
          b.box(0, 3.45, sign * (l - 0.8), 1.85, 1.12, 0.14, PALE, S.paint);
          b.box(0, 3.35, sign * (l - 0.89), 0.67, 0.5, 0.025, '#526873', S.metal);
          arc(b, 0, sign * (l - 1.2), 0.27, 3.05, 0, Math.PI * 2, 0.07, '#ddb080');
          for (let i = 0; i < 10; i++) {
            const a = (i * Math.PI) / 5;
            b.tube(
              [Math.cos(a) * 0.25, 3.04, sign * (l - 1.2) + Math.sin(a) * 0.25],
              [Math.cos(a) * 0.16, 2.64, sign * (l - 1.2) + Math.sin(a) * 0.16],
              0.018,
              0.018,
              PALE,
              S.paint,
              5,
            );
          }
          add([0, sign * (l + 0.5)], undefined, 0.15);
        }
        this.basketballActivity(group, animations, l);
      }
      bench(b, width / 2 + 1.6, 0, Math.PI / 2);
      add([width / 2 + 1.6, -1], [width / 2 + 1.6, 1], 0.32);
    } else if (f.type === 'playground') {
      b.poly(frame.ring, [], 0.045, '#aa9471', S.ground);
      for (let i = 0; i < frame.ring.length; i++)
        line(b, frame.ring[i], frame.ring[(i + 1) % frame.ring.length], 0.1, 0.18, '#c6b089');
      if (width > 12 && length > 14) {
        swings(group, b, this.material, -width * 0.2, -length * 0.24, animations, this.interactions, add);
        slide(b, -width * 0.24, length * 0.12, add);
        if (f.id === '477964576' || Number(f.id) % 3 === 0)
          carousel(group, this.material, width * 0.23, length * 0.18, animations, this.interactions, add);
        else {
          climber(b, width * 0.22, length * 0.17, add);
          seesaw(group, b, this.material, 0, length * 0.35, animations, add);
        }
      } else if (width > 7 && length > 9) {
        swings(group, b, this.material, 0, -length * 0.2, animations, this.interactions, add);
        seesaw(group, b, this.material, 0, length * 0.28, animations, add);
      } else {
        climber(b, 0, 0, add);
      }
      bench(b, 0, -length / 2 - 1.4);
      add([-1, -length / 2 - 1.4], [1, -length / 2 - 1.4], 0.3);
    } else if (f.type === 'pool') {
      b.poly(frame.ring, [], 0.06, '#699ba2', S.water);
      for (let i = 0; i < frame.ring.length; i++)
        line(b, frame.ring[i], frame.ring[(i + 1) % frame.ring.length], 0.13, 0.75, PALE);
      if (width > 12 && length > 18) {
        for (let x = -width * 0.3; x <= width * 0.3; x += 3.5) {
          b.tube([x, 0.1, -length * 0.42], [x, 0.1, length * 0.42], 0.035, 0.035, PALE, S.metal, 6);
          for (let z = -length * 0.4; z < length * 0.4; z += 1.2)
            sphere(b, x, 0.15, z, 0.12, Math.round(z * 10) % 2 ? '#cdb275' : '#cedace', S.paint);
        }
      }
      if (width > 5)
        for (const x of [-width * 0.25, width * 0.25]) {
          for (const side of [-1, 1]) {
            const xx = x + side * 0.3;
            b.tube([xx, 0.15, length * 0.45], [xx, 1.0, length * 0.45], 0.055, 0.055, STEEL, S.metal, 8);
            b.tube(
              [xx, 1.0, length * 0.45],
              [xx, 1.0, length * 0.45 + 0.65],
              0.055,
              0.055,
              STEEL,
              S.metal,
              8,
            );
            b.tube(
              [xx, 1.0, length * 0.45 + 0.65],
              [xx, 0, length * 0.45 + 0.65],
              0.055,
              0.055,
              STEEL,
              S.metal,
              8,
            );
          }
        }
    } else if (f.type === 'baseball') {
      // The mapped field fixes the extent; the diamond is an inferred fit within it.
      const size = Math.min(width, length) * 0.24;
      const diamond: Point2[] = [
        [0, size],
        [size, 0],
        [0, -size],
        [-size, 0],
      ];
      for (let i = 0; i < 4; i++) {
        const a = diamond[i],
          c = diamond[(i + 1) % 4];
        for (let k = 0; k < 12; k++) {
          const t = k / 12,
            u = (k + 1) / 12,
            p = frame.point(a[0] + (c[0] - a[0]) * t, 0, a[1] + (c[1] - a[1]) * t),
            q = frame.point(a[0] + (c[0] - a[0]) * u, 0, a[1] + (c[1] - a[1]) * u);
          const y = this.data.ground(p[0], p[2]) - f.height + 0.08,
            v = this.data.ground(q[0], q[2]) - f.height + 0.08;
          b.tube(
            [a[0] + (c[0] - a[0]) * t, y, a[1] + (c[1] - a[1]) * t],
            [a[0] + (c[0] - a[0]) * u, v, a[1] + (c[1] - a[1]) * u],
            0.08,
            0.08,
            PALE,
            S.paint,
            5,
          );
        }
        const p = frame.point(a[0], 0, a[1]);
        b.box(a[0], this.data.ground(p[0], p[2]) - f.height + 0.09, a[1], 0.45, 0.08, 0.45, PALE, S.paint);
      }
      const p = frame.point(0, 0, 0);
      b.cylinder(0, this.data.ground(p[0], p[2]) - f.height + 0.04, 0, 2.4, 0.08, '#b79b74', S.ground, 24);
      const floor = (x: number, z: number) => {
        const p = frame.point(x, 0, z);
        return this.data.ground(p[0], p[2]) - f.height;
      };
      fence(b, [-4, size + 2], [4, size + 2], 3.5, add, floor);
      fence(b, [-4, size + 2], [-7, size - 1], 3.5, add, floor);
      fence(b, [4, size + 2], [7, size - 1], 3.5, add, floor);
      for (let row = 0; row < 3; row++)
        b.box(
          size + 4,
          floor(size + 4, row * 0.65) + 0.4 + row * 0.42,
          row * 0.65,
          5,
          0.12,
          0.5,
          '#b8bfb1',
          S.metal,
        );
      add([size + 1.5, -0.3], [size + 6.5, 1.7], 0.5);
    }
    group.add(b.mesh(this.material));
    this.group.add(group);
    this.sites.push({ group, x: frame.x, z: frame.z, animations });
  }
  tennisActivity(group: THREE.Group, animations: Animation[], l: number, w: number) {
    const ballBatch = new Batch();
    sphere(ballBatch, 0, 0, 0, 0.16, '#e7d9a2', S.paint);
    const ball = ballBatch.mesh(this.material);
    group.add(ball);
    for (const side of [-1, 1]) {
      const p = person(this.material, side < 0 ? '#caa27b' : '#95becb');
      group.add(p.group);
      const racket = new Batch();
      racket.tube([0, 0, 0], [0, -0.5, 0], 0.035, 0.035, STEEL, S.metal, 6);
      for (let i = 0; i < 20; i++) {
        const a = (i * Math.PI) / 10,
          c = ((i + 1) * Math.PI) / 10;
        racket.tube(
          [Math.cos(a) * 0.22, -0.73 + Math.sin(a) * 0.31, 0],
          [Math.cos(c) * 0.22, -0.73 + Math.sin(c) * 0.31, 0],
          0.03,
          0.03,
          PALE,
          S.paint,
          5,
        );
      }
      p.limbs[3].add(racket.mesh(this.material));
      animations.push((t) => {
        p.group.position.set(Math.sin(t * 1.4 + side) * Math.min(w * 0.4, 1.7), 0, side * l * 0.86);
        p.group.rotation.y = side > 0 ? 0 : Math.PI;
        p.limbs[3].rotation.x = -0.8 + Math.sin(t * 2.4 + side) * 0.65;
        p.limbs[0].rotation.x = Math.sin(t * 5) * 0.2;
        p.limbs[1].rotation.x = -p.limbs[0].rotation.x;
      });
    }
    animations.push((t) => {
      const a = Math.sin(t * 1.4);
      ball.position.set(Math.sin(t * 0.7) * 1.4, 0.3 + 1.9 * (1 - a * a), a * l * 0.84);
    });
  }
  basketballActivity(group: THREE.Group, animations: Animation[], l: number) {
    const player = person(this.material, '#bd956e');
    group.add(player.group);
    const b = new Batch();
    sphere(b, 0, 0, 0, 0.25, '#deb286', S.metal);
    const ball = b.mesh(this.material);
    group.add(ball);
    const defender = person(this.material, '#95b8a6');
    group.add(defender.group);
    defender.group.rotation.y = Math.PI;
    animations.push((t) => {
      const cycle = t % 7,
        moving = Math.sin(t * 0.7) * 1.2;
      player.group.position.set(moving, 0, -l * 0.2);
      player.group.rotation.y = Math.PI;
      defender.group.position.set(Math.sin(t * 0.8) * 1.5, 0, l * 0.35);
      defender.limbs[2].rotation.z = -0.4;
      defender.limbs[3].rotation.z = 0.4;
      if (cycle < 3.8) {
        ball.position.set(moving - 0.55, 0.32 + Math.abs(Math.sin(t * 5)) * 1.0, -l * 0.2 - 0.1);
        player.limbs[3].rotation.x = -0.45 + Math.sin(t * 5) * 0.2;
      } else {
        const u = (cycle - 3.8) / 3.2;
        ball.position.set(
          moving * (1 - u),
          1.6 * (1 - u) + 0.3 * u + 3.4 * Math.sin(Math.PI * u),
          -l * 0.2 + l * 1.05 * u,
        );
        player.limbs[3].rotation.x = -2.4;
      }
    });
  }
  parkExtras() {
    const group = new THREE.Group(),
      b = new Batch(),
      animations: Animation[] = [];
    group.name = 'warsaw-park-furnishings';
    const add: ObstacleAdder = (a, c = a, radius = 0.12) => {
      this.obstacles.push({ a, b: c, radius });
    };
    // Surround the mapped six-court block, with wide pedestrian gates at both ends.
    const segments: [Point2, Point2][] = [
      [
        [-499, 591],
        [-419, 591],
      ],
      [
        [-499, 621],
        [-419, 621],
      ],
      [
        [-499, 591],
        [-499, 603],
      ],
      [
        [-499, 609],
        [-499, 621],
      ],
      [
        [-419, 591],
        [-419, 603],
      ],
      [
        [-419, 609],
        [-419, 621],
      ],
    ];
    for (const [a, c] of segments) {
      fence(b, a, c, 2.5, add, (x, z) => this.data.ground(x, z));
    }
    for (const [x, z, yaw, picnic] of [
      [-503, 548, 0, 1],
      [-516, 548, 0, 1],
      [-532, 550, 0.2, 1],
      [-489, 586, 0, 0],
      [-452, 587, 0, 0],
      [-426, 588, 0, 0],
      [-570, 576, 1.5, 0],
    ]) {
      const local = new Batch();
      bench(local, 0, 0, yaw, !!picnic);
      const mesh = local.mesh(this.material);
      mesh.position.set(x, this.data.ground(x, z), z);
      group.add(mesh);
      add([x - 1, z], [x + 1, z], picnic ? 0.7 : 0.35);
      const binY = this.data.ground(x + 2, z + 1);
      b.cylinder(x + 2, binY, z + 1, 0.3, 0.85, '#8dada0', S.metal, 12);
      b.cylinder(x + 2, binY + 0.85, z + 1, 0.34, 0.08, PALE, S.paint, 12);
    }
    // Small furnishings are inferred within the mapped open space, not surveyed equipment locations.
    for (const [x, z] of [
      [-500, 539],
      [-538, 544],
      [-560, 560],
      [-407, 564],
      [-414, 626],
    ]) {
      const y = this.data.ground(x, z);
      b.cylinder(x, y, z, 0.09, 4.4, STEEL, S.metal, 8);
      b.box(x, y + 4.35, z, 0.9, 0.2, 0.65, PALE, S.paint);
      add([x, z]);
    }
    for (const [x, z, s] of [
      [-537, 540, 7],
      [-520, 537, 6],
      [-564, 555, 8],
      [-584, 580, 7],
    ])
      makeTree(b, x, this.data.ground(x, z), z, s, x + z);
    // Picnic shelter: an open roof and posts keep the area navigable.
    const sx = -530,
      sz = 533,
      y = this.data.ground(sx, sz);
    for (const dx of [-4, 4])
      for (const dz of [-2.7, 2.7]) {
        b.box(sx + dx, y + 1.7, sz + dz, 0.22, 3.4, 0.22, STEEL, S.metal);
        add([sx + dx, sz + dz]);
      }
    b.quad(
      [sx - 4.6, y + 3.2, sz - 3.3],
      [sx + 4.6, y + 3.2, sz - 3.3],
      [sx + 4.6, y + 4.35, sz],
      [sx - 4.6, y + 4.35, sz],
      '#a9b8ad',
      S.roof,
    );
    b.quad(
      [sx - 4.6, y + 4.35, sz],
      [sx + 4.6, y + 4.35, sz],
      [sx + 4.6, y + 3.2, sz + 3.3],
      [sx - 4.6, y + 3.2, sz + 3.3],
      '#a9b8ad',
      S.roof,
    );
    for (const dx of [-2, 2]) {
      const local = new Batch();
      bench(local, 0, 0, Math.PI / 2, true);
      const mesh = local.mesh(this.material);
      mesh.position.set(sx + dx, y, sz);
      group.add(mesh);
      add([sx + dx, sz - 1], [sx + dx, sz + 1], 0.7);
    }
    for (let i = 0; i < 3; i++) {
      const bird = new THREE.Group(),
        left = new Batch(),
        right = new Batch();
      left.tube([0, 0, 0], [-0.65, 0.13, 0.15], 0.035, 0.07, PALE, S.paint, 5);
      right.tube([0, 0, 0], [0.65, 0.13, 0.15], 0.035, 0.07, PALE, S.paint, 5);
      const a = left.mesh(this.material),
        c = right.mesh(this.material);
      bird.add(a, c);
      group.add(bird);
      animations.push((t) => {
        const phase = t * 0.12 + i * 2.1;
        bird.position.set(
          -500 + Math.cos(phase) * 35,
          15 + Math.sin(t * 0.3 + i) * 2,
          545 + Math.sin(phase) * 25,
        );
        bird.rotation.y = -phase;
        a.rotation.z = Math.sin(t * 5 + i) * 0.45;
        c.rotation.z = -a.rotation.z;
      });
    }
    group.add(b.mesh(this.material));
    this.group.add(group);
    this.sites.push({ group, x: -510, z: 557, animations });
  }
  tick(dt: number, x: number, z: number) {
    if (this.live) this.time += dt;
    for (const site of this.sites) {
      site.group.visible = Math.hypot(site.x - x, site.z - z) < 550;
      if (site.group.visible && this.live) for (const animate of site.animations) animate(this.time, dt);
    }
  }
  nearestInteraction(x: number, z: number) {
    if (!this.live) return undefined;
    const p = new THREE.Vector3();
    let best: Interaction | undefined,
      distance = 6;
    for (const interaction of this.interactions) {
      interaction.object.getWorldPosition(p);
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < distance) {
        best = interaction;
        distance = d;
      }
    }
    return best;
  }
  interact(x: number, z: number) {
    const action = this.nearestInteraction(x, z);
    action?.push();
    return action?.label;
  }
}
