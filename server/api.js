'use strict';
const express = require('express');

function createApi({ run, sso }) {
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
