# Web Debug 1.5.2 validation

Original run: 2026-09-29 Asia/Bangkok, Windows 11 Home 26200, Node 24.18.0, Chrome 154.0.8037.57. JSON timestamps use UTC. English edition: 2026-10-01.

| Suite | Passed | Evidence |
|---|---|---|
| Unit / raw policy / schema scanner | 92, plus 1 POSIX skip | [JSON](validation/unit-1.5.2.json) |
| Chrome | 39 | [JSON](validation/browser-1.5.2.json) |
| Adversarial Chrome | 13 | [JSON](validation/adversarial-browser-1.5.2.json) |
| Review | 22 | [JSON](validation/review-browser-1.5.2.json) |
| Re-audit | 6 | [JSON](validation/re-audit-browser-1.5.2.json) |
| File/data-only drag | 5 | [Baseline and result](validation/file-drag-1.5.2.json) |
| Protocol review | 1 | [661 commands / 16 candidates](validation/protocol-review-1.5.2.json) |
| Installer / ledger | 14 | [JSON](validation/package-1.5.2.json) |
| Windows smoke | 7 in both shells | [PS7](validation/windows-ps7-1.5.2.json), [PS5.1](validation/windows-ps51-1.5.2.json) |

Total: 199 pass, 1 skip, 0 fail. Windows counts once; command counts, baseline replays and subcases are not extra tests. Skill validation and package equality, required artifacts, archive-local links and hashes passed. Reviewed/rejected candidates do not prove that raw CDP has no other routes.

No live Claude Code, Linux/macOS/Node 22.4, Headless Shell, WSL, authenticated providers, private-file or production testing. [Review response](RE-AUDIT-1.5.2.md).

```sh
node --test tests/unit.test.mjs tests/diagnostics.test.mjs tests/platforms.test.mjs tests/quality.test.mjs tests/adversarial.test.mjs tests/review-security.test.mjs tests/re-audit.test.mjs tests/raw-policy.test.mjs
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

Run in fresh authorized work directories. Optional file-drag `--baseline PATH_TO_1.5.1_SKILL` uses synthetic files and is not needed for current regressions. Protocol review opens/cleans an owned TCP Chrome only to read schema; candidate probe parameters are validated, not executed.
