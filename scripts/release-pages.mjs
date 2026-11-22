// Local CI and Cloudflare Pages release, run on this machine instead of GitHub Actions.
//
//   node scripts/release-pages.mjs              refresh EIA data, validate, test, deploy
//   node scripts/release-pages.mjs --ci         validate and test only (no refresh, no deploy)
//   flags: --no-refresh  --no-deploy  --no-ui
//
// Secrets come from the environment or, on macOS, the login Keychain (service
// "electricity-map-deploy", accounts CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, EIA_API_KEY).
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = new Set(process.argv.slice(2));
const ci = args.has('--ci');
const refresh = !ci && !args.has('--no-refresh');
const deploy = !ci && !args.has('--no-deploy');
const ui = !args.has('--no-ui');
const project = process.env.PAGES_PROJECT || 'electricity-map';
const port = Number(process.env.PAGES_DEV_PORT || 8788);
const windows = process.platform === 'win32';
// npm/npx are .cmd shims on Windows, which Node only runs through a shell.
const npx = 'npx';
const npm = 'npm';

function keychain(account) {
  if (process.env[account] || process.platform !== 'darwin') return process.env[account];
  const result = spawnSync(
    'security',
    ['find-generic-password', '-s', 'electricity-map-deploy', '-a', account, '-w'],
    { encoding: 'utf8' },
  );
  return result.status === 0 ? result.stdout.trim() : undefined;
}

// With shell: true (Windows), cmd.exe receives one joined command line, so quote arguments.
const quote = (arg) => (windows && /[\s"&|<>^]/.test(arg) ? `"${arg.replaceAll('"', '""')}"` : arg);

function run(command, commandArgs, env = {}) {
  console.log(`\n▶ ${[command, ...commandArgs].join(' ')}`);
  const result = spawnSync(command, commandArgs.map(quote), {
    cwd: root,
    stdio: 'inherit',
    shell: windows,
    env: { ...process.env, ...env },
  });
  if (result.status !== 0)
    throw new Error(`${command} ${commandArgs.join(' ')} exited with ${result.status ?? result.signal}`);
}

function git(...gitArgs) {
  const result = spawnSync('git', gitArgs, { cwd: root, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '';
}

const env = {};
if (refresh) {
  env.EIA_API_KEY = keychain('EIA_API_KEY');
  if (!env.EIA_API_KEY) {
    console.warn('EIA_API_KEY not found; using DEMO_KEY, which EIA rate-limits (HTTP 429).');
    env.EIA_API_KEY = 'DEMO_KEY';
  }
}
if (deploy) {
  env.CLOUDFLARE_API_TOKEN = keychain('CLOUDFLARE_API_TOKEN');
  env.CLOUDFLARE_ACCOUNT_ID = keychain('CLOUDFLARE_ACCOUNT_ID');
  if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID)
    throw new Error('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required to deploy.');
}

// GitHub's runners use installed Chrome; fall back to Playwright's Chromium where it is absent.
const chrome =
  process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : process.platform === 'linux'
      ? '/opt/google/chrome/chrome'
      : windows
        ? join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google/Chrome/Application/chrome.exe')
        : null;
const browserEnv = chrome && !existsSync(chrome) ? { PLAYWRIGHT_BUNDLED_CHROMIUM: '1' } : {};

async function waitFor(url, seconds) {
  for (let i = 0; i < seconds; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`${url} did not respond within ${seconds}s`);
}

const started = Date.now();
if (refresh) run(npm, ['run', 'data:refresh'], env);
run(npm, ['run', 'check']);
run(npm, ['test']);
run(npm, ['run', 'build:pages']);
if (ui) {
  if (browserEnv.PLAYWRIGHT_BUNDLED_CHROMIUM) run(npx, ['playwright', 'install', 'chromium']);
  // Node server (as in the original CI), then the static Pages output under Cloudflare's runtime.
  run(npm, ['run', 'test:ui'], browserEnv);
  const pages = spawn(
    npx,
    ['wrangler', 'pages', 'dev', 'dist-pages', '--ip', '127.0.0.1', '--port', String(port)],
    { cwd: root, stdio: ['ignore', 'ignore', 'inherit'], detached: !windows, shell: windows },
  );
  try {
    await waitFor(`http://127.0.0.1:${port}/api/health`, 60);
    run(npm, ['run', 'test:ui'], {
      ...browserEnv,
      PLAYWRIGHT_BASE_URL: `http://127.0.0.1:${port}`,
    });
  } finally {
    try {
      if (windows) spawnSync('taskkill', ['/pid', String(pages.pid), '/T', '/F']);
      else process.kill(-pages.pid);
    } catch {}
  }
}
if (deploy) {
  const sha = git('rev-parse', 'HEAD');
  run(
    npx,
    [
      'wrangler',
      'pages',
      'deploy',
      'dist-pages',
      '--project-name',
      project,
      '--branch',
      'main',
      ...(sha ? ['--commit-hash', sha] : []),
      '--commit-message',
      `Local release${refresh ? ' with EIA refresh' : ''} ${new Date().toISOString()}`,
      '--commit-dirty=true',
    ],
    env,
  );
}
console.log(
  `\n✔ ${deploy ? 'Released' : 'Checked'} in ${Math.round((Date.now() - started) / 1000)}s` +
    (refresh ? ' with refreshed EIA data' : ''),
);
