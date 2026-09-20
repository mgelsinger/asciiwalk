import { PlaceSite, facade } from './place-kit';
import { Batch } from './geometry';
import { PALE, STEEL } from './park-models';
import { SURFACE as S } from '../renderer/material';

export function monument(site: PlaceSite) {
  const cx = -11.46,
    cz = -276.16;
  // A jointed stone apron gives the monument and its four cannon a readable setting.
  for (let i = 0; i < 64; i++) {
    const a = (i * Math.PI) / 32,
      c = ((i + 1) * Math.PI) / 32;
    const p = (r: number, t: number): [number, number, number] => {
      const x = cx + Math.cos(t) * r,
        z = cz + Math.sin(t) * r;
      return [x, site.ground(x, z) + 0.065, z];
    };
    site.b.quad(
      p(7, a + 0.006),
      p(9, a + 0.006),
      p(9, c - 0.006),
      p(7, c - 0.006),
      i % 2 ? '#beb7a0' : '#a9ad9c',
      S.stone,
    );
  }
  site.board(
    -24,
    -282,
    Math.PI / 2,
    'SOLDIERS & SAILORS',
    'WARSAW, 1903',
    'Dedicated in 1903, the monument honors Civil War service. Its granite column supports a bronze Union soldier. Four captured cannon surround the base.',
    4.4,
  );
  for (const z of [-265, -289]) {
    site.seat(-20, z, Math.PI / 2);
    site.planter(-23, z);
  }
  site.flag(-28, -273, 9);
  site.visitor([[-22, -269]], { yaw: Math.PI / 2 });
  site.inventory.add('stone memorial apron');
  site.inventory.add('history plaque');
  return site;
}

export function courthouse(site: PlaceSite) {
  site.flag(-29, -336, 10);
  for (const z of [-332, -297]) {
    site.lamp(-30, z, 4.5);
    site.planter(-29, z + 3, 2.2);
  }
  for (const z of [-326, -302]) site.seat(-29, z, Math.PI / 2);
  const b = site.data.features.buildings.find((b) => b.id === '478525896')!;
  const f = facade(site, -43.9, b.ground, -315.2, Math.PI / 2);
  f.window(-0.85, 1.95, 1.45, 3.1, 0.32);
  f.window(0.85, 1.95, 1.45, 3.1, 0.32);
  f.sign('WYOMING COUNTY COURTHOUSE', 0, 9.9, 5.12, 11.7);
  site.board(
    -27,
    -346,
    Math.PI / 2,
    'WYOMING COUNTY',
    'COURTHOUSE / 1937',
    'The 1937 courthouse faces North Main Street. Four large columns, a symmetrical nine-bay facade and a hipped roof distinguish this civic building.',
    4.5,
  );
  site.visitor(
    [
      [-26, -321],
      [-26, -312],
    ],
    { color: '#8b9da6' },
  );
  site.inventory.add('courthouse entrance');
  return site;
}

export function library(site: PlaceSite) {
  const y = site.ground(10, -234);
  const b = new Batch();
  b.box(0, 0.65, 0, 0.9, 1.3, 0.75, '#72958f', S.metal);
  b.box(0, 1.32, 0, 1, 0.1, 0.85, PALE, S.metal);
  b.box(0, 1.02, 0.386, 0.65, 0.18, 0.04, '#334b4a', S.window);
  site.place(b, 10, -234, -Math.PI / 2);
  site.obstacle([10, -234], undefined, 0.51);
  site.sign('BOOKS', 9.59, y + 0.7, -234, 0.72, -Math.PI / 2);
  site.action(
    'Read the library note',
    9,
    -234,
    () =>
      'Warsaw Public Library opened in 1905 with Carnegie funding. Its arched windows, hipped roof and welcoming entrance are part of the historic Main Street streetscape.',
    true,
  );
  site.seat(20, -229);
  site.visitor([[20, -228.8]], { seated: true, yaw: Math.PI });
  const book = new Batch();
  book.box(20, site.ground(20, -229) + 0.88, -229, 0.5, 0.045, 0.36, PALE, S.paint);
  site.group.add(book.mesh(site.material));
  site.planter(14, -230);
  site.lamp(29, -230);
  site.inventory.add('book return');
  site.inventory.add('reading bench');
  return site;
}

export function postoffice(site: PlaceSite) {
  for (const z of [80, 83]) {
    const b = new Batch();
    b.box(0, 0.85, 0, 0.75, 1.15, 0.78, '#648498', S.metal);
    b.box(0, 1.47, 0, 0.78, 0.15, 0.81, STEEL, S.metal);
    for (const x of [-0.25, 0.25]) b.box(x, 0.22, 0, 0.075, 0.44, 0.58, STEEL, S.metal);
    b.box(0, 1.12, 0.403, 0.55, 0.2, 0.04, '#304e55', S.window);
    b.box(0, 0.68, 0.407, 0.48, 0.34, 0.035, PALE, S.paint);
    site.place(b, -11.2, z, Math.PI / 2);
    site.obstacle([-11.2, z], undefined, 0.5);
    site.sign('MAIL', -10.77, site.ground(-11.2, z) + 0.71, z, 0.48, Math.PI / 2);
  }
  site.action(
    'Read the post office note',
    -9.8,
    81,
    () =>
      'Warsaw Post Office, South Main Street. Mailboxes, an entrance notice and a flag mark the street-facing side.',
    true,
  );
  site.planter(-12.5, 89);
  site.visitor(
    [
      [-9.8, 86],
      [-9.8, 91],
    ],
    { bag: true },
  );
  site.inventory.add('curbside mailboxes');
  site.inventory.add('postal notice');
  return site;
}

export function church(
  site: PlaceSite,
  name: string,
  x: number,
  z: number,
  yaw: number,
  boardX: number,
  boardZ: number,
) {
  const y = site.ground(x, z),
    f = facade(site, x, y, z, yaw);
  // Rose-window spokes and pointed entry trim retain their silhouette in monochrome.
  f.box(0, 1.45, 0.14, 2.4, 2.9, 0.2, '#5c6455', S.window);
  for (const u of [-1.3, 1.3]) f.box(u, 1.7, 0.2, 0.24, 3.4, 0.25, PALE, S.trim);
  for (const side of [-1, 1])
    site.b.tube(f.point(side * 1.35, 3.25, 0.25), f.point(0, 4.55, 0.25), 0.14, 0.14, PALE, S.trim, 6);
  if (name === 'TRINITY EPISCOPAL') {
    for (const u of [-0.85, 0, 0.85]) {
      f.window(u, 4.8, 0.5, 1.9, 0.4);
      for (const side of [-1, 1])
        site.b.tube(f.point(u + side * 0.37, 5.8, 0.52), f.point(u, 6.5, 0.52), 0.09, 0.09, PALE, S.trim, 6);
    }
  } else
    for (let i = 0; i < 32; i++) {
      const a = (i * Math.PI) / 16,
        c = ((i + 1) * Math.PI) / 16;
      site.b.tube(
        f.point(Math.cos(a) * 1.55, 7 + Math.sin(a) * 1.55, 0.4),
        f.point(Math.cos(c) * 1.55, 7 + Math.sin(c) * 1.55, 0.4),
        0.1,
        0.1,
        PALE,
        S.trim,
        6,
      );
      if (i % 4 === 0)
        site.b.tube(
          f.point(0, 7, 0.4),
          f.point(Math.cos(a) * 1.5, 7 + Math.sin(a) * 1.5, 0.4),
          0.07,
          0.07,
          PALE,
          S.trim,
          6,
        );
    }
  site.board(
    boardX,
    boardZ,
    yaw,
    name,
    'WELCOME',
    `${name}. Explore the church's tower, entrance and surrounding historic streets. Window tracery and small furnishings are an artistic interpretation.`,
    4.1,
  );
  site.inventory.add('church window tracery');
  site.inventory.add('pointed entrance');
  return site;
}
