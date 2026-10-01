# Distribution and update status

Web Debug 1.7 supports opt-in signed updates for managed local installations. A downloaded ZIP alone does not enroll a user.

| Host | Supported route | Boundary |
|---|---|---|
| Codex | Install reviewed core, then enroll the installed folder with its matching signed payload | File updates do not rewrite the active AI conversation |
| Claude Code | Same managed local route | Host/session reload may be needed for changed instructions |
| Claude Cowork Pro/Max | Download and upload the Cowork ZIP | Account-level automatic ZIP replacement is not verified |

See [managed updates](../web-debug/references/updates.md) for enrollment, daily-on-use checks, explicit apply, rollback and disabling auto. Patch updates are the default policy; minor updates require enrollment opt-in and major changes require deliberate migration.

Signed payloads authenticate against the publisher key shipped in the trusted initial installation. The private key stays off GitHub. The updater rejects tampered signatures, unsafe paths, incompatible epochs, downgrades, changed user files and corrupt backups. No account credential is sent during update discovery/download. Initial package provenance, publisher-key protection and OS permissions remain trust dependencies.

Report transport is separate: creating and previewing a report stays local, and sending requires a reviewed content hash plus actual user authorization. Never infer reporting consent from update enrollment.

Maintainer automation reviews incoming issues and uses the publication gate and isolated lab. Installing the skill does not install a resident service, Git hook or OS scheduled task. The project hook is a separate maintainer setup action. A resolved issue does not prove every client was updated.

References checked 2026-10-01:
- [Codex skills](https://learn.chatgpt.com/docs/build-skills)
- [Claude Code plugin updates, an alternative route](https://code.claude.com/docs/en/discover-plugins#keep-plugins-updated)
- [Claude organization distribution, Team/Enterprise](https://support.claude.com/en/articles/13837433-manage-plugins-for-your-organization)
