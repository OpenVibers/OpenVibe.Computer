# AGENTS.md — OpenVibe.Computer

## Project overview

The front door and API facade for OpenVibe computers: a public site that renders the product, signs a
person in through OpenVibe.Network SSO, and forwards that person's Network token **unchanged** to
OpenVibe.Run. Run owns sessions, placement, budgets and the actual computer; Computer owns no
sessions and stores nothing.

- Origin `https://openvibe.computer`, port `5135`, unit `openvibe-computer.service`,
  release root `/opt/openvibe.computer`.
- Node.js/Express, CommonJS, **no database, no migrations, no build step**; server-rendered pages.

## What it owns

- The public pages: `/`, `/templates`, `/pricing`, `/docs`, `/updates`, legal pages.
- `/api/v1/computers` and `/api/v1/computers/{id}[/stop|/screenshot|/act|/handoff]` — a thin facade
  that calls Run with the caller's own bearer token.
- `/auth/*` — the Network OAuth client `computer` (callback `/auth/callback`), the session cookie and
  optional auth for pages.
- `/llms.txt`, `/llms-full.txt`, `/sitemap.xml`, `/robots.txt`, `/openapi.json`,
  `/.well-known/agent.json`, `/release.json`, `/shared/*`, `/api/health`.

It does not own: the computer, the browser, placement, the allowance, per-minute pricing, the
session budget, screenshots or control handoff. Those are Run's. The UI marks what Run does not yet
expose as **pending**, and that must stay honest.

## Who it calls, and who calls it

- **OpenVibe.Run** — every session action goes through [server/run-client.js](server/run-client.js) to
  `OV_RUN_URL` (`/api/v1/sessions…`, `/commands`, `/control`, `/timeline`, `/snapshot`). The person's
  Network token is passed through as `Authorization: Bearer`; Computer never mints or broadens one.
- **OpenVibe.Network** — SSO through `openvibe-sdk/sso` (`createSsoClient`), OAuth client `computer`.
- Called by people in the browser and by agents that read the public pages/OpenAPI. There is no
  service-to-service caller and no contract of its own.

## Repository map

- **Entry:** [server/index.js](server/index.js) — `createApp()`, listen on `config.port`/`config.host`.
- **App:** [server/app.js](server/app.js) — helmet CSP, SSO router + optional auth, health, robots,
  sitemap, legal, llms files, openapi, agent descriptor, `/api/v1`, release, `/shared`, static,
  pages, error handler.
- **Config:** [server/config.js](server/config.js) — env load (`PORT`, `BASE_URL`, `OV_RUN_URL`,
  `OV_OAUTH_CLIENT_ID/SECRET`, `OV_NETWORK_*`, secure cookies).
- **Run client:** [server/run-client.js](server/run-client.js) — `RunError`, `list/get/create/stop/
  command/control/take/timeline/snapshot`; creates browser sessions only.
- **API:** [server/api.js](server/api.js) — token extraction, RFC 9457 problem+json errors, the routes.
- **Pages:** [server/pages.js](server/pages.js), [server/layout.js](server/layout.js),
  [server/html.js](server/html.js), [server/product.js](server/product.js).
- **Deploy:** [deploy/systemd/openvibe-computer.service](deploy/systemd/openvibe-computer.service),
  [deploy/nginx/openvibe.computer.conf](deploy/nginx/openvibe.computer.conf),
  [deploy/LAUNCH.md](deploy/LAUNCH.md) (DNS, TLS, OAuth, service add, vhost swap).
- **Static:** [public/openapi.json](public/openapi.json), [public/llms.txt](public/llms.txt),
  [public/.well-known/agent.json](public/.well-known/agent.json), [public/css/computer.css](public/css/computer.css).

## Commands

```bash
npm ci
cp .env.example .env      # if present; the README lists the variables
npm run dev               # NODE_ENV=development node server/index.js
npm start                 # node server/index.js, http://127.0.0.1:5135
npm test                  # node --test test/*.test.js
ov test                   # the harness's sharded run of what the change reaches
node --check <file.js>
```

## Auth

`openvibe-sdk/sso` owns the OAuth flow and cookie (`createSsoClient({ site: 'computer', … })`).
Pages use `sso.optionalAuth()`; API routes take the bearer token with `sso.extractToken(req)` and
answer `401 application/problem+json` (`computer.auth.required`) when it is absent. Run authorizes
the token and its budget — Computer does not decide entitlement. `OV_OAUTH_CLIENT_SECRET` is required
for sign-in; without it the flow cannot complete.

## Frontend loading model

Server-rendered HTML from `server/pages.js`/`server/layout.js` and `server/html.js`; no SPA, no
bundler, no transpiler. Static files are served from `public/`; shared frame assets come from the
pinned `openvibe-shared` tarball through `/shared/*` (`openvibe-shared/serve`). The CSP in
[server/app.js](server/app.js) is the real allow-list (Network, Chat, Billing, Events, Media,
Cloudflare insights, self) — add an origin there before using it.

## Deploy

`sudo ovhost service add computer` (once) then `sudo ovhost deploy computer --restart`
([deploy/LAUNCH.md](deploy/LAUNCH.md)). Unit `openvibe-computer.service`, env
`/etc/openvibe/computer.env` (0600), vhost installed with `sudo ovhost nginx render computer --install`.
The launch is a host-level swap: the `openvibe.computer` parked redirect is removed **only after**
review and readiness, in the same change that installs the vhost. Do not remove the redirect in a
service PR. Health check: `http://127.0.0.1:5135/api/health`.

## Tests

`npm test` is Node's built-in runner over [test/computer.test.js](test/computer.test.js) and
[test/link-brand.test.js](test/link-brand.test.js). They pin the facade contract: 401 without a
token, browser-only creation, the three templates, Run errors mapped to problem+json, the public
pages/llms/sitemap, the brand rules and the CSP. `ov test` runs the same suite.

## Conventions

- CommonJS, 4-space indent, single quotes, semicolons; `server/` modules export factories
  (`createApp`, `createApi`, `createPages`) so tests inject config/SSO/Run.
- Public-facing copy is calm and specific; no unverified capability claims ("pending" stays pending).
- Error bodies follow RFC 9457 (`application/problem+json`) with a stable `code`.
- DNS/TLS/OAuth/vhost steps belong in [deploy/LAUNCH.md](deploy/LAUNCH.md), not in code.

## Pitfalls

- **Computer is a facade.** Do not add session state, a database, billing logic or placement here;
  that belongs in Run.
- **Never mint or rewrite the forwarded token.** Pass the person's own token through.
- **The parked redirect is intentional** until the review in `deploy/LAUNCH.md`; removing it early
  sends the domain to a service that may not be live.
- **CSP is enforced.** A new script/font/frame origin must be added to the helmet directives or it
  will be blocked; do not add `unsafe-eval`.
- **Run support is partial.** Desktop/GPU/always-on, live streams, B3 control modes, control handoff
  timelines, snapshots and non-browser kinds are not available yet; the UI says so.
- **No build step:** a change to `public/` or the view strings is live on the next deploy/restart.

## Documentation

- [README.md](README.md) — product summary and the current Run support.
- [deploy/LAUNCH.md](deploy/LAUNCH.md) — the host-level launch sequence.
- [public/openapi.json](public/openapi.json) — the API surface served to clients.
