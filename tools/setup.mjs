import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { root } from './launch.mjs';
process.chdir(root);
const python = process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python';
function run(exe, args) {
  const r = spawnSync(exe, args, { stdio: 'inherit', shell: false });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
if (!existsSync(python)) {
  const candidates = process.env.ASCII_PYTHON
    ? [[process.env.ASCII_PYTHON, []]]
    : process.platform === 'win32'
      ? [
          ['py', ['-3.11']],
          ['python', []],
          ['python3', []],
        ]
      : [
          ['python3', []],
          ['python', []],
        ];
  const found = candidates.find(
    ([exe, args]) =>
      spawnSync(exe, [...args, '-c', 'import sys; sys.exit(sys.version_info < (3, 11))'], {
        windowsHide: true,
        stdio: 'ignore',
      }).status === 0,
  );
  if (!found) {
    console.error(
      'Install Python 3.11 or newer, then run npm run setup again. You can also set ASCII_PYTHON to its executable path.',
    );
    process.exit(1);
  }
  run(found[0], [...found[1], '-m', 'venv', '.venv']);
}
run(python, ['-m', 'pip', 'install', '-r', 'tools/geodata/requirements.txt']);
console.log('Environment ready. Run npm run dev.');
