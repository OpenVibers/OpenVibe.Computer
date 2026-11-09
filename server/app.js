'use strict';
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const { createSsoClient } = require('openvibe-sdk/sso');
const { createRunClient } = require('./run-client');
const { createApi } = require('./api');
const { createPages } = require('./pages');
const seo = require('openvibe-shared/seo');
const configLib = require('./config');

const SITE_NAME = 'OpenVibe.Computer';
const SUMMARY = 'A computer for you, your AI, or both. Start a browser desk on OpenVibe Run; Run owns sessions, placement and budgets.';
// The public pages, for /llms-full.txt: the same pages llms.txt and the sitemap list.
const PUBLIC_PAGES = [
    { title: SITE_NAME, url: '/', text: SUMMARY },
    { title: 'Computer templates', url: '/templates', text: 'Choose the browser profile behavior before Run places the desk: a browser, a throwaway browser, or a kept browser where the machine supports it.' },
    { title: 'Pricing', url: '/pricing', text: 'Your Link machines are free with no time limit. The browser and desktop allowances and the per-minute price after them come from service configuration; Run enforces the session budget.' },
    { title: 'Computer API docs', url: '/docs', text: 'Computer forwards each signed-in person\'s Network token to Run. GET and POST /api/v1/computers, GET /api/v1/computers/{id}, POST /api/v1/computers/{id}/stop, screenshot, act and handoff. Run owns budgets, placement and session state.' },
    { title: 'Updates', url: '/updates', text: 'The first front door uses Run browser sessions. Desktop, GPU and always-on sessions follow as placement and templates arrive in Run.' },
];

function createApp(opts = {}) {
    const config = opts.config || configLib.load();
    const sso = opts.sso || createSsoClient({ site: 'computer', baseUrl: config.baseUrl, clientId: config.clientId, clientSecret: config.clientSecret, networkUrl: config.networkUrl, networkInternalUrl: config.networkInternalUrl, secureCookies: config.secureCookies });
    const run = opts.run || createRunClient({ baseUrl: config.runUrl, fetchImpl: opts.fetchImpl });
    const app = express();
    app.disable('x-powered-by'); app.set('trust proxy', config.trustProxy);
    app.use(helmet({ contentSecurityPolicy: { directives: {
        defaultSrc: ["'self'"], scriptSrc: ["'self'", "'unsafe-inline'", 'https://openvibe.network', 'https://static.cloudflareinsights.com'], styleSrc: ["'self'", "'unsafe-inline'", 'https://openvibe.network', 'https://fonts.googleapis.com'], fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'], imgSrc: ["'self'", 'data:', 'https://openvibe.network'], connectSrc: ["'self'", 'https://openvibe.network', 'https://openvibe.chat', 'https://billing.openvibe.network', 'https://openvibe.events', 'https://cloudflareinsights.com'], frameSrc: ["'self'", 'https://openvibe.network'], frameAncestors: ["'none'"], objectSrc: ["'none'"], baseUri: ["'self'"], formAction: ["'self'", 'https://openvibe.network'],
    } }, crossOriginEmbedderPolicy: false, referrerPolicy: { policy: 'strict-origin-when-cross-origin' } }));
    app.use(express.urlencoded({ extended: false }));
    app.use('/auth', sso.router(express));
    app.use(sso.optionalAuth());
    app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'openvibe-computer', version: require('../package.json').version }));
    app.get('/robots.txt', (_req, res) => res.type('text/plain').send('User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: https://openvibe.computer/sitemap.xml\n'));
    app.get('/sitemap.xml', (_req, res) => res.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://openvibe.computer/</loc></url><url><loc>https://openvibe.computer/templates</loc></url><url><loc>https://openvibe.computer/pricing</loc></url><url><loc>https://openvibe.computer/docs</loc></url><url><loc>https://openvibe.computer/updates</loc></url></urlset>'));
    { const legal = require('openvibe-shared/legal'); app.get(legal.PATHS, legal.handler({ id: 'computer', service: 'computer', host: 'openvibe.computer', name: 'OpenVibe.Computer', profile: 'hosting' })); }
    app.get('/llms.txt', (_req, res) => res.type('text/plain').send('# OpenVibe.Computer\n\nA computer for you, your AI, or both. Run owns sessions, placement and budgets.\n\n- [Templates](/templates)\n- [Pricing](/pricing)\n- [API docs](/docs)\n- [OpenAPI](/openapi.json)\n- [Agent descriptor](/.well-known/agent.json)\n- [Full text for language models](/llms-full.txt)\n'));
    // The same public pages with their text, for a model that wants the site in one read (llms-full.txt, llmstxt.org).
    app.get('/llms-full.txt', (_req, res) => res.type('text/plain').send(seo.llmsFull({
        site: SITE_NAME, summary: SUMMARY, base: 'https://openvibe.computer',
        sections: [{ title: 'Pages', pages: PUBLIC_PAGES }],
    })));
    app.get('/openapi.json', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'openapi.json')));
    app.get('/.well-known/agent.json', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', '.well-known', 'agent.json')));
    app.use('/api/v1', createApi({ run, sso }));
    // GET /release.json (ADR-016): the navbar's release watch polls it so open tabs learn of a new release (the 11-09
    // browser sweep found it answering 404 here).
    require('openvibe-shared/release').createRelease({ service: 'computer', root: path.join(__dirname, '..') }).mount(app);
    app.use('/shared', require('openvibe-shared/serve').handler());
    app.use(express.static(path.join(__dirname, '..', 'public'), { index: false, maxAge: '1h' }));
    app.use(createPages({ config, run, sso }));
    app.use((err, _req, res, _next) => { if (res.headersSent) return; res.status(err.status || 500).type('text/plain').send('Computer could not complete that request.'); });
    return { app, config, run, sso };
}
module.exports = { createApp };
