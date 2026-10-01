# Web Debug 1.6.0 validation

Original run: 2026-09-29, Windows 11 Home 26200, Node 24.18.0, Chrome 154.0.8037.57. English edition: 2026-10-01.

| Suite | Passed | Evidence |
|---|---|---|
| Unit / diagnostics / security / integrity / reporting | 128, plus 1 POSIX skip | [JSON](validation/unit-1.6.0.json) |
| Chrome | 39 | [JSON](validation/browser-1.6.0.json) |
| Adversarial Chrome | 13 | [JSON](validation/adversarial-browser-1.6.0.json) |
| Review | 22 | [JSON](validation/review-browser-1.6.0.json) |
| Re-audit | 6 | [JSON](validation/re-audit-browser-1.6.0.json) |
| File drag | 5 | [JSON](validation/file-drag-1.6.0.json) |
| Protocol review | 1 | [JSON](validation/protocol-review-1.6.0.json) |
| Installer / ledger | 14 | [JSON](validation/package-1.6.0.json) |
| Windows smoke | 7 in both shells | [PS7](validation/windows-ps7-1.6.0.json), [PS5.1](validation/windows-ps51-1.6.0.json) |

Total: 235 pass, 1 skip, 0 fail. Windows counts once; schema methods are not tests; 23 reporting cases are already included in unit counts.

Reporting cases cover bounded schemas/enums, redaction and Thai input; suspected versus confirmed ownership; provider/project patch restrictions; required resolution version/evidence; amendments preserving versions/history; duplicate hints/canonical IDs; private/security export and Markdown fences; no automatic secrets/file/network collection; missing/mixed stores, links/aliases/locks/collisions; malformed records/IDs/oversize; CLI template/create/triage/export.

Tests do not prove automatic root-cause classification, perfect redaction or resistance to every same-user storage attack. There was no remote submission feature to test. No new live Claude Code, Linux/macOS/Node 22.4, Headless Shell or authenticated provider test; reviewer Linux evidence concerns 1.5.2, not new reporting.

```sh
node --test tests/unit.test.mjs tests/diagnostics.test.mjs tests/platforms.test.mjs tests/quality.test.mjs tests/adversarial.test.mjs tests/review-security.test.mjs tests/re-audit.test.mjs tests/raw-policy.test.mjs tests/install-integrity.test.mjs tests/report.test.mjs
node tests/browser-smoke.mjs --work work/browser-check
node tests/adversarial-browser.mjs --work work/adversarial-check
node tests/review-browser.mjs --work work/review-check
node tests/re-audit-browser.mjs --work work/re-audit-check
node tests/file-drag-browser.mjs --work work/file-drag-check
node tests/protocol-review.mjs --work work/protocol-check
node tests/package-smoke.mjs --work work/package-check
node tests/windows-smoke.mjs --work work/windows-ps7 --shell pwsh.exe
node tests/windows-smoke.mjs --work work/windows-ps51 --shell powershell.exe
```

Use a verified full kit and fresh project work directories. Fixtures do not transmit real reports or alter global settings/installations; tests close processes they create.
