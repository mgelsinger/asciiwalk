import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const token = randomBytes(24).toString('hex');
const jobs = new Map();
const queue = [];
let active;
let towns;
const worlds = path.join(root, 'public', 'worlds');
const jobRoot = path.join(root, 'data', 'jobs');
const python = path.join(
  root,
  process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python',
);

export function validateArea(body) {
  if (!body || !Number.isFinite(body.lat) || !Number.isFinite(body.lon) || !Number.isFinite(body.size))
    throw new Error('Provide valid coordinates and an area size.');
  if (body.lat < 24 || body.lat > 50 || body.lon < -125 || body.lon > -66)
    throw new Error('The current terrain adapter supports the contiguous United States.');
  if (!Number.isInteger(body.size) || body.size < 500 || body.size > 4000)
    throw new Error('Choose an area between 500 and 4000 meters across.');
  if (typeof body.name !== 'string' || body.name.length > 100)
    throw new Error('Provide a place name of 100 characters or fewer.');
  return {
    lat: body.lat,
    lon: body.lon,
    size: body.size,
    name: body.name.replace(/[\u0000-\u001f]/g, '').trim() || 'My neighborhood',
  };
}
const worldId = (area) =>
  `area-${area.lat.toFixed(4)}-${Math.abs(area.lon).toFixed(4)}-${area.size}`.replaceAll('.', 'p');
function publicJob(job) {
  const { child, area, output, ...value } = job;
  return value;
}
function persist(job) {
  writeFileSync(path.join(jobRoot, `${job.id}.json`), JSON.stringify(publicJob(job), null, 2));
}
function processQueue() {
  if (active) return;
  const id = queue.shift();
  if (!id) return;
  const job = jobs.get(id);
  if (!job || job.status === 'cancelled') return processQueue();
  active = job;
  job.status = 'running';
  job.stage = 'Starting area preparation';
  persist(job);
  mkdirSync(job.output, { recursive: true });
  const args = [
    path.join(root, job.preview ? 'tools/geodata/preview.py' : 'tools/geodata/build.py'),
    '--id',
    job.worldId,
    '--lat',
    String(job.area.lat),
    '--lon',
    String(job.area.lon),
    '--size',
    String(job.area.size),
    '--name',
    job.area.name,
    '--output',
    job.output,
  ];
  const child = spawn(python, args, {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    windowsHide: true,
  });
  job.child = child;
  let buffer = '',
    stderr = '';
  child.stdout.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      try {
        const update = JSON.parse(line);
        if (job.status === 'cancelled') continue;
        if (update.error) job.error = update.error;
        if (update.stage) job.stage = update.stage;
        if (typeof update.progress === 'number') job.progress = update.progress;
        persist(job);
      } catch {
        /* Non-JSON tool output is not a progress event. */
      }
    }
  });
  child.stderr.on('data', (chunk) => {
    stderr = (stderr + chunk.toString()).slice(-4000);
  });
  child.on('error', (error) => {
    job.error = error.message;
  });
  child.on('close', (code) => {
    if (job.status !== 'cancelled') {
      const target = path.join(worlds, job.worldId);
      if (code === 0 && job.preview && existsSync(path.join(job.output, 'preview.json'))) {
        job.map = JSON.parse(readFileSync(path.join(job.output, 'preview.json'), 'utf8'));
        job.status = 'complete';
        job.stage = 'Preview ready';
        job.progress = 1;
      } else if (code === 0 && existsSync(path.join(job.output, 'manifest.json'))) {
        try {
          if (!existsSync(target)) renameSync(job.output, target);
          job.status = 'complete';
          job.stage = 'World ready';
          job.progress = 1;
        } catch (e) {
          job.status = 'failed';
          job.error = `Unable to publish the prepared world: ${e.message}`;
        }
      } else {
        job.status = 'failed';
        job.error ||= stderr.trim() || 'Area preparation failed. Cached worlds are still available.';
      }
    }
    delete job.child;
    persist(job);
    active = undefined;
    processQueue();
  });
}
export function startApi(port = 5174) {
  mkdirSync(jobRoot, { recursive: true });
  mkdirSync(worlds, { recursive: true });
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');
    const send = (status, body) => {
      res.writeHead(status);
      res.end(JSON.stringify(body));
    };
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (req.method !== 'GET') {
        const origin = req.headers.origin;
        if (
          !['http://127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:4173'].includes(origin) ||
          req.headers['x-ascii-token'] !== token
        )
          return send(403, { error: 'Invalid local builder session. Reopen the Places panel.' });
      }
      if (url.pathname === '/api/status') return send(200, { ready: existsSync(python), token });
      if (url.pathname === '/api/locations') {
        const items = [];
        for (const item of readdirSync(worlds, { withFileTypes: true }))
          if (item.isDirectory())
            try {
              const m = JSON.parse(readFileSync(path.join(worlds, item.name, 'manifest.json'), 'utf8'));
              items.push({ id: m.id, name: m.name, curated: m.curated });
            } catch {
              /* Ignore incomplete packs. */
            }
        return send(
          200,
          items.sort((a, b) => Number(b.curated) - Number(a.curated) || a.name.localeCompare(b.name)),
        );
      }
      if (url.pathname === '/api/search') {
        const file = path.join(root, 'data', 'gazetteer-us.json');
        if (!existsSync(file))
          return send(503, {
            error: 'The local town index is not installed. Coordinates can still be used.',
          });
        towns ||= JSON.parse(readFileSync(file, 'utf8'));
        const query = (url.searchParams.get('q') || '')
          .slice(0, 100)
          .toLowerCase()
          .split(/[ ,]+/)
          .filter(Boolean);
        return send(
          200,
          query.length
            ? towns
                .filter((t) => query.every((q) => `${t.name} ${t.region}`.toLowerCase().includes(q)))
                .slice(0, 12)
            : [],
        );
      }
      if (['/api/imports', '/api/preview'].includes(url.pathname) && req.method === 'POST') {
        let text = '';
        for await (const chunk of req) {
          text += chunk;
          if (text.length > 4096) return send(413, { error: 'Request is too large.' });
        }
        const area = validateArea(JSON.parse(text));
        if (!existsSync(python)) return send(503, { error: 'Run npm run setup to enable preparing areas.' });
        const areaId = worldId(area),
          preview = url.pathname === '/api/preview';
        const existing = [...jobs.values()].find(
          (j) => j.worldId === areaId && j.preview === preview && ['queued', 'running'].includes(j.status),
        );
        if (existing) return send(200, publicJob(existing));
        if (queue.length >= 3)
          return send(429, { error: 'The preparation queue is full. Wait for an area to finish.' });
        const id = randomBytes(10).toString('hex'),
          output = path.resolve(jobRoot, id);
        if (!output.startsWith(jobRoot + path.sep)) throw new Error('Invalid staging directory');
        const complete = !preview && existsSync(path.join(worlds, areaId, 'manifest.json'));
        const job = {
          id,
          worldId: areaId,
          area,
          output,
          preview,
          status: complete ? 'complete' : 'queued',
          progress: complete ? 1 : 0,
          stage: complete ? 'Opening saved world' : 'Queued',
          created: new Date().toISOString(),
        };
        jobs.set(id, job);
        persist(job);
        if (!complete) {
          queue.push(id);
          processQueue();
        }
        return send(202, publicJob(job));
      }
      const match = url.pathname.match(/^\/api\/imports\/([a-f0-9]{20})$/);
      if (match) {
        let job = jobs.get(match[1]);
        if (!job) {
          const file = path.join(jobRoot, `${match[1]}.json`);
          if (existsSync(file)) {
            job = JSON.parse(readFileSync(file, 'utf8'));
            if (['running', 'queued'].includes(job.status)) {
              job.status = 'failed';
              job.error =
                'Preparation was interrupted by a restart. Start it again to reuse the cached source data.';
            }
          }
        }
        if (!job) return send(404, { error: 'Preparation job not found' });
        if (req.method === 'DELETE' && !['complete', 'failed', 'cancelled'].includes(job.status)) {
          job.status = 'cancelled';
          job.stage = 'Preparation cancelled';
          job.child?.kill();
          persist(job);
        }
        return send(200, publicJob(job));
      }
      send(404, { error: 'Not found' });
    } catch (error) {
      send(400, { error: error.message || 'Invalid request' });
    }
  });
  server.listen(port, '127.0.0.1', () => console.log(`Local area builder: http://127.0.0.1:${port}`));
  server.on('close', () => {
    queue.length = 0;
    if (active) {
      active.status = 'cancelled';
      active.stage = 'Builder stopped';
      active.child?.kill();
      persist(active);
    }
  });
  return server;
}
