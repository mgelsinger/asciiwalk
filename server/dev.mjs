import { createServer } from 'vite';
import { startApi } from './api.mjs';
const api = startApi();
const vite = await createServer();
await vite.listen();
vite.printUrls();
async function shutdown() {
  api.close();
  await vite.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
