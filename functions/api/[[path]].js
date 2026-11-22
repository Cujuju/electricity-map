// Cloudflare Pages Function for /api/* paths that are not static snapshots.
// _routes.json excludes /api/electricity, /api/monthly, /api/utilities and /api/health,
// so this only answers unknown API routes, matching server/index.mjs.
export function onRequest({ request }) {
  const allowed = request.method === 'GET' || request.method === 'HEAD';
  return new Response(
    JSON.stringify({ error: allowed ? 'API route not found' : 'Method not allowed' }),
    {
      status: allowed ? 404 : 405,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        ...(allowed ? {} : { Allow: 'GET, HEAD' }),
      },
    },
  );
}
