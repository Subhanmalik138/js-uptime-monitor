'use strict';

/**
 * HTTP checker: one request per endpoint, with a hard timeout and a
 * measured latency. A check is "up" when the endpoint answers within its
 * timeout and the status matches `--expect` when one was set, or is any
 * 2xx/3xx otherwise. Timeouts, DNS failures, and connection errors are
 * "down" and record the error message instead of a status code.
 */
const http = require('node:http');
const https = require('node:https');
const { performance } = require('node:perf_hooks');

function checkEndpoint(endpoint) {
  return new Promise((resolve) => {
    const started = performance.now();
    const finish = (result) => {
      resolve({
        endpointId: endpoint.id,
        timestamp: new Date().toISOString(),
        latencyMs: Math.round(performance.now() - started),
        ...result,
      });
    };

    let url;
    try {
      url = new URL(endpoint.url);
    } catch (err) {
      finish({ status: 'down', statusCode: null, error: `invalid URL: ${err.message}` });
      return;
    }

    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.get(url, { timeout: endpoint.timeoutMs }, (res) => {
      // Drain the body so the socket can be reused/closed cleanly.
      res.resume();
      res.on('end', () => {
        const ok = endpoint.expectedStatus
          ? res.statusCode === endpoint.expectedStatus
          : res.statusCode >= 200 && res.statusCode < 400;
        finish({
          status: ok ? 'up' : 'down',
          statusCode: res.statusCode,
          error: ok ? null : `unexpected status ${res.statusCode}`,
        });
      });
    });

    let settled = false;
    const fail = (err) => {
      if (settled) return;
      settled = true;
      req.destroy();
      finish({ status: 'down', statusCode: null, error: err.message });
    };
    req.on('timeout', () => fail(new Error(`timed out after ${endpoint.timeoutMs}ms`)));
    req.on('error', fail);
  });
}

// Small worker pool: run checks concurrently but bounded, so monitoring
// many endpoints does not open all sockets at the same instant.
async function checkAll(endpoints, concurrency = 5) {
  const results = new Array(endpoints.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, endpoints.length || 1)) },
    async () => {
      while (next < endpoints.length) {
        const i = next++;
        results[i] = await checkEndpoint(endpoints[i]);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

module.exports = { checkEndpoint, checkAll };
