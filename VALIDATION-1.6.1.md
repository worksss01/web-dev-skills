# Web Debug 1.6.1 validation

Original run: 2026-09-29, Windows / Node 24.18.0. English edition: 2026-10-01. This patch changed reporting redaction and the version identifier only.

| Check | Result | Evidence |
|---|---|---|
| Reporting, including two regressions | 25 pass, 0 fail/skip | [JSON](validation/report-1.6.1.json) |
| Installer/ledger | 14 pass | [JSON](validation/package-1.6.1.json) |
| Source scope | Report + version only | [Metrics](audit/release-1.6.1-metrics.json) |

39 tests passed in this patch. Do not add [1.6.0's 235 pass / 1 skip](VALIDATION-1.6.0.md) or claim a full new Chrome run. New cases preserve quoted/escaped JSON, placeholders and trailing punctuation across repeated redaction and retain duplicate hints across repeated reads. All values are synthetic.

[Baseline](validation/readiness-baseline-1.6.0.json), [resolved internal report](reports/report-redaction-1.6.1.md).

```sh
node --test tests/report.test.mjs
node tests/package-smoke.mjs --work work/package-check
```

Use a verified full kit/fresh work directory. This does not guarantee redaction of all data/languages. [Readiness limits](RELEASE-1.6.1.md).
