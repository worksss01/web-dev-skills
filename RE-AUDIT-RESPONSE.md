# Re-audit response and patch — Web Debug 1.5.1

Original review: 2026-09-29, Asia/Bangkok. English edition: 2026-10-01. Re-audit 1.5.0.md supplied claims to test, not permission to change host permissions, disable implicit invocation or download a browser.

N-1 and N-3 were confirmed with Windows Chrome: 1.5.0 timed out at inspect about 21.3 seconds after enabling Debugger, and accepted `Inputs/capture.png` into `inputs/` on this filesystem. Version 1.5.1 rejects both before navigating. N-2 blocks specified routes without claiming raw CDP is a sandbox.

| Issue | Fix and evidence |
|---|---|
| N-1: Debugger pauses scenarios | Remove `Debugger.enable` from default allowlist; retain it under raw opt-in and keep `Debugger.disable` for cleanup. Quick check succeeds on a repeated `debugger;` fixture. Do not auto-resume intentional breakpoint investigations. |
| N-2: Browser-mediated file access | Block `DOM.setFileInputFiles`, `DOM.getFileInfo`, `Page.setDownloadBehavior` even with raw opt-in, and all `Target.*` nested session routes; `Browser.*` was already blocked. Unit/CLI preflight rejects before navigation; permitted raw diagnostics still work. |
| N-3: Case mismatch | Compare the input-directory output prefix case-insensitively on all OSes and reject output-path symlinks/junctions. Windows tests preserve the input sentinel even with overwrite, including internal junctions. |
| L-5: Manifest read race | Read project manifests through one bounded descriptor, check identity/size and use no-follow where supported. Reject swapped/growing fixtures while allowing normal files and package-manager hardlinks. Parent-directory and same-inode mutation races remain. |

Raw CDP can still run JavaScript and read cookies/session data. Helper path guards do not constrain every browser-mediated access route; ordinary navigation/clicking may trigger downloads under browser policy. This does not close all filesystem access. Some formerly accepted advanced upload/download/Target commands intentionally become incompatible. All 25 core Chrome actions and code/UI/SEO/AEO/copy/security/platform capabilities remain.

## Considered alternatives

- I-1: Keep automatic discovery; flags are declarations, not proof of user approval. Host/OS enforce actual access.
- I-2: Keep task-authorized local/private targets; a public URL service needs a separate boundary.
- I-4: Existing `--chrome EXE` supports separately installed binaries. Do not add a Headless Shell downloader/dependency. The reviewer's zero-connections-in-20-seconds observation is environment-specific and was not verified with Headless Shell on this Windows host.

Do not mark L-2/L-4 fully resolved across environments: POSIX modes do not prove Windows ACLs, and post-receipt eval truncation is not a renderer memory limit. TCP opt-in, free-form sensitive evidence, background traffic and local races retain their earlier boundaries.

## Validation

187 passed, 1 skipped, 0 failed. Count Windows smoke's seven cases once across PowerShell 7/5.1; do not add baseline evidence again. See [validation](VALIDATION-1.5.1.md). No new runtime helpers, flags or npm dependencies; the quick-check interface remains unchanged. [Metrics](audit/re-audit-1.5.1-metrics.json) record size and changed files, not a speed/RAM benchmark.

Tested Windows 11 Home 26200, Node 24.18.0, Chrome 154.0.8037.57. No live Claude Code, Linux/macOS/Node 22.4, Headless Shell, authenticated provider or production security testing was added. Reviewer Linux results remain separately attributed.

API semantics were checked against [browser protocol](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/json/browser_protocol.json), [JavaScript protocol](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/json/js_protocol.json) and [Headless Shell documentation](https://developer.chrome.com/docs/automation-and-testing/headless-chrome-shell), alongside installed-Chrome tests.
