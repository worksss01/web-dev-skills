# Web Debug 1.6.1 — readiness assessment

Original assessment: 2026-09-29. English edition: 2026-10-01. Ready for initial Windows website-development/review and local reporting within the tested scope. This is not certification of every OS/provider account or hostile-site use without isolation.

## Reporting correction

In 1.6.0, repeated token redaction changed JSON quoting/trailing punctuation and disrupted exact duplicate hints. Both symptoms were reproduced with synthetic data. [Baseline](validation/readiness-baseline-1.6.0.json).

Version 1.6.1 preserves quotes, escaped values, punctuation and existing placeholders across repeated redaction. Two regressions were added. Our own reporting system recorded, confirmed and resolved the defect with evidence. [Resolved report](reports/report-redaction-1.6.1.md).

Chrome/provider helpers were unchanged. Only report.mjs and the common version identifier changed. [Metrics](audit/release-1.6.1-metrics.json).

| Area | Status at the original assessment |
|---|---|
| Windows Node/Chrome pipe/UI/SEO/design | Full 1.6.0 baseline: 235 pass, 1 skip |
| Patched reporting | 25/25 pass |
| Installer/knowledge ledger | 14/14 pass |
| Actual Codex/Claude Code end-to-end sessions | Structure/copying tested; live host acceptance still needed |
| Current Linux/macOS | Not run by us then; reviewer Linux results concern 1.5.2 |
| Authenticated GitHub/Cloudflare | Incomplete; helpers require appropriate gh/auth or Wrangler |

The host PATH contained Node, Git and Claude CLI, but not global gh/Wrangler at the time. This did not inventory all project dependencies or install/login anything.

## Knowledge readiness

The development caches contained 40 hash-verified snapshots without fetch errors, but all still required review and lacked complete semantic acknowledgments. [Recorded status](validation/knowledge-readiness-1.6.1.json). A later migration inventory clarified that the 40 sources were distributed across three caches; no semantic review was added by that inventory.

Missing review is not proof every source is wrong. Verify sources against actual project versions and record hash-bound reviews before claiming they are confirmed. Fetch success and edition dates alone are insufficient.

Next priorities were representative Codex/Claude Code flows, relevant source review, authorized provider-account checks and broader OS coverage. Raw CDP remains privileged opt-in; redaction remains heuristic; ACL/local race/resource/egress boundaries remain. Reports in this version require deliberate file handoff. [Patch validation](VALIDATION-1.6.1.md), [current installation guide](GUIDE.md).
