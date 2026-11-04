import electron from 'electron';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const env = { ...process.env };
// Spillway also clears this: editor terminals may otherwise turn Electron into plain Node.
delete env.ELECTRON_RUN_AS_NODE;
const services = process.argv.includes('--dev')
  ? await (await import('./development.mjs')).startDevelopment()
  : null;
if (services) env.ELECTRICITY_MAP_RENDERER_URL = services.origin;
const child = spawn(electron, ['.', ...process.argv.slice(2)], {
  cwd: root,
  env,
  stdio: 'inherit',
});
let finished = false;
async function finish(code) {
  if (finished) return;
  finished = true;
  try {
    await services?.close();
  } catch (error) {
    console.error(error.message);
    code = 1;
  }
  process.exitCode = code;
}
child.on('error', (error) => {
  console.error(error.message);
  void finish(1);
});
child.on('exit', (code) => {
  void finish(code ?? 0);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
