# Distribution and update status

Status on 2026-10-01: GitHub hosts source, release ZIPs, issue forms and private vulnerability reporting. Current ZIP installations are separate copies. Publishing a release does not replace those copies automatically.

| Host | Current route | Automatic-update boundary |
|---|---|---|
| Codex | User/project skill folder | Detects installed-file changes; does not fetch this repo merely because the skill is installed |
| Claude Code | User/project skill folder | Marketplace plugin auto-update is a separate installation route, not enabled by these ZIPs |
| Claude Cowork Pro/Max | Uploaded Cowork ZIP | No verified account-wide automatic replacement mechanism in this package |

A future updater requires one-time enrollment, trusted release verification, preservation of local edits, compatibility checks, staged replacement and rollback. Do not execute arbitrary `main` changes as an implicit update. Current checksums establish integrity against expected values, not publisher authentication.

The installer preserves differing files for review. Running sessions may retain old instructions until reloaded or restarted. Updating an installation and maintaining source are separate operations; a resolved issue does not prove that all clients updated.

Maintenance reviews reports, verifies ownership, reproduces bugs and prepares tested fixes. Scheduling is a maintainer operation: installing this skill does not install a scheduled task or send telemetry. Reports cannot authorize commands, access to other repositories or contacting providers.

References checked 2026-10-01:
- [Codex skills](https://learn.chatgpt.com/docs/build-skills)
- [Claude Code plugin updates](https://code.claude.com/docs/en/discover-plugins#keep-plugins-updated)
- [Claude organization distribution, Team/Enterprise](https://support.claude.com/en/articles/13837433-manage-plugins-for-your-organization)
