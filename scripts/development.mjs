import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createApp } from '../server/index.mjs';
import { desktopCSP } from '../desktop/state.mjs';

// Keep Vite under plain Node: its child workers must not inherit Electron as their runtime.
export async function startDevelopment() {
  const csp = desktopCSP(true);
  const api = await createApp({ contentSecurityPolicy: csp });
  let vite;
  async function close() {
    vite?.httpServer?.closeAllConnections();
    await vite?.close();
    if (api.listening) {
      api.closeAllConnections();
      await new Promise((resolve) => api.close(resolve));
    }
  }
  try {
    await new Promise((resolve, reject) => {
      api.once('error', reject);
      api.listen(0, '127.0.0.1', resolve);
    });
    const target = `http://127.0.0.1:${api.address().port}`;
    vite = await createServer({
      root: fileURLToPath(new URL('../', import.meta.url)),
      server: { proxy: { '/api': target } },
      plugins: [
        {
          name: 'electricity-desktop-csp',
          configureServer(server) {
            server.middlewares.use((_request, response, next) => {
              response.setHeader('Content-Security-Policy', csp);
              next();
            });
          },
        },
      ],
    });
    await vite.listen();
    vite.printUrls();
    return { origin: vite.resolvedUrls.local[0].replace(/\/$/, ''), close };
  } catch (error) {
    await close();
    throw error;
  }
}
