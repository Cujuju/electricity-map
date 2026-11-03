import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/index.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const api = await createApp();
const vite = await createServer({ root });
try {
  await new Promise((resolve, reject) => {
    api.once('error', reject);
    api.listen(3001, '127.0.0.1', resolve);
  });
  await vite.listen();
  console.log('Electricity Map API: http://127.0.0.1:3001');
  vite.printUrls();
} catch (error) {
  console.error(error.message);
  await vite.close();
  api.close();
  process.exitCode = 1;
}
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await vite.close();
  api.close();
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
