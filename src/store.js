'use strict';

/**
 * Atomic JSON store for endpoints and check history.
 *
 * The whole state lives in one file so the tool stays dependency-free and
 * trivially portable: copy the file, keep your history. Writes go to a
 * temporary sibling file and are renamed into place, so a crash mid-write
 * can never leave a half-written database behind.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const MAX_CHECKS_PER_ENDPOINT = 500;

function defaultDbPath() {
  return process.env.UPTIME_MONITOR_DB
    || path.join(os.homedir(), '.uptime-monitor.json');
}

function emptyState() {
  return { version: 1, endpoints: [], checks: [] };
}

class Store {
  constructor(dbPath = defaultDbPath()) {
    this.dbPath = dbPath;
  }

  load() {
    try {
      const raw = fs.readFileSync(this.dbPath, 'utf8');
      const state = JSON.parse(raw);
      if (!state || typeof state !== 'object'
        || !Array.isArray(state.endpoints) || !Array.isArray(state.checks)) {
        throw new Error('invalid database format');
      }
      return state;
    } catch (err) {
      if (err.code === 'ENOENT') return emptyState();
      throw err;
    }
  }

  save(state) {
    const dir = path.dirname(this.dbPath);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${this.dbPath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(tmp, this.dbPath);
  }

  /** Run a mutation against the loaded state and persist it. */
  update(fn) {
    const state = this.load();
    const result = fn(state);
    this.prune(state);
    this.save(state);
    return result;
  }

  // Keep history bounded: a monitor that runs for months must not grow
  // its database without limit. Oldest checks per endpoint are dropped.
  prune(state) {
    const counts = new Map();
    const kept = [];
    for (let i = state.checks.length - 1; i >= 0; i--) {
      const check = state.checks[i];
      const n = counts.get(check.endpointId) || 0;
      if (n < MAX_CHECKS_PER_ENDPOINT) {
        counts.set(check.endpointId, n + 1);
        kept.push(check);
      }
    }
    state.checks = kept.reverse();
  }
}

module.exports = { Store, defaultDbPath, emptyState, MAX_CHECKS_PER_ENDPOINT };
