import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateDataset } from './eia.mjs';
import { validateMonthlyDataset } from './eia.mjs';
import { validateUtilities } from './utilities.mjs';
import { gzipSync } from 'node:zlib';

const root = fileURLToPath(new URL('../', import.meta.url));
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
};

export async function createApp({
  datasetPath = resolve(root, 'data/electricity.json'),
  staticRoot = resolve(root, 'dist'),
  contentSecurityPolicy,
} = {}) {
  const snapshot = await readFile(datasetPath);
  const dataset = JSON.parse(snapshot.toString());
  const periods = validateDataset(dataset);
  const extra = new Map();
  for (const [route, file, validate] of [
    ['/api/monthly', 'monthly.json', validateMonthlyDataset],
    ['/api/utilities', 'utilities.json', validateUtilities],
  ]) {
    try {
      const bytes = await readFile(resolve(root, 'data', file));
      const data = JSON.parse(bytes.toString());
      validate(data);
      extra.set(route, {
        bytes,
        gzip: gzipSync(bytes),
        fetchedAt: data.fetchedAt,
      });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (contentSecurityPolicy) response.setHeader('Content-Security-Policy', contentSecurityPolicy);
    const json = (status, body) => {
      response.writeHead(status, { 'Content-Type': mime['.json'] });
      response.end(JSON.stringify(body));
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.setHeader('Allow', 'GET, HEAD');
      return json(405, { error: 'Method not allowed' });
    }
    try {
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname === '/api/health')
        return json(200, {
          status: 'ok',
          latestQuarter: periods.at(-1),
          observations: dataset.rows.length,
          fetchedAt: dataset.fetchedAt,
        });
      if (url.pathname === '/api/electricity') {
        response.writeHead(200, {
          'Content-Type': mime['.json'],
          'Cache-Control': 'public, max-age=3600',
          'Last-Modified': new Date(dataset.fetchedAt).toUTCString(),
        });
        return response.end(request.method === 'HEAD' ? undefined : snapshot);
      }
      if (['/api/monthly', '/api/utilities'].includes(url.pathname)) {
        const data = extra.get(url.pathname);
        if (!data)
          return json(503, {
            error: 'This data snapshot has not been fetched yet.',
          });
        const compressed = (request.headers['accept-encoding'] ?? '').split(',').some((entry) => {
          const [encoding, ...parameters] = entry.trim().split(';');
          const quality = parameters.find((part) => part.trim().startsWith('q='));
          return (
            encoding.toLowerCase() === 'gzip' && (!quality || Number(quality.split('=')[1]) > 0)
          );
        });
        response.writeHead(200, {
          'Content-Type': mime['.json'],
          'Cache-Control': 'public, max-age=3600',
          'Last-Modified': new Date(data.fetchedAt).toUTCString(),
          Vary: 'Accept-Encoding',
          ...(compressed ? { 'Content-Encoding': 'gzip' } : {}),
        });
        return response.end(
          request.method === 'HEAD' ? undefined : compressed ? data.gzip : data.bytes,
        );
      }
      if (url.pathname.startsWith('/api/')) return json(404, { error: 'API route not found' });
      const pathname = decodeURIComponent(url.pathname);
      if (pathname.includes('\\') || pathname.includes('\0'))
        return json(403, { error: 'Forbidden' });
      const requested = resolve(staticRoot, `.${pathname}`);
      if (requested !== staticRoot && !requested.startsWith(`${staticRoot}${sep}`))
        return json(403, { error: 'Forbidden' });
      let file = requested;
      try {
        if (!(await stat(file)).isFile()) file = resolve(staticRoot, 'index.html');
      } catch {
        if (extname(pathname)) return json(404, { error: 'File not found' });
        file = resolve(staticRoot, 'index.html');
      }
      const bytes = await readFile(file);
      response.writeHead(200, {
        'Content-Type': mime[extname(file)] || 'application/octet-stream',
        'Cache-Control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600',
      });
      response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch (error) {
      json(error.code === 'ENOENT' ? 404 : error instanceof URIError ? 400 : 500, {
        error:
          error.code === 'ENOENT'
            ? 'Build the frontend with npm run build, or use npm run dev.'
            : 'Unable to serve this request',
      });
    }
  });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const server = await createApp();
  const port = Number(process.env.PORT || 3001);
  server.listen(port, process.env.HOST || '127.0.0.1', () =>
    console.log(`Electricity Map Node server: http://${process.env.HOST || '127.0.0.1'}:${port}`),
  );
  server.on('error', (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
