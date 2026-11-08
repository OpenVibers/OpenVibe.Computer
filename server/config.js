'use strict';
require('dotenv').config();
const trim = (s) => String(s || '').replace(/\/+$/, '');
const numberOrNull = (v) => v === '' || v == null || !Number.isFinite(Number(v)) || Number(v) < 0 ? null : Number(v);
function load(env = process.env) {
    const port = Number.parseInt(env.PORT, 10) || 5135;
    const networkUrl = trim(env.OV_NETWORK_URL || 'https://openvibe.network');
    return {
        port, host: env.HOST || '127.0.0.1', baseUrl: trim(env.BASE_URL || `http://localhost:${port}`),
        trustProxy: env.TRUST_PROXY != null ? Number(env.TRUST_PROXY) : 2,
        networkUrl, networkInternalUrl: trim(env.OV_NETWORK_INTERNAL_URL || 'http://127.0.0.1:4000'),
        runUrl: trim(env.OV_RUN_URL || 'https://openvibe.run'),
        clientId: env.OV_OAUTH_CLIENT_ID || 'computer', clientSecret: env.OV_OAUTH_CLIENT_SECRET || '',
        browserFreeMinutes: numberOrNull(env.COMPUTER_BROWSER_FREE_MINUTES),
        desktopFreeMinutes: numberOrNull(env.COMPUTER_DESKTOP_FREE_MINUTES),
        pricePerMinute: numberOrNull(env.COMPUTER_PRICE_PER_MINUTE),
        secureCookies: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : env.NODE_ENV === 'production',
    };
}
module.exports = { load };
