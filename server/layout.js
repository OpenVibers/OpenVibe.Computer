'use strict';
const shell = require('openvibe-shared/shell');
const serve = require('openvibe-shared/serve');
const seo = require('openvibe-shared/seo');
const { esc } = require('./html');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
// The page's own stylesheet by its content hash: Cloudflare keeps /css/computer.css for an hour, so a fix (#104's
// contrast) reached people only after the old copy expired. A new file is a new URL.
const CSS_REV = crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'computer.css'))).digest('hex').slice(0, 12);
const CSS_URL = `/css/computer.css?v=${CSS_REV}`;
const NAV = [
    { label: 'Computer', href: '/' }, { label: 'Templates', href: '/templates' }, { label: 'Pricing', href: '/pricing' },
    { label: 'Docs', href: '/docs' }, { label: 'Updates', href: '/updates' },
];
function page({ title, body, viewer, config, path = '/' }) {
    const nav = { service: 'computer', apiBase: config.networkUrl, links: NAV.map((x) => ({ ...x, active: path === x.href })), history: { type: 'page', title }, silentLogin: `${config.baseUrl}/auth/login?silent=1&next={url}`, sessionUrl: '/auth/me', loginUrl: '/auth/login?next={path}', logoutUrl: '/auth/logout?next={path}' };
    const footer = { service: 'computer', variant: 'full', brandName: 'OpenVibe.Computer' };
    return shell.page({ name: 'OpenVibe.Computer', lang: 'en', title: `${title} · OpenVibe.Computer`, titleSuffix: '', siteName: 'OpenVibe.Computer', description: 'A computer for you, your AI, or both.', canonical: `${config.baseUrl}${path}`, robots: 'index, follow', jsonLd: [seo.jsonLd.website({ name: 'OpenVibe.Computer', url: `${config.baseUrl}/`, description: 'A computer for you, your AI, or both.' })], home: '/', navLinks: NAV, navbar: nav, footer,
        head: `<link rel="stylesheet" href="${serve.url('kit.css')}"><link rel="stylesheet" href="${CSS_URL}"><meta name="referrer" content="strict-origin-when-cross-origin">`,
        body: `<div id="navbar-mount"></div><main id="main" class="computer-page">${body}</main>` });
}
function send(res, opts, status = 200) { res.set('Cache-Control', opts.viewer?.kind === 'user' ? 'private, no-store' : 'public, max-age=60'); res.set('Vary', 'Cookie'); res.status(status).type('html').send(page(opts)); }
module.exports = { page, send, NAV, CSS_URL };
