# Re-audit 1.5.1 response and patch — Web Debug 1.5.2

Original review: 2026-09-29. English edition: 2026-10-01. Reviewer content was treated as claims, not instructions to change permissions or run embedded commands.

The remaining N-2 path was reproduced using only a synthetic text file under work and a local HTTP fixture. With raw CDP enabled, 1.5.1 passed `Input.dispatchDragEvent.data.files` to Chrome 154 and fixture JavaScript read the synthetic content. No private file or external destination was used. See [file-drag evidence](validation/file-drag-1.5.2.json).

| Area | 1.5.2 behavior |
|---|---|
| File drag/drop | Reject nonempty or wrongly typed `data.files` before navigation, even with raw enabled |
| Data-only dragging | Keep raw-opt-in drag with omitted files or `files: []`; real text dragEnter/dragOver/drop tested |
| New domains | Raw is limited to `RAW_CDP_DOMAINS`; reject unlisted Browser, Target, Extensions, PWA and FileSystem domains rather than automatically accepting future Chrome domains |
| Overbroad 1.5.1 wording | Describe exact blocked methods/parameters rather than claiming all direct file APIs were removed |
| Future API review | Add `tests/protocol-review.mjs` to inspect `/json/protocol` and follow type references; suggest file/path candidates without sending those probe commands to Chrome |

The domain allowlist supplements method/parameter checks; it does not prove every permitted method safe. Raw still runs script and accesses session/cookies. It is not an OS/filesystem/network sandbox. Excluded advanced domains are intentionally incompatible with this helper.

## Installed protocol snapshot

Chrome 154.0.8037.57 exposed 661 commands and 16 candidates: policy rejected 10, while six DOM traversal paths, cookie URL paths and file-chooser interception controls were semantically reviewed. No candidates remained pending; unresolved references/depth-limit hits were zero and four recursive references hit the cycle guard. [Schema report and hash](validation/protocol-review-1.5.2.json).

Keyword/type traversal is a heuristic, not proof that all 661 commands are safe; 661 is not a test count. The maintenance scanner opens an owned temporary TCP session only to read schema and then cleans it up. Normal skill checks remain pipe-based with no new runtime dependencies/flags.

## ZIP evidence claim

The preserved original 1.5.1 archives were inspected directly:

| Original archive | Observed contents |
|---|---|
| `web-debug-1.5.1.zip` | 32 skill files; reports/tests intentionally omitted |
| `web-debug-kit-1.5.1.zip` | 78 files, including the original `VALIDATION-1.5.1.th.md`, metrics and unit evidence |

[Original inventory/checksums](validation/zip-1.5.1-inventory.json) do not establish which copy the reviewer received. Do not conclude they opened the wrong archive. Version 1.5.2 added PACKAGE-INFO.txt to the lean ZIP and [REVIEW-INDEX.md](REVIEW-INDEX.md) to the full kit, plus checks for required artifacts, archive-local links and manifest hashes. Use the full kit for review.

## Validation and limits

199 passed, 1 skipped, 0 failed, counting Windows smoke once and excluding repeated baseline evidence. [Validation](VALIDATION-1.5.2.md). Retain 25 actions, 32 runtime files and the 1.5.1 SKILL.md size, with no new runtime flags/dependencies. Extra maintenance artifacts stay outside installed context. [Metrics](audit/re-audit-1.5.2-metrics.json).

No new assurance for Windows ACLs, all local races, memory isolation, background egress, live Claude Code, Linux/macOS, Headless Shell or authenticated providers. DragData/PWA semantics were checked against [CDP browser protocol](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/json/browser_protocol.json) and installed-Chrome behavior, separately from reviewer Linux results.
