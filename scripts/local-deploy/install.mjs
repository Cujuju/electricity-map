// Install (or --uninstall) the weekly macOS launchd agent that releases the Pages site.
//   npm run deploy:install      npm run deploy:uninstall
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'darwin') throw new Error('The local deploy agent uses launchd (macOS only).');
const label = 'foo.cujuju.electricity-map.deploy';
const home = join(homedir(), 'Library/Application Support/Electricity Map Deploy');
const plist = join(homedir(), 'Library/LaunchAgents', `${label}.plist`);
const logFile = join(homedir(), 'Library/Logs/electricity-map-deploy.log');
const domain = `gui/${process.getuid()}`;
const launchctl = (...args) => spawnSync('launchctl', args, { encoding: 'utf8' });

launchctl('bootout', `${domain}/${label}`);
if (process.argv.includes('--uninstall')) {
  rmSync(plist, { force: true });
  console.log(`Removed ${label}. Its clone and state remain in ${home}.`);
  process.exit(0);
}

mkdirSync(home, { recursive: true });
const runner = join(home, 'runner.mjs');
copyFileSync(fileURLToPath(new URL('runner.mjs', import.meta.url)), runner);

const escape = (value) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const path = [dirname(process.execPath), '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'];
writeFileSync(
  plist,
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${escape(process.execPath)}</string>
    <string>${escape(runner)}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>${escape([...new Set(path)].join(':'))}</string></dict>
  <key>WorkingDirectory</key><string>${escape(home)}</string>
  <key>StartCalendarInterval</key>
  <dict><key>Weekday</key><integer>1</integer><key>Hour</key><integer>9</integer><key>Minute</key><integer>0</integer></dict>
  <key>LowPriorityIO</key><true/>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>${escape(logFile)}</string>
  <key>StandardErrorPath</key><string>${escape(logFile)}</string>
</dict>
</plist>
`,
);
const result = launchctl('bootstrap', domain, plist);
if (result.status !== 0) throw new Error(`launchctl bootstrap failed: ${result.stderr}`);

const missing = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'EIA_API_KEY'].filter(
  (account) =>
    spawnSync('security', ['find-generic-password', '-s', 'electricity-map-deploy', '-a', account]).status !== 0,
);
console.log(`Installed ${label}: Mondays 09:00 (or on next wake), log ${logFile}`);
for (const account of missing)
  console.log(
    `Missing Keychain secret ${account}. Add it with:\n  security add-generic-password -U -s electricity-map-deploy -a ${account} -w`,
  );
