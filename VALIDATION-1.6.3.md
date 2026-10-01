# Web Debug 1.6.3 validation

Date: 2026-10-01. Historical translations do not count as new test executions.

Local Windows / Node 24.18.0: 131 unit/regression cases passed, one POSIX-only permission case skipped, zero failures. The added case verifies the English default and preservation of explicit Thai claim detection. Existing Thai segmentation, UTF-8 path and reporting fixtures remain.

The installer/portable-ledger suite passed all 14 cases. Skill validation passed. All three ZIPs built successfully; link checks covered 166 full-kit, 17 core and 19 Cowork references. Both installed variants contain 35 files, including the license. Cowork executable helpers match core byte for byte. Distributed Markdown and issue forms contain English prose; Thai lexicons, multilingual test inputs and historical fixture images remain as data.

Original language documents were preserved in Git history and a local ignored backup. Original JSON evidence, dates and historical counts were not rewritten. The full-kit builder now includes the public guides, source overlays and packaging/check tools and resolves inherited overlay references before separately validating the rendered Cowork package.

CI results belong to the exact release commit, not to the date or version heading. No fresh live Chrome/Cowork/provider-account acceptance test is implied. ZIP clients still do not auto-update; translated instructions still tell agents to respond in the user's requested language.
