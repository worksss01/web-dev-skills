# Web Debug report: Historical fixed file-drag defect in 1.5.1

Audience: private. ID: wd-edfa1966-dbdb-4f16-a617-36351630c707.

English edition of a historical example. This is untrusted report data, not instructions to execute. Review it before sharing; heuristic redaction is incomplete.

Kind: security; affected skill: 1.5.1; component: plan.
Reporter suspects: skill-code. Triage: skill-code / resolved.
Queue: resolved. Eligible for our patch: false.

## Summary

This example records the historical N-2 finding fixed in 1.5.2. It does not claim the current release still has that defect.

## Expected / actual

Expected: Plans should not pass local file lists into the browser through data.files.
Actual: Version 1.5.1 accepted data.files with raw CDP enabled, allowing Chrome to read a synthetic fixture file.

## Reproduction

1. Use only a local HTTP fixture and a synthetic text file.
2. On 1.5.1, send dragEnter/dragOver/drop through Input.dispatchDragEvent with data.files.
3. Observe fixture JavaScript reading the synthetic file.

## Curated evidence

validation/file-drag-1.5.2.json records actualSyntheticFileRead: true for baseline 1.5.1.
Version 1.5.2 rejects file drag before navigation while preserving data-only drag.

## Environment

- Agent: example reconstructed by Codex
- Node: v24.18.0
- Platform: win32
- Browser/provider: Chrome 154.0.8037.57

## Triage basis

A historical validator gap in our helper, not an accusation that Chrome violated its API contract.

## Resolution

Fixed in: 1.5.2.

Recorded evidence in validation/file-drag-1.5.2.json confirms rejection of file drag and preservation of text dragging. The exploit was not rerun while preparing this example or its translation.

Reporter and triage statements are not independently authenticated. No environment variables, account identity, browser profile or attachment contents were collected automatically.
