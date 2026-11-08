# Launch sequence for openvibe.computer

This PR prepares the service and host configuration. Opus performs the host-level swap after review; do not remove the parked redirect before the Computer vhost and service are ready.

1. **DNS and Cloudflare:** make sure the `openvibe.computer` zone is active at Cloudflare. Add apex and `www` A/AAAA records to the OpenVibe host, proxied through Cloudflare like the other room domains. Keep the DNS-only ACME validation route reachable during certificate issuance. Confirm `openvibe.computer` and `www.openvibe.computer` resolve to the intended host.
2. **TLS:** issue `/etc/letsencrypt/live/openvibe.computer/{fullchain.pem,privkey.pem}` for apex and `www` before enabling the TLS server block.
3. **Network OAuth:** deploy the Network PR with the Computer cutover. It seeds confidential OAuth client `computer`, redirect URI `https://openvibe.computer/auth/callback`, and lists Computer in the Network Frame. The same host change installs Computer's vhost before removing the old redirect.
4. **Service:** after the OpenVibe.Host inventory PR is available, run `sudo ovhost service add computer`. It adds the service entry, clones the repo, creates `/etc/openvibe/computer.env` with mode 0600 and prints the remaining setup steps without printing secrets. Use Network's service-principal setup to create or rotate client `computer`; set `OV_RUN_URL=https://openvibe.run` and `OV_OAUTH_CLIENT_ID=computer`, then run `sudo ovhost validate computer` and `sudo ovhost deploy computer --restart`. Check `http://127.0.0.1:5135/api/health`.
5. **Vhost and parked redirect:** after review and successful readiness checks, Opus removes the `openvibe.computer` redirect blocks from Network's `parked-domains.conf`, installs `deploy/nginx/openvibe.computer.conf` with `sudo ovhost nginx render computer --install`, runs `nginx -t`, and reloads nginx as one host-level swap. The Host inventory keeps `repoVhost` review-only so a normal Computer deploy does not install the vhost early.
6. **Verify:** check `/`, `/api/health`, and `/auth/login` through HTTPS. The vhost leaves `/api/` public to the service; user endpoints require a Network token and Run authorizes the forwarded token.

No host change is part of this PR.
