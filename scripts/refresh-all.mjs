import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
for (const script of ['fetch-data.mjs', 'fetch-monthly.mjs', 'fetch-utilities.mjs']) {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL(script, import.meta.url))], {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    process.exitCode = result.status || 1;
    break;
  }
}
