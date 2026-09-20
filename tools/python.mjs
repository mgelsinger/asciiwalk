import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const executable = process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python';
if (!existsSync(executable)) {
  console.error('Run npm run setup to create the local Python environment.');
  process.exit(1);
}
const child = spawn(executable, process.argv.slice(2), { stdio: 'inherit', shell: false });
child.on('exit', (code) => process.exit(code ?? 1));
child.on('error', (error) => {
  console.error(error.message);
  process.exit(1);
});
