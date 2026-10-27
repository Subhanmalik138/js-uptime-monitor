'use strict';

// Command registry. Each stage adds its commands here.
const { parseFlags, parseIntFlag } = require('./flags');
const { addEndpoint, removeEndpoint, resolveEndpoint } = require('./registry');
const { checkAll } = require('./checker');
const { summarize, formatReport, toCsv } = require('./report');
const fs = require('node:fs');

function add(store, args) {
  const { flags, positionals } = parseFlags(args);
  const url = positionals[0];
  if (!url) throw new Error('usage: add <url> [--name <name>] [--expect <status>] [--timeout <ms>]');
  const endpoint = store.update((state) => addEndpoint(state, {
    url,
    name: flags.name,
    expectedStatus: flags.expect === undefined ? null : parseIntFlag(flags.expect, 'expect', null),
    timeoutMs: parseIntFlag(flags.timeout, 'timeout', 5000),
  }));
  process.stdout.write(`Added ${endpoint.name} (${endpoint.url}) [${endpoint.id}]\n`);
  return 0;
}

function remove(store, args) {
  const { positionals } = parseFlags(args);
  const target = positionals[0];
  if (!target) throw new Error('usage: remove <id-or-url>');
  const endpoint = store.update((state) => removeEndpoint(state, target));
  if (!endpoint) {
    process.stderr.write(`No such endpoint: ${target}\n`);
    return 1;
  }
  process.stdout.write(`Removed ${endpoint.name} (${endpoint.url})\n`);
  return 0;
}

function list(store) {
  const state = store.load();
  if (state.endpoints.length === 0) {
    process.stdout.write('No endpoints registered. Use `add <url>` first.\n');
    return 0;
  }
  for (const e of state.endpoints) {
    const expect = e.expectedStatus ? ` expect=${e.expectedStatus}` : '';
    process.stdout.write(`${e.id}  ${e.name}  ${e.url}  timeout=${e.timeoutMs}ms${expect}\n`);
  }
  return 0;
}

async function check(store, args) {
  const { flags } = parseFlags(args);
  const concurrency = parseIntFlag(flags.concurrency, 'concurrency', 5);
  const state = store.load();
  if (state.endpoints.length === 0) {
    process.stdout.write('No endpoints registered. Use `add <url>` first.\n');
    return 0;
  }
  const results = await checkAll(state.endpoints, concurrency);
  store.update((s) => { s.checks.push(...results); });
  const byId = new Map(state.endpoints.map((e) => [e.id, e]));
  for (const r of results) {
    const e = byId.get(r.endpointId);
    const detail = r.statusCode ? `HTTP ${r.statusCode}` : r.error;
    process.stdout.write(`${r.status.toUpperCase().padEnd(4)} ${e.name} ${r.latencyMs}ms ${detail}\n`);
  }
  return 0;
}

function history(store, args) {
  const { flags, positionals } = parseFlags(args);
  const target = positionals[0];
  if (!target) throw new Error('usage: history <id-or-url> [--limit <n>]');
  const limit = parseIntFlag(flags.limit, 'limit', 20);
  const state = store.load();
  const endpoint = resolveEndpoint(state, target);
  if (!endpoint) {
    process.stderr.write(`No such endpoint: ${target}\n`);
    return 1;
  }
  const rows = state.checks
    .filter((c) => c.endpointId === endpoint.id)
    .slice(-limit);
  if (rows.length === 0) {
    process.stdout.write(`No checks recorded for ${endpoint.name} yet. Run \`check\` first.\n`);
    return 0;
  }
  for (const c of rows) {
    const detail = c.statusCode ? `HTTP ${c.statusCode}` : c.error;
    process.stdout.write(`${c.timestamp} ${c.status.toUpperCase().padEnd(4)} ${c.latencyMs}ms ${detail}\n`);
  }
  return 0;
}

function report(store, args) {
  const { flags } = parseFlags(args);
  const days = flags.days === undefined ? null : parseIntFlag(flags.days, 'days', null);
  const rows = summarize(store.load(), { days });
  if (rows.length === 0) {
    process.stdout.write('No endpoints registered. Use `add <url>` first.\n');
    return 0;
  }
  process.stdout.write(formatReport(rows));
  return 0;
}

async function watch(store, args) {
  const { flags } = parseFlags(args);
  const interval = parseIntFlag(flags.interval, 'interval', 60);
  const concurrency = parseIntFlag(flags.concurrency, 'concurrency', 5);
  process.stdout.write(`Watching every ${interval}s (Ctrl+C to stop)...\n`);
  for (;;) {
    const state = store.load();
    if (state.endpoints.length === 0) {
      process.stdout.write('No endpoints registered. Use `add <url>` first.\n');
      return 0;
    }
    const results = await checkAll(state.endpoints, concurrency);
    store.update((s) => { s.checks.push(...results); });
    const up = results.filter((r) => r.status === 'up').length;
    process.stdout.write(`[${new Date().toISOString()}] ${up}/${results.length} up\n`);
    await new Promise((resolve) => { setTimeout(resolve, interval * 1000); });
  }
}

function exportHistory(store, args) {
  const { flags } = parseFlags(args);
  const format = flags.format || 'json';
  if (format !== 'json' && format !== 'csv') {
    throw new Error('usage: export [--format json|csv] [--out <path>]');
  }
  const state = store.load();
  const out = format === 'json'
    ? JSON.stringify(state.checks, null, 2) + '\n'
    : toCsv(state.checks);
  if (flags.out) {
    fs.writeFileSync(flags.out, out, 'utf8');
    process.stdout.write(`Wrote ${state.checks.length} checks to ${flags.out}\n`);
  } else {
    process.stdout.write(out);
  }
  return 0;
}

module.exports = { add, remove, list, check, history, report, watch, export: exportHistory };
