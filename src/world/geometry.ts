import * as THREE from 'three';
import { hash, pointInRing, seeded } from '../geography/math';
import { SURFACE as S } from '../renderer/material';
import type { Building, Point2, Point3 } from './types';
import type { WorldData } from './data';

const colorCache = new Map<string, THREE.Color>();
const colorOf = (value: string) => {
  if (!colorCache.has(value)) colorCache.set(value, new THREE.Color(value));
  return colorCache.get(value)!;
};

export class Batch {
  positions: number[] = [];
  normals: number[] = [];
  colors: number[] = [];
  surfaces: number[] = [];
  tri(a: Point3, b: Point3, c: Point3, color: string, surface: number) {
    const ux = b[0] - a[0],
      uy = b[1] - a[1],
      uz = b[2] - a[2],
      vx = c[0] - a[0],
      vy = c[1] - a[1],
      vz = c[2] - a[2];
    let nx = uy * vz - uz * vy,
      ny = uz * vx - ux * vz,
      nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz) || 1;
    nx /= length;
    ny /= length;
    nz /= length;
    const rgb = colorOf(color);
    for (const p of [a, b, c]) {
      this.positions.push(...p);
      this.normals.push(nx, ny, nz);
      this.colors.push(rgb.r, rgb.g, rgb.b);
      this.surfaces.push(surface);
    }
  }
  quad(a: Point3, b: Point3, c: Point3, d: Point3, color: string, surface: number) {
    this.tri(a, b, c, color, surface);
    this.tri(a, c, d, color, surface);
  }
  box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    depth: number,
    color: string,
    surface: number,
    yaw = 0,
  ) {
    const co = Math.cos(yaw),
      si = Math.sin(yaw);
    const p = (a: number, b: number, c: number): Point3 => [x + a * co + c * si, y + b, z - a * si + c * co];
    const a = p(-w / 2, -h / 2, -depth / 2),
      b = p(w / 2, -h / 2, -depth / 2),
      c = p(w / 2, h / 2, -depth / 2),
      d = p(-w / 2, h / 2, -depth / 2);
    const e = p(-w / 2, -h / 2, depth / 2),
      f = p(w / 2, -h / 2, depth / 2),
      g = p(w / 2, h / 2, depth / 2),
      j = p(-w / 2, h / 2, depth / 2);
    this.quad(a, d, c, b, color, surface);
    this.quad(e, f, g, j, color, surface);
    this.quad(a, e, j, d, color, surface);
    this.quad(b, c, g, f, color, surface);
    this.quad(d, j, g, c, color, surface);
    this.quad(a, b, f, e, color, surface);
  }
  cone(
    x: number,
    y: number,
    z: number,
    r: number,
    height: number,
    color: string,
    surface: number,
    sides = 6,
  ) {
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2,
        b = ((i + 1) / sides) * Math.PI * 2;
      this.tri(
        [x + Math.cos(a) * r, y, z + Math.sin(a) * r],
        [x, y + height, z],
        [x + Math.cos(b) * r, y, z + Math.sin(b) * r],
        color,
        surface,
      );
    }
  }
  cylinder(
    x: number,
    y: number,
    z: number,
    radius: number,
    height: number,
    color: string,
    surface: number,
    sides = 12,
  ) {
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2,
        b = ((i + 1) / sides) * Math.PI * 2;
      this.quad(
        [x + Math.cos(a) * radius, y, z + Math.sin(a) * radius],
        [x + Math.cos(b) * radius, y, z + Math.sin(b) * radius],
        [x + Math.cos(b) * radius, y + height, z + Math.sin(b) * radius],
        [x + Math.cos(a) * radius, y + height, z + Math.sin(a) * radius],
        color,
        surface,
      );
      this.tri(
        [x, y + height, z],
        [x + Math.cos(a) * radius, y + height, z + Math.sin(a) * radius],
        [x + Math.cos(b) * radius, y + height, z + Math.sin(b) * radius],
        color,
        surface,
      );
    }
  }
  poly(ring: Point2[], holes: Point2[][], y: number, color: string, surface: number) {
    const outer = ring.map((p) => new THREE.Vector2(...p)),
      inner = holes.map((h) => h.map((p) => new THREE.Vector2(...p))),
      all = [...ring, ...holes.flat()];
    const faces = THREE.ShapeUtils.triangulateShape(outer, inner);
    for (const [a, b, c] of faces)
      this.tri(
        [all[a][0], y, all[a][1]],
        [all[c][0], y, all[c][1]],
        [all[b][0], y, all[b][1]],
        color,
        surface,
      );
  }
  tube(a: Point3, b: Point3, r0: number, r1: number, color: string, surface: number, sides = 16) {
    const axis = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
    const u = new THREE.Vector3()
      .crossVectors(axis, Math.abs(axis.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0))
      .normalize();
    const v = new THREE.Vector3().crossVectors(axis, u);
    const p = (center: Point3, radius: number, angle: number): Point3 =>
      center.map(
        (n, i) => n + radius * (u.getComponent(i) * Math.cos(angle) + v.getComponent(i) * Math.sin(angle)),
      ) as Point3;
    for (let i = 0; i < sides; i++) {
      const x = (i * Math.PI * 2) / sides,
        y = ((i + 1) * Math.PI * 2) / sides;
      this.quad(p(a, r0, x), p(a, r0, y), p(b, r1, y), p(b, r1, x), color, surface);
      this.tri(b, p(b, r1, x), p(b, r1, y), color, surface);
    }
  }
  mesh(material: THREE.Material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    g.setAttribute('surface', new THREE.Float32BufferAttribute(this.surfaces, 1));
    g.computeBoundingSphere();
    return new THREE.Mesh(g, material);
  }
}

function windowOnWall(
  batch: Batch,
  ax: number,
  az: number,
  dx: number,
  dz: number,
  normal: Point2,
  along: number,
  bottom: number,
  width: number,
  height: number,
  trim: string,
  arch: boolean,
) {
  const point = (u: number, y: number, offset: number): Point3 => [
    ax + dx * u + normal[0] * offset,
    y,
    az + dz * u + normal[1] * offset,
  ];
  const quad = (u: number, v: number, y: number, h: number, color: string, surface: number, offset: number) =>
    batch.quad(
      point(u, y, offset),
      point(v, y, offset),
      point(v, y + h, offset),
      point(u, y + h, offset),
      color,
      surface,
    );
  const left = along - width / 2,
    right = along + width / 2;
  quad(left - 0.11, right + 0.11, bottom - 0.12, height + 0.25, trim, S.trim, 0.07);
  quad(left, right, bottom, height, '#253f43', S.window, 0.1);
  quad(left, right, bottom + height * 0.52, 0.055, trim, S.trim, 0.12);
  quad(along - 0.035, along + 0.035, bottom, height, trim, S.trim, 0.12);
  if (arch) {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 8,
        b = ((i + 1) * Math.PI) / 8;
      const r = width / 2 + 0.13;
      batch.tri(
        point(along, bottom + height, 0.105),
        point(along + (Math.cos(a) * width) / 2, bottom + height + (Math.sin(a) * width) / 2, 0.105),
        point(along + (Math.cos(b) * width) / 2, bottom + height + (Math.sin(b) * width) / 2, 0.105),
        '#253f43',
        S.window,
      );
      batch.quad(
        point(along + Math.cos(a) * r, bottom + height + Math.sin(a) * r, 0.11),
        point(along + Math.cos(b) * r, bottom + height + Math.sin(b) * r, 0.11),
        point(along + Math.cos(b) * (r + 0.13), bottom + height + Math.sin(b) * (r + 0.13), 0.11),
        point(along + Math.cos(a) * (r + 0.13), bottom + height + Math.sin(a) * (r + 0.13), 0.11),
        trim,
        S.trim,
      );
    }
  }
}

export function makeBuilding(batch: Batch, building: Building, detailed: boolean) {
  const b = building,
    trim = b.details.trim ?? (b.residential ? '#d7d3bc' : '#d6cbb0'),
    style = b.details.style ?? '';
  const roofHeight = ['gable', 'hip'].includes(b.roof)
    ? (b.details.roofHeight ?? Math.min(3.8, b.height * 0.27))
    : 0;
  const top = b.ground + b.height - roofHeight,
    base = b.ground - (b.details.foundationDepth ?? 2);
  const rings = [b.ring, ...b.holes];
  for (const ring of rings) {
    const signed = ring.reduce((sum, p, i) => {
      const q = ring[(i + 1) % ring.length];
      return sum + p[0] * q[1] - q[0] * p[1];
    }, 0);
    for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i],
        [bx, bz] = ring[(i + 1) % ring.length],
        length = Math.hypot(bx - ax, bz - az);
      if (length < 0.05) continue;
      const dx = (bx - ax) / length,
        dz = (bz - az) / length,
        normal: Point2 = signed > 0 ? [dz, -dx] : [-dz, dx];
      batch.quad([ax, base, az], [bx, base, bz], [bx, top, bz], [ax, top, az], b.color, S.wall);
      if (!detailed || length < 2.5) continue;
      const yaw = Math.atan2(-dz, dx),
        mx = (ax + bx) / 2 + normal[0] * 0.08,
        mz = (az + bz) / 2 + normal[1] * 0.08;
      if (style === 'courthouse' && normal[0] > 0.8 && Math.abs(mz - (b.details.entrance?.z ?? b.z)) < 20)
        continue;
      if (style === 'theater' && normal[0] > 0.8) continue;
      batch.box(
        mx,
        top - 0.15,
        mz,
        length + 0.15,
        b.residential ? 0.27 : 0.4,
        b.residential ? 0.25 : 0.65,
        trim,
        S.trim,
        yaw,
      );
      if (!b.residential) {
        batch.box(mx, b.ground + 3.05, mz, length, 0.28, 0.28, trim, S.trim, yaw);
        batch.box(mx, top - 0.65, mz, length, 0.1, 0.16, trim, S.trim, yaw);
        if (['cornice', 'bay', 'arched', 'bank', 'pediment'].includes(style)) {
          for (let u = 0.4; u < length - 0.2; u += 0.85)
            batch.box(
              ax + dx * u + normal[0] * 0.19,
              top - 0.51,
              az + dz * u + normal[1] * 0.19,
              0.19,
              0.4,
              0.45,
              trim,
              S.stone,
              yaw,
            );
          for (const u of [0.16, length - 0.16])
            batch.box(
              ax + dx * u + normal[0] * 0.15,
              b.ground + 1.5,
              az + dz * u + normal[1] * 0.15,
              0.32,
              3,
              0.44,
              trim,
              S.stone,
              yaw,
            );
        }
      }
      const bays = Math.max(1, Math.floor(length / (b.details.bayWidth ?? (b.residential ? 3.6 : 3.2))));
      const step = length / bays,
        floors = Math.min(7, b.floors),
        floorHeight = (top - b.ground) / floors;
      for (let k = 0; k < bays; k++)
        for (let floor = 0; floor < floors; floor++) {
          const isShop =
            !b.residential &&
            floor === 0 &&
            !['church', 'library', 'courthouse', 'postoffice', 'school', 'theater'].includes(style);
          const width = isShop ? Math.min(step - 0.6, 3.4) : Math.min(step - 0.9, b.residential ? 1.1 : 1.45);
          if (width < 0.45) continue;
          const height = isShop
            ? 2.25
            : Math.min(floorHeight - 1.25, b.residential ? 1.35 : style === 'postoffice' ? 3.5 : 2.2);
          const bottom = b.ground + floor * floorHeight + (isShop ? 0.35 : 0.85);
          windowOnWall(
            batch,
            ax,
            az,
            dx,
            dz,
            normal,
            (k + 0.5) * step,
            bottom,
            width,
            height,
            trim,
            !b.residential &&
              ((floor > 0 && ['arched', 'church'].includes(style)) ||
                ['library', 'postoffice'].includes(style)),
          );
        }
      if (style === 'pediment' && Math.abs(normal[0]) > 0.6) {
        batch.tri(
          [ax + normal[0] * 0.2, top, az],
          [bx + normal[0] * 0.2, top, bz],
          [mx, top + 1.5, mz],
          b.color,
          S.wall,
        );
      }
      if (style === 'bay' && length > 5 && length < 30) {
        for (let floor = 1; floor < floors; floor++) {
          batch.box(
            mx + normal[0] * 0.4,
            b.ground + floor * floorHeight + 1.65,
            mz + normal[1] * 0.4,
            Math.min(length * 0.55, 4.5),
            2.3,
            1,
            trim,
            S.trim,
            yaw,
          );
          batch.box(
            mx + normal[0] * 0.93,
            b.ground + floor * floorHeight + 1.8,
            mz + normal[1] * 0.93,
            Math.min(length * 0.48, 3.9),
            1.35,
            0.06,
            '#39575b',
            S.window,
            yaw,
          );
        }
      }
    }
  }
  batch.poly(b.ring, b.holes, top, '#53594e', S.roof);
  if (roofHeight > 0 && b.roof === 'hip') {
    const xs = b.ring.map((p) => p[0]),
      zs = b.ring.map((p) => p[1]),
      x0 = Math.min(...xs),
      x1 = Math.max(...xs),
      z0 = Math.min(...zs),
      z1 = Math.max(...zs);
    const all = [...b.ring, ...b.holes.flat()],
      faces = THREE.ShapeUtils.triangulateShape(
        b.ring.map((p) => new THREE.Vector2(...p)),
        b.holes.map((h) => h.map((p) => new THREE.Vector2(...p))),
      );
    const lift = (p: Point2): Point3 => [
      p[0],
      top + roofHeight * Math.min(1, Math.max(0, Math.min(p[0] - x0, x1 - p[0], p[1] - z0, z1 - p[1])) / 3),
      p[1],
    ];
    const roofTri = (a: Point2, c: Point2, d: Point2, depth: number) => {
      if (depth > 0) {
        const ac: Point2 = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2],
          cd: Point2 = [(c[0] + d[0]) / 2, (c[1] + d[1]) / 2],
          da: Point2 = [(d[0] + a[0]) / 2, (d[1] + a[1]) / 2];
        roofTri(a, ac, da, depth - 1);
        roofTri(ac, c, cd, depth - 1);
        roofTri(da, cd, d, depth - 1);
        roofTri(ac, cd, da, depth - 1);
      } else batch.tri(lift(a), lift(d), lift(c), '#646b60', S.roof);
    };
    for (const [a, c, d] of faces) roofTri(all[a], all[c], all[d], 3);
    for (const ring of rings)
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          c = ring[(i + 1) % ring.length];
        batch.quad([a[0], top, a[1]], [c[0], top, c[1]], lift(c), lift(a), b.color, S.wall);
      }
  }
  if (roofHeight > 0 && b.roof === 'gable') {
    const xs = b.ring.map((p) => p[0]),
      zs = b.ring.map((p) => p[1]);
    const x0 = Math.min(...xs),
      x1 = Math.max(...xs),
      z0 = Math.min(...zs),
      z1 = Math.max(...zs),
      xc = (x0 + x1) / 2,
      zc = (z0 + z1) / 2;
    const axis = x1 - x0 > z1 - z0 ? 1 : 0,
      center = axis === 1 ? zc : xc,
      half = (axis === 1 ? z1 - z0 : x1 - x0) / 2;
    const lift = (p: Point2): Point3 => [
      p[0],
      top + roofHeight * Math.max(0, 1 - Math.abs(p[axis] - center) / half),
      p[1],
    ];
    // Split the triangulated footprint at the ridge. Courtyards and concavities stay open.
    const all = [...b.ring, ...b.holes.flat()];
    const faces = THREE.ShapeUtils.triangulateShape(
      b.ring.map((p) => new THREE.Vector2(...p)),
      b.holes.map((h) => h.map((p) => new THREE.Vector2(...p))),
    );
    for (const face of faces)
      for (const sign of [-1, 1]) {
        const input = face.map((i) => all[i]),
          output: Point2[] = [];
        for (let i = 0; i < input.length; i++) {
          const a = input[i],
            c = input[(i + 1) % input.length],
            insideA = (a[axis] - center) * sign >= 0,
            insideC = (c[axis] - center) * sign >= 0;
          if (insideA) output.push(a);
          if (insideA !== insideC) {
            const t = (center - a[axis]) / (c[axis] - a[axis]);
            output.push([a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t]);
          }
        }
        for (let i = 1; i < output.length - 1; i++)
          batch.tri(
            lift(output[0]),
            lift(output[i + 1]),
            lift(output[i]),
            sign < 0 ? '#555c55' : '#494e49',
            S.roof,
          );
      }
    for (const ring of rings)
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          c = ring[(i + 1) % ring.length],
          segments = [a];
        if ((a[axis] - center) * (c[axis] - center) < 0) {
          const t = (center - a[axis]) / (c[axis] - a[axis]);
          segments.push([a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t]);
        }
        segments.push(c);
        for (let k = 0; k < segments.length - 1; k++) {
          const p = segments[k],
            q = segments[k + 1];
          batch.quad([p[0], top, p[1]], [q[0], top, q[1]], lift(q), lift(p), b.color, S.wall);
        }
      }
  }
  const tower = b.details.tower;
  if (tower) {
    batch.box(
      tower.x,
      b.ground + tower.height / 2,
      tower.z,
      tower.width,
      tower.height,
      tower.width,
      b.color,
      S.wall,
    );
    batch.box(
      tower.x,
      b.ground + tower.height - 0.7,
      tower.z,
      tower.width + 0.35,
      0.35,
      tower.width + 0.35,
      trim,
      S.trim,
    );
    batch.cone(
      tower.x,
      b.ground + tower.height,
      tower.z,
      tower.width * 0.75,
      tower.spire ?? 6,
      '#7d8a82',
      S.roof,
      4,
    );
    if ((tower.spire ?? 6) > 0)
      for (let side = 0; side < 4; side++)
        for (const offset of [-1, 1]) {
          const yaw = (side * Math.PI) / 2,
            nx = Math.sin(yaw),
            nz = Math.cos(yaw),
            px = Math.cos(yaw),
            pz = -Math.sin(yaw);
          batch.box(
            tower.x + nx * (tower.width / 2 + 0.07) + px * offset * tower.width * 0.22,
            b.ground + tower.height - 2.2,
            tower.z + nz * (tower.width / 2 + 0.07) + pz * offset * tower.width * 0.22,
            0.75,
            1.8,
            0.1,
            '#233f41',
            S.window,
            yaw,
          );
        }
  }
  if (detailed && style === 'courthouse') makeCourthouseFront(batch, b, top, trim);
  if (detailed && style === 'library') {
    const facing = b.details.facing ?? -Math.PI / 2,
      dx = Math.sin(facing),
      dz = Math.cos(facing);
    const reach = Math.max(...b.ring.map((p) => (p[0] - b.x) * dx + (p[1] - b.z) * dz)) + 0.25;
    const x = b.details.entrance?.x ?? b.x + dx * reach,
      z = b.details.entrance?.z ?? b.z + dz * reach,
      width = 8;
    const px = Math.cos(facing),
      pz = -Math.sin(facing);
    batch.tri(
      [x - (px * width) / 2, top, z - (pz * width) / 2],
      [x + (px * width) / 2, top, z + (pz * width) / 2],
      [x, top + 2, z],
      trim,
      S.trim,
    );
    batch.box(x, top - 0.5, z, width, 0.9, 0.5, trim, S.trim, facing);
    for (const sign of [-1, 1])
      batch.cylinder(
        x + px * sign * (width / 2 - 0.4),
        b.ground,
        z + pz * sign * (width / 2 - 0.4),
        0.3,
        top - b.ground - 0.9,
        trim,
        S.trim,
      );
  }
  if (detailed && style === 'postoffice') {
    const x = Math.max(...b.ring.map((p) => p[0])) + 0.2;
    for (const side of [-1, 1]) batch.box(x, b.ground + 3, b.z + side * 6.8, 0.3, 5.6, 0.5, trim, S.trim);
    batch.box(x, b.ground + 2, b.z, 0.3, 3.9, 1.9, trim, S.trim);
    batch.box(x + 0.18, b.ground + 1.9, b.z, 0.05, 3.4, 1.4, '#253f43', S.window);
    batch.box(x + 2.4, b.ground + 4, b.z - 4, 0.1, 8, 0.1, '#aeb5a7', S.metal);
    for (let i = 0; i < 7; i++)
      batch.box(
        x + 2.4,
        b.ground + 7.8 - i * 0.15,
        b.z - 3.2,
        0.04,
        0.15,
        1.6,
        i % 2 ? '#d4cfc0' : '#aa6857',
        S.trim,
      );
  }
  if (detailed && style === 'bank') {
    const x = Math.max(...b.ring.map((p) => p[0])) + 0.28;
    for (const side of [-1, 1])
      batch.cylinder(x, b.ground, b.z + side * 3.2, 0.35, b.height * 0.64, '#d4d4c4', S.trim);
    batch.box(x, b.ground + b.height * 0.64, b.z, 0.7, 0.65, 8, '#d4d4c4', S.trim);
  }
  if (detailed && style === 'plaza') {
    const front = Math.max(...b.ring.map((p) => p[0])) + 0.1,
      z0 = Math.min(...b.ring.map((p) => p[1])),
      z1 = Math.max(...b.ring.map((p) => p[1]));
    const length = z1 - z0;
    batch.box(front + 1.5, b.ground + 3.65, (z0 + z1) / 2, 3.4, 0.42, length + 0.3, trim, S.stone);
    batch.box(front + 0.2, b.ground + 4.25, (z0 + z1) / 2, 0.45, 0.85, length, trim, S.stone);
    for (let z = z0 + 1; z < z1; z += 7) {
      batch.box(front + 2.7, b.ground + 1.82, z, 0.24, 3.64, 0.24, trim, S.stone);
      batch.box(front + 0.32, b.ground + 1.7, z + 2.1, 0.07, 2.8, 2.8, '#273b3c', S.window);
    }
  }
}

function makeCourthouseFront(batch: Batch, b: Building, top: number, trim: string) {
  const facing = b.details.facing ?? Math.PI / 2,
    nx = Math.sin(facing),
    nz = Math.cos(facing),
    tx = Math.cos(facing),
    tz = -Math.sin(facing);
  const x = b.details.entrance?.x ?? b.x,
    z = b.details.entrance?.z ?? b.z,
    g = b.ground;
  const p = (u: number, y: number, depth: number): Point3 => [
    x + tx * u + nx * depth,
    g + y,
    z + tz * u + nz * depth,
  ];
  const box = (
    u: number,
    y: number,
    d: number,
    w: number,
    h: number,
    depth: number,
    color = trim,
    surface: number = S.stone,
  ) => batch.box(...p(u, y, d), w, h, depth, color, surface, facing);
  // Nine bays across the historic front, with three behind the four-column portico.
  const width = 31.5,
    cornice = top - g;
  box(0, cornice / 2, -0.12, width, cornice, 0.24, b.color, S.wall);
  for (let bay = -4; bay <= 4; bay++)
    for (let floor = 0; floor < 2; floor++) {
      if (bay === 0 && floor === 0) continue;
      windowOnWall(
        batch,
        x,
        z,
        tx,
        tz,
        [nx, nz],
        bay * 3.38,
        g + (floor ? 5.25 : 1.1),
        1.45,
        floor ? 2.4 : 2.75,
        trim,
        floor === 1,
      );
      box(bay * 3.38, floor ? 8.58 : 4.08, 0.18, 0.25, 0.3, 0.16, trim, S.stone);
    }
  for (const side of [-1, 1])
    for (let y = 0.5; y < cornice - 0.5; y += 0.7)
      box(side * (width / 2 - 0.22), y, 0.08, 0.56, 0.48, 0.3, trim, S.stone);
  box(0, 0.45, 0.28, width, 0.28, 0.6);
  box(0, cornice - 0.18, 0.2, width + 0.6, 0.36, 0.7);
  box(0, cornice - 0.63, 0.13, width, 0.18, 0.4);
  const porticoWidth = 12.9,
    depth = 4.6,
    beam = cornice - 0.45;
  // A projecting roof and freestanding columns expose real depth and shadow gaps.
  for (let i = 0; i < 5; i++)
    box(
      0,
      0.12 + i * 0.14,
      depth / 2 + 0.65 - i * 0.15,
      porticoWidth + 1.2 - i * 0.17,
      0.24 + i * 0.28,
      depth + 2.1 - i * 0.3,
    );
  for (const u of [-5.4, -1.8, 1.8, 5.4]) {
    box(u, 0.9, depth, 1.48, 0.28, 1.48);
    batch.cylinder(...p(u, 1.04, depth), 0.69, 0.25, trim, S.stone, 24);
    batch.tube(p(u, 1.29, depth), p(u, beam - 0.4, depth), 0.59, 0.5, trim, S.stone, 24);
    batch.cylinder(...p(u, beam - 0.4, depth), 0.67, 0.18, trim, S.stone, 24);
    box(u, beam - 0.15, depth, 1.46, 0.28, 1.46);
  }
  box(0, beam + 0.35, depth / 2, porticoWidth, 0.75, depth + 1.2);
  box(0, beam + 0.81, depth / 2, porticoWidth + 0.5, 0.18, depth + 1.5);
  const roofY = beam + 0.9,
    roofH = 2.4;
  for (const d of [depth + 0.76, -0.5])
    batch.tri(
      p(-porticoWidth / 2 - 0.25, roofY, d),
      p(porticoWidth / 2 + 0.25, roofY, d),
      p(0, roofY + roofH, d),
      trim,
      S.stone,
    );
  batch.quad(
    p(-porticoWidth / 2 - 0.25, roofY, -0.5),
    p(0, roofY + roofH, -0.5),
    p(0, roofY + roofH, depth + 0.76),
    p(-porticoWidth / 2 - 0.25, roofY, depth + 0.76),
    '#60625d',
    S.roof,
  );
  batch.quad(
    p(0, roofY + roofH, -0.5),
    p(porticoWidth / 2 + 0.25, roofY, -0.5),
    p(porticoWidth / 2 + 0.25, roofY, depth + 0.76),
    p(0, roofY + roofH, depth + 0.76),
    '#60625d',
    S.roof,
  );
  // Distinct semicircular fanlight in the triangular pediment.
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 16,
      c = ((i + 1) * Math.PI) / 16;
    batch.tri(
      p(0, roofY + 0.45, depth + 0.78),
      p(Math.cos(a) * 0.82, roofY + 0.45 + Math.sin(a) * 0.82, depth + 0.78),
      p(Math.cos(c) * 0.82, roofY + 0.45 + Math.sin(c) * 0.82, depth + 0.78),
      '#233236',
      S.window,
    );
  }
  for (let u = -6.2; u < 6.3; u += 0.48) box(u, beam + 0.75, depth + 0.67, 0.17, 0.22, 0.23, trim, S.trim);
  box(0, 2.23, 0.25, 2.35, 3.8, 0.4);
  box(0, 2.08, 0.48, 1.88, 3.35, 0.05, '#24373b', S.window);
  box(0, 2.08, 0.52, 0.08, 3.35, 0.08);
  box(0, 4.36, 0.31, 4.8, 0.65, 0.3);
  // Paired dormers break the long hip roof without changing the sourced outline.
  for (const u of [-11.3, 11.3]) {
    box(u, cornice + 0.72, -2, 2.1, 1.45, 1.4);
    box(u, cornice + 0.73, -1.25, 1.1, 1.04, 0.05, '#25373b', S.window);
    batch.tri(
      p(u - 1.25, cornice + 1.45, -1.2),
      p(u + 1.25, cornice + 1.45, -1.2),
      p(u, cornice + 2.25, -1.2),
      trim,
      S.stone,
    );
  }
}

export function makeTree(batch: Batch, x: number, y: number, z: number, scale: number, seed: number) {
  const random = seeded(seed),
    color = ['#678757', '#709460', '#52734f', '#819761'][seed % 4];
  batch.box(x, y + scale * 0.33, z, scale * 0.075, scale * 0.65, scale * 0.075, '#6c6550', S.wall);
  for (let i = 0; i < 3; i++) {
    const cx = x + (random() - 0.5) * scale * 0.35,
      cz = z + (random() - 0.5) * scale * 0.35,
      cy = y + scale * (0.42 + i * 0.15),
      radius = scale * (0.39 - i * 0.055);
    batch.cone(cx, cy, cz, radius, scale * 0.38, color, S.leaf, 7);
    batch.cone(cx, cy, cz, radius, -scale * 0.2, color, S.leaf, 7);
  }
}

export function terrainBatch(
  data: WorldData,
  x0: number,
  z0: number,
  size: number,
  step: number,
  detailed: boolean,
) {
  const batch = new Batch(),
    count = Math.ceil(size / step),
    delta = size / count;
  for (let iz = 0; iz < count; iz++)
    for (let ix = 0; ix < count; ix++) {
      const x = x0 + ix * delta,
        z = z0 + iz * delta;
      const y = (x: number, z: number) => (detailed ? data.ground(x, z) : data.terrain(x, z) - 0.12);
      const color = Math.abs(data.terrain(x, z)) > 45 ? '#5b7351' : '#7c885f';
      batch.quad(
        [x, y(x, z), z],
        [x, y(x, z + delta), z + delta],
        [x + delta, y(x + delta, z + delta), z + delta],
        [x + delta, y(x + delta, z), z],
        color,
        S.ground,
      );
    }
  // Skirts close the small height differences where near terrain meets context LOD.
  if (detailed)
    for (let i = 0; i < count; i++)
      for (const side of [0, 1, 2, 3]) {
        const a: Point2 =
          side < 2 ? [x0 + i * delta, z0 + side * size] : [x0 + (side - 2) * size, z0 + i * delta];
        const b: Point2 = side < 2 ? [a[0] + delta, a[1]] : [a[0], a[1] + delta];
        const ya = data.ground(...a),
          yb = data.ground(...b);
        batch.quad(
          [a[0], ya, a[1]],
          [b[0], yb, b[1]],
          [b[0], yb - 6, b[1]],
          [a[0], ya - 6, a[1]],
          '#6e8058',
          S.ground,
        );
      }
  return batch;
}

export function makeRoadSegment(
  batch: Batch,
  a: Point3,
  b: Point3,
  width: number,
  type: string,
  bridge: boolean,
  marked: boolean,
) {
  const dx = b[0] - a[0],
    dz = b[2] - a[2],
    length = Math.hypot(dx, dz);
  if (length < 0.01) return;
  const nx = dz / length,
    nz = -dx / length,
    path = width < 3;
  const ribbon = (half: number, lift: number, color: string, surface: number, offset = 0) => {
    batch.quad(
      [a[0] + nx * (half + offset), a[1] + lift, a[2] + nz * (half + offset)],
      [b[0] + nx * (half + offset), b[1] + lift, b[2] + nz * (half + offset)],
      [b[0] + nx * (-half + offset), b[1] + lift, b[2] + nz * (-half + offset)],
      [a[0] + nx * (-half + offset), a[1] + lift, a[2] + nz * (-half + offset)],
      color,
      surface,
    );
  };
  if (type === 'water') {
    ribbon(width / 2, 0.1, '#4e8283', S.water);
    return;
  }
  if (!path && type !== 'service' && type !== 'track') ribbon(width / 2 + 2.5, 0.18, '#aaac98', S.ground);
  ribbon(width / 2 + 0.15, 0.22, path ? '#aca996' : '#575e59', path ? S.ground : S.road);
  if (marked && width >= 8) {
    ribbon(0.065, 0.24, '#dec28b', S.paint, -0.13);
    ribbon(0.065, 0.24, '#dec28b', S.paint, 0.13);
    for (const sign of [-1, 1]) ribbon(0.08, 0.24, '#c9c9b5', S.paint, sign * (width / 2 - 1.9));
  }
  if (bridge)
    for (const sign of [-1, 1])
      batch.box(
        (a[0] + b[0]) / 2 + (nx * sign * width) / 2,
        (a[1] + b[1]) / 2 + 0.8,
        (a[2] + b[2]) / 2 + (nz * sign * width) / 2,
        0.18,
        1.2,
        length,
        '#939d92',
        S.metal,
        Math.atan2(dx, dz),
      );
}

export function vegetationForChunk(batch: Batch, data: WorldData, x0: number, z0: number, size: number) {
  const random = seeded(hash(`${x0}:${z0}`));
  const nearbyBuildings = data.features.buildings.filter(
    (b) => Math.abs(b.x - (x0 + size / 2)) < size && Math.abs(b.z - (z0 + size / 2)) < size,
  );
  const areas = data.features.areas.filter((a) => a.type !== 'water');
  for (let i = 0; i < 90; i++) {
    const x = x0 + random() * size,
      z = z0 + random() * size;
    const forest = areas.some((a) => a.type === 'forest' && pointInRing(x, z, a.ring));
    if (!forest && (i > 12 || (Math.hypot(x, z) < 170 && data.manifest.id === 'warsaw'))) continue;
    const road = data.nearbyRoad(x, z);
    if (road && road.distance < road.road.width / 2 + 4) continue;
    if (nearbyBuildings.some((b) => Math.hypot(b.x - x, b.z - z) < 50 && pointInRing(x, z, b.ring))) continue;
    if (data.features.areas.some((a) => ['water', 'parking'].includes(a.type) && pointInRing(x, z, a.ring)))
      continue;
    if ((data.features.facilities ?? []).some((f) => pointInRing(x, z, f.ring))) continue;
    if (data.detailExclusions.some((ring) => pointInRing(x, z, ring))) continue;
    makeTree(batch, x, data.ground(x, z), z, 6 + random() * 6, i + hash(`${x0}:${z0}`));
  }
}
