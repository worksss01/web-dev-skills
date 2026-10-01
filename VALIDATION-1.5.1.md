# Web Debug 1.5.1 validation

Original run: 2026-09-29 Asia/Bangkok; JSON timestamps use UTC. Windows 11 Home 26200, Node 24.18.0, Chrome 154.0.8037.57. English edition: 2026-10-01.

| Suite | Result | Evidence |
|---|---|---|
| Unit / diagnostic / platform / quality / security / re-audit | 86 pass, 1 skip | [JSON](validation/unit-1.5.1.json) |
| Chrome | 39 pass | [JSON](validation/browser-1.5.1.json) |
| Adversarial Chrome | 13 pass | [JSON](validation/adversarial-browser-1.5.1.json) |
| Review Chrome | 22 pass | [JSON](validation/review-browser-1.5.1.json) |
| Re-audit Chrome | 6 pass | [Baseline and result](validation/re-audit-browser-1.5.1.json) |
| Installer / ledger | 14 pass | [JSON](validation/package-1.5.1.json) |
| Windows smoke | 7 pass in both shells | [PS7](validation/windows-ps7-1.5.1.json), [PS5.1](validation/windows-ps51-1.5.1.json) |
| Skill validator | Pass | Frontmatter/naming/scaffold |
| ZIPs/links | Checked in packaging | Matching skill payloads and archive checksums |

Total: 187 pass, 1 POSIX-only skip, 0 fail. Count Windows once; do not multiply mutation or baseline evidence counts.

New evidence: baseline Debugger/inspect timeout in 21.3 seconds; fixed preflight and quick observation on debugger fixtures; Windows case-alias input overwrite blocked including internal junction/overwrite; specified direct file/Target methods rejected while allowed diagnostics remain; project manifest reader rejects links/oversize/swap/growth but accepts normal files/hardlinks. Earlier UI/SEO/design, lifecycle, install and ledger cases were replayed.

[Response and limits](RE-AUDIT-RESPONSE.md). No certification of ACLs, parent races, renderer resource/egress or agent permission choices. No live Claude Code, Linux/macOS/Node 22.4, Headless Shell, WSL or authenticated provider testing was added; no production/account changes.

```sh
node --test tests/unit.test.mjs tests/diagnostics.test.mjs tests/platforms.test.mjs tests/quality.test.mjs tests/adversarial.test.mjs tests/review-security.test.mjs tests/re-audit.test.mjs
node tests/browser-smoke.mjs --work work/browser-check
node tests/adversarial-browser.mjs --work work/adversarial-check
node tests/review-browser.mjs --work work/review-check
node tests/re-audit-browser.mjs --work work/re-audit-check
node tests/package-smoke.mjs --work work/package-check
node tests/windows-smoke.mjs --work "work/windows-ps7 unicode" --shell pwsh.exe
node tests/windows-smoke.mjs --work "work/windows-ps51 unicode" --shell powershell.exe
```

Use fresh project work directories; original validation included Thai paths. Optional `--baseline PATH_TO_1.5.0_SKILL` replays local fixtures only; the kit does not install that old version. Suites close their own processes; profile retention/cleanup follows each scenario.
