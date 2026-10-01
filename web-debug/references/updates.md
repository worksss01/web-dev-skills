# Managed updates

Ordinary ZIP installations stay unchanged unless enrolled. Codex/Claude Code local installations can opt into signed stable updates. Cowork account-uploaded ZIP replacement is not verified by this updater; do not enroll an ephemeral Cowork copy or claim it updated the account.

The publisher's Ed25519 public key ships in release-keys.json. Initial trust comes from the user's deliberate installation from the publisher; a key inside an arbitrary download is not an independent trust anchor. Signatures authenticate the signed bytes, not correctness or safety. The private signing key is never distributed.

## One-time enrollment

Install a reviewed release first. Download its matching `web-debug-update-VERSION.json` from the official release. Run with an empty, dedicated state directory in an authorized private work area:

```text
node SKILL_DIR/scripts/debug.mjs update enroll --bundle SIGNED_RELEASE.json --state work/web-debug-update-state --auto
```

Enrollment verifies every installed file against the signed payload; local differences stop it. State must be outside the skill folder. Use a different state directory per installation. A private marker in the installed folder records the location, baseline and policy; never package it or its backups.

`--auto` enables checks at normal web-helper startup, at most daily. This is not a resident service or an operating-system scheduled task. Reporting commands/help do not trigger these checks. Without auto, use explicit check/apply. Default policy allows patch updates in the same major/minor; `--allow-minor` additionally permits same-major minor updates. Major versions and incompatible release epochs need a deliberate migration.

```text
node SKILL_DIR/scripts/debug.mjs update status
node SKILL_DIR/scripts/debug.mjs update check
node SKILL_DIR/scripts/debug.mjs update apply --bundle SIGNED_RELEASE.json
node SKILL_DIR/scripts/debug.mjs update rollback
node SKILL_DIR/scripts/debug.mjs update enable
node SKILL_DIR/scripts/debug.mjs update disable
```

Checks download only public GitHub release metadata/payloads, without account tokens. Validate signatures, versions, path restrictions, sizes and file inventories before replacement. Back up the exact previous installation and use staged directory replacement. Stop on changed user files, untrusted keys, corrupt backups, downgrades or incompatible versions. Rollback disables auto to avoid reapplying the same update immediately.

An updated helper restarts its own command to avoid mixing module versions. The host AI session may retain old instructions until reloaded; replacing files does not rewrite conversation context. Offline/download failures retain the installed version. Concurrent same-user filesystem attacks and a compromised publisher key require stronger host controls; these checks are not an OS sandbox.

After rollback, re-enable auto only when a reviewed replacement is available; enabling it while the same defective release is latest can apply that release again. Enable/disable changes are locked and enabling refuses local edits.
