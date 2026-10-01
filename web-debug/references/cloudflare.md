# Cloudflare website and runtime diagnosis

Use this route for Cloudflare DNS/proxy/cache/TLS delivery and Workers/Pages development. Establish the affected hostname, product, account/environment (when relevant), deployed commit/version and UTC reproduction time. Do not assume every Cloudflare-hosted site uses the same build/runtime.

## Probe the selected URL

```text
node SKILL_DIR/scripts/edge.mjs --url https://YOUR_SITE/affected-route --out work/edge.json
node SKILL_DIR/scripts/edge.mjs --url https://YOUR_SITE/affected-route --method GET --follow --out work/edge-get.json
```

Substitute the user's actual authorized URL. Default HEAD captures status, an allowlist of response headers and endpoint TLS certificate metadata without reading the body or sending cookies/tokens. GET is available when HEAD behavior is unrepresentative. Follow is opt-in, stays on the original origin and stops after at most six requests or a detected loop. Paths/query parameters can still select an application operation; use diagnostic routes within the task scope.

The report records direct A/AAAA/CNAME queries separately from OS name resolution. OS results may come from local policy or hosts files. Failed direct DNS queries plus successful OS/HTTP resolution are evidence of differing resolver paths, not proof the site is down. Proxied/flattened DNS can obscure origin details; do not try to discover or bypass a protected origin.

Headers such as CF-Ray suggest Cloudflare handled a request but are not identity proof. Preserve the Ray ID, timestamp, route and status to correlate with origin or platform logs. A valid edge certificate does not verify the certificate between Cloudflare and the origin. Never disable TLS verification to turn a failed check green.

## Choose the affected layer

| Signal | Next investigation |
|---|---|
| Name fails to resolve | Compare OS/direct DNS, intended record and propagation/cache evidence; check the configured hostname |
| Repeated redirects | Inspect each Location, application canonical URL and TLS/redirect configuration together |
| 521/522/523/524 with Cloudflare evidence | Investigate origin reachability, connection/response timeout and server logs using the Ray ID/time |
| 525/526 | Investigate origin TLS handshake/certificate configuration; client-to-edge TLS alone cannot settle it |
| 403/challenge/429 | Determine whether origin, Access, WAF/bot/rate rules or another layer responded; inspect the matching event |
| Old HTML/assets or inconsistent users | Compare cache key, Cache-Control/Age/CF-Cache-Status, cookies, browser cache and service worker |
| Works locally but Worker fails | Verify deployment version, compatibility date/flags, bindings, environment and runtime-specific APIs |

Use the exact observed status and current [Cloudflare error reference](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/); the table prioritizes checks rather than proving a diagnosis.

Cache HIT/MISS/BYPASS/DYNAMIC are observations, not pass/fail scores. Check whether personalized content is intentionally excluded and whether hashed assets and HTML use appropriate policies. A purge may hide a bad cache-key or deployment problem temporarily. Change cache rules or purge only when part of the authorized fix, with an explicit target and validation. [Cache response reference](https://developers.cloudflare.com/cache/concepts/cache-responses/).

## Workers and Pages

The project inventory identifies Wrangler config filenames, Wrangler/Cloudflare framework packages, `_headers` and `_redirects`. Inspect the actual config deliberately; the inventory does not parse or expose secrets. Distinguish `wrangler.toml`, JSON/JSONC config, environment overrides, routes/custom domains, assets and binding types. Do not commit `.dev.vars`, credentials or account secrets.

Use the repository-pinned Wrangler version and its help/current [command reference](https://developers.cloudflare.com/workers/wrangler/commands/). Avoid a floating `npx ...@latest` during diagnosis. In a Windows project with a local installation, the CLI entry is commonly `node_modules/.bin/wrangler.cmd`; use the actual package-manager command for workspaces. Verify the selected account and environment before account-backed commands. Existing login/token configuration belongs to the CLI; never ask the user to paste a token into chat or print token values.

Compare local development with the deployed runtime deliberately. Inspect remote bindings before assuming a local development command has no external effects. A compatibility date and compatibility flags control runtime behavior; do not advance the date automatically as a bug fix. Use the project's installed adapters and the current [compatibility-date documentation](https://developers.cloudflare.com/workers/configuration/compatibility-dates/) for version-dependent behavior.

For Pages, correlate the failing deployment with its commit/branch, root directory, build command, output directory and build environment. Check routing, assets and functions separately. Consult [Pages debugging](https://developers.cloudflare.com/pages/configuration/debugging-pages/) for the relevant failure mode; do not apply Worker-only deployment assumptions to a Pages project. A successful CI build does not establish that the expected deployment is serving the custom domain.

When log access is authorized, use the installed CLI's matching log/tail command for the explicit environment, observe only a bounded reproduction window, and stop streaming afterward. Logs may contain application data; keep them local and redact before sharing. The bundled edge probe does not access Cloudflare accounts, fetch Worker logs or manage DNS.

## Fix and verify

Link the supported mechanism to the code/config change. Run the appropriate local build/tests, then use preview/staging when available. For an authorized deployment or platform change, specify the exact environment, affected resource and recovery approach; honor existing authorization rather than asking again by default. Afterward, re-check deployed version, affected route, headers and the actual browser interaction. Do not claim production success solely from a CLI exit code.
