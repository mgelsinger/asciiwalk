import { PlaceSite, facade, vehicle } from './place-kit';
import { Batch } from './geometry';
import { PALE, STEEL } from './park-models';
import { SURFACE as S } from '../renderer/material';
import type { Point2, Point3 } from './types';

export function school(site: PlaceSite, elementary = false) {
  const building = site.data.features.buildings.find((b) => b.id === (elementary ? '478975613' : '7120249'))!;
  const x = elementary ? -394 : -338,
    z = elementary ? -15.6 : -391.1,
    y = building.ground;
  const f = facade(site, x, y, z, 0);
  // The central entrance and tall gridded stair window distinguish the high school.
  f.box(0, 2.6, 0.05, 8, 5.2, 0.32, elementary ? '#b29778' : '#b8ac88');
  for (const u of [-2.55, -0.85, 0.85, 2.55]) {
    f.window(u, 1.45, 1.45, 2.5, 0.27);
    f.window(u, 4, 1.45, 1.3, 0.27);
    f.box(u + 0.38, 1.35, 0.42, 0.055, 0.55, 0.08, PALE, S.metal);
  }
  f.box(0, 3, 0.8, 8.7, 0.22, 2.3, STEEL, S.metal);
  if (!elementary) {
    f.box(-8, 5, -1.1, 4.1, 10, 3, '#c3b58f');
    for (const h of [2, 5, 8]) f.window(-8, h, 2.65, 2.1, 0.44);
    f.box(8, 3.2, 0.1, 8.7, 6.4, 0.55, '#b8ac88');
    f.sign('WARSAW CENTRAL', 8, 4.6, 0.41, 7.8);
    f.sign('MIDDLE / HIGH SCHOOL', 8, 3.75, 0.41, 7.8);
    f.box(-8, 10.15, -1, 4.5, 0.25, 3.6, PALE, S.trim);
  } else {
    f.sign('WARSAW ELEMENTARY', 0, 5.25, 0.27, 14);
    for (const u of [-12, -8, 8, 12]) f.window(u, 2, 2.1, 2.6, 0.5);
  }
  site.paving(x - 5, z + 0.5, x + 5, z + 10);
  site.inventory.add('glazed school entrance');
  site.board(
    elementary ? -419 : -306,
    elementary ? 1 : -360,
    0,
    elementary ? 'WARSAW ELEMENTARY' : 'WARSAW CENTRAL',
    elementary ? 'HOME OF THE TIGER CUBS' : 'HOME OF THE TIGERS',
    elementary
      ? 'Warsaw Elementary School, 153 West Buffalo Street. Explore the playground behind the west wing.'
      : 'Warsaw Middle/High School, 81 West Court Street. The football field and sports grounds are behind the school.',
    5.5,
  );
  site.flag(elementary ? -426 : -289, elementary ? -7 : -374, 9);
  site.bikeRack(elementary ? -382 : -353, elementary ? -8 : -383, 0, 3);
  site.seat(x + 9, z + 5);
  site.seat(x - 10, z + 5);
  site.planter(x - 5, z + 4);
  site.planter(x + 5, z + 4);
  site.lamp(x - 6, z + 9);
  site.lamp(x + 6, z + 9);
  const busX = elementary ? -371 : -336,
    busZ = elementary ? -52 : -365;
  site.place(vehicle(true), busX, busZ, Math.PI / 2);
  site.obstacle([busX - 3.5, busZ], [busX + 3.5, busZ], 1.25);
  site.sign('SCHOOL BUS', busX + 4.59, site.ground(busX, busZ) + 2.44, busZ, 1.7, Math.PI / 2);
  site.inventory.add('school bus');
  for (let i = 0; i < 3; i++)
    site.visitor(
      [
        [x - 2 + i * 1.3, z + 5],
        [x - 2 + i * 1.3, z + 9],
      ],
      { scale: elementary ? 0.68 : 0.88, backpack: true, color: i % 2 ? '#b3bea1' : '#9bafc2' },
    );
  if (elementary) {
    // Chalk squares are ground geometry and remain visible without color.
    for (let i = 0; i < 8; i++) {
      const xx = -407 + (i % 2) * 0.9,
        zz = -1 - Math.floor(i / 2) * 0.95,
        yy = site.ground(xx, zz) + 0.08;
      for (const dx of [-0.4, 0.4]) site.b.box(xx + dx, yy, zz, 0.05, 0.02, 0.8, PALE, S.paint);
      for (const dz of [-0.4, 0.4]) site.b.box(xx, yy, zz + dz, 0.8, 0.02, 0.05, PALE, S.paint);
    }
    site.inventory.add('hopscotch');
    site.board(-459, -114, Math.PI / 2, 'PLAYGROUND', 'TIGER CUBS AT PLAY', undefined, 3);
  }
  return site;
}

export function stadium(site: PlaceSite) {
  // The pitch uses the mapped football/soccer footprint. Surrounding track and fittings are inferred.
  const ring: Point2[] = [
    [-382, -535],
    [-292, -535],
    [-292, -686],
    [-382, -686],
  ];
  site.data.detailExclusions.push(ring);
  const height = site.data.features.areas.find((a) => a.id === '137054491')!.height;
  site.data.facilityBounds.push({ facility: { ring, height }, bounds: [-384, -290, -688, -533] });
  site.paving(-363, -663, -312, -555, '#6c8762', S.court);
  const paint = (a: Point2, c: Point2, width = 0.16, color = PALE, surface: number = S.paint) => {
    const length = Math.hypot(c[0] - a[0], c[1] - a[1]),
      n = Math.ceil(length / 2),
      dx = (((c[1] - a[1]) / length) * width) / 2,
      dz = ((-(c[0] - a[0]) / length) * width) / 2;
    const p = (t: number, side: number): Point3 => {
      const x = a[0] + (c[0] - a[0]) * t + dx * side,
        z = a[1] + (c[1] - a[1]) * t + dz * side;
      return [x, site.ground(x, z) + (surface === S.road ? 0.05 : 0.095), z];
    };
    for (let i = 0; i < n; i++)
      site.b.quad(p(i / n, -1), p((i + 1) / n, -1), p((i + 1) / n, 1), p(i / n, 1), color, surface);
  };
  for (const x of [-361, -314]) paint([x, -661], [x, -557], 0.24);
  for (let z = -661; z <= -557; z += 10.4) {
    paint([-361, z], [-314, z], 0.19);
    for (const x of [-348, -327])
      for (let j = 1; j < 5; j++) paint([x - 0.45, z + j * 2.08], [x + 0.45, z + j * 2.08], 0.14);
  }
  // Four clearly separated oval track lanes wrap the field.
  for (const x of [-369, -306]) paint([x, -637], [x, -581], 5.8, '#987c66', S.road);
  for (const [cz, offset] of [
    [-637, Math.PI],
    [-581, 0],
  ])
    for (let k = 0; k < 60; k++) {
      const a = offset + (k * Math.PI) / 60,
        c = offset + ((k + 1) * Math.PI) / 60;
      paint(
        [-337.5 + Math.cos(a) * 31.5, cz + Math.sin(a) * 31.5],
        [-337.5 + Math.cos(c) * 31.5, cz + Math.sin(c) * 31.5],
        5.8,
        '#987c66',
        S.road,
      );
    }
  for (let lane = 0; lane < 5; lane++) {
    const r = 29 + lane * 1.25;
    for (const x of [-337.5 - r, -337.5 + r]) paint([x, -637], [x, -581], 0.12);
    for (const [cz, offset] of [
      [-637, Math.PI],
      [-581, 0],
    ])
      for (let k = 0; k < 40; k++) {
        const a = offset + (k * Math.PI) / 40,
          c = offset + ((k + 1) * Math.PI) / 40;
        paint(
          [-337.5 + Math.cos(a) * r, cz + Math.sin(a) * r],
          [-337.5 + Math.cos(c) * r, cz + Math.sin(c) * r],
          0.2,
        );
      }
  }
  for (const z of [-665, -553]) {
    const x = -337.5,
      y = site.ground(x, z);
    site.b.tube([x, y, z], [x, y + 3, z], 0.14, 0.12, PALE, S.metal, 10);
    site.b.tube([x - 2.8, y + 3, z], [x + 2.8, y + 3, z], 0.1, 0.1, PALE, S.metal, 8);
    for (const side of [-1, 1])
      site.b.tube([x + side * 2.8, y + 3, z], [x + side * 2.8, y + 8, z], 0.09, 0.07, PALE, S.metal, 8);
    site.obstacle([x, z], undefined, 0.17);
    // Soccer goal, with an open mouth and netted back.
    const b = new Batch();
    for (const side of [-1, 1])
      b.tube([side * 3.6, 0, 0], [side * 3.6, 2.4, 0], 0.065, 0.065, PALE, S.metal, 8);
    b.tube([-3.6, 2.4, 0], [3.6, 2.4, 0], 0.065, 0.065, PALE, S.metal, 8);
    b.quad([-3.6, 0, -1.4], [3.6, 0, -1.4], [3.6, 2.4, -1.4], [-3.6, 2.4, -1.4], STEEL, S.mesh);
    b.quad([-3.6, 2.4, 0], [3.6, 2.4, 0], [3.6, 2.4, -1.4], [-3.6, 2.4, -1.4], STEEL, S.mesh);
    const facing = z < -600 ? 0 : Math.PI;
    const gz = z + (z < -600 ? 6 : -6),
      back = gz + (z < -600 ? -1.4 : 1.4);
    site.place(b, x, gz, facing);
    for (const dx of [-3.6, 3.6]) site.obstacle([x + dx, gz], undefined, 0.07);
    site.obstacle([x - 3.6, back], [x + 3.6, back], 0.05);
  }
  for (const side of [-1, 1]) {
    const x = side < 0 ? -379 : -294,
      z = -610,
      y = site.ground(x, z);
    for (let row = 0; row < 4; row++) {
      const xx = x + side * row * 0.85;
      site.b.box(xx, y + 0.5 + row * 0.48, z, 0.75, 0.12, 22, STEEL, S.metal);
      for (const dz of [-9, 0, 9])
        site.b.box(xx, y + (0.5 + row * 0.48) / 2, z + dz, 0.09, 0.5 + row * 0.48, 0.09, STEEL, S.metal);
      site.obstacle([xx, z - 11], [xx, z + 11], 0.4);
    }
    site.lamp(x + side * 5, z - 25, 11);
    site.lamp(x + side * 5, z + 25, 11);
  }
  site.board(-335, -680, 0, 'WARSAW TIGERS', 'HOME  00     GUEST  00', undefined, 10);
  site.board(
    -292,
    -563,
    Math.PI / 2,
    'ATHLETIC FIELD',
    'FOOTBALL / SOCCER / TRACK',
    'The mapped school football and soccer fields share this space. The track and stadium furnishings are interpreted from district project descriptions.',
    4.8,
  );
  site.flag(-302, -546, 10);
  for (let i = 0; i < 3; i++)
    site.visitor(
      [
        [-335 + i * 4, -590],
        [-335 + i * 4, -623],
      ],
      { scale: 0.9 },
    );
  site.inventory.add('football field');
  site.inventory.add('soccer goals');
  site.inventory.add('track lanes');
  site.inventory.add('bleachers');
  site.inventory.add('scoreboard');
  return site;
}
