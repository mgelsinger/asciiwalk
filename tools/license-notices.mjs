import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { root } from './launch.mjs';

let notice =
  'ASCII WALK - THIRD-PARTY SOFTWARE NOTICES\n\nBundled runtime code and build-generated helpers retain the following notices.\nIBM Plex Mono is covered by FONT_LICENSE.txt. Geographic data is covered by DATA_LICENSES.txt.\n';
for (const [name, file] of [
  ['three', 'LICENSE'],
  ['zod', 'LICENSE'],
  ['vite', 'LICENSE.md'],
]) {
  const dir = path.join(root, 'node_modules', name);
  const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
  notice += `\n${name} ${pkg.version}\n${'='.repeat(60)}\n${readFileSync(path.join(dir, file), 'utf8')}\n`;
}
writeFileSync(path.join(root, 'public/THIRD_PARTY_NOTICES.txt'), notice);
console.log('Updated third-party software notices.');
