'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createApp } = require('../server/app');
const config = { port: 0, host: '127.0.0.1', baseUrl: 'http://computer.test', networkUrl: 'https://openvibe.network', runUrl: 'https://openvibe.run', trustProxy: false };
const sso = { router: () => (_q, _r, next) => next(), optionalAuth: () => (_q, _r, next) => next(), requireAuth: () => (_q, r) => r.status(401).end() };

// /metrics (2026-11-16, Report's stats for every site): Prometheus on the host reads it over loopback. It carries the
// release, the HTTP counts and the process's own numbers; a request a proxy relayed is turned away as if it were absent.
async function checkMetrics(base, service) {
    assert.equal((await fetch(base + '/api/health')).status, 200);
    const r = await fetch(base + '/metrics');
    assert.equal(r.status, 200, 'loopback reads /metrics');
    assert.equal(r.headers.get('cache-control'), 'no-store');
    const text = await r.text();
    assert.match(text, new RegExp(`release_info\\{service="${service}",release="[^"]+"\\} 1`), 'the release it runs');
    assert.match(text, /http_requests_total\{[^}]*route="\/api\/health"/, 'the request just made is counted');
    assert.match(text, /nodejs_eventloop_lag_seconds/, 'the event loop lag (stalls look like a slow database)');
    for (const h of [{ 'X-Forwarded-For': '203.0.113.9' }, { 'CF-Connecting-IP': '203.0.113.9' }, { Forwarded: 'for=203.0.113.9' }]) {
        assert.equal((await fetch(base + '/metrics', { headers: h })).status, 404, `relayed (${Object.keys(h)[0]}) is not served`);
    }
}

test('GET /metrics: the release, HTTP counts and process numbers, to loopback only', async (t) => {
    const { app } = createApp({ config, sso, run: {} });
    const server = http.createServer(app); await new Promise((r) => server.listen(0, '127.0.0.1', r)); t.after(() => new Promise((r) => server.close(r)));
    await checkMetrics(`http://127.0.0.1:${server.address().port}`, 'computer');
});
