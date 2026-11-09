# OpenVibe.Computer

The front door and API facade for OpenVibe computers. Run owns sessions, placement and budgets; this service renders the product and forwards a person's Network token to Run unchanged.

## Run locally

Link 22 or newer is required.

```sh
npm ci
cp .env.example .env
npm run dev
```

The site listens on `127.0.0.1:5135`. Configure `OV_OAUTH_CLIENT_SECRET` for Network sign-in and `OV_RUN_URL` for Run. Allowance and per-minute settings are intentionally unset until the owner chooses them.

## Run support today

The current Run session API supports browser session create/list/read/end and one-off screen, input and browser commands. Placement and budget enforcement remain in Run. Run does not yet expose live session streams, B3 control modes, control handoff, action timelines, snapshots, non-browser computer kinds or templates. The UI marks those capabilities as pending.

## Launch notes

See [deploy/LAUNCH.md](deploy/LAUNCH.md) for the DNS, Cloudflare, OAuth and vhost sequence. The host-level parked-redirect swap is intentionally a post-review action.

<!-- versions:start -->
- openvibe-contracts: v0.346.0
- openvibe-sdk: v0.117.0
- openvibe-shared: v4.172.0
<!-- versions:end -->
