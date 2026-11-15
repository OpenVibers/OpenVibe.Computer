'use strict';
// The page links its stylesheet by content hash, so a CSS fix is a new URL and Cloudflare's hour-old copy is not served
// (11-15: #104's contrast fix waited behind the cached /css/computer.css).
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const layout = require('../server/layout');
const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'computer.css'));
const rev = crypto.createHash('sha256').update(css).digest('hex').slice(0, 12);
assert.strictEqual(layout.CSS_URL, `/css/computer.css?v=${rev}`);
const html = layout.page({ title: 'Computer', body: '<h1>x</h1>', viewer: null, config: { baseUrl: 'https://openvibe.computer', networkUrl: 'https://openvibe.network' } });
assert.ok(html.includes(`href="/css/computer.css?v=${rev}"`), 'the page links the hashed stylesheet');
assert.ok(!html.includes('href="/css/computer.css"'), 'no bare stylesheet link is left');
console.log('computer.css is linked by its content hash');
