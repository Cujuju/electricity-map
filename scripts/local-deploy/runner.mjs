// Weekly release of map.cujuju.foo, run by T3 Code scheduled tasks on more than one machine.
// Self-contained (Node built-ins only) so a task can run it straight from origin/main:
//
//   git fetch origin main && git show origin/main:scripts/local-deploy/runner.mjs > <tmp>/runner.mjs
//   node <tmp>/runner.mjs [--force]
//
// It skips when the live site's data is under six days old, so whichever machine runs first
// does the refresh and the others do nothing. Otherwise it updates its own clone of
// origin/main (never a working checkout), then runs scripts/release-pages.mjs: EIA refresh,
// checks, unit and UI tests, and the Cloudflare Pages deploy.
//
// Secrets: environment variables, then <home>/secrets.env (KEY=value lines), then on macOS the
// login Keychain (service "electricity-map-deploy"). Keys: CLOUDFLARE_API_TOKEN,
// CLOUDFLARE_ACCOUNT_ID, EIA_API_KEY.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';

const windows = process.platform === 'win32';
const home =
  process.env.ELECTRICITY_MAP_DEPLOY_HOME ||
  (windows
    ? join(process.env.LOCALAPPDATA || join(homedir(), 'AppData/Local'), 'Electricity Map Deploy')
    : process.platform === 'darwin'
      ? join(homedir(), 'Library/Application Support/Electricity Map Deploy')
      : join(homedir(), '.local/share/electricity-map-deploy'));
const repo = join(home, 'repo');
const statePath = join(home, 'state.json');
const lock = join(home, 'lock');
const secrets = join(home, 'secrets.env');
const remote = process.env.ELECTRICITY_MAP_REMOTE || 'https://github.com/Cujuju/electricity-map';
const branch = process.env.ELECTRICITY_MAP_BRANCH || 'main';
const site = process.env.SITE_URL || 'https://map.cujuju.foo/';
const freshFor = 6 * 24 * 60 * 60 * 1000;
const force = process.argv.includes('--force');

const log = (message) => console.log(`[${new Date().toISOString()}] ${message}`);
const readState = () => {
  try {
    return JSON.parse(readFileSync(statePath, 'utf8'));
  } catch {
    return {};
  }
};
const writeState = (state) => writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');
function sh(command, args, options = {}) {
  // npm/npx are .cmd shims on Windows and need a shell.
  const result = spawnSync(command, args, { cwd: repo, encoding: 'utf8', shell: windows && command === 'npm', ...options });
  if (result.status !== 0)
    throw new Error(`${command} ${args.join(' ')} failed (${result.status ?? result.signal ?? result.error?.message}): ${(result.stderr || '').trim().slice(-500)}`);
  return (result.stdout || '').trim();
}

async function liveAge() {
  try {
    const response = await fetch(new URL('api/health', site), { signal: AbortSignal.timeout(15000) });
    const { fetchedAt } = await response.json();
    const age = Date.now() - Date.parse(fetchedAt);
    return Number.isFinite(age) ? { age, fetchedAt } : null;
  } catch {
    return null;
  }
}

mkdirSync(home, { recursive: true });
const live = await liveAge();
if (!force && live && live.age < freshFor) {
  log(`RESULT: skipped. Live data fetched ${live.fetchedAt} is under six days old.`);
  process.exit(0);
}

try {
  mkdirSync(lock);
} catch {
  // A stale lock (crash, reboot) older than three hours is reclaimed.
  let since = 0;
  try {
    since = Number(readFileSync(join(lock, 'since'), 'utf8').trim());
  } catch {}
  if (Date.now() - since < 3 * 60 * 60 * 1000) {
    log('RESULT: skipped. Another release is running on this machine.');
    process.exit(0);
  }
}
writeFileSync(join(lock, 'since'), String(Date.now()));

const state = readState();
try {
  if (existsSync(secrets)) process.loadEnvFile(secrets);
  if (!existsSync(join(repo, '.git')))
    sh('git', ['clone', '--quiet', '--branch', branch, remote, repo], { cwd: home });
  sh('git', ['fetch', '--quiet', 'origin', branch]);
  const head = sh('git', ['rev-parse', `origin/${branch}`]);
  log(`Releasing ${head.slice(0, 7)}; live data was ${live ? `fetched ${live.fetchedAt}` : 'unreachable'}.`);
  sh('git', ['reset', '--quiet', '--hard', head]);
  sh('git', ['clean', '-fdxq', '-e', 'node_modules']);
  const lockHash = createHash('sha256').update(readFileSync(join(repo, 'package-lock.json'))).digest('hex');
  if (lockHash !== state.lockHash || !existsSync(join(repo, 'node_modules'))) {
    log('npm ci');
    sh('npm', ['ci', '--no-audit', '--no-fund'], { stdio: 'inherit' });
  }
  sh(process.execPath, ['scripts/release-pages.mjs'], { stdio: 'inherit' });
  writeState({ deployedSha: head, releasedAt: new Date().toISOString(), lockHash, lastError: null });
  log(`RESULT: released ${head.slice(0, 7)} with refreshed EIA data to ${site}`);
} catch (error) {
  writeState({ ...state, lastError: error.message, failedAt: new Date().toISOString() });
  log(`RESULT: failed. ${error.message}`);
  process.exitCode = 1;
} finally {
  rmSync(lock, { recursive: true, force: true });
}
