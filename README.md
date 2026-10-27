# uptime-monitor

A zero-dependency CLI uptime monitor for Node.js. Register the endpoints you
care about, run checks on demand or on a loop, and get uptime percentages,
average latency, and a persistent check history — all stored in a single
atomic JSON file you can copy, back up, or inspect by hand.

## Why this exists

Hosted uptime tools are great until you want a quick check of a handful of
internal services from your own machine, with no account and no dashboard.
This tool does that one job: it pings your endpoints, records what happened,
and tells you, honestly, how often they were actually up.

## Install

Requires Node.js 18 or later. No dependencies to install.

```sh
git clone https://github.com/Subhanmalik138/js-uptime-monitor.git
cd js-uptime-monitor
```

## Usage

```sh
node src/cli.js add https://example.com --name "Example" --expect 200
node src/cli.js list
node src/cli.js check
node src/cli.js report
node src/cli.js watch --interval 60
node src/cli.js history <id-or-url>
node src/cli.js export --format csv --out checks.csv
```

Use `--db <path>` (or `$UPTIME_MONITOR_DB`) to point the tool at a different
database file. The default is `~/.uptime-monitor.json`.

## Design decisions

1. **One JSON file, atomically written.** State is a single document written
   via temp-file + rename, so a crash can never corrupt the database — and
   the whole history is portable and human-readable.
2. **Bounded history.** At most 500 checks per endpoint are kept, so a monitor
   running for months does not grow its database without limit.
3. **Zero dependencies.** Only Node's standard library, so there is nothing
   to install, audit, or break on upgrade.
4. **Concurrency-limited checks.** Parallel checks run through a small worker
   pool instead of firing all at once, so monitoring 50 endpoints does not
   open 50 sockets at the same instant.

## Commands

| Command | What it does |
| --- | --- |
| `add <url>` | Register an endpoint (`--name`, `--expect`, `--timeout`) |
| `remove <id-or-url>` | Remove an endpoint and its history |
| `list` | Show registered endpoints |
| `check` | Run one check round over all endpoints |
| `history <id-or-url>` | Show recent checks for one endpoint |
| `report` | Uptime %, average latency, and last status per endpoint |
| `watch` | Repeat `check` every N seconds until interrupted |
| `export` | Dump check history as JSON or CSV |

An endpoint counts as **up** when it answers within its timeout and its
status matches `--expect` (default: any 2xx/3xx response). Timeouts, DNS
failures, and connection errors count as **down** and record the error.

## Tests

```sh
npm test
```

Tests use Node's built-in test runner against local HTTP servers — no
network access and no external services required.

## Tech stack

- Node.js 18+ (standard library only: `http`, `https`, `fs`)
- Node's built-in `node:test` runner

## License

MIT — see [LICENSE](LICENSE).
