# Web Debug 1.5.3 validation

Original run: 2026-09-29, Windows 11 / Node 24.18.0. English edition: 2026-10-01. Only installer/integrity guidance changed; runtime differed from 1.5.2 only in its version identifier.

| Check | Result | Evidence |
|---|---|---|
| Manifest/installer integrity | 13 pass, 0 fail/skip | [JSON](validation/install-integrity-1.5.3.json) |
| Installer/ledger regressions | 14 pass | [JSON](validation/package-1.5.3.json) |
| Skill-file comparison | Version-only difference | [Metrics](audit/re-audit-1.5.3-metrics.json) |
| Packaging | Required artifacts, links, hashes and payload equality checked | Manifest and archive sidecars |

Total: 27 executed tests passed. Do not add packaging checks or prior baselines. Integrity cases cover normal/Unicode/space paths, changed/missing files, absent/oversized manifests, unlisted skill files, duplicate/case aliases, malformed hashes, traversal/absolute/devices, links, required coverage and rejection before helper import/destination creation. A changed-file-plus-changed-manifest case deliberately passes without claiming publisher authentication.

[Windows 1.5.2 baseline](VALIDATION-1.5.2.md): 199 pass, 1 skip. [Reviewer Linux 193 pass](validation/external-review-1.5.2.json) is externally reported for 1.5.2, not our validation of the new installer on Linux.

```sh
node --test --test-reporter=tap tests/install-integrity.test.mjs
node tests/package-smoke.mjs --work work/package-check
```

Use a checksum-verified full kit and fresh work directory. Review intended source changes before rebuilding the manifest; never repair it to hide unexplained corruption. Tests use local fixtures, not global installs. [Integrity/authenticity response](RE-AUDIT-1.5.3.md).
