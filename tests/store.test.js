'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Store } = require('../src/store');
const { addEndpoint, removeEndpoint } = require('../src/registry');

function tmpDb() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'uptime-')), 'db.json');
}

test('store starts empty and round-trips endpoints', () => {
  const store = new Store(tmpDb());
  const endpoint = store.update((s) => addEndpoint(s, { url: 'https://example.com' }));
  const reloaded = store.load();
  assert.equal(reloaded.endpoints.length, 1);
  assert.equal(reloaded.endpoints[0].id, endpoint.id);
  assert.equal(reloaded.endpoints[0].url, 'https://example.com/');
});

test('store rejects duplicate URLs and non-http schemes', () => {
  const store = new Store(tmpDb());
  store.update((s) => addEndpoint(s, { url: 'https://example.com' }));
  assert.throws(() => store.update((s) => addEndpoint(s, { url: 'https://example.com' })), /already registered/);
  assert.throws(() => store.update((s) => addEndpoint(s, { url: 'ftp://example.com' })), /only http/);
});

test('remove deletes the endpoint and its checks', () => {
  const store = new Store(tmpDb());
  const endpoint = store.update((s) => addEndpoint(s, { url: 'https://example.com' }));
  store.update((s) => {
    s.checks.push({ endpointId: endpoint.id, timestamp: new Date().toISOString(), status: 'up' });
  });
  const removed = store.update((s) => removeEndpoint(s, endpoint.id));
  assert.equal(removed.id, endpoint.id);
  const state = store.load();
  assert.equal(state.endpoints.length, 0);
  assert.equal(state.checks.length, 0);
});

test('history is pruned to 500 checks per endpoint', () => {
  const store = new Store(tmpDb());
  const endpoint = store.update((s) => addEndpoint(s, { url: 'https://example.com' }));
  store.update((s) => {
    for (let i = 0; i < 505; i++) {
      s.checks.push({ endpointId: endpoint.id, timestamp: new Date().toISOString(), status: 'up', seq: i });
    }
  });
  const state = store.load();
  assert.equal(state.checks.length, 500);
  assert.equal(state.checks[0].seq, 5);
  assert.equal(state.checks[499].seq, 504);
});

test('corrupt database is reported, not silently emptied', () => {
  const db = tmpDb();
  fs.writeFileSync(db, '{not json', 'utf8');
  assert.throws(() => new Store(db).load());
});
