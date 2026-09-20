import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { once } from 'node:events';
import { startApi, validateArea } from '../../server/api.mjs';
let server, base, token;
beforeAll(async () => {
  server = startApi(0);
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
  token = (await (await fetch(base + '/api/status')).json()).token;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));
describe('bounded local area service', () => {
  it('rejects nonfinite, unsupported, and oversized areas', () => {
    for (const patch of [
      { lat: NaN },
      { lat: 70 },
      { lon: 0 },
      { size: 4001 },
      { size: -1 },
      { size: 1500.5 },
      { name: 'x'.repeat(101) },
    ])
      expect(() => validateArea({ lat: 42, lon: -78, size: 1000, name: 'Example', ...patch })).toThrow();
  });
  it('requires both a local origin and a valid session token', async () => {
    const body = JSON.stringify({ lat: 42, lon: -78, size: 1000, name: 'Example' });
    for (const headers of [
      { Origin: 'https://unrelated.example', 'X-ASCII-Token': token },
      { Origin: 'http://127.0.0.1:5173', 'X-ASCII-Token': 'invalid' },
    ]) {
      expect((await fetch(base + '/api/imports', { method: 'POST', headers, body })).status).toBe(403);
    }
  });
  it('validates before starting a provider request', async () => {
    const response = await fetch(base + '/api/imports', {
      method: 'POST',
      headers: { Origin: 'http://127.0.0.1:5173', 'X-ASCII-Token': token },
      body: JSON.stringify({ lat: 42, lon: -78, size: 99999, name: 'Example' }),
    });
    expect(response.status).toBe(400);
  });
  it('uses the local gazetteer and reports missing jobs', async () => {
    expect(
      (await (await fetch(base + '/api/search?q=Warsaw%20NY')).json()).some((p) => p.name === 'Warsaw'),
    ).toBe(true);
    expect((await fetch(base + '/api/imports/00000000000000000000')).status).toBe(404);
  });
});
