# Web Debug 1.6.3 — installation and usage

Web Debug supports Codex and Claude Code with shared instructions and dependency-free Node.js helpers. A separate Cowork ZIP adapts instructions while retaining identical executable helpers. Browser evidence uses direct Chrome CDP, without provider browser-control tools.

Version 1.6.3 makes distributed instructions, forms, examples and documentation English. Reporting preserves ownership distinctions and local-first storage; an AI may send a reviewed report when the user asks. See [release notes](RELEASE-1.6.3.md), [validation](VALIDATION-1.6.3.md) and [reporting](web-debug/references/reporting.md).

## Capabilities

| Area | Tools and guidance |
|---|---|
| Web debugging | Project versions, build/runtime/hydration/network diagnosis and before/after comparison |
| Direct Chrome | Tabs, clicking, filling, keyboard, DOM/AX, console/network, screenshots and traces |
| Website design / UI | Responsive layout, typography, interaction, overflow, controls and bounded contrast checks with visual review |
| SEO / AEO | Metadata, canonical, robots/indexing intent, JSON-LD and clear evidence-backed answers |
| Natural copy | Preserve facts/voice, review repetition, claims and CTA labels across supported languages |
| Cybersecurity | Defensive review and passive security-header/cookie-attribute checks |
| Cloudflare | DNS/TLS/cache, edge/origin and Workers/Pages/Wrangler guidance |
| GitHub | PR/CI metadata through gh, comparing commit SHA and run attempt |
| Windows 11 | PowerShell, PATH, ports and Windows/WSL boundaries |
| Maintainable knowledge | 40 official sources with snapshots/hashes and semantic review distinct from fetching |
| Skill reports | Record defects, establish ownership, request evidence, track fixes and export reviewed reports |

Node.js 22.4+ and a shell are required. Chrome, gh, Wrangler and PowerShell are needed only for relevant tasks. The skill does not install prerequisites or log in automatically. A cloud runtime does not automatically access Chrome on the user's PC.

## Installation

Download from [Releases](https://github.com/worksss01/web-dev-skills/releases/latest). The lean `web-debug-1.6.3.zip` contains the skill and a package notice; `web-debug-kit-1.6.3.zip` additionally includes the installer, tests and evidence. Skill files match. Use the full kit for review. Cowork uses `web-debug-cowork-1.6.3.zip`; see [upload instructions](docs/cowork/UPLOAD.md).

Compare the ZIP SHA-256 against the trusted release/handoff before extracting and running code:

```powershell
Get-FileHash -LiteralPath .\web-debug-kit-1.6.3.zip -Algorithm SHA256
```

A checksum downloaded alongside a ZIP is not an independent trust anchor if both can be replaced. The manifest verifies integrity, not publisher identity; this release has no publisher signature.

Copy the lean folder to your host's user/project skill location, or run the full-kit installer from its extracted directory:

```sh
node install.mjs --project /absolute/path/to/your/repository --target both
```

The destination must be an existing Git repository. Choose `codex`, `claude` or `both`. Project destinations are `.agents/skills/web-debug` and `.claude/skills/web-debug`; personal equivalents are under your home directory. [Codex documentation](https://learn.chatgpt.com/docs/build-skills), [Claude Code documentation](https://code.claude.com/docs/en/skills).

Identical installs are reusable; differing files are preserved for explicit comparison/update. The installer does not edit AGENTS.md or permissions. Start a new session if the skill is not discovered. The full-kit manifest covers installer, skill, docs and evidence; missing/changed/unlisted files or unsupported paths stop installation before creating destinations. Do not regenerate a manifest merely to hide unknown corruption.

## Ask an AI to use it

Use `$web-debug` in Codex, `/web-debug` in Claude Code, or select `web-debug-cowork` in Cowork:

> Use Web Debug to investigate the signup flow. Reproduce it with code and Chrome evidence, fix the cause and replay the same case.

Request the relevant scope, such as SEO/AEO and natural copy while preserving facts, or a failed Cloudflare deployment in GitHub Actions. The skill loads task-specific references rather than auditing everything. Instructions are English; responses and website copy still follow the user's requested language.

## Report a skill problem

Ask the AI to prepare a local report or explicitly ask it to send a reviewed report to this project's GitHub repository. Non-sensitive reports use [Issues](https://github.com/worksss01/web-dev-skills/issues/new/choose); vulnerabilities use [private reporting](https://github.com/worksss01/web-dev-skills/security/advisories/new).

```sh
node .agents/skills/web-debug/scripts/debug.mjs report create --title "Observed symptom" --summary "Behavior and impact" --origin unknown
node .agents/skills/web-debug/scripts/debug.mjs report list
node .agents/skills/web-debug/scripts/debug.mjs report export --id REPORT_ID --out work/report-to-maintainer.md
```

Use the returned ID. The default store is `work/web-debug/reports`. The helper creates JSON and exports Markdown locally; the maintainer receives nothing until a separate authorized handoff succeeds. Security reports default to private and cannot use public export. [Example](examples/report-example.md), [input form](examples/report-input.json), [handoff instructions](web-debug/references/reporting.md).

## One command entry point

From a project with the Codex skill installed:

```sh
node .agents/skills/web-debug/scripts/debug.mjs --help
node .agents/skills/web-debug/scripts/debug.mjs project --project . --out work/project.json
node .agents/skills/web-debug/scripts/debug.mjs chrome check --url http://localhost:3000 --out work/check.json
```

Check starts a separate headless Chrome over a pipe, captures DOM/AX and startup console/network evidence, then closes/removes its profile. Use `--headed` for a visible window or `--plan work/repro.json` for interactions/screenshots/traces. Navigating still executes page JavaScript and network requests; read-only actions are not network isolation. `ok: true` means actions succeeded, not that findings are absent.

Default Chrome state is `work/web-debug/chrome`; override with `--state-dir`. `--out` keeps stdout compact and saves full evidence; use `--full` for full stdout. Choose a fresh output path or explicit `--overwrite`.

Other commands: `analyze`, `copy`, `edge`, `github`, `windows`, `knowledge`. Use their `--help`:

```sh
node .agents/skills/web-debug/scripts/debug.mjs edge --url https://example.com/ --security --out work/edge.json
node .agents/skills/web-debug/scripts/debug.mjs copy --file work/page-copy.txt --language en --out work/copy.json
node .agents/skills/web-debug/scripts/debug.mjs windows --project . --ports 3000,5173 --out work/windows.json
node .agents/skills/web-debug/scripts/debug.mjs knowledge status --out work/web-knowledge
```

Copy review defaults to English in 1.6.3. Set the actual BCP 47 content language explicitly, such as `th`, for localized segmentation. [Chrome actions](web-debug/references/chrome.md); [skill router](web-debug/SKILL.md).

## Knowledge and scope

The 2026-09-28 edition date is not a perpetual freshness guarantee. Fetch relevant source IDs, read the snapshots, then record semantic review using [maintenance](web-debug/references/maintenance.md). Paths are relative to ledger.json; move the entire knowledge folder, snapshots and review history together. Browser sessions are machine-specific and must be recreated.

Helpers run with host privileges. Plans/pages/reports cannot grant authority; review advanced inputs and use host isolation as appropriate. Inspect evidence before sharing. Findings do not guarantee ranking, AI citations, authorship detection, accessibility compliance or system-wide security.

## Migrating from 1.4

| Task | Current behavior |
|---|---|
| Quick inspection | `chrome check --url URL --out work/check.json` |
| Persistent Chrome | `launch --allow-tcp-debugging`, then new/tabs/run/stop; local TCP remains unauthenticated |
| Eval/assert/waitFor | Reviewed scripts need `--allow-script`; prefer waitForSelector when sufficient |
| Raw methods | Require `--allow-raw-cdp` outside the default allowlist, including Debugger.enable since 1.5.1; specified Browser/Target, file-input/download and protection-bypass APIs remain blocked |
| Raw since 1.5.2 | Restricted domains; unlisted Extensions/PWA domains rejected; drag data must not contain file lists |
| External browsers | Require `--allow-external-browser`; interaction also needs `--allow-external-actions` and applicable script/raw flags |
| Plan input files | Place authorized files in inputs/ under the plan directory or work root |
| Screenshot/trace | Relative PNG/JSON under work root; reject links/junctions and case variants of inputs/; overwrite is explicit |
| Profiles | Check cleans up unless keep-profile; persistent purge validates ownership |
| Comparisons | Reuse the state/work context for the same private HMAC key; never share .context-key |

Back up local edits before replacing an installation. No machine-level AGENTS.md change is needed. Helper path guards do not constrain the entire browser; raw CDP can access sessions/cookies and execute script. Flags document selected privileges but do not independently establish approval. Host/OS permissions remain the enforcement boundary.
