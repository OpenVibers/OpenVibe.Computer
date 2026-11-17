'use strict';
// Machines are Computer's (plan §AD.15; the owner, 11-16: "that should be part of openvibe.computer, not openvibe.bot").
// Computer is their front door: /api/v1/machines answers as the person from the registry (Bot holds it until the move),
// the home lists them, and an outage of the registry never takes the page down.
//   node --test test/machines.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const { createApp } = require('../server/app');
const { createMachinesClient } = require('../server/machines-client');

const config = { port: 0, host: '127.0.0.1', baseUrl: 'http://computer.test', networkUrl: 'https://openvibe.network', runUrl: 'https://openvibe.run', machinesUrl: 'https://openvibe.bot', browserFreeMinutes: null, desktopFreeMinutes: null };
function fakeSso() {
    return {
        router: () => express.Router(),
        optionalAuth: () => (req, _res, next) => { if ((req.headers.cookie || '').includes('ov_token=person-a')) req.user = { kind: 'user', sub: 'usr_a', displayName: 'Person A' }; next(); },
        extractToken: (req) => { const auth = req.headers.authorization || ''; if (auth.startsWith('Bearer ')) return auth.slice(7); const m = (req.headers.cookie || '').match(/(?:^|;\s*)ov_token=([^;]+)/); return m ? m[1] : null; },
    };
}
const run = { list: async () => ({ sessions: [] }) };
async function serve(opts) {
    const { app } = createApp({ config, sso: fakeSso(), run, ...opts });
    const server = http.createServer(app); await new Promise((r) => server.listen(0, '127.0.0.1', r));
    return { base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) };
}
const node = { id: 'dev_1', name: 'Studio PC', online: true, specs_words: 'Linux · 16 cores · 64 GB', roles: ['desks.host', 'codes.worker'] };

test('the client asks the registry as the person, and says what it answered', async () => {
    const seen = [];
    const fetchImpl = async (url, o = {}) => {
        seen.push([o.method || 'GET', String(url), o.headers.authorization, o.body || null]);
        if (String(url).endsWith('/missing')) return { ok: false, status: 404, json: async () => ({ code: 'bot.not_found', detail: 'no such machine' }) };
        if ((o.method || 'GET') === 'DELETE') return { ok: true, status: 204, json: async () => ({}) };
        return { ok: true, status: 200, json: async () => ({ machines: [node] }) };
    };
    const c = createMachinesClient({ baseUrl: 'https://openvibe.bot/', fetchImpl });
    assert.deepEqual((await c.list('tok')).machines, [node]);
    await c.leaseCreate('tok', 'dev 1', { seconds: 600 });
    await c.leaseEnd('tok', 'dev_1', 'dsk_2');
    assert.deepEqual(seen.map((s) => s.slice(0, 3)), [
        ['GET', 'https://openvibe.bot/api/v1/machines', 'Bearer tok'],
        ['POST', 'https://openvibe.bot/api/v1/machines/dev%201/desk-leases', 'Bearer tok'],
        ['DELETE', 'https://openvibe.bot/api/v1/machines/dev_1/desk-leases/dsk_2', 'Bearer tok'],
    ]);
    assert.equal(seen[1][3], '{"seconds":600}');
    await assert.rejects(c.get('tok', 'missing'), (e) => e.status === 404 && e.code === 'bot.not_found' && /no such machine/.test(e.message));
});

test('/api/v1/machines: signed in only, the person\'s token, the registry\'s answer and status', async (t) => {
    const calls = [];
    const machines = {
        list: async (token) => { calls.push(['list', token]); return { machines: [node] }; },
        get: async (token, id) => { calls.push(['get', token, id]); const e = new Error('no such machine'); e.status = 404; e.code = 'bot.not_found'; throw e; },
        leaseCreate: async (token, id, body) => { calls.push(['lease', token, id, body]); return { lease: { desk: 'dsk_1' } }; },
        leaseEnd: async (token, id, desk) => { calls.push(['end', token, id, desk]); },
    };
    const s = await serve({ machines }); t.after(s.close);
    assert.equal((await fetch(`${s.base}/api/v1/machines`)).status, 401, 'signed out');
    const list = await fetch(`${s.base}/api/v1/machines`, { headers: { authorization: 'Bearer person-a' } });
    assert.equal(list.status, 200); assert.deepEqual((await list.json()).machines, [node]);
    const one = await fetch(`${s.base}/api/v1/machines/dev_9`, { headers: { authorization: 'Bearer person-a' } });
    assert.equal(one.status, 404); assert.equal((await one.json()).code, 'bot.not_found', 'the registry\'s own answer');
    const lease = await fetch(`${s.base}/api/v1/machines/dev_1/desk-leases`, { method: 'POST', headers: { authorization: 'Bearer person-a', 'content-type': 'application/json' }, body: JSON.stringify({ seconds: 600 }) });
    assert.equal(lease.status, 201);
    assert.equal((await fetch(`${s.base}/api/v1/machines/dev_1/desk-leases/dsk_1`, { method: 'DELETE', headers: { authorization: 'Bearer person-a' } })).status, 204);
    assert.deepEqual(calls, [['list', 'person-a'], ['get', 'person-a', 'dev_9'], ['lease', 'person-a', 'dev_1', { seconds: 600 }], ['end', 'person-a', 'dev_1', 'dsk_1']]);
});

test('the home lists your machines; with none it says how to add one; an outage leaves the page whole', async (t) => {
    const withOne = await serve({ machines: { list: async () => ({ machines: [node] }) } }); t.after(withOne.close);
    const html = await (await fetch(withOne.base, { headers: { cookie: 'ov_token=person-a' } })).text();
    assert.match(html, /<h2>Your machines<\/h2>/);
    assert.match(html, /<strong>Studio PC<\/strong><span class="status is-on">online<\/span><span>Linux · 16 cores · 64 GB<\/span><span class="role">desks\.host<\/span>/);
    assert.match(html, /href="https:\/\/openvibe\.link">Add a machine/);
    const none = await serve({ machines: { list: async () => ({ machines: [] }) } }); t.after(none.close);
    assert.match(await (await fetch(none.base, { headers: { cookie: 'ov_token=person-a' } })).text(), /No machine yet\. Pair a computer with the/);
    const down = await serve({ machines: { list: async () => { throw new Error('down'); } } }); t.after(down.close);
    const page = await fetch(down.base, { headers: { cookie: 'ov_token=person-a' } });
    assert.equal(page.status, 200); assert.doesNotMatch(await page.text(), /Your machines/, 'no machines section rather than a wrong one');
    const guest = await (await fetch(withOne.base)).text();
    assert.doesNotMatch(guest, /Your machines/, 'signed out: nothing of anyone\'s');
});

test('the API description lists the machine paths', async () => {
    const o = require('../public/openapi.json');
    for (const p of ['/machines', '/machines/{id}', '/machines/{id}/desk-leases', '/machines/{id}/desk-leases/{desk}/commands']) assert.ok(o.paths[p], p);
});
