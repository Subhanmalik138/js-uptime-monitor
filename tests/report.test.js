'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { summarize, toCsv } = require('../src/report');

function check(endpointId, status, daysAgo = 0) {
  const ts = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  return { endpointId, timestamp: ts, status, statusCode: 200, latencyMs: 100, error: null };
}

test('report computes uptime percentage and average latency', () => {
  const state = {
    endpoints: [{ id: 'a', name: 'A', url: 'https://a.example' }],
    checks: [check('a', 'up'), check('a', 'up'), check('a', 'down'), check('a', 'up')],
  };
  const [row] = summarize(state);
  assert.equal(row.total, 4);
  assert.equal(row.up, 3);
  assert.equal(row.uptimePct, 75);
  assert.equal(row.avgLatencyMs, 100);
});

test('report with no checks shows nulls, not zeros', () => {
  const state = { endpoints: [{ id: 'a', name: 'A', url: 'https://a.example' }], checks: [] };
  const [row] = summarize(state);
  assert.equal(row.uptimePct, null);
  assert.equal(row.avgLatencyMs, null);
  assert.equal(row.lastCheck, null);
});

test('day window excludes older checks', () => {
  const state = {
    endpoints: [{ id: 'a', name: 'A', url: 'https://a.example' }],
    checks: [check('a', 'down', 10), check('a', 'up', 0)],
  };
  const [row] = summarize(state, { days: 7 });
  assert.equal(row.total, 1);
  assert.equal(row.uptimePct, 100);
});

test('CSV escapes commas and quotes in error messages', () => {
  const csv = toCsv([{ endpointId: 'a', timestamp: 't', status: 'down', statusCode: null, latencyMs: 5, error: 'bad, "quoted"' }]);
  assert.match(csv, /"bad, ""quoted"""/);
});
