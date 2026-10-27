#!/usr/bin/env node
'use strict';

const { Store } = require('./store');

const VERSION = '1.0.0';

function usage() {
  return `uptime-monitor ${VERSION} — track endpoints, measure latency, report uptime.

Usage: uptime-monitor [--db <path>] <command> [options]

Commands:
  add <url> [--name <name>] [--expect <status>] [--timeout <ms>]
  remove <id-or-url>
  list
  check [--concurrency <n>]
  history <id-or-url> [--limit <n>]
  report [--days <n>]
  watch [--interval <seconds>] [--concurrency <n>]
  export [--format json|csv] [--out <path>]

Options:
  --db <path>   database file (default: ~/.uptime-monitor.json,
                or $UPTIME_MONITOR_DB)
`;
}

function parseGlobal(argv) {
  const args = [...argv];
  let dbPath;
  const rest = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--db' && i + 1 < args.length) {
      dbPath = args[++i];
    } else {
      rest.push(args[i]);
    }
  }
  return { dbPath, rest };
}

function main(argv) {
  const { dbPath, rest } = parseGlobal(argv);
  const [command, ...args] = rest;
  const store = new Store(dbPath);

  if (!command || command === '--help' || command === '-h') {
    process.stdout.write(usage());
    return 0;
  }
  if (command === '--version' || command === '-v') {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }

  // Commands are implemented in later stages; the dispatcher below is
  // filled in by the registry, checker, and reporting modules.
  const commands = require('./commands');
  const handler = commands[command];
  if (!handler) {
    process.stderr.write(`Unknown command: ${command}\n\n${usage()}`);
    return 1;
  }
  return handler(store, args);
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { main, usage };
