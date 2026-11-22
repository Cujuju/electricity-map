// Scheduled weekly by launchd (see install.mjs): refresh EIA data from origin/main and release.
// Works in its own clone, so it never touches a working checkout.
//
//   node runner.mjs
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';

const home = process.env.ELECTRICITY_MAP_DEPLOY_HOME || join(homedir(), 'Library/Application Support/Electricity Map Deploy');
const repo = join(home, 'repo');
const statePath = join(home, 'state.json');
const lock = join(home, 'lock');
const remote = process.env.ELECTRICITY_MAP_REMOTE || 'https://github.com/Cujuju/electricity-map';
const branch = process.env.ELECTRICITY_MAP_BRANCH || 'main';

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
  const result = spawnSync(command, args, { cwd: repo, encoding: 'utf8', ...options });
  if (result.status !== 0)
    throw new Error(`${command} ${args.join(' ')} failed: ${(result.stderr || '').trim().slice(-500)}`);
  return (result.stdout || '').trim();
}
function notify(title, message) {
  if (process.platform !== 'darwin') return;
  spawnSync('osascript', [
    '-e',
    `display notification ${JSON.stringify(message)} with title ${JSON.stringify(title)}`,
  ]);
}

mkdirSync(home, { recursive: true });
try {
  mkdirSync(lock);
} catch {
  // A stale lock (crash, reboot) older than three hours is reclaimed.
  let since = 0;
  try {
    since = Number(readFileSync(join(lock, 'since'), 'utf8').trim());
  } catch {}
  if (Date.now() - since < 3 * 60 * 60 * 1000) {
    log('Another release is running; skipping.');
    process.exit(0);
  }
}
writeFileSync(join(lock, 'since'), String(Date.now()));

const state = readState();
async function release() {
  if (!existsSync(join(repo, '.git')))
    sh('git', ['clone', '--quiet', '--branch', branch, remote, repo], { cwd: home });
  sh('git', ['fetch', '--quiet', 'origin', branch]);
  const head = sh('git', ['rev-parse', `origin/${branch}`]);
  log(`Release ${head.slice(0, 7)}`);

  sh('git', ['reset', '--quiet', '--hard', head]);
  sh('git', ['clean', '-fdxq', '-e', 'node_modules']);
  const lockHash = createHash('sha256').update(readFileSync(join(repo, 'package-lock.json'))).digest('hex');
  if (lockHash !== state.lockHash || !existsSync(join(repo, 'node_modules'))) {
    log('npm ci');
    sh('npm', ['ci', '--no-audit', '--no-fund'], { stdio: 'inherit' });
  }
  // Every release refreshes first, so deploying main never rolls live data back to older snapshots.
  sh(process.execPath, ['scripts/release-pages.mjs'], { stdio: 'inherit' });

  writeState({
    ...state,
    deployedSha: head,
    refreshedAt: new Date().toISOString(),
    lockHash,
    failing: false,
    lastError: null,
  });
  log('Release complete.');
  if (state.failing) notify('Electricity Map', 'Deploy recovered; map.cujuju.foo is up to date.');
}
try {
  await release();
} catch (error) {
  log(`Release failed: ${error.message}`);
  if (!state.failing) notify('Electricity Map deploy failed', 'See ~/Library/Logs/electricity-map-deploy.log. Run npm run release to retry.');
  writeState({ ...state, failing: true, lastError: error.message, failedAt: new Date().toISOString() });
  process.exitCode = 1;
} finally {
  rmSync(lock, { recursive: true, force: true });
}
