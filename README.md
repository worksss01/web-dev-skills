# Web Dev Skills

Reusable AI skills for web development, debugging, UI/UX, SEO, AEO, and security.

The current skill is **Web Debug 1.7.0**: concise instructions, dependency-free Node.js helpers and direct Chrome DevTools Protocol (CDP) evidence. Chrome control does not require OpenAI or Anthropic browser tools.

[Installation and usage](GUIDE.md) · [Downloads](https://github.com/worksss01/web-dev-skills/releases/latest) · [Report a problem](https://github.com/worksss01/web-dev-skills/issues/new/choose) · [Report a vulnerability privately](https://github.com/worksss01/web-dev-skills/security/advisories/new)

## Choose your package

| Environment | Package | Installation |
|---|---|---|
| Codex | `web-debug-1.7.0.zip` | Copy the extracted `web-debug` folder to `~/.agents/skills/` or the project's `.agents/skills/` |
| Claude Code | `web-debug-1.7.0.zip` | Copy it to `~/.claude/skills/` or the project's `.claude/skills/` |
| Claude Cowork | `web-debug-cowork-1.7.0.zip` | Upload the complete ZIP in Skills → Add → Upload skill |
| Review / project installer | `web-debug-kit-1.7.0.zip` | Includes installer, tests and versioned evidence |

Node.js 22.4+ and a shell are required for helpers. Chrome/Chromium, GitHub CLI, Wrangler and PowerShell are needed only for corresponding tasks. Cowork access to tools and local Chrome depends on its execution environment; an accepted upload does not establish runtime compatibility. See [Cowork runtime](adapters/cowork/references/cowork-runtime.md).

Preserve local customizations when upgrading. Managed local installs can opt into signed updates with rollback; ordinary ZIP installs remain unchanged until enrolled. See [update status](docs/UPDATES.md).

Verify downloaded archive checksums from the release, then extract. Checksums detect mismatches but are not publisher signatures. Run the full-kit installer from its extracted folder:

```sh
node install.mjs --project /absolute/path/to/your/repository --target both
```

The destination must be an existing Git repository. Identical installs are reusable; differing files are preserved. A fresh session may be needed to load changed instructions.

## Use the skill

Ask Codex to use `$web-debug`, Claude Code to use `/web-debug`, or select `web-debug-cowork` in Cowork.

> Use Web Debug to reproduce the broken signup flow, identify the cause from code and direct Chrome evidence, fix it, and verify the same flow again.

Covers code/runtime diagnosis, responsive design, accessibility checks, SEO/AEO, natural web copy, defensive security, performance, Cloudflare, GitHub CI and Windows 11. Only references relevant to the task are loaded.

## Report a problem

Use [GitHub Issues](https://github.com/worksss01/web-dev-skills/issues/new/choose) for non-sensitive bugs, stale guidance and provider compatibility problems. English and Thai are welcome. Reporter classification is a hypothesis until confirmed by a maintainer.

An AI can prepare and submit a report through your authenticated GitHub connection **when you ask it to send that report**. The report send command previews locally, then requires the exact reviewed hash before an authorized submission. Exclude secrets, customer code and full conversation logs. Vulnerabilities belong in [private reporting](SECURITY.md).

See [reporting instructions](web-debug/references/reporting.md) and [contribution guidelines](CONTRIBUTING.md).

## Develop and verify

Source: `web-debug/`. Cowork overlays: `adapters/cowork/`. All variants use the same executable helpers. Temporary data belongs in ignored `work/`; generated ZIPs in ignored `outputs/`.

```sh
node --test tests/*.test.mjs
python tools/package.py --manifest-only
node tests/package-smoke.mjs --work work/package-check
python tools/package.py
```

Refresh the manifest only after reviewing intended changes. CI checks the committed manifest instead of repairing it. Historical evidence retains its original version/date; fresh CI does not imply all live browsers, accounts or Cowork environments were tested.

## License

[MIT](LICENSE). External documentation retains its own terms; fetched documentation caches are not distributed.

Maintainers: [quality gate, isolated lab, knowledge review, evaluation and signed delivery](docs/MAINTENANCE.md).
