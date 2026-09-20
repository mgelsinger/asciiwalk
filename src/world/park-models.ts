import * as THREE from 'three';
import { Batch } from './geometry';
import { SURFACE as S } from '../renderer/material';
import type { Point2, Point3 } from './types';

export const PALE = '#e1dfc8',
  STEEL = '#aabbb7',
  WOOD = '#bb9868';
export type Animation = (time: number, dt: number) => void;
export type ObstacleAdder = (a: Point2, b?: Point2, radius?: number) => void;
export type Interaction = {
  object: THREE.Object3D;
  label: string;
  push: () => void | string;
  message?: string;
  static?: boolean;
};
const pole = (b: Batch, a: Point3, c: Point3, r = 0.07, color = STEEL) =>
  b.tube(a, c, r, r, color, S.metal, 8);
export function line(b: Batch, a: Point2, c: Point2, y = 0.07, width = 0.16, color = PALE) {
  const length = Math.hypot(c[0] - a[0], c[1] - a[1]);
  b.box(
    (a[0] + c[0]) / 2,
    y,
    (a[1] + c[1]) / 2,
    width,
    0.025,
    length,
    color,
    S.paint,
    Math.atan2(c[0] - a[0], c[1] - a[1]),
  );
}
export function arc(
  b: Batch,
  x: number,
  z: number,
  r: number,
  y: number,
  start = 0,
  end = Math.PI * 2,
  width = 0.15,
  color = PALE,
) {
  const n = Math.max(12, Math.ceil((end - start) * r * 3));
  for (let i = 0; i < n; i++) {
    const a = start + ((end - start) * i) / n,
      c = start + ((end - start) * (i + 1)) / n;
    line(
      b,
      [x + Math.cos(a) * r, z + Math.sin(a) * r],
      [x + Math.cos(c) * r, z + Math.sin(c) * r],
      y,
      width,
      color,
    );
  }
}
export function sphere(
  b: Batch,
  x: number,
  y: number,
  z: number,
  r: number,
  color: string,
  surface: number = S.person,
) {
  const p = (a: number, c: number): Point3 => [
    x + Math.cos(a) * Math.sin(c) * r,
    y + Math.cos(c) * r,
    z + Math.sin(a) * Math.sin(c) * r,
  ];
  for (let i = 0; i < 12; i++)
    for (let j = 0; j < 6; j++)
      b.quad(
        p((i * Math.PI) / 6, (j * Math.PI) / 6),
        p(((i + 1) * Math.PI) / 6, (j * Math.PI) / 6),
        p(((i + 1) * Math.PI) / 6, ((j + 1) * Math.PI) / 6),
        p((i * Math.PI) / 6, ((j + 1) * Math.PI) / 6),
        color,
        surface,
      );
}
export function fence(
  b: Batch,
  a: Point2,
  c: Point2,
  height: number,
  add: ObstacleAdder,
  floor = (_x: number, _z: number) => 0,
) {
  const length = Math.hypot(c[0] - a[0], c[1] - a[1]),
    n = Math.ceil(length / 3);
  for (let i = 0; i <= n; i++) {
    const x = a[0] + ((c[0] - a[0]) * i) / n,
      z = a[1] + ((c[1] - a[1]) * i) / n;
    const y = floor(x, z);
    pole(b, [x, y, z], [x, y + height + 0.12, z]);
    if (i === n) continue;
    const xx = a[0] + ((c[0] - a[0]) * (i + 1)) / n,
      zz = a[1] + ((c[1] - a[1]) * (i + 1)) / n,
      yy = floor(xx, zz);
    pole(b, [x, y + height, z], [xx, yy + height, zz], 0.045);
    b.quad(
      [x, y + 0.15, z],
      [xx, yy + 0.15, zz],
      [xx, yy + height, zz],
      [x, y + height, z],
      '#8bada4',
      S.mesh,
    );
  }
  add(a, c, 0.07);
}
export function bench(b: Batch, x: number, z: number, yaw = 0, picnic = false) {
  const co = Math.cos(yaw),
    si = Math.sin(yaw);
  const box = (a: number, y: number, c: number, w: number, h: number, d: number, color = WOOD) =>
    b.box(x + a * co + c * si, y, z - a * si + c * co, w, h, d, color, S.metal, yaw);
  if (picnic) {
    for (let i = -2; i <= 2; i++) box(0, 0.82, i * 0.18, 2.2, 0.09, 0.15);
    for (const side of [-1, 1]) {
      box(0, 0.46, side * 0.77, 2.2, 0.1, 0.31);
      box(side * 0.7, 0.36, 0, 0.13, 0.72, 1.6, STEEL);
    }
  } else {
    for (let i = 0; i < 3; i++) {
      box(0, 0.48, i * 0.17 - 0.17, 2.1, 0.1, 0.14);
      box(0, 0.68 + i * 0.16, 0.3, 2.1, 0.13, 0.09);
    }
    for (const side of [-1, 1]) box(side * 0.78, 0.26, 0, 0.14, 0.52, 0.6, STEEL);
  }
}
export function person(material: THREE.Material, shirt = '#d7ac74') {
  const group = new THREE.Group(),
    b = new Batch();
  b.box(0, 1.12, 0, 0.46, 0.57, 0.3, shirt, S.person);
  sphere(b, 0, 1.6, 0, 0.17, '#d9b691');
  group.add(b.mesh(material));
  const limbs: THREE.Mesh[] = [];
  for (const [x, y, length] of [
    [-0.14, 0.86, 0.76],
    [0.14, 0.86, 0.76],
    [-0.31, 1.37, 0.59],
    [0.31, 1.37, 0.59],
  ]) {
    const limb = new Batch();
    limb.box(0, -length / 2, 0, 0.15, length, 0.17, y > 1 ? shirt : '#92a6b3', S.person);
    const mesh = limb.mesh(material);
    mesh.position.set(x, y, 0);
    group.add(mesh);
    limbs.push(mesh);
  }
  return { group, limbs };
}
export function swings(
  parent: THREE.Group,
  b: Batch,
  material: THREE.Material,
  x: number,
  z: number,
  animations: Animation[],
  interactions: Interaction[],
  add: ObstacleAdder,
) {
  for (const side of [-1, 1])
    for (const front of [-1, 1]) {
      pole(b, [x + side * 3.8, 0, z + front * 1.4], [x + side * 3.35, 3.4, z], 0.1, '#d4bb75');
      add([x + side * 3.8, z + front * 1.4]);
    }
  pole(b, [x - 3.4, 3.4, z], [x + 3.4, 3.4, z], 0.12, '#d4bb75');
  let boost = 0;
  const marker = new THREE.Object3D();
  marker.position.set(x, 0, z);
  parent.add(marker);
  interactions.push({
    object: marker,
    label: 'Push the swings',
    push: () => {
      boost = 1;
    },
  });
  for (let i = 0; i < 3; i++) {
    const pivot = new THREE.Group(),
      s = new Batch();
    pivot.position.set(x + (i - 1) * 2.0, 3.35, z);
    for (const side of [-1, 1]) pole(s, [side * 0.3, 0, 0], [side * 0.3, -2.65, 0], 0.028, PALE);
    s.box(0, -2.65, 0, 0.72, 0.1, 0.4, '#adc7b6', S.paint);
    pivot.add(s.mesh(material));
    parent.add(pivot);
    if (i !== 1) {
      const kid = person(material, i ? '#8eb9cc' : '#dfaf7b');
      kid.group.scale.setScalar(0.68);
      kid.group.position.y = -3.24;
      kid.limbs[0].rotation.x = -1.1;
      kid.limbs[1].rotation.x = -1.1;
      kid.limbs[2].rotation.x = -0.6;
      kid.limbs[3].rotation.x = -0.6;
      pivot.add(kid.group);
    }
    animations.push((t, dt) => {
      if (i === 0) boost = Math.max(0, boost - dt * 0.08);
      pivot.rotation.x = Math.sin(t * 1.75 + i * 1.7) * (0.32 + boost * 0.38);
    });
  }
}
export function carousel(
  parent: THREE.Group,
  material: THREE.Material,
  x: number,
  z: number,
  animations: Animation[],
  interactions: Interaction[],
  add: ObstacleAdder,
) {
  const turntable = new THREE.Group(),
    b = new Batch();
  turntable.position.set(x, 0, z);
  b.cylinder(0, 0.18, 0, 1.85, 0.22, '#bd9c70', S.metal, 32);
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3,
      c = ((i + 1) * Math.PI) / 3;
    b.tri(
      [0, 0.41, 0],
      [Math.cos(a) * 1.8, 0.41, Math.sin(a) * 1.8],
      [Math.cos(c) * 1.8, 0.41, Math.sin(c) * 1.8],
      i % 2 ? '#aabfa9' : '#779ead',
      S.paint,
    );
    pole(b, [Math.cos(a) * 1.5, 0.41, Math.sin(a) * 1.5], [Math.cos(a) * 1.5, 1.3, Math.sin(a) * 1.5], 0.06);
    pole(b, [Math.cos(a) * 1.5, 1.3, Math.sin(a) * 1.5], [Math.cos(a) * 0.45, 1.3, Math.sin(a) * 0.45], 0.06);
  }
  pole(b, [0, 0.4, 0], [0, 1.35, 0], 0.1);
  turntable.add(b.mesh(material));
  parent.add(turntable);
  add([x, z], undefined, 1.8);
  const kid = person(material, '#d5a175');
  kid.group.position.set(0.9, 0.42, 0);
  kid.group.scale.setScalar(0.68);
  turntable.add(kid.group);
  let speed = 0.26;
  animations.push((_t, dt) => {
    speed = 0.26 + (speed - 0.26) * Math.exp(-dt * 0.16);
    turntable.rotation.y += dt * speed;
  });
  interactions.push({
    object: turntable,
    label: 'Spin the merry-go-round',
    push: () => {
      speed = 1.5;
    },
  });
}
export function slide(b: Batch, x: number, z: number, add: ObstacleAdder) {
  for (const side of [-1, 1])
    for (const front of [-1, 1])
      pole(b, [x + side * 0.8, 0, z + front * 0.8], [x + side * 0.8, 2.7, z + front * 0.8], 0.075, '#a7be95');
  b.box(x, 1.9, z, 1.8, 0.18, 1.8, '#d2af77', S.paint);
  for (const side of [-1, 1]) {
    pole(b, [x + side * 0.85, 2.7, z - 0.8], [x + side * 0.85, 2.7, z + 0.8]);
    pole(b, [x + side * 0.48, 0.1, z - 2.2], [x + side * 0.48, 1.95, z - 0.8]);
  }
  for (let i = 0; i < 7; i++)
    b.box(x, 0.22 + i * 0.26, z - 2.1 + i * 0.19, 1.05, 0.13, 0.26, '#c9b88d', S.paint);
  for (let i = 0; i < 10; i++) {
    const t = i / 10,
      u = (i + 1) / 10,
      y = 1.9 * (1 - t) * (1 - t) + 0.15,
      v = 1.9 * (1 - u) * (1 - u) + 0.15;
    b.quad(
      [x - 0.55, y, z + 0.8 + t * 3.6],
      [x + 0.55, y, z + 0.8 + t * 3.6],
      [x + 0.55, v, z + 0.8 + u * 3.6],
      [x - 0.55, v, z + 0.8 + u * 3.6],
      '#b6d3d1',
      S.metal,
    );
    for (const side of [-1, 1])
      pole(
        b,
        [x + side * 0.62, y + 0.2, z + 0.8 + t * 3.6],
        [x + side * 0.62, v + 0.2, z + 0.8 + u * 3.6],
        0.07,
        '#d8b56c',
      );
  }
  add([x, z - 1.2], [x, z + 4.3], 0.72);
}
export function climber(b: Batch, x: number, z: number, add: ObstacleAdder) {
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6,
      c = ((i + 1) * Math.PI) / 6;
    for (let j = 0; j < 4; j++) {
      const t = (j * Math.PI) / 8,
        u = ((j + 1) * Math.PI) / 8;
      pole(
        b,
        [x + 2 * Math.cos(a) * Math.cos(t), 2 * Math.sin(t), z + 2 * Math.sin(a) * Math.cos(t)],
        [x + 2 * Math.cos(a) * Math.cos(u), 2 * Math.sin(u), z + 2 * Math.sin(a) * Math.cos(u)],
        0.045,
        '#c1bf84',
      );
      pole(
        b,
        [x + 2 * Math.cos(a) * Math.cos(t), 2 * Math.sin(t), z + 2 * Math.sin(a) * Math.cos(t)],
        [x + 2 * Math.cos(c) * Math.cos(t), 2 * Math.sin(t), z + 2 * Math.sin(c) * Math.cos(t)],
        0.045,
        '#b0cfce',
      );
    }
  }
  add([x, z], undefined, 1.8);
}
export function seesaw(
  parent: THREE.Group,
  b: Batch,
  material: THREE.Material,
  x: number,
  z: number,
  animations: Animation[],
  add: ObstacleAdder,
) {
  pole(b, [x, 0, z - 0.45], [x, 0.8, z], 0.16);
  pole(b, [x, 0, z + 0.45], [x, 0.8, z], 0.16);
  const pivot = new THREE.Group(),
    s = new Batch();
  pivot.position.set(x, 0.9, z);
  s.box(0, 0, 0, 4.5, 0.15, 0.3, '#d2b36c', S.paint);
  for (const side of [-1, 1]) {
    s.box(side * 1.85, 0.1, 0, 0.6, 0.12, 0.5, '#a5cbd1', S.paint);
    pole(s, [side * 1.5, 0, 0], [side * 1.5, 0.6, 0], 0.045);
  }
  pivot.add(s.mesh(material));
  parent.add(pivot);
  animations.push((t) => {
    pivot.rotation.z = Math.sin(t * 1.3) * 0.22;
  });
  add([x - 2, z], [x + 2, z], 0.35);
}
