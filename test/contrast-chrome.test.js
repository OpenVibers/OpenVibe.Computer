'use strict';
// axe in the browser check (11-15): white on the primary buttons was 2.5:1 (the page's accent is the theme's light
// accent) and accent text faded on light pages. Real Chrome, the real computer.css, a dark and a light theme: the
// primary button, a link and the template mark read at 4.5:1 or more.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('openvibe-shared/browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('contrast-chrome: skipped (no Chrome)'); process.exit(0); }

const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'computer.css'), 'utf8');
const THEMES = {
    dark: '--text-primary:#e6edf7;--text-secondary:#96a7c2;--bg-primary:#0a0f1c;--bg-card:#131c2e;--border:#26344d;--accent:#3b82f6;--accent-light:#60a5fa',
    light: '--text-primary:#0f172a;--text-secondary:#475569;--bg-primary:#ffffff;--bg-card:#f8fafc;--border:#e2e8f0;--accent:#2563eb;--accent-light:#3b82f6',
    pale: '--text-primary:#0f172a;--text-secondary:#475569;--bg-primary:#ffffff;--bg-card:#f8fafc;--border:#e2e8f0;--accent:#60a5fa;--accent-light:#93c5fd',
};
const page = (vars) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>t</title><style>:root{${vars}}</style><link rel="stylesheet" href="/c.css"></head>
<body><main class="computer-page"><p class="eyebrow">Your computers</p><a href="#start">Read the docs</a><button class="button-primary" type="submit">Start</button>
<a class="button-primary" href="#start">Get started</a><article><span class="template-mark">W</span></article></main></body></html>`;
const server = http.createServer((req, res) => {
    if (req.url === '/c.css') { res.writeHead(200, { 'content-type': 'text/css' }); return res.end(css); }
    const t = req.url.slice(1);
    res.writeHead(200, { 'content-type': 'text/html' }); res.end(page(THEMES[t] || THEMES.dark));
});
const measure = `(() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgba = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const over = (t, u) => [0, 1, 2].map((i) => t[i] * t[3] + u[i] * (1 - t[3]));
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const pageBg = rgba(getComputedStyle(document.documentElement).backgroundColor);
  return [...document.querySelectorAll('main *')].filter((e) => e.textContent.trim() && !e.children.length).map((e) => {
    let bg = pageBg; const chain = []; for (let n = e; n && n !== document.documentElement; n = n.parentElement) chain.unshift(n);
    for (const n of chain) bg = over(rgba(getComputedStyle(n).backgroundColor), bg);
    const cs = getComputedStyle(e); return { el: (e.className || e.tagName) + ':' + e.textContent.trim(), ratio: Math.round(ratio(over(rgba(cs.color), bg), bg) * 100) / 100 };
  });
})()`;
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'computer-contrast-'));
    const browser = await h.launch({ tmpDir });
    try {
        for (const theme of Object.keys(THEMES)) {
            const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 800 });
            await p.goto(`http://127.0.0.1:${server.address().port}/${theme}`, { maxMs: 8000 });
            const out = await p.evaluate(measure);
            for (const x of out) assert.ok(x.ratio >= 4.5, `${theme}: ${x.el} reads at ${x.ratio}:1`);
            console.log(`contrast-chrome: ${theme}: ${out.map((x) => `${x.el} ${x.ratio}`).join(', ')}`);
        }
    } finally { await browser.close(); server.close(); fs.rmSync(tmpDir, { recursive: true, force: true }); }
})().catch((e) => { console.error(e); process.exit(1); });
