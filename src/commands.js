'use strict';

// Command registry. Each stage adds its commands here.
const { parseFlags, parseIntFlag } = require('./flags');
const { addEndpoint, removeEndpoint, resolveEndpoint } = require('./registry');

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

module.exports = { add, remove, list };
