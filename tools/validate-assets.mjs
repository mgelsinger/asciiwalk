import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { root } from './launch.mjs';

const read = (file) => readFileSync(path.join(root, file));
const json = (file) => JSON.parse(read(file));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const places = json('public/worlds/index.json');
assert.equal(new Set(places.map((p) => p.id)).size, places.length, 'Duplicate bundled place');
let total = 0;
for (const place of places) {
  assert.match(place.id, /^[a-z0-9-]+$/);
  const dir = `public/worlds/${place.id}/`;
  const manifest = json(dir + 'manifest.json');
  assert.equal(manifest.id, place.id);
  const local = (file) => {
    assert.equal(path.basename(file), file, 'World assets must use plain file names');
    const bytes = read(dir + file);
    total += bytes.length;
    return bytes;
  };
  const featureBytes = local(manifest.features);
  const features = JSON.parse(featureBytes);
  for (const key of ['buildings', 'roads', 'landmarks', 'facilities']) {
    assert.equal(features[key]?.length ?? 0, manifest.counts[key] ?? 0, `${place.id}: ${key} count`);
  }
  assert.equal(new Set(features.buildings.map((b) => b.id)).size, features.buildings.length);
  const revision = createHash('sha256').update(featureBytes);
  for (const grid of manifest.terrain) {
    const bytes = local(grid.file);
    assert.equal(bytes.length, grid.width * grid.height * 4, `${place.id}: terrain size`);
    for (let offset = 0; offset < bytes.length; offset += 4) {
      assert.ok(Number.isFinite(bytes.readFloatLE(offset)), `${place.id}: nonfinite terrain`);
    }
    revision.update(bytes);
    if (place.id === 'warsaw') {
      const source = `research/sources/warsaw/${grid.file.replace('.bin', '.tif')}`;
      assert.equal(digest(read(source)), grid.sha256, `${source}: source checksum`);
    }
  }
  assert.equal(revision.digest('hex').slice(0, 12), manifest.revision, `${place.id}: revision checksum`);
  if (place.id === 'warsaw') {
    const inputs = [
      'research/warsaw-osm.json',
      'research/warsaw-north-osm.json',
      'data/overrides/warsaw/buildings.json',
      'research/sources/warsaw/overture-buildings.geojson',
    ];
    assert.equal(inputs.length, manifest.inputs.length);
    inputs.forEach((file, i) => assert.equal(digest(read(file)), manifest.inputs[i].sha256, file));
  }
  console.log(`${place.name}: buildings, terrain, source checksums and revision verified.`);
}
for (const file of [
  'public/DATA_LICENSES.txt',
  'public/FONT_LICENSE.txt',
  'public/THIRD_PARTY_NOTICES.txt',
  'public/REFERENCE_SOURCES.json',
  'data/gazetteer-us.json',
]) {
  assert.ok(statSync(path.join(root, file)).size > 0, `Missing ${file}`);
}
console.log(
  `${places.length} bundled worlds, ${(total / 1024 / 1024).toFixed(1)} MiB of runtime geography. All required assets present.`,
);
