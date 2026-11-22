// Assemble a fully static Cloudflare Pages site from the Vite build and the bundled snapshots.
// The browser fetches the same /api/* routes that server/index.mjs serves; here they are
// static JSON files reached through _redirects rewrites, with headers set in _headers.
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDataset, validateMonthlyDataset } from '../server/eia.mjs';
import { validateUtilities } from '../server/utilities.mjs';
import { desktopCSP } from '../desktop/state.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = resolve(root, 'dist');
const output = resolve(root, process.env.PAGES_OUTPUT_DIR || 'dist-pages');
const siteURL = new URL(process.env.SITE_URL || 'https://map.cujuju.foo/');
const project = process.env.PAGES_PROJECT || 'electricity-map';

let index;
try {
  index = await readFile(resolve(source, 'index.html'), 'utf8');
} catch {
  throw new Error('dist/index.html is missing. Run npm run build first.');
}

const snapshots = [
  { route: '/api/electricity', file: 'electricity.json', validate: validateDataset },
  { route: '/api/monthly', file: 'monthly.json', validate: validateMonthlyDataset },
  { route: '/api/utilities', file: 'utilities.json', validate: validateUtilities },
];
const loaded = [];
for (const snapshot of snapshots) {
  const bytes = await readFile(resolve(root, 'data', snapshot.file));
  const data = JSON.parse(bytes.toString());
  const result = snapshot.validate(data);
  const fetchedAt = new Date(data.fetchedAt);
  if (Number.isNaN(fetchedAt.valueOf())) throw new Error(`${snapshot.file} has no fetchedAt`);
  loaded.push({ ...snapshot, bytes, data, result, fetchedAt });
}
const [quarterly] = loaded;

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, output, { recursive: true });
// Third-party license text stays reachable at /licenses/npm-renderer.txt, as in dist.

await writeFile(
  resolve(output, 'index.html'),
  index.replace(
    '</head>',
    `  <link rel="canonical" href="${siteURL.href}" />\n  </head>`,
  ),
);

await mkdir(resolve(output, 'api'), { recursive: true });
for (const snapshot of loaded)
  await writeFile(resolve(output, `.${snapshot.route}.json`), snapshot.bytes);
await writeFile(
  resolve(output, 'api/health.json'),
  JSON.stringify({
    status: 'ok',
    latestQuarter: quarterly.result.at(-1),
    observations: quarterly.data.rows.length,
    fetchedAt: quarterly.data.fetchedAt,
  }),
);

const rewrites = [...loaded.map((snapshot) => snapshot.route), '/api/health'];
await writeFile(
  resolve(output, '_redirects'),
  rewrites.map((route) => `${route} ${route}.json 200`).join('\n') + '\n',
);

const headers = [
  '/*',
  `  Content-Security-Policy: ${desktopCSP()}`,
  '  X-Content-Type-Options: nosniff',
  '  Referrer-Policy: strict-origin-when-cross-origin',
  '',
  '/assets/*',
  '  Cache-Control: public, max-age=31536000, immutable',
  '',
  '/api/*',
  '  Cache-Control: public, max-age=3600',
  '  Vary: Accept-Encoding',
  '',
  '/api/health',
  '  ! Cache-Control',
  '  Cache-Control: no-cache',
  '',
  ...loaded.flatMap((snapshot) => [
    snapshot.route,
    `  Last-Modified: ${snapshot.fetchedAt.toUTCString()}`,
    '',
  ]),
  // Keep search engines on the custom domain; preview and production *.pages.dev hosts stay usable.
  `https://:project.${project}.pages.dev/*`,
  '  X-Robots-Tag: noindex',
  '',
  `https://${project}.pages.dev/*`,
  '  X-Robots-Tag: noindex',
  '',
];
await writeFile(resolve(output, '_headers'), headers.join('\n'));

// Unknown /api/* paths get a JSON 404 from a tiny Function; everything else is static.
await writeFile(
  resolve(output, '_routes.json'),
  JSON.stringify({ version: 1, include: ['/api/*'], exclude: rewrites }, null, 2),
);

const size = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
for (const snapshot of loaded) {
  if (snapshot.bytes.length > 25 * 1024 * 1024)
    throw new Error(`${snapshot.file} exceeds the Cloudflare Pages 25 MiB file limit`);
  console.log(`${snapshot.route} ← data/${snapshot.file} (${size(snapshot.bytes.length)}, ${snapshot.data.fetchedAt})`);
}
console.log(`Cloudflare Pages site written to ${output} for ${siteURL.href}`);
