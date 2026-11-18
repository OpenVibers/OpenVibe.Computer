'use strict';
const express = require('express');

function createApi({ run, sso, machines = null }) {
    const r = express.Router();
    r.use(express.json({ limit: '64kb' }));
    const token = (req, res) => {
        const value = sso.extractToken(req);
        if (!value) { res.status(401).type('application/problem+json').json({ type: 'about:blank', title: 'Sign in required', status: 401, code: 'computer.auth.required' }); return null; }
        return value;
    };
    const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch((e) => {
        if (res.headersSent) return next(e);
        const status = Number(e.status) || 502;
        res.status(status).type('application/problem+json').json({ type: 'about:blank', title: e.message || 'Run request failed', status, code: e.code || 'computer.run_error' });
    });
    // Machines (plan §AD.15): your own computers through the OpenVibe Link and the shared nodes you may use, and desks
    // leased on them. Computer is their front door; the registry answers as the person (machines-client.js).
    const m = (fn) => wrap(async (req, res) => {
        if (!machines) return res.status(503).type('application/problem+json').json({ type: 'about:blank', title: 'Machines are not configured here', status: 503, code: 'computer.machines.unavailable' });
        const t = token(req, res); if (!t) return;
        return fn(t, req, res);
    });
    r.get('/machines', m(async (t, _req, res) => res.json(await machines.list(t))));
    r.get('/machines/:id', m(async (t, req, res) => res.json(await machines.get(t, req.params.id))));
    r.get('/machines/:id/desks', m(async (t, req, res) => res.json(await machines.desks(t, req.params.id))));
    r.get('/machines/:id/shares', m(async (t, req, res) => res.json(await machines.shares(t, req.params.id))));
    r.post('/machines/:id/desk-leases', m(async (t, req, res) => res.status(201).json(await machines.leaseCreate(t, req.params.id, req.body))));
    r.get('/machines/:id/desk-leases/:desk', m(async (t, req, res) => res.json(await machines.leaseGet(t, req.params.id, req.params.desk))));
    r.post('/machines/:id/desk-leases/:desk/commands', m(async (t, req, res) => res.json(await machines.leaseCommand(t, req.params.id, req.params.desk, req.body))));
    r.delete('/machines/:id/desk-leases/:desk', m(async (t, req, res) => { await machines.leaseEnd(t, req.params.id, req.params.desk); res.status(204).end(); }));
    r.get('/computers', wrap(async (req, res) => { const t = token(req, res); if (!t) return; res.json(await run.list(t, `?state=${encodeURIComponent(req.query.state || 'all')}&limit=${encodeURIComponent(req.query.limit || '20')}`)); }));
    r.post('/computers', wrap(async (req, res) => {
        const t = token(req, res); if (!t) return;
        if (req.body?.kind && req.body.kind !== 'browser') return res.status(422).json({ code: 'computer.kind.unsupported', detail: 'Run currently creates browser sessions only.' });
        const { template, kind, ...runBody } = req.body || {};
        if (template && !['browser', 'kept-browser', 'throwaway'].includes(template)) return res.status(422).json({ code: 'computer.template.invalid', detail: 'Choose browser, kept-browser or throwaway.' });
        res.status(201).json(await run.create(t, { kind: 'browser', ...(template ? { template } : {}), ...runBody }));
    }));
    r.get('/computers/:id', wrap(async (req, res) => { const t = token(req, res); if (!t) return; res.json(await run.get(t, req.params.id)); }));
    r.post('/computers/:id/stop', wrap(async (req, res) => { const t = token(req, res); if (!t) return; res.json(await run.stop(t, req.params.id)); }));
    r.post('/computers/:id/screenshot', wrap(async (req, res) => {
        const t = token(req, res); if (!t) return;
        const width = Math.min(1920, Math.max(320, Number(req.body?.max_width) || 1280));
        res.json(await run.command(t, req.params.id, { kind: 'screen', value: { max_width: width } }));
    }));
    r.post('/computers/:id/act', wrap(async (req, res) => {
        const t = token(req, res); if (!t) return;
        const { kind, value, id } = req.body || {};
        if (!['screen', 'input', 'browser'].includes(kind) || !value || typeof value !== 'object' || Array.isArray(value)) return res.status(400).json({ code: 'computer.action.invalid', detail: 'Send a Run screen, input or browser command.' });
        res.json(await run.command(t, req.params.id, { kind, value, ...(id ? { id } : {}) }));
    }));
    r.post('/computers/:id/handoff', wrap(async (req, res) => {
        const t = token(req, res); if (!t) return;
        res.json(await run.take(t, req.params.id));
    }));
    return r;
}
module.exports = { createApi };
