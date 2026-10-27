'use strict';

// Shared flag parsing for commands: `--key value` pairs plus positionals.
function parseFlags(args, defaults = {}) {
  const flags = { ...defaults };
  const positionals = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        flags[key] = args[++i];
      } else {
        flags[key] = true;
      }
    } else {
      positionals.push(arg);
    }
  }
  return { flags, positionals };
}

function parseIntFlag(value, name, fallback) {
  if (value === undefined) return fallback;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`--${name} must be a positive integer`);
  return n;
}

module.exports = { parseFlags, parseIntFlag };
