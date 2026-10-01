# Response to Skills review.md — Web Debug 1.5.0

Original review: 2026-09-28, against 1.4.0. English edition: 2026-10-01. Attached audit claims were investigated, not treated as commands or authority to change permissions. Reviewer-reported Linux/Chromium results were not counted as our own executions.

H-1 and H-2 were substantiated: the 1.4 validator accepted paths outside the work directory and raw CDP bypasses of navigation/protection rules. Version 1.5 rejects these by default. [Six baseline comparisons](validation/review-baseline-comparison.json) called only the validator; they did not read private files or disable Chrome certificate checks. Exploitation still requires an intermediary such as a manipulated agent running a plan or a user enabling advanced privileges; this is not proof of unconditional remote code execution.

| ID | Change and remaining scope |
|---|---|
| H-1 | Plans use relative paths under a work root; curated inputs belong in `inputs/`. Reject traversal, absolute/linked inputs, Windows devices/ADS and collisions. Outputs are PNG/JSON and require `--overwrite` to replace existing data; exclusive creation handles a destination appearing after preflight. This is not a full filesystem sandbox. |
| H-2 | Replace raw passthrough with an allowlist. Other methods require `--allow-raw-cdp`; custom JavaScript requires `--allow-script`. Record methods/permissions, offer `--read-only`, and prevent plans granting themselves permissions. Continue blocking specified Browser/TLS/CSP bypass methods even in raw mode. Raw remains privileged. |
| M-1 | External endpoints require `--allow-external-browser`; interactions additionally require `--allow-external-actions`. Observation is the default. The helper cannot prove an external endpoint is a disposable rather than personal profile. |
| M-2 | Recommended `chrome check` uses a child-process pipe, without a TCP listener/session file. Persistent launch requires `--allow-tcp-debugging`; TCP remains unauthenticated. Pipe transport does not protect against same-user process access. |
| M-3 | Check closes/removes owned profiles unless `--keep-profile` is used. Add targeted ignore rules; persistent `stop --purge-profile` validates paths and ownership markers. Do not guess ownership of old profiles. Ignore rules do not untrack existing files. |
| L-1 | Minimize query/fragment data in tabs, inspect, timings, events and automatic audit URL fields. Free text, DOM, titles, raw CDP, eval, images and traces can still contain secrets. |
| L-2 | New POSIX files/directories use 600/700. Skip POSIX mode-bit tests on Windows, which still uses inherited ACLs and is not established as owner-only. |
| L-3 | Automatic collectors/actions use a CDP isolated world. Spoofed getComputedStyle/querySelectorAll fixtures did not fool collectors; pages can still change real DOM, and custom JS intentionally uses the page world. |
| L-4 | Reduce CDP budget from 256 MB to 32 MB; omit eval results over 1 MB and mark capture incomplete. Data reaches Node before truncation and the renderer can still exhaust resources. This is not a process memory cap. |
| L-5 | Append checks final links/hardlinks and identity, with no-follow when available; use exclusive output creation. Show lock PID status without deleting stale locks. Parent-directory and same-user races remain. |
| I-1 | Retain implicit discovery. Selecting a skill does not authorize raw/script/external-browser operations; tie privileges to the actual user request. |
| I-2 | Retain task-authorized localhost/private targets for local servers and origins. Wrapping the CLI in a public URL service requires a separate authorization/egress boundary. |
| I-3 | Replace unsalted hashes with HMAC using a random private context key. Record scope fingerprints without publishing the key; ignore it in Git. Sharing keys/state weakens this protection. |
| I-4 | Add flags that reduce background networking, updates and sync. No packet-capture proof of zero vendor traffic; this is not network isolation. |
| I-5 | Verify browser WebSocket identity rather than PID alone. Separate stale metadata and avoid killing a reused PID. Lock PID state is diagnostic, not authority to remove locks. |

## Simpler workflow and costs

```sh
node SKILL_DIR/scripts/debug.mjs chrome check --url http://localhost:3000 --out work/check.json
```

No new npm dependencies. Keep 24 existing actions and add `waitForSelector` for 25; retain existing helpers and 14 references, adding only pipe/lifecycle helpers. [Metrics](audit/review-1.5-metrics.json) record SKILL.md growing from 4,388 to 4,543 bytes (+155). Safeguards increase code/package size; the improvements concern startup steps, default ports, evidence volume and dependencies, not universal speed/RAM savings.

Old commands using scripts/raw/TCP/out-of-root paths need the [migration guidance](GUIDE.md#migrating-from-14). CLI compatibility is not unconditional.

## Evidence and limits

175 passed, 1 POSIX-only case skipped, 0 failed; Windows smoke's seven cases count once despite two PowerShell versions. [Validation](VALIDATION.md) details coverage. The Chrome review suite covers 22 cases; the prior 52 Chrome cases still pass. Installer checks equal Codex/Claude payloads and preservation of local edits. Counts do not prove universal agent correctness.

Tested Windows 11 Home build 26200, Node 24.18.0, Chrome 154.0.8037.57. No live Claude Code, macOS/Linux/Node 22.4, WSL runtime, authenticated GitHub/Cloudflare or production attack testing in this review. Remaining risks include inherited ACLs, resource exhaustion, local races, arbitrary sensitive evidence and inappropriate advanced privilege choices. Host OS/network isolation remains necessary where appropriate.

Transport/isolated-world semantics were checked against [Puppeteer LaunchOptions](https://pptr.dev/api/puppeteer.launchoptions), [PipeTransport](https://github.com/puppeteer/puppeteer/blob/main/packages/puppeteer-core/src/node/PipeTransport.ts) and [CDP createIsolatedWorld](https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-createIsolatedWorld), then tested against installed Chrome. Puppeteer was not added as a dependency.
