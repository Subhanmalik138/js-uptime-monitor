'use strict';

/** Endpoint registry: validation, lookup, add/remove against store state. */
const crypto = require('node:crypto');

function validateUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`invalid URL: ${raw}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`only http(s) URLs are supported: ${raw}`);
  }
  return url.toString();
}

function newId() {
  return `${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
}

function addEndpoint(state, { url, name, expectedStatus, timeoutMs }) {
  const cleanUrl = validateUrl(url);
  if (state.endpoints.some((e) => e.url === cleanUrl)) {
    throw new Error(`endpoint already registered: ${cleanUrl}`);
  }
  const endpoint = {
    id: newId(),
    name: name || cleanUrl,
    url: cleanUrl,
    expectedStatus: expectedStatus ?? null,
    timeoutMs: timeoutMs ?? 5000,
    createdAt: new Date().toISOString(),
  };
  state.endpoints.push(endpoint);
  return endpoint;
}

function resolveEndpoint(state, idOrUrl) {
  return state.endpoints.find((e) => e.id === idOrUrl
    || e.url === idOrUrl || e.name === idOrUrl);
}

function removeEndpoint(state, idOrUrl) {
  const endpoint = resolveEndpoint(state, idOrUrl);
  if (!endpoint) return null;
  state.endpoints = state.endpoints.filter((e) => e.id !== endpoint.id);
  state.checks = state.checks.filter((c) => c.endpointId !== endpoint.id);
  return endpoint;
}

module.exports = { validateUrl, newId, addEndpoint, resolveEndpoint, removeEndpoint };
