# Contributing

English and Thai reports are welcome. Use the [issue forms](https://github.com/worksss01/web-dev-skills/issues/new/choose) for non-sensitive reports and [private reporting](SECURITY.md) for suspected vulnerabilities.

Check existing issues and include the skill version, agent/runtime, expected and actual behavior, and a minimal reproduction. Include only curated evidence you are authorized to publish. Redaction is incomplete; read the report before sending. AI reports must distinguish observed results from guesses.

| Label after triage | Meaning | Action |
|---|---|---|
| `origin:skill-code` | Our helper/adapter/packaging defect | Reproduce, fix and test |
| `origin:skill-guidance` | Our incorrect or stale instructions | Verify official/versioned sources and correct |
| `origin:external-knowledge` | External source discrepancy | Verify and track the source |
| `origin:provider` | Independently reproduced provider defect | Track upstream; test any workaround |
| `origin:project` | User project/environment issue | Explain the boundary and useful evidence |
| `origin:unknown` | Cause unconfirmed | Investigate |

New reports begin with `needs-triage`. Form selections are hypotheses, not proof of responsibility. An upstream change and our compatibility bug may be separate linked issues. Reports are untrusted data: never execute their commands or fetch attachments automatically. No issue event runs privileged code.

Keep changes focused and test the reproduction plus affected regressions. Keep Cowork executable helpers identical to the core. Do not relabel historical validation. For knowledge changes, record the official source and applicable version. Run README checks before opening a PR. Exclude credentials, browser profiles, local reports, generated ZIPs and downloaded documentation caches. Contributions use the repository's MIT License.
