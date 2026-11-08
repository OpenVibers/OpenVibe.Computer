'use strict';
const express = require('express');
const crypto = require('crypto');
const { esc } = require('./html');
const { send } = require('./layout');
const { priceText, freeText, kinds, templates, priceLine } = require('./product');

function createPages({ config, run, sso }) {
    const r = express.Router();
    const viewerOf = (req) => req.user || req.viewer || { kind: 'anonymous' };
    const tokenOf = (req) => sso.extractToken(req);
    const card = (k) => `<article class="kind-card kind-card--ready"><span class="eyebrow">${esc(k.badge)}</span><h3>${esc(k.name)}</h3><p>${esc(k.for)}</p><p class="runs">Runs on ${esc(k.runs)}</p><form method="post" action="/start"><input type="hidden" name="kind" value="${esc(k.id)}"><label for="template-${esc(k.id)}">Start from template</label><select id="template-${esc(k.id)}" name="template"><option value="browser">Browser</option><option value="throwaway">Throwaway</option><option value="kept-browser" disabled>Kept browser · not available on this machine</option></select><button class="button-primary" type="submit">Start a ${esc(k.name.toLowerCase())}</button></form></article>`;
    const soon = (k) => `<li class="kind-soon"><b>${esc(k.name)}</b><span>${esc(k.for)}</span><small>${esc(k.runs.replace(/\.$/, ''))}</small></li>`;
    r.get('/', async (req, res) => {
        const viewer = viewerOf(req); let sessions = [];
        if (viewer.kind === 'user') { try { sessions = (await run.list(tokenOf(req), '?state=all&limit=8')).sessions || []; } catch { /* show dashboard state without hiding the service page */ } }
        const computerRows = sessions.map((s) => `<li><a href="/computers/${encodeURIComponent(s.id)}"><strong>${esc(s.kind === 'browser' ? 'Browser computer' : s.kind)}</strong></a><span class="status">${esc(s.state)}</span><span>${esc(s.id)}</span><a href="/computers/${encodeURIComponent(s.id)}">Open</a>${s.state !== 'ended' ? `<form method="post" action="/computers/${encodeURIComponent(s.id)}/stop"><button class="button-quiet">Stop</button></form>` : ''}</li>`).join('');
        const body = `<section class="hero"><div><span class="eyebrow">YOUR COMPUTER, WHEREVER YOU ARE</span><h1>A computer for you, your AI, or both.</h1><p>Start a browser desk on OpenVibe Run. Choose where it runs, keep control close, and bring your own Link machine for free use.</p><a class="button-primary" href="#start">Start a computer</a> <a class="button-secondary" href="/templates">Explore templates</a></div></section>
        <section id="start"><div class="section-heading"><div><span class="eyebrow">PICK A COMPUTER</span><h2>Start a computer</h2></div><p>Each session runs where its kind is supported. Run chooses placement and enforces budgets.</p></div><p class="price-line">${esc(priceLine(config))} <a href="/pricing">Pricing</a></p><div class="kind-grid">${kinds(config).filter((k) => k.available).map(card).join('')}</div>
        <h3 class="soon-h">Coming as Run adds them <span class="muted">${kinds(config).filter((k) => !k.available).length}</span></h3><ul class="kind-soon-grid">${kinds(config).filter((k) => !k.available).map(soon).join('')}</ul></section>
        ${viewer.kind === 'user' ? `<section class="your-computers"><div class="section-heading"><div><span class="eyebrow">YOUR WORKSPACE</span><h2>Your computers</h2></div><a href="/api/v1/computers">Open API</a></div>${computerRows ? `<ul class="computer-list">${computerRows}</ul>` : '<p>No running or recent computers yet. Start a browser computer to see it here.</p>'}</section>` : `<section class="sign-in-callout"><h2>Keep your computers close</h2><p>Sign in to open, stop and manage your sessions.</p><a class="button-secondary" href="/auth/login?next=%2F">Sign in with OpenVibe</a></section>`}`;
        send(res, { title: 'A computer for you, your AI, or both', body, viewer, config, path: '/' });
    });
    r.post('/start', express.urlencoded({ extended: false }), async (req, res) => {
        const kind = String(req.body.kind || 'browser');
        if (kind !== 'browser') return res.redirect(303, '/#start');
        if (viewerOf(req).kind !== 'user') return res.redirect(303, `/auth/login?next=${encodeURIComponent('/')}`);
        const viewer = viewerOf(req);
        const template = String(req.body.template || 'browser');
        if (!['browser', 'kept-browser', 'throwaway'].includes(template)) return res.redirect(303, '/#start');
        try { const session = await run.create(tokenOf(req), { kind: 'browser', template, idempotency_key: `computer:${crypto.randomUUID()}` }); return res.redirect(303, `/computers/${encodeURIComponent(session.id)}`); }
        catch (e) { send(res, { title: 'Could not start computer', body: `<section class="page-intro"><h1>Could not start this computer</h1><p>${esc(e.message)}</p><a href="/#start">Try again</a></section>`, viewer, config, path: '/' }, e.status || 503); }
    });
    r.get('/computers/:id', async (req, res) => {
        const viewer = viewerOf(req); if (viewer.kind !== 'user') return res.redirect(303, `/auth/login?next=${encodeURIComponent(req.originalUrl)}`);
        try {
            const session = await run.get(tokenOf(req), req.params.id);
            const [control, timeline, snapshot] = await Promise.all([run.control(tokenOf(req), session.id), run.timeline(tokenOf(req), session.id), run.snapshot(tokenOf(req), session.id)]);
            const holder = control.lease?.holder;
            const actions = (timeline.actions || []).map((a) => `<li><strong>${esc(a.action || a.kind)}</strong><span>${esc(a.actor.kind)} · ${esc(a.result)}${a.code ? ` · ${esc(a.code)}` : ''}</span><time>${esc(a.at)}</time></li>`).join('');
            const body = `<section class="page-intro"><a href="/">← Your computers</a><div class="title-row"><div><span class="eyebrow">${esc(session.state)} · ${esc(session.id)}</span><h1>Browser computer</h1></div><form method="post" action="/computers/${encodeURIComponent(session.id)}/stop"><button class="button-danger" ${session.state === 'ended' ? 'disabled' : ''}>Stop computer</button></form></div><p>Placed by OpenVibe Run. ${esc(session.placement?.machine || 'Run is choosing a machine')} · ${esc(session.usage?.desk_seconds || 0)} seconds used.</p></section>
            <section class="screen-panel"><div class="screen-placeholder"><span class="screen-led"></span><h2>Live screen connects through Run</h2><p>Run currently exposes one-off screen commands. Live streaming is not available yet.</p></div><div class="mode-panel"><span class="eyebrow">WHO HOLDS THE CONTROLS</span><h2>${holder ? `${esc(holder.kind)} · ${esc(holder.subject || 'nobody')}` : 'Controls are free'}</h2><p class="fine-print">Lease ${esc(control.lease?.seq || 1)} · ${control.lease?.expires_ms ? `expires ${esc(new Date(control.lease.expires_ms).toISOString())}` : 'no expiry'}</p><form method="post" action="/computers/${encodeURIComponent(session.id)}/handoff"><button class="button-primary" ${session.state === 'ended' ? 'disabled' : ''}>Take over</button></form></div></section><section class="timeline"><span class="eyebrow">ACTIVITY</span><h2>Action timeline</h2>${actions ? `<ol class="computer-list">${actions}</ol>` : '<p>No commands recorded yet.</p>'}<p class="fine-print">${esc(snapshot.message || 'Snapshots are not available on this machine.')}</p></section>`;
            send(res, { title: 'Your browser computer', body, viewer, config, path: req.path });
        } catch (e) { send(res, { title: 'Computer unavailable', body: `<section class="page-intro"><h1>Computer unavailable</h1><p>${esc(e.message)}</p><a href="/">Back to your computers</a></section>`, viewer, config, path: req.path }, e.status || 503); }
    });
    r.post('/computers/:id/stop', async (req, res) => { try { await run.stop(tokenOf(req), req.params.id); res.redirect(303, '/'); } catch (e) { send(res, { title: 'Could not stop computer', body: `<h1>Could not stop computer</h1><p>${esc(e.message)}</p><a href="/">Back</a>`, viewer: viewerOf(req), config }, e.status || 503); } });
    r.post('/computers/:id/handoff', async (req, res) => {
        const viewer = viewerOf(req); if (viewer.kind !== 'user') return res.redirect(303, `/auth/login?next=${encodeURIComponent(req.originalUrl)}`);
        try { await run.take(tokenOf(req), req.params.id); res.redirect(303, `/computers/${encodeURIComponent(req.params.id)}`); }
        catch (e) { send(res, { title: 'Could not take over', body: `<h1>Could not take over</h1><p>${esc(e.message)}</p>`, viewer, config }, e.status || 503); }
    });
    r.get('/templates', (_req, res) => send(res, { title: 'Computer templates', body: `<section class="page-intro"><span class="eyebrow">START A BROWSER COMPUTER</span><h1>Templates</h1><p>Choose the browser profile behavior before Run places the desk.</p></section><div class="template-grid">${templates.map((t) => `<article class="template-card"><span class="template-mark">${esc(t.mark)}</span><h2>${esc(t.name)}</h2><p>${esc(t.text)}</p>${t.available ? `<form method="post" action="/start"><input type="hidden" name="kind" value="browser"><input type="hidden" name="template" value="${esc(t.id)}"><button class="button-primary">Start ${esc(t.name)}</button></form>` : '<span class="availability">Not available on this machine</span>'}</article>`).join('')}</div>`, viewer: viewerOf(_req), config, path: '/templates' }));
    r.get('/pricing', (_req, res) => send(res, { title: 'Pricing', body: `<section class="page-intro"><span class="eyebrow">CLEAR BEFORE YOU START</span><h1>Pricing</h1><p>Run enforces the session budget and placement. Prices become final when configured by the owner.</p></section><div class="price-grid"><article><h2>Your Link machines</h2><p>Free, with no time limit.</p></article><article><h2>Browser allowance</h2><p>${freeText(config.browserFreeMinutes, '20 hours per month (proposed)')}</p></article><article><h2>Desktop allowance</h2><p>${freeText(config.desktopFreeMinutes, '1 hour per month (proposed)')}</p></article><article><h2>After the allowance</h2><p>${priceText(config.pricePerMinute)}</p></article></div><p class="fine-print">The free allowances and per-minute price come from service configuration. Values marked proposed are not yet owner-set.</p>`, viewer: viewerOf(_req), config, path: '/pricing' }));
    r.get('/docs', (_req, res) => send(res, { title: 'Computer API docs', body: `<section class="page-intro"><span class="eyebrow">BUILD ON COMPUTER</span><h1>API documentation</h1><p>Computer forwards each signed-in person's Network token to Run. Run owns budgets, placement and session state.</p><p><a href="/openapi.json">OpenAPI 3.1</a> · <a href="/.well-known/agent.json">Agent descriptor</a></p></section><pre>GET  /api/v1/computers\nPOST /api/v1/computers\nGET  /api/v1/computers/{id}\nPOST /api/v1/computers/{id}/stop\nPOST /api/v1/computers/{id}/screenshot\nPOST /api/v1/computers/{id}/act\nPOST /api/v1/computers/{id}/handoff</pre><p>Use a user Network token with the matching Run session capability. Computer does not use a service token on the person's behalf.</p>`, viewer: viewerOf(_req), config, path: '/docs' }));
    r.get('/updates', (_req, res) => send(res, { title: 'Updates', body: '<section class="page-intro"><span class="eyebrow">UPDATES</span><h1>Computer is taking shape</h1><p>The first front door uses Run browser sessions. Desktop, GPU and always-on sessions follow as placement and templates arrive in Run.</p></section>', viewer: viewerOf(_req), config, path: '/updates' }));
    return r;
}
module.exports = { createPages };
