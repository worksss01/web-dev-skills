# Web Debug 1.6.0 — Report Skills

English edition prepared 2026-10-01; historical release scope is unchanged.

This version introduced local file-based reporting. Users or agents create reports in the project and export Markdown for manual maintainer handoff. At this version there was no reporting server, issue submission, telemetry or background transmission.

| Origin | Responsibility | Action |
|---|---|---|
| skill-code | Our helper, validation, adapter or packaging | Queue a code patch after confirmation |
| skill-guidance | Our wrong/stale reference | Queue a reference correction after confirmation |
| external-knowledge | Incorrect/uncertain external source | Review the source; do not claim to edit its publication |
| provider | Independently reproduced upstream service/tool defect | Track upstream |
| project | Website code, settings, permissions or environment outside the skill | Project support |
| unknown | Root cause unestablished | Investigate without guessing from an error's vendor name |

An upstream API change and our compatibility defect may be separate linked issues. A guide misquoting a correct source is our guidance defect. Every new record starts new/unknown; suspectedOrigin is the reporter's hypothesis. Only confirmed/in-progress owned code/guidance is patchEligible. Triage is a maintainer judgment, not automatic causal proof.

```sh
node .agents/skills/web-debug/scripts/debug.mjs report create --title "Observed symptom" --summary "Behavior and impact" --origin unknown
node .agents/skills/web-debug/scripts/debug.mjs report list
node .agents/skills/web-debug/scripts/debug.mjs report export --id REPORT_ID --out work/report-to-maintainer.md
```

Use the returned ID and the actual installed directory. submitted=false means local-only output. Use report template/create --input for expected/actual, steps, curated evidence and affected version. [Template](examples/report-input.json), [historical fixed file-drag example](examples/report-example.md).

Show/list inspect records; needs-info requests evidence; amend preserves history/observed versions while resetting stale conclusions; in-progress is for owned fixes. Resolution requires fixed-in and verification and cannot close a provider issue as our patch. Duplicate hints never delete/close automatically; canonical references require deliberate triage. Verification notes record claims and do not execute commands or establish authority.

## Privacy and limits

Dedicated stores default to work/web-debug/reports, with ignore rules and writer locks. Evidence paths are labels, not automatic attachments. No environment dump, account/profile collection or network traffic. Defaults record Node/platform and unknown elsewhere.

Known credential headers/tokens/private-key blocks, URL query/fragment and home paths are minimized heuristically. Arbitrary prose/URL paths can remain sensitive. Review exports. Private export is default; security-kind records cannot be publicly exported. Kind is reporter-supplied, not automatic vulnerability classification.

One new helper and reference; no database, SDK or npm dependency. Sequential record reads retain only required summaries/IDs. Bounds: 1,000 records/store, 512 KB/record and 100 history events. Local history is not a signed audit log; Windows uses inherited ACLs.

## Validation

235 passed, one POSIX-only case skipped. Windows smoke counts once across two shells. The 23 reporting cases cover ownership, provider boundaries, amendment history, duplicate hints, privacy, public-security rejection, paths/locks/bounds and Thai CLI input. [Validation](VALIDATION-1.6.0.md), [metrics](audit/release-1.6.0-metrics.json), [reporting guide](web-debug/references/reporting.md). This release did not enable networking or modify global installations.
