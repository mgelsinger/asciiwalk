import { pointInRing } from '../geography/math';
import type { WorldData } from '../world/data';
import type { Pose } from '../world/types';

export function mapText(data: WorldData, pose: Pose, columns = 51, rows = 29, scale = 7) {
  const cells = Array.from({ length: rows }, () => Array<string>(columns).fill(' '));
  const cx = Math.round(pose.x / scale) * scale,
    cz = Math.round(pose.z / (scale * 1.7)) * scale * 1.7;
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < columns; col++) {
      const x = cx + (col - (columns - 1) / 2) * scale,
        z = cz + (row - (rows - 1) / 2) * scale * 1.7;
      const road = data.nearbyRoad(x, z);
      if (road && road.distance < road.road.width / 2 + scale / 2) cells[row][col] = '.';
      if (
        data.features.buildings.some(
          (b) => Math.abs(b.x - x) < 100 && Math.abs(b.z - z) < 100 && pointInRing(x, z, b.ring),
        )
      )
        cells[row][col] = '#';
      for (const area of data.features.areas)
        if (area.type === 'water' && pointInRing(x, z, area.ring)) cells[row][col] = '~';
      for (const f of data.features.facilities ?? [])
        if (pointInRing(x, z, f.ring))
          cells[row][col] = { basketball: 'B', tennis: 'T', playground: 'P', pool: '~', baseball: 'o' }[
            f.type
          ];
    }
  cells[Math.floor(rows / 2)][Math.floor(columns / 2)] = '@';
  const facing = ((Math.round(-pose.yaw / (Math.PI / 2)) % 4) + 4) % 4;
  const [dx, dz] = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ][facing];
  cells[Math.floor(rows / 2) + dz][Math.floor(columns / 2) + dx] = ['^', '>', 'v', '<'][facing];
  cells[0][Math.floor(columns / 2)] = 'N';
  return cells.map((row) => row.join('')).join('\n');
}
