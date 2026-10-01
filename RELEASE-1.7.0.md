# Web Debug 1.7.0 — maintenance and managed delivery

Six additions: content-bound publication receipts and a project pre-push hook; a constrained Docker reproduction lab; version/hash/quote-bound knowledge reviews; controlled browser evaluation cases and manual AI rubrics; opt-in signed updates with local-edit protection and rollback; and reviewed GitHub report submission with deduplication and uncertain-outcome recovery.

Maintainer tooling lives outside the installed skill. Core/Cowork executable helpers remain identical. Cowork account-uploaded ZIP replacement is still manual; the updater supports managed local Codex/Claude Code installations, not account administration.

Default installations do not check for updates until enrolled. Default report commands remain local; report send requires an exact preview hash and actual user authorization. Private vulnerability reports never go through the public issue transport. The signature trust anchor is public; the private signing key stays outside the repository and all archives.

Quality/security gates are layered controls, not proof of zero vulnerabilities. Container isolation is not a guarantee against kernel/daemon flaws. Evaluation controls do not count as independent model acceptance tests. Knowledge statements require real semantic review, and unknown versions remain unknown. See [maintainer workflow](docs/MAINTENANCE.md) and [validation](VALIDATION-1.7.0.md).
