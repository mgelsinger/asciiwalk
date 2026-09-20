import { createServer } from 'vite';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { startApi } from './api.mjs';
import { base, control, root, runtime, stateFile, workspace } from '../tools/launch.mjs';

const token = randomBytes(32).toString('hex');
let api,
  vite,
  ready = false,
  closing = false;
async function shutdown(code = 0) {
  if (closing) return;
  closing = true;
  ready = false;
  if (api) await new Promise((resolve) => api.close(resolve));
  if (vite) await vite.close();
  try {
    const saved = JSON.parse(readFileSync(stateFile, 'utf8'));
    if (saved.pid === process.pid && saved.token === token) unlinkSync(stateFile);
  } catch {
    /* Another launch may own the current record. */
  }
  process.exit(code);
}
try {
  vite = await createServer({
    root,
    plugins: [
      {
        name: 'ascii-walk-launcher',
        configureServer(server) {
          server.middlewares.use(control, (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-store');
            if (req.method === 'GET') {
              res.end(
                JSON.stringify({ app: 'ascii-walk', workspace, pid: process.pid, managed: true, ready }),
              );
            } else if (
              req.method === 'POST' &&
              req.headers['x-ascii-launcher'] === token &&
              (!req.headers.origin || req.headers.origin === base)
            ) {
              res.end(JSON.stringify({ stopping: true }));
              setImmediate(() => shutdown());
            } else {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: 'This action requires the local launcher.' }));
            }
          });
        },
      },
    ],
  });
  api = startApi();
  await once(api, 'listening');
  await vite.listen();
  mkdirSync(runtime, { recursive: true });
  writeFileSync(stateFile, JSON.stringify({ workspace, pid: process.pid, token }));
  ready = true;
  console.log(`${new Date().toISOString()} ASCII Walk ready at ${base}`);
  process.on('SIGINT', () => shutdown());
  process.on('SIGTERM', () => shutdown());
} catch (error) {
  console.error(error);
  await shutdown(1);
}
