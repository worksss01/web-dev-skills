# Adversarial review — Web Debug 1.3.0 to 1.4.0

Original review: 2026-09-28. English edition: 2026-10-01; historical results and scope are unchanged.

The review looked for defects in the tools and skill instructions, then corrected them while retaining capability. Tests used sentinel files, local HTTP fixtures, isolated Chrome profiles and temporary repositories. They did not attack third-party websites or accounts.

Fifteen baseline problems were reproduced and fixed. Priorities below describe local-tool remediation order, not CVSS scores or proof of unconditional remote exploitation.

| # | Problem / priority | Baseline observation | Change in 1.4.0 |
|---|---|---|---|
| 1 | Input/output collision — high | Copy/analyze could overwrite their own input | Check resolved paths and hardlink identity, including screenshot/trace outputs |
| 2 | Unknown CLI options — medium | Invalid options could silently succeed | Reject options not declared for the command |
| 3 | Boolean numeric coercion — medium | `true` became numeric 1 | Reject booleans, null and nonnumeric strings |
| 4 | Contradictory success — medium | `ok=true` with a failed step still produced `scenarioPassed=true` | Reject inconsistent captures |
| 5 | Inline URL payload leakage — medium | Data/javascript URL contents appeared in reports | Remove inline payloads and bound displayed URL length |
| 6 | Snapshot junction escape — context-dependent high | Reader accessed data outside the cache | Resolve and constrain cache, ledger and history paths |
| 7 | Missing knowledge evidence — medium | Missing snapshots or invalid review dates did not warn | Verify files/hashes; flag invalid/future dates for review |
| 8 | Output symlink overwrite — context-dependent high | Writing JSON changed a linked sentinel | Reject linked/non-file destinations; use temporary replacement |
| 9 | Malformed CDP crash — medium | Null JSON or malformed events caused uncaught errors | Validate envelopes, catch callbacks and mark evidence incomplete |
| 10 | Fill changed a checkbox — medium | Fill clicked a checkbox before typing | Check control type before interaction |
| 11 | Invisible-parent interaction — medium | A child of an opacity-zero parent could be clicked | Check ancestors, disabled and inert state |
| 12 | Late plan validation — medium | Early actions ran before an invalid later action was detected | Validate the whole plan before page actions |
| 13 | Missing failure trace — medium | Assertion failure skipped traceStop | Finalize an active trace where possible while preserving failure |
| 14 | Oversampling design scan — performance | 2,000-element fixture caused 4,500 style reads for a 500-sample limit | Stop after collecting the sample; 1,001 reads in the same fixture |
| 15 | Windows Unicode stdout — usability | Thai paths differed between stdout and saved JSON on PowerShell 7/5.1 | Escape Unicode in JSON stdout; keep UTF-8 files and console settings intact |

Baseline evidence: [general](audit/baseline-findings.json), [Chrome](audit/baseline-browser-findings.json), [Windows](audit/baseline-windows-findings.json). The suspected empty-fill bug was not reproduced in the baseline; its regression case preserves behavior rather than claiming a fix.

## Additional hardening

- Verify focus after clicking and select-all to reduce typing into a different field after focus-changing handlers.
- Lock browser mutations sharing a state directory; do not reset emulation the run did not change.
- Apply remaining waitFor time to evaluation; test promises that never resolve.
- Bound inputs, responses and events; truncated evidence cannot establish that omitted events never happened.
- Accept UTF-8/UTF-16 JSON BOMs; reject malformed or empty reports as success evidence.
- Resolve executables from absolute PATH entries rather than the current directory.
- Stage and verify installations; preserve differing installations and user edits.
- Replace metadata/report files safely and validate ledger schemas before mutation.

These are tested safeguards, not a new sandbox for Node or PowerShell.

## Conflicts and compatibility

| Concern | Preserved rule |
|---|---|
| SEO and privacy | Establish indexing intent; do not remove noindex from private pages to improve a score |
| AEO and natural copy | Do not impose FAQ/keyword formulas or invent expertise/evidence |
| Design and accessibility | Inspect context and images; size/contrast findings are not beauty or compliance scores |
| Security and usability | Test legitimate flows; do not disable TLS/CORS/sandboxing or add blanket policies to hide failures |
| Cloudflare and CI | Distinguish local builds, commits/checks, deployments and the live URL |
| Windows, WSL and portability | Runtime/session state is machine-specific; move relative snapshots with their files |
| Codex and Claude Code | Share SKILL.md and Node helpers without provider browser SDK/MCP dependencies |
| Other skills and host rules | Preserve host/repository permissions and workflows; tool availability grants no extra authority |

Documentation links and guidance were aligned with trace failure handling, locks, incomplete evidence and Unicode behavior.

## Reduced overhead

One `debug.mjs` entry point replaces the need to remember helper names while retaining old commands. With `--out`, stdout is compact and full evidence stays in the file; `--full` restores full stdout. Task-specific references load on demand. Design scans stop at their sample limit and copy metrics iterate segments rather than allocating the entire segment array. The lean ZIP contains only the skill; tests, images and reports stay in the full kit. Skill files match byte for byte.

[Measurements](audit/optimization.json) cover entry/README size, style reads and sample capture stdout. They are not universal speed or RAM improvements. Additional safeguards and tests can increase source and full-kit size.

## Remaining boundaries

Eval, raw CDP and plan paths require trusted inputs and appropriate host permissions. Static link/cache checks do not defeat every same-user filesystem race. Locks coordinate only a shared state directory; DevTools, external endpoints and copied state need separate coordination. URL redaction does not sanitize arbitrary console text, DOM, images or traces. Network/OS operations may outlive logical timeouts; the host should apply suitable process limits.

This review did not run a live Claude Code session, macOS/Linux, Node 22.4, authenticated GitHub/Cloudflare or every Chrome version. See [validation](VALIDATION.md). Knowledge still requires semantic review; hashes and tests do not certify that no errors remain.

## Reproduce

```sh
node --test tests/unit.test.mjs tests/diagnostics.test.mjs tests/platforms.test.mjs tests/quality.test.mjs tests/adversarial.test.mjs
node tests/browser-smoke.mjs --work work/browser-check
node tests/adversarial-browser.mjs --work work/adversarial-browser-check
node tests/package-smoke.mjs --work work/package-check
node tests/windows-smoke.mjs --work "work/windows-check unicode"
```

Run inside an authorized project. Tests close servers/Chrome they create and retain selected work artifacts/profiles for inspection; they do not modify personal Chrome profiles. Original Windows validation also exercised Thai paths.
