'use strict';

/** Uptime summaries over a window of check history. */
function summarize(state, { days = null } = {}) {
  const cutoff = days ? Date.now() - days * 24 * 60 * 60 * 1000 : 0;
  return state.endpoints.map((endpoint) => {
    const checks = state.checks.filter((c) => c.endpointId === endpoint.id
      && new Date(c.timestamp).getTime() >= cutoff);
    const up = checks.filter((c) => c.status === 'up').length;
    const latencies = checks.map((c) => c.latencyMs).filter(Number.isFinite);
    return {
      endpoint,
      total: checks.length,
      up,
      uptimePct: checks.length === 0 ? null
        : Math.round((up / checks.length) * 1000) / 10,
      avgLatencyMs: latencies.length === 0 ? null
        : Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
      lastCheck: checks.length === 0 ? null : checks[checks.length - 1],
    };
  });
}

function formatReport(rows) {
  const lines = [];
  for (const r of rows) {
    const uptime = r.uptimePct === null ? 'n/a' : `${r.uptimePct}%`;
    const latency = r.avgLatencyMs === null ? 'n/a' : `${r.avgLatencyMs}ms`;
    const last = r.lastCheck === null ? 'never'
      : `${r.lastCheck.status.toUpperCase()} @ ${r.lastCheck.timestamp}`;
    lines.push(`${r.endpoint.name}  uptime=${uptime}  avg=${latency}  checks=${r.total}  last=${last}`);
  }
  return lines.join('\n') + '\n';
}

function toCsv(checks) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = 'endpointId,timestamp,status,statusCode,latencyMs,error';
  const rows = checks.map((c) => [c.endpointId, c.timestamp, c.status,
    c.statusCode, c.latencyMs, c.error].map(esc).join(','));
  return [header, ...rows].join('\n') + '\n';
}

module.exports = { summarize, formatReport, toCsv };
