import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { resolveRequest, createServer } from '../scripts/preview.mjs';

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-'));
const dist = path.join(base, 'dist');
const sibling = path.join(base, 'dist-secret');
fs.mkdirSync(path.join(dist, 'matrix'), { recursive: true });
fs.mkdirSync(sibling);
fs.writeFileSync(path.join(dist, 'index.html'), 'home');
fs.writeFileSync(path.join(dist, '404.html'), 'missing');
fs.writeFileSync(path.join(dist, 'matrix', 'index.html'), 'matrix');
fs.writeFileSync(path.join(sibling, 'secret.txt'), 'secret');
test.after(() => fs.rmSync(base, { recursive: true, force: true }));

test('preview serves files and directory indexes inside dist', () => {
  assert.deepEqual(resolveRequest(dist, '/'), { status: 200, file: path.join(dist, 'index.html') });
  assert.deepEqual(resolveRequest(dist, '/matrix/'), { status: 200, file: path.join(dist, 'matrix', 'index.html') });
  assert.deepEqual(resolveRequest(dist, '/matrix/?x=1'), { status: 200, file: path.join(dist, 'matrix', 'index.html') });
  assert.equal(resolveRequest(dist, '/nope').status, 404);
});

test('preview answers 400 for a malformed percent escape or a NUL byte instead of crashing', () => {
  assert.equal(resolveRequest(dist, '/%E0%A4%A').status, 400);
  assert.equal(resolveRequest(dist, '/%').status, 400);
  assert.equal(resolveRequest(dist, '/a%00b').status, 400);
});

test('preview refuses paths outside dist, including a sibling folder that shares the prefix', () => {
  // An encoded slash survives URL normalisation, so these reach the path check and are refused.
  assert.equal(resolveRequest(dist, '/..%2fdist-secret/secret.txt').status, 403);
  assert.equal(resolveRequest(dist, '/..%2f..%2fetc/passwd').status, 403);
  assert.equal(resolveRequest(dist, '/%2e%2e%2fdist-secret/secret.txt').status, 403);
  assert.equal(resolveRequest(dist, '/sub/..%5c..%5cdist-secret/secret.txt').status, process.platform === 'win32' ? 403 : 404);
  // Plain dot segments are collapsed by the URL parser first and stay inside dist, so the sibling is not reachable.
  assert.equal(resolveRequest(dist, '/../dist-secret/secret.txt').status, 404);
  assert.equal(resolveRequest(dist, '/../../etc/passwd').status, 404);
  // The old check was file.startsWith(dist): a path in "dist-secret" would have passed it.
  assert.ok(path.join(sibling, 'secret.txt').startsWith(dist));
});

test('preview server returns the status codes over HTTP', async () => {
  const server = createServer(dist);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  const get = (p) => new Promise((resolve, reject) => {
    // Raw request so the client does not normalise the path.
    const req = http.request({ host: '127.0.0.1', port, path: p, method: 'GET' }, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
  });
  try {
    assert.equal((await get('/')).body, 'home');
    assert.equal((await get('/%E0%A4%A')).status, 400);
    assert.equal((await get('/..%2fdist-secret/secret.txt')).status, 403);
    const nf = await get('/missing');
    assert.equal(nf.status, 404);
    assert.equal(nf.body, 'missing');
  } finally {
    await new Promise((r) => server.close(r));
  }
});
