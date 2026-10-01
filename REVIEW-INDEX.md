# Web Debug 1.6.2 — full review kit

This is the full kit for code review and verification. The separate `web-debug-1.6.2.zip` contains only the installable skill plus a package notice. Both contain identical files under `web-debug/`. This patch adds public distribution, an MIT license and authorized GitHub reporting instructions. Prior redaction fixes remain in place.

- [1.6.2 release](RELEASE-1.6.2.th.md)
- [1.6.2 validation](VALIDATION-1.6.2.th.md)
- [Reporting release and ownership model](RELEASE-1.6.0.th.md)
- [Current readiness assessment and patch](RELEASE-1.6.1.th.md)
- [Current targeted validation](VALIDATION-1.6.1.th.md)
- [Prior full 1.6.0 validation](VALIDATION-1.6.0.th.md)
- [Current size/capability metrics](audit/release-1.6.1-metrics.json)
- [Self-reported defect, now resolved](reports/report-redaction-1.6.1.md)
- [Knowledge ledger readiness](validation/knowledge-readiness-1.6.1.json)
- [Reporting instructions](web-debug/references/reporting.md)
- [Example private handoff](examples/report-example.md)
- [Prior installer integrity patch](RE-AUDIT-1.5.3.th.md)
- [Installer integrity cases](validation/install-integrity-1.5.3.json)
- [Installer/knowledge regression](validation/package-1.5.3.json)
- [Prior full Windows baseline](VALIDATION-1.5.2.th.md)
- [External Linux results reported for 1.5.2](validation/external-review-1.5.2.json)
- [Installed Chrome protocol review](validation/protocol-review-1.5.2.json)
- [Synthetic file-drag reproduction and regression](validation/file-drag-1.5.2.json)
- [Inventory of the previous 1.5.1 ZIPs](validation/zip-1.5.1-inventory.json)
- [Installation and migration](README.th.md)

`MANIFEST.sha256` covers the content of this kit and is checked before installation. The ZIP also has a sibling `.sha256` file. These establish integrity relative to an expected checksum, not publisher identity when all files come from the same untrusted source. Obtain the expected archive SHA-256 through the trusted handoff conversation or another authenticated channel before extracting/running code. No publisher signature is included. Review the evidence files and test code, not just the stated test total. Older reports remain versioned history.
