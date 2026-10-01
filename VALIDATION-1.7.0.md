# Web Debug 1.7.0 validation

Local validation on 2026-10-01, Windows / Node 24.18.0:

- Node unit/regression suites: 141 passed, one POSIX-only permissions case skipped, zero failed (142 cases).
- Python maintenance-tool tests: seven passed, including a real local Git push blocked without a receipt, allowed after review, and blocked again after content changed. Synthetic test doubles validate gate orchestration, not application quality.
- Docker lab: live Linux-container canary passed for non-root execution, no inherited synthetic secret/host mounts, read-only root, dropped capabilities/no-new-privileges and unavailable external networking. No personal files or credentials were used.
- Browser evaluation: all three deliberately buggy controls failed and all three reference repairs passed against local Chrome through direct CDP. This validates the grader controls; no separate Codex/Claude model run or manual-rubric pass is claimed.
- Managed updater: tests cover signature tampering, unknown keys, traversal/devices, enrollment, staged update/rollback, local edits, downgrade policy, modified backups, linked content and untrusted download redirects.
- Report delivery: mocked transport verifies explicit preview review, private-security rejection, receipts, duplicate suppression, unknown-outcome refusal/recovery and restricted endpoints. No synthetic issue was posted to the public repository.
- Knowledge reviews: official Chrome debugging, Node WebSocket and React hydration sources were fetched and three claims reviewed against exact hashes/quotes. Chrome/Node applicability was checked against observed versions; React remains unknown for an unspecified project. Other sources are not newly certified.

Installer/package, exact-revision CI and final release verification are separate checks; consult the release's CI link. Signatures authenticate publisher bytes, not safety. Docker and filesystem controls do not guarantee protection against kernel flaws or every same-user race. No live Cowork account update is claimed.

The first Linux CI attempt correctly blocked the synthetic hook fixture because hook setup changed its executable bit after the fixture commit. The fixture now records that mode before committing. The gate was not weakened; corrected tests must pass on the final CI revision.

A GitHub-hosted Windows browser attempt produced no capture and failed closed. Bounded, redacted startup diagnostics are now retained. A subsequent exact-revision run passed the browser controls on both hosted operating systems; this does not establish the root cause of the earlier environment-sensitive startup failure or guarantee every cold start.

A later hosted run identified `Browser.getVersion` startup timeout before page actions. Owned pipe startup now has a separate bounded 45-second budget instead of the ordinary 15-second CDP command budget. Page-action budgets and browser sandbox protections are unchanged; no failed action is silently replayed. Final CI must pass with this change before release.
