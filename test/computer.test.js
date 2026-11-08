'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const { createApp } = require('../server/app');
const { createRunClient } = require('../server/run-client');

const config = { port: 0, host: '127.0.0.1', baseUrl: 'http://computer.test', networkUrl: 'https://openvibe.network', runUrl: 'https://openvibe.run', browserFreeMinutes: null, desktopFreeMinutes: null, pricePerMinute: null };
function fakeSso() {
    return {
        router: () => express.Router(),
        optionalAuth: () => (req, _res, next) => { if ((req.headers.cookie || '').includes('ov_token=person-a')) req.user = { kind: 'user', sub: 'usr_a', displayName: 'Person A' }; next(); },
        extractToken: (req) => { const auth = req.headers.authorization || ''; if (auth.startsWith('Bearer ')) return auth.slice(7); const m = (req.headers.cookie || '').match(/(?:^|;\s*)ov_token=([^;]+)/); return m && m[1] || null; },
    };
}
async function serve(opts) {
    const { app } = createApp({ config, sso: fakeSso(), ...opts });
    const server = http.createServer(app); await new Promise((r) => server.listen(0, '127.0.0.1', r));
    return { base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) };
}

test('home renders signed out and signed in; sign-in and computer controls are visible', async (t) => {
    const calls = [];
    const run = { list: async (token) => { calls.push(['list', token]); return { sessions: [{ id: 'ses_a', kind: 'browser', state: 'running', usage: { desk_seconds: 12 } }] }; }, get: async (token, id) => { calls.push(['get', token, id]); return { id, kind: 'browser', state: 'running', usage: { desk_seconds: 12 } }; }, stop: async () => ({}) };
    const s = await serve({ run }); t.after(s.close);
    const guest = await fetch(s.base); assert.equal(guest.status, 200); assert.match(await guest.text(), /Sign in with OpenVibe/);
    const home = await fetch(s.base, { headers: { cookie: 'ov_token=person-a' } }); const html = await home.text();
    assert.match(html, /Your computers/); assert.match(html, /Browser/); assert.match(html, /20 hours of cloud browser a month \(proposed\)/); assert.match(html, /Coming as Run adds them/); assert.doesNotMatch(html, /hero-art|account-line/);
    const detail = await fetch(`${s.base}/computers/ses_a`, { headers: { cookie: 'ov_token=person-a' } }); const page = await detail.text();
    for (const mode of ['You drive, your AI watches', 'Your AI drives, you watch', 'Your AI drives and asks first', 'Together', 'Guests watch', 'Paused']) assert.match(page, new RegExp(mode));
    assert.match(page, /Take over/); assert.equal(calls[0][1], 'person-a'); assert.deepEqual(calls[1], ['get', 'person-a', 'ses_a']);
    for (const path of ['/templates', '/pricing', '/docs', '/updates']) { const r = await fetch(`${s.base}${path}`); assert.equal(r.status, 200, `${path} renders signed out`); }
    for (const path of ['/templates', '/pricing', '/docs', '/updates']) { const r = await fetch(`${s.base}${path}`, { headers: { cookie: 'ov_token=person-a' } }); assert.equal(r.status, 200, `${path} renders signed in`); }
    assert.equal((await fetch(`${s.base}/openapi.json`)).status, 200); assert.equal((await fetch(`${s.base}/.well-known/agent.json`)).status, 200); assert.equal((await fetch(`${s.base}/llms.txt`)).status, 200);
});

test('facade forwards only the presented person token to Run', async (t) => {
    const received = [];
    const run = { list: async (token) => { received.push(token); return { sessions: [] }; }, create: async (token, body) => { received.push(token); return { id: 'ses_new', ...body }; } };
    const s = await serve({ run }); t.after(s.close);
    assert.equal((await fetch(`${s.base}/api/v1/computers`)).status, 401);
    const list = await fetch(`${s.base}/api/v1/computers`, { headers: { authorization: 'Bearer user-token-A' } }); assert.equal(list.status, 200);
    const create = await fetch(`${s.base}/api/v1/computers`, { method: 'POST', headers: { authorization: 'Bearer user-token-B', 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'browser' }) }); assert.equal(create.status, 201);
    assert.deepEqual(received, ['user-token-A', 'user-token-B']);
});

test('starting from the home page is a signed-in POST to Run', async (t) => {
    const calls = []; const run = { create: async (token, body) => { calls.push([token, body]); return { id: 'ses_started' }; } };
    const s = await serve({ run }); t.after(s.close);
    const guest = await fetch(`${s.base}/start`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'kind=browser', redirect: 'manual' });
    assert.equal(guest.status, 303); assert.match(guest.headers.get('location'), /auth\/login/); assert.equal(calls.length, 0);
    const signed = await fetch(`${s.base}/start`, { method: 'POST', headers: { cookie: 'ov_token=person-a', 'content-type': 'application/x-www-form-urlencoded' }, body: 'kind=browser', redirect: 'manual' });
    assert.equal(signed.status, 303); assert.equal(signed.headers.get('location'), '/computers/ses_started');
    assert.equal(calls[0][0], 'person-a'); assert.equal(calls[0][1].kind, 'browser'); assert.match(calls[0][1].idempotency_key, /^computer:/);
});

test('screen, act and stop map to Run; handoff reports unsupported Run capability', async (t) => {
    const calls = []; const run = { command: async (token, id, body) => { calls.push([token, id, body]); return { result: { outcome: 'ack' } }; }, stop: async (token, id) => { calls.push([token, id, 'stop']); return { state: 'ended' }; }, get: async (token, id) => { calls.push([token, id, 'get']); return { id, state: 'running' }; } };
    const s = await serve({ run }); t.after(s.close); const headers = { authorization: 'Bearer user-token-A', 'content-type': 'application/json' };
    assert.equal((await fetch(`${s.base}/api/v1/computers/ses_a/screenshot`, { method: 'POST', headers, body: '{}' })).status, 200);
    assert.equal((await fetch(`${s.base}/api/v1/computers/ses_a/act`, { method: 'POST', headers, body: JSON.stringify({ kind: 'browser', value: { action: 'read' } }) })).status, 200);
    assert.equal((await fetch(`${s.base}/api/v1/computers/ses_a/stop`, { method: 'POST', headers, body: '{}' })).status, 200);
    const handoff = await fetch(`${s.base}/api/v1/computers/ses_a/handoff`, { method: 'POST', headers, body: '{}' }); assert.equal(handoff.status, 501);
    assert.equal(calls[0][2].kind, 'screen'); assert.equal(calls[1][2].kind, 'browser'); assert.deepEqual(calls[2], ['user-token-A', 'ses_a', 'stop']); assert.deepEqual(calls[3], ['user-token-A', 'ses_a', 'get']);
});

test('Run client sends the original bearer token on each upstream request', async () => {
    const seen = []; const client = createRunClient({ baseUrl: 'https://run.example', fetchImpl: async (url, options) => { seen.push([url, options.headers.authorization, options.method]); return { ok: true, json: async () => ({ sessions: [] }) }; } });
    await client.list('one-token'); await client.get('another-token', 'ses_abc');
    assert.deepEqual(seen, [['https://run.example/api/v1/sessions', 'Bearer one-token', 'GET'], ['https://run.example/api/v1/sessions/ses_abc', 'Bearer another-token', 'GET']]);
});
