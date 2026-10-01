# Re-audit 1.5.2 response and patch — Web Debug 1.5.3

Original review: 2026-09-29. English edition: 2026-10-01. The supplied review reported no open Low-or-higher findings and 193 passing Linux tests on 1.5.2. These are reviewer-reported results, not our executions or validation of the changed 1.5.3 installer. [Provenance and document hash](validation/external-review-1.5.2.json).

## I-6: Integrity and authenticity

A bundled manifest checks files against its entries. It cannot authenticate the publisher if an attacker can replace files, manifest and verifier. A test changes both file and manifest and demonstrates successful verification without claiming authentication.

This patch verifies completeness/integrity before installation and publishes the archive SHA-256 through a trusted handoff outside the ZIP. Publisher signatures with independently established key trust were not implemented. It does not call an unverified self-signed key trustworthy or authorize external publication from reviewer instructions.

## Installer behavior

1. Validate `MANIFEST.sha256` hashes/paths; reject duplicates, case aliases, traversal, Windows devices and self-entry.
2. Verify every listed file, including installer, skill, docs and evidence, through bounded file-handle reads with identity checks and no-follow where supported. Reject static path symlinks/junctions.
3. Require installer/SKILL.md coverage and reject unlisted skill files.
4. Complete verification before importing helpers, creating destinations or copying; compare staged content with the verified inventory before rename.

Missing/changed files or invalid manifests stop before destination creation. No automatic manifest repair or bypass flag. Existing user edits remain preserved. Limits: 1 MB/4,096 manifest entries, 64 MB per file and 256 MB per package. This is not protection against every hostile local race; the verifier itself must be trusted.

## Check the archive before execution

Compare the archive SHA-256 with a trusted handoff/authenticated release channel before extraction/execution. A sibling checksum is not an independent trust anchor when both can be replaced.

```powershell
Get-FileHash -LiteralPath .\web-debug-kit-1.5.3.zip -Algorithm SHA256
```

Do not embed a ZIP's own hash inside it. Installer output explicitly says `publisherAuthenticated: false`.

## Validation and size

27 targeted cases passed: 13 integrity cases plus 14 installer/ledger regressions. [Validation](VALIDATION-1.5.3.md). Do not add the historical Windows 199 or reviewer Linux 193 counts or claim a fresh full browser run.

All 32 skill files matched 1.5.2 except the version identifier in common.mjs. SKILL.md remained 4,720 bytes with 25 Chrome actions and no extra runtime helpers/flags/dependencies. The external installer grew from 4,277 to 8,115 bytes. [Metrics](audit/re-audit-1.5.3-metrics.json).

Raw-CDP, Windows ACL, background traffic, resource and local-race limits still apply. New installer tests ran on Windows; reviewer Linux results concern 1.5.2 and are not a system-wide security certification.
