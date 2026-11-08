'use strict';
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const { createSsoClient } = require('openvibe-sdk/sso');
const { createRunClient } = require('./run-client');
const { createApi } = require('./api');
const { createPages } = require('./pages');
const configLib = require('./config');

function createApp(opts = {}) {
    const config = opts.config || configLib.load();
    const sso = opts.sso || createSsoClient({ site: 'computer', baseUrl: config.baseUrl, clientId: config.clientId, clientSecret: config.clientSecret, networkUrl: config.networkUrl, networkInternalUrl: config.networkInternalUrl, secureCookies: config.secureCookies });
    const run = opts.run || createRunClient({ baseUrl: config.runUrl, fetchImpl: opts.fetchImpl });
    const app = express();
    app.disable('x-powered-by'); app.set('trust proxy', config.trustProxy);
    app.use(helmet({ contentSecurityPolicy: { directives: {
        defaultSrc: ["'self'"], scriptSrc: ["'self'", "'unsafe-inline'", 'https://openvibe.network'], styleSrc: ["'self'", "'unsafe-inline'", 'https://openvibe.network', 'https://fonts.googleapis.com'], fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'], imgSrc: ["'self'", 'data:', 'https://openvibe.network'], connectSrc: ["'self'", 'https://openvibe.network', 'https://openvibe.chat', 'https://billing.openvibe.network', 'https://openvibe.events'], frameSrc: ["'self'", 'https://openvibe.network'], frameAncestors: ["'none'"], objectSrc: ["'none'"], baseUri: ["'self'"], formAction: ["'self'", 'https://openvibe.network'],
    } }, crossOriginEmbedderPolicy: false, referrerPolicy: { policy: 'strict-origin-when-cross-origin' } }));
    app.use(express.urlencoded({ extended: false }));
    app.use('/auth', sso.router(express));
    app.use(sso.optionalAuth());
    app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'openvibe-computer', version: require('../package.json').version }));
    app.get('/robots.txt', (_req, res) => res.type('text/plain').send('User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: https://openvibe.computer/sitemap.xml\n'));
    app.get('/sitemap.xml', (_req, res) => res.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://openvibe.computer/</loc></url><url><loc>https://openvibe.computer/templates</loc></url><url><loc>https://openvibe.computer/pricing</loc></url><url><loc>https://openvibe.computer/docs</loc></url><url><loc>https://openvibe.computer/updates</loc></url></urlset>'));
    { const legal = require('openvibe-shared/legal'); app.get(legal.PATHS, legal.handler({ id: 'computer', service: 'computer', host: 'openvibe.computer', name: 'OpenVibe.Computer', profile: 'hosting' })); }
    app.get('/llms.txt', (_req, res) => res.type('text/plain').send('# OpenVibe.Computer\n\nA computer for you, your AI, or both. Run owns sessions, placement and budgets.\n\n- [Templates](/templates)\n- [Pricing](/pricing)\n- [API docs](/docs)\n- [OpenAPI](/openapi.json)\n- [Agent descriptor](/.well-known/agent.json)\n'));
    app.get('/openapi.json', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'openapi.json')));
    app.get('/.well-known/agent.json', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', '.well-known', 'agent.json')));
    app.use('/api/v1', createApi({ run, sso }));
    app.use('/shared', require('openvibe-shared/serve').handler());
    app.use(express.static(path.join(__dirname, '..', 'public'), { index: false, maxAge: '1h' }));
    app.use(createPages({ config, run, sso }));
    app.use((err, _req, res, _next) => { if (res.headersSent) return; res.status(err.status || 500).type('text/plain').send('Computer could not complete that request.'); });
    return { app, config, run, sso };
}
module.exports = { createApp };
