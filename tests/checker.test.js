'use strict';

const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const http = require('node:http');
const { checkEndpoint, checkAll } = require('../src/checker');

let server;
let base;

before(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/slow') {
      setTimeout(() => { res.writeHead(200); res.end('ok'); }, 300);
    } else if (req.url === '/err') {
      res.writeHead(500); res.end('boom');
    } else {
      res.writeHead(200); res.end('ok');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('200 response is up', async () => {
  const r = await checkEndpoint({ id: 'a', url: `${base}/`, expectedStatus: null, timeoutMs: 2000 });
  assert.equal(r.status, 'up');
  assert.equal(r.statusCode, 200);
  assert.equal(typeof r.latencyMs, 'number');
});

test('unexpected status is down when --expect is set', async () => {
  const r = await checkEndpoint({ id: 'a', url: `${base}/err`, expectedStatus: 200, timeoutMs: 2000 });
  assert.equal(r.status, 'down');
  assert.equal(r.statusCode, 500);
});

test('timeout is down with an error message', async () => {
  const r = await checkEndpoint({ id: 'a', url: `${base}/slow`, expectedStatus: null, timeoutMs: 50 });
  assert.equal(r.status, 'down');
  assert.match(r.error, /timed out/);
});

test('connection refused is down, not a crash', async () => {
  const r = await checkEndpoint({ id: 'a', url: 'http://127.0.0.1:1/', expectedStatus: null, timeoutMs: 2000 });
  assert.equal(r.status, 'down');
  assert.equal(r.statusCode, null);
});

test('checkAll returns one result per endpoint', async () => {
  const endpoints = [
    { id: 'a', url: `${base}/`, expectedStatus: null, timeoutMs: 2000 },
    { id: 'b', url: `${base}/err`, expectedStatus: null, timeoutMs: 2000 },
  ];
  const results = await checkAll(endpoints, 2);
  assert.equal(results.length, 2);
  assert.deepEqual(results.map((r) => r.endpointId), ['a', 'b']);
});
