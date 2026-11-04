import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/index.mjs';

let server;
let base;
before(async () => {
  server = await createApp();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});
test('health endpoint reports snapshot provenance', async () => {
  const response = await fetch(`${base}/api/health`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, 'ok');
  assert.match(body.latestQuarter, /^\d{4}-Q[1-4]$/);
  assert.ok(body.observations >= 9568);
});
test('data endpoint returns the snapshot with cache headers and supports HEAD', async () => {
  const response = await fetch(`${base}/api/electricity`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(response.headers.get('last-modified'));
  assert.equal((await response.json()).schemaVersion, 1);
  const head = await fetch(`${base}/api/electricity`, { method: 'HEAD' });
  assert.equal(await head.text(), '');
});
test('unknown APIs and unsupported methods return explicit errors', async () => {
  assert.equal((await fetch(`${base}/api/missing`)).status, 404);
  const post = await fetch(`${base}/api/electricity`, { method: 'POST' });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('allow'), 'GET, HEAD');
});

test('monthly and utility APIs serve complete snapshots with gzip, provenance and HEAD', async () => {
  for (const [route, field, minimum] of [
    ['monthly', 'rows', 29120],
    ['utilities', 'records', 23879],
  ]) {
    const response = await fetch(`${base}/api/${route}`, {
      headers: { 'Accept-Encoding': 'gzip' },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-encoding'), 'gzip');
    assert.equal(response.headers.get('vary'), 'Accept-Encoding');
    assert.ok(response.headers.get('last-modified'));
    assert.equal(response.headers.get('cache-control'), 'public, max-age=3600');
    const body = await response.json();
    assert.equal(body.schemaVersion, 1);
    assert.ok(body[field].length >= minimum);
    const head = await fetch(`${base}/api/${route}`, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    const plain = await fetch(`${base}/api/${route}`, {
      headers: { 'Accept-Encoding': 'gzip;q=0, identity' },
    });
    assert.equal(plain.headers.get('content-encoding'), null);
    await plain.arrayBuffer();
  }
});
test('encoded Windows traversal is blocked and malformed paths are handled', async () => {
  assert.equal((await fetch(`${base}/%2e%2e%5cpackage.json`)).status, 403);
  assert.equal((await fetch(`${base}/%E0%A4%A`)).status, 400);
});
