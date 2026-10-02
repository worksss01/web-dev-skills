# Web Debug 1.8.2 — full review kit

This is the full kit for code review and verification. The separate `web-debug-1.8.2.zip` contains only the installable skill plus a package notice. Both contain identical files under `web-debug/`. Version 1.8 adds short-brief design guidance and dated visual references while preserving the diagnostic and maintenance workflows.

- [1.8.2 release](RELEASE-1.8.2.md)
- [1.8.2 validation](VALIDATION-1.8.2.md)
- [1.8.1 release](RELEASE-1.8.1.md)
- [1.8.1 validation](VALIDATION-1.8.1.md)
- [1.8.0 release](RELEASE-1.8.0.md)
- [1.8.0 validation](VALIDATION-1.8.0.md)
- [Design evaluation cases](evals/design-briefs.md)
- [1.7.0 release](RELEASE-1.7.0.md)
- [1.7.0 validation](VALIDATION-1.7.0.md)
- [Reporting release and ownership model](RELEASE-1.6.0.md)
- [1.6.1 readiness assessment and patch](RELEASE-1.6.1.md)
- [1.6.1 targeted validation](VALIDATION-1.6.1.md)
- [Prior full 1.6.0 validation](VALIDATION-1.6.0.md)
- [1.6.1 size/capability metrics](audit/release-1.6.1-metrics.json)
- [Self-reported defect, now resolved](reports/report-redaction-1.6.1.md)
- [Knowledge ledger readiness](validation/knowledge-readiness-1.6.1.json)
- [Reporting instructions](web-debug/references/reporting.md)
- [Example private handoff](examples/report-example.md)
- [Prior installer integrity patch](RE-AUDIT-1.5.3.md)
- [Installer integrity cases](validation/install-integrity-1.5.3.json)
- [Installer/knowledge regression](validation/package-1.5.3.json)
- [Prior full Windows baseline](VALIDATION-1.5.2.md)
- [External Linux results reported for 1.5.2](validation/external-review-1.5.2.json)
- [Installed Chrome protocol review](validation/protocol-review-1.5.2.json)
- [Synthetic file-drag reproduction and regression](validation/file-drag-1.5.2.json)
- [Inventory of the previous 1.5.1 ZIPs](validation/zip-1.5.1-inventory.json)
- [Installation and migration](GUIDE.md)

`MANIFEST.sha256` covers the content of this kit and is checked before installation. The ZIP also has a sibling `.sha256` file. These establish integrity relative to an expected checksum, not publisher identity when all files come from the same untrusted source. Obtain the expected archive SHA-256 through the trusted handoff conversation or another authenticated channel before extracting/running code. ZIP sidecars are checksums; the separate core update payload is publisher-signed. See the update documentation for trust and migration limits. Review the evidence files and test code, not just the stated test total. Older reports remain versioned history.
