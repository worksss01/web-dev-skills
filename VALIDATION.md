# Web Debug 1.5.0 validation

Original run: 2026-09-28, Windows 11 Home 26200, Node 24.18.0, Chrome 154.0.8037.57. English edition: 2026-10-01; no historical results were rerun or relabeled for this translation.

| Suite | Result |
|---|---|
| Unit / diagnostics / platforms / quality / adversarial / review security | 80 pass, 1 POSIX-permissions skip |
| Original Chrome integration | 39/39 pass |
| Adversarial Chrome | 13/13 pass |
| Skills review Chrome regressions | 22/22 pass |
| Installer / knowledge ledger | 14/14 pass |
| Windows smoke | 7/7 in both PowerShell 7.6.5 and 5.1 |
| Skill validator | Pass |
| Package links / identical skill payloads | Checked during packaging |

Total: 175 passed, 1 skipped. Count Windows smoke once across shells. A corpus of 100 malformed plans counts as one test; six baseline validator comparisons are supporting evidence, not extra tests.

## Observed coverage

Separate Chrome profiles and explicit targets; real pointer/keyboard/fill; DOM/AX/console/network; parseable PNG/trace; failing/passing layout, Thai text, indexing intent, JSON-LD and opaque-background contrast with unreliable gradients skipped. Malformed CLI/plans/reports/ledgers cover links, junctions, hardlinks, collisions, sizes, UTF-16 and protocol envelopes.

Interaction regressions cover changing focus, checkbox fill, invisible ancestors, failure traces, unresolved promises, concurrent runs and another client's emulation. Knowledge tests cover relocation, legacy paths, snapshots/hashes/dates and existing user files. Windows smoke uses spaces/Thai paths and a test listener, preserving that process and linked output targets.

GitHub uses API-shaped fixtures; Cloudflare/security uses HTTP fixtures and redirect/credential/redaction cases. All prior 24 actions, 14 historical helpers and references remained; 1.5 added waitForSelector and two pipe/lifecycle helpers. Private pipes, cleanup/ignore rules, startup capture, spoofed DOM/style APIs, HMAC scopes, external observation, curated inputs, exclusive output and oversized eval were checked. See [review response](REVIEW-RESPONSE.md) and the [historical 1.4 audit](AUDIT.md).

## Evidence

- [Unit/TAP](validation/unit-validation.json)
- [Chrome](validation/browser-validation.json)
- [Review Chrome](validation/review-browser-validation.json)
- [Baseline comparisons](validation/review-baseline-comparison.json)
- [Adversarial Chrome](validation/adversarial-browser-validation.json)
- [Installer/ledger](validation/package-validation.json)
- [PowerShell 7](validation/windows-ps7-validation.json), [5.1](validation/windows-ps51-validation.json)
- [Optimization](audit/optimization.json), [1.5 metrics](audit/review-1.5-metrics.json)
- [Historical Cloudflare public probe](validation/cloudflare-public-probe.json)

Fixture images include intentional occlusion and duplicate-selector controls, not a delivered website design. Multilingual fixture text is retained as original evidence.

![Mobile fixture](validation/after-mobile.png)
![Desktop fixture](validation/after-desktop.png)

## Not established by this run

No live Claude Code, macOS/Linux, Node 22.4, WSL runtime or authenticated provider testing. gh was absent; reviewer Linux results are separately attributed. The skipped POSIX mode case does not certify Windows ACLs; memory isolation and all filesystem races remain unproven.

Forty sources were registered/fetched in earlier work, separately from semantic review. The historical 1.2 Cloudflare public probe passed HTTP/TLS/cache and OS resolution but direct DNS queries timed out. These results do not guarantee ranking, AI citation, naturalness studies, rich results, accessibility compliance or system-wide security.

## Reproduce

```sh
node --test tests/unit.test.mjs tests/diagnostics.test.mjs tests/platforms.test.mjs tests/quality.test.mjs tests/adversarial.test.mjs tests/review-security.test.mjs
node tests/browser-smoke.mjs --work work/browser-check
node tests/adversarial-browser.mjs --work work/adversarial-browser-check
node tests/review-browser.mjs --work work/review-browser-check
node tests/package-smoke.mjs --work work/package-check
node tests/windows-smoke.mjs --work "work/windows-check unicode"
```

Use authorized project work directories. Tests close their own servers/Chrome; legacy suites retain selected profiles while review-browser checks/removes owned profiles. Repeat Windows smoke with `--shell powershell.exe` for PowerShell 5.1. Original validation also exercised Thai paths.
