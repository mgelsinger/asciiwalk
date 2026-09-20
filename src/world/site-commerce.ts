import { PlaceSite, facade, vehicle } from './place-kit';
import { Batch } from './geometry';
import { PALE, STEEL, sphere } from './park-models';
import { SURFACE as S } from '../renderer/material';

export function theater(site: PlaceSite) {
  const building = site.data.features.buildings.find((b) => b.id === '477962348')!;
  const y = building.ground,
    f = facade(site, -13.25, y, 44, Math.PI / 2);
  // Stone front, upper windows, projecting marquee and three fins follow the theater's own photo.
  f.box(0, 5, -0.15, 20, 10, 0.25, '#939e96', S.stone);
  f.box(0, 10, 0.02, 20.5, 0.24, 0.48, PALE, S.trim);
  for (const u of [-7.1, -3.5, 0.1, 3.7, 7.3]) f.window(u, 7.3, 1.65, 2.15, 0.06);
  for (const u of [6.3, 7.7, 9.1]) f.box(u, 5.4, 0.4, 0.43, 8.8, 0.75, PALE, S.trim);
  for (const u of [-2.7, -0.9, 0.9, 2.7]) {
    f.window(u, 1.45, 1.5, 2.55, 0.12);
    f.box(u + 0.45, 1.3, 0.28, 0.06, 0.55, 0.1, PALE, S.metal);
  }
  f.box(-6, 1.65, 0.2, 2.4, 2.7, 0.32, '#bcc2b3', S.trim);
  f.window(-6, 1.8, 1.85, 1.35, 0.4);
  f.sign('TICKETS', -6, 2.75, 0.42, 2.1);
  f.box(0, 4.25, 1.6, 13.6, 1.9, 3.6, '#dfd8ba', S.trim);
  f.box(0, 4.25, 3.43, 13.1, 1.25, 0.06, '#354447', S.window);
  f.box(0, 5.25, 1.65, 14, 0.18, 3.9, PALE, S.metal);
  f.box(0, 3.25, 1.65, 14, 0.18, 3.9, PALE, S.metal);
  f.box(-1, 6.25, 0.28, 10.5, 0.75, 0.25, '#536963', S.window);
  f.sign('SPOTLIGHT', -1, 6.3, 0.52, 8.5);
  const marquee = f.sign('ASCII MATINEE', 0, 4.46, 3.5, 11.8);
  f.sign('A LITTLE MOVIE MAGIC', 0, 3.94, 3.5, 11.8);
  const lamps = new Batch();
  for (let u = -6.4; u <= 6.4; u += 0.46)
    for (const h of [3.37, 5.09]) sphere(lamps, ...f.point(u, h, 3.54), 0.095, '#fcf0c7', S.paint);
  site.group.add(lamps.mesh(site.material));
  // A small moving highlight suggests chasing marquee bulbs without flashing the whole sign.
  const glow = new Batch();
  sphere(glow, 0, 0, 0, 0.13, PALE, S.paint);
  for (let i = 0; i < 4; i++) {
    const mesh = glow.mesh(site.material);
    site.group.add(mesh);
    site.animations.push((t) =>
      mesh.position.set(...f.point(-6.3 + ((t * 0.8 + i * 3.2) % 12.6), i % 2 ? 3.37 : 5.09, 3.62)),
    );
  }
  for (const [u, title] of [
    [-8.4, 'VALLEY'],
    [4.7, 'LETTERS'],
  ] as const) {
    f.box(u, 1.7, 0.23, 1.35, 2.4, 0.16, PALE, S.trim);
    f.box(u, 1.7, 0.33, 1.12, 2.17, 0.05, '#536b6a', S.window);
    f.sign(title, u, 2.35, 0.37, 1.06);
    f.sign('* * *', u, 1.55, 0.37, 1);
  }
  const programs = ['ASCII MATINEE', 'WALK THE VALLEY', 'A WORLD OF LETTERS'];
  let program = 0;
  site.action(
    'Change the marquee',
    -9.5,
    44,
    () => {
      program = (program + 1) % programs.length;
      marquee.text = programs[program];
      return `Now on the marquee: ${programs[program]}.`;
    },
    true,
  );
  site.visitor(
    [
      [-11, 50],
      [-11, 47],
    ],
    { bag: true },
  );
  site.visitor([[-10.8, 38]], { yaw: Math.PI / 2 });
  site.inventory.add('stone cinema facade');
  site.inventory.add('illuminated marquee');
  site.inventory.add('ticket window');
  site.inventory.add('movie posters');
  return site;
}

function cart() {
  const b = new Batch();
  for (const x of [-0.32, 0.32]) {
    b.tube([x, 0.16, -0.46], [x, 0.88, -0.3], 0.028, 0.028, STEEL, S.metal, 6);
    b.tube([x, 0.18, -0.4], [x, 0.18, 0.46], 0.028, 0.028, STEEL, S.metal, 6);
    b.quad([x, 0.58, -0.32], [x, 0.58, 0.4], [x, 0.96, 0.4], [x, 0.96, -0.32], STEEL, S.mesh);
    for (const z of [-0.38, 0.4]) sphere(b, x, 0.12, z, 0.09, '#4e5954', S.metal);
  }
  b.quad([-0.32, 0.58, 0.4], [0.32, 0.58, 0.4], [0.32, 0.96, 0.4], [-0.32, 0.96, 0.4], STEEL, S.mesh);
  b.tube([-0.36, 1, -0.42], [0.36, 1, -0.42], 0.045, 0.045, PALE, S.metal, 6);
  return b;
}
export function shopping(site: PlaceSite) {
  for (const z of [-2211, -2227, -2243, -2259, -2132, -2148, -2164]) {
    const y = site.ground(-26, z),
      f = facade(site, -26, y, z, Math.PI / 2);
    f.window(0, 1.45, 2.1, 2.6, 0.13);
    for (const u of [-4, 4]) {
      f.window(u, 1.65, 4, 2.6, 0.15);
      for (let row = 0; row < 3; row++)
        for (let j = 0; j < 4; j++)
          f.box(
            u - 1.4 + j * 0.9,
            0.7 + row * 0.62,
            0.27,
            0.55,
            0.36,
            0.035,
            row % 2 ? '#a3b6ac' : '#c2ad85',
            S.metal,
          );
    }
    f.box(0, 3.7, 0.38, 12, 1, 0.26, '#899d90', S.metal);
    f.sign('SHOPS', 0, 3.75, 0.54, 7);
    f.sign('OPEN', 0, 2.15, 0.3, 1.5);
  }
  site.board(
    27,
    -2197,
    Math.PI / 2,
    'WARSAW SHOPPING CENTER',
    '461 NORTH MAIN STREET',
    'Explore the three mapped retail buildings. Store displays and shoppers are imagined; current tenant names are not represented.',
    8,
  );
  for (const z of [-2130, -2162, -2208]) {
    site.seat(-21, z, Math.PI / 2);
    site.planter(-21, z + 4);
  }
  for (const [x, z] of [
    [1, -2142],
    [24, -2170],
    [4, -2210],
  ])
    site.lamp(x, z, 8);
  const colors = ['#a5aaa0', '#c1bdb0', '#688a9e', '#b59782', '#85897a'];
  for (let row = 0; row < 3; row++)
    for (let i = 0; i < 13; i++) {
      if ((i + row * 2) % 4 === 0) continue;
      const x = -11.7 + row * 17,
        z = -2129 - i * 6.2;
      if (z < -2171 && z > -2190 && row === 2) continue;
      site.place(
        vehicle(false, colors[(i + row) % colors.length]),
        x,
        z,
        Math.PI / 2,
        site.ground(x, z) + 0.24,
      );
      site.obstacle([x - 1.4, z], [x + 1.4, z], 0.95);
    }
  const cx = -13,
    cz = -2192,
    y = site.ground(cx, cz) + 0.24;
  for (const dz of [-1.3, 1.3]) {
    site.b.tube([cx - 2, y + 0.8, cz + dz], [cx + 2, y + 0.8, cz + dz], 0.06, 0.06, STEEL, S.metal, 8);
    for (const dx of [-2, 2])
      site.b.tube([cx + dx, y, cz + dz], [cx + dx, y + 0.8, cz + dz], 0.06, 0.06, STEEL, S.metal, 8);
    site.obstacle([cx - 2, cz + dz], [cx + 2, cz + dz], 0.08);
  }
  for (let i = 0; i < 4; i++) site.place(cart(), cx - 1.2 + i * 0.6, cz, Math.PI / 2, y);
  site.sign('CARTS', cx, y + 1.35, cz + 1.34, 3.4);
  site.obstacle([cx - 1.2, cz], [cx + 0.9, cz], 0.42);
  const loose = site.place(cart(), -21, -2185, Math.PI / 2);
  let bump = 0;
  site.animations.push((t) => {
    loose.rotation.z = Math.sin(t * 12) * bump;
    bump *= 0.92;
  });
  site.action('Rattle the cart', -20, -2185, () => {
    bump = 0.04;
    return 'The little cart rattles.';
  });
  site.obstacle([-21, -2185], undefined, 0.48);
  for (let i = 0; i < 4; i++)
    site.visitor(
      [
        [-19.4, -2140 - i * 20],
        [-19.4, -2147 - i * 20],
      ],
      { bag: true, color: colors[i] },
    );
  site.inventory.add('storefront displays');
  site.inventory.add('parked cars');
  site.inventory.add('shopping carts');
  site.inventory.add('cart corral');
  return site;
}

export function downtown(site: PlaceSite) {
  // Keep the narrow historic sidewalks passable; furniture is grouped beside the facades.
  for (const [x, z] of [
    [11, -16],
    [11, -36],
    [11, -66],
    [-11, -26],
    [-11, -56],
    [-11, 21],
  ]) {
    if (site.clear(x, z, 0.65, 0.1)) site.planter(x, z, 1.1);
  }
  for (const [x, z, yaw] of [
    [11, -27, -Math.PI / 2],
    [-11, -39, Math.PI / 2],
    [11, 27, -Math.PI / 2],
  ])
    if (site.clear(x, z, 0.55, 0.1)) site.seat(x, z, yaw);
  for (const [x, z, yaw] of [
    [12, -47, -Math.PI / 2],
    [-12, -74, Math.PI / 2],
  ]) {
    const y = site.ground(x, z),
      f = facade(site, x, y, z, yaw);
    for (let i = 0; i < 12; i++)
      f.box(-2.75 + i * 0.5, 3.15, 0.45, 0.5, 0.13, 1.65, i % 2 ? PALE : '#54726a', S.roof);
    f.box(0, 2.9, 1.22, 6, 0.42, 0.1, '#91a399', S.trim);
    f.sign('LOCAL SHOPS', 0, 2.92, 1.29, 5.4);
    // Window displays stay flat against the building, clear of the walking route.
    f.box(0, 1.4, 0.02, 3.5, 2.05, 0.05, '#344e55', S.window);
    for (let i = 0; i < 6; i++)
      f.box(-1.35 + i * 0.52, 1.35, 0.08, 0.29, 0.6 + (i % 3) * 0.15, 0.06, '#c5b592', S.metal);
    f.sign('OPEN', 0, 2.05, 0.13, 1.8);
  }
  site.board(
    14,
    16,
    -Math.PI / 2,
    'MAIN & BUFFALO',
    'THE FOUR CORNERS',
    'North and South Main Street meet East and West Buffalo Street here. Look for the tall corner block, stepped cornices and individual shop fronts.',
    3.2,
  );
  for (const [x, z] of [
    [10.3, -83],
    [-10.5, -95],
  ])
    if (site.clear(x, z, 1.6, 0.1)) site.bikeRack(x, z, Math.PI / 2);
  site.visitor(
    [
      [10, -56],
      [10, -44],
    ],
    { bag: true },
  );
  site.visitor(
    [
      [-9.5, 24],
      [-9.5, 30],
    ],
    { color: '#c6ab86' },
  );
  site.inventory.add('striped shop awnings');
  site.inventory.add('window displays');
  return site;
}
