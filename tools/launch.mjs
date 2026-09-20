import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, openSync, closeSync, readFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const base = 'http://127.0.0.1:5173';
export const workspace = createHash('sha256').update(root.toLowerCase()).digest('hex').slice(0, 20);
export const runtime = path.join(root, '.launcher');
export const stateFile = path.join(runtime, 'server.json');
export const control = '/__ascii_walk_launcher';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function status() {
  try {
    const response = await fetch(base + control, { signal: AbortSignal.timeout(900) });
    const body = await response.text();
    try {
      const info = JSON.parse(body);
      if (info.app === 'ascii-walk' && info.workspace === workspace) return info;
    } catch {
      /* An ordinary development server has no launcher endpoint. */
    }
    if (body.includes('<title>ASCII Walk -')) {
      const local = JSON.parse(readFileSync(path.join(root, 'public/worlds/warsaw/manifest.json'), 'utf8'));
      const response = await fetch(base + '/worlds/warsaw/manifest.json', {
        signal: AbortSignal.timeout(900),
      });
      const manifest = await response.json();
      if (manifest.id === 'warsaw' && manifest.revision === local.revision)
        return { app: 'ascii-walk', managed: false };
    }
    return { app: 'other' };
  } catch {
    return undefined;
  }
}

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const finish = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(700, () => finish(true));
  });
}

export async function start() {
  const current = await status();
  if (current?.app === 'ascii-walk' && current.ready !== false) return { ...current, reused: true };
  const occupied = await Promise.all([portInUse(5173), portInUse(5174)]);
  if (occupied.some(Boolean)) {
    // A second double-click can arrive while the first launcher is still starting.
    for (let i = 0; i < 25; i++) {
      await delay(100);
      const info = await status();
      if (info?.app === 'ascii-walk' && info.ready !== false) return { ...info, reused: true };
    }
  }
  if (occupied[0])
    throw new Error('Port 5173 is being used by another app. Close that app, then launch ASCII Walk again.');
  if (occupied[1])
    throw new Error(
      'Port 5174 is already in use. Close the existing area-builder terminal or app, then launch again.',
    );
  if (!existsSync(path.join(root, 'node_modules/vite/package.json')))
    throw new Error(
      'The project dependencies are missing. Open a terminal in this folder and run npm ci once, then launch again.',
    );
  mkdirSync(runtime, { recursive: true });
  const log = openSync(path.join(runtime, 'server.log'), 'a');
  const child = spawn(process.execPath, [path.join(root, 'server/desktop.mjs')], {
    cwd: root,
    detached: true,
    windowsHide: true,
    stdio: ['ignore', log, log],
  });
  closeSync(log);
  let spawnError;
  child.once('error', (error) => {
    spawnError = error;
  });
  child.unref();
  for (let i = 0; i < 200; i++) {
    if (spawnError) throw spawnError;
    const info = await status();
    if (info?.app === 'ascii-walk' && info.ready !== false) return { ...info, reused: false };
    if (child.exitCode !== null) break;
    await delay(100);
  }
  throw new Error(`The local server could not start. Details are in ${path.join(runtime, 'server.log')}`);
}

export async function stop() {
  const info = await status();
  if (!info || info.app !== 'ascii-walk') return 'ASCII Walk is already stopped.';
  if (!info.managed)
    return 'This copy was started in a development terminal. Close that terminal to stop it.';
  let saved;
  try {
    saved = JSON.parse(readFileSync(stateFile, 'utf8'));
  } catch {
    /* Keep unrelated processes untouched. */
  }
  if (!saved || saved.pid !== info.pid || saved.workspace !== workspace || !saved.token)
    throw new Error('The running server does not match this launcher. It has been left running.');
  const response = await fetch(base + control, {
    method: 'POST',
    headers: { 'X-ASCII-Launcher': saved.token },
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) throw new Error('The local server did not accept the stop request.');
  for (let i = 0; i < 50; i++) {
    const current = await status();
    if (!current || current.pid !== info.pid) return 'ASCII Walk stopped. You can close the browser tab.';
    await delay(100);
  }
  throw new Error('The server is taking longer than expected to stop. See .launcher/server.log.');
}

export function browserCommand(platform = process.platform) {
  if (platform === 'win32') return { exe: 'explorer.exe', args: [base] };
  if (platform === 'darwin') return { exe: 'open', args: [base] };
  return { exe: 'xdg-open', args: [base] };
}

async function openBrowser() {
  const { exe, args } = browserCommand();
  const child = spawn(exe, args, { detached: true, windowsHide: true, stdio: 'ignore' });
  await new Promise((resolve, reject) => {
    child.once('spawn', resolve);
    child.once('error', reject);
  });
  child.unref();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [major, minor] = process.versions.node.split('.').map(Number);
    if (major < 22 || (major === 22 && minor < 12))
      throw new Error(
        'Node.js 22.12 or newer is required. Install an updated version from https://nodejs.org.',
      );
    if (process.argv.includes('--stop')) console.log(await stop());
    else {
      console.log('Starting ASCII Walk...');
      const info = await start();
      console.log(`${info.reused ? 'Already running' : 'Ready'}: ${base}`);
      if (!process.argv.includes('--no-browser')) {
        try {
          await openBrowser();
        } catch {
          console.log(`Your browser could not open automatically. Open ${base} in a browser.`);
        }
      }
      console.log('The server runs in the background. Use npm stop or Stop ASCII Walk to shut it down.');
    }
  } catch (error) {
    console.error(`\n${error.message}`);
    process.exitCode = 1;
  }
}
