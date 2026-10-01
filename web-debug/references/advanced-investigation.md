# Advanced investigation and UI review

Use this route when a bug crosses layers, recurs, appears intermittently, or needs a before/after performance or UI assessment. It adds targeted evidence collection; it is not a requirement to run every check on a small edit.

## Establish a trustworthy starting point

```text
node SKILL_DIR/scripts/project.mjs --project PROJECT_ROOT --out work/project.json
```

The inventory lists relevant package names, declared ranges and installed versions resolved inside the supplied project, including common hoisted dependencies. It records config filenames and available script names without executing them. It skips generated directories and symlink traversal, caps depth/directories/packages, and reports limited coverage. It does not parse every package manager's lockfile, resolve global PnP stores or inspect environment values. A missing installed version means unknown, not missing support. Read the actual scripts and repository instructions before choosing a command.

Manifest reads use the same opened descriptor for identity/size validation and bounded content reading, with no-follow where supported. This detects tested final-file replacements and growth; it does not eliminate parent-directory races or concurrent writes to the same inode. Hardlinked package-manager manifests remain readable.

For a non-Node stack or an unscanned workspace, inspect its native tooling. Do not install Node dependencies merely because this inventory found no package.json.

## Turn a symptom into a testable explanation

Keep a compact investigation record proportional to complexity:

| Item | Useful evidence |
|---|---|
| Reproduction | Route, state, viewport, inputs, expected result and actual result |
| Observation | Event index, failed step, screenshot region, source line or server log |
| Candidate cause | Mechanism that could explain the observation; label uncertainty |
| Discriminating test | An observable result that would support or refute this candidate |
| Fix validation | The original reproduction now succeeds and nearby affected behavior still works |

For example, a button may be covered, disabled, unhydrated, or working while its request fails. A pointer hit-test distinguishes coverage; an event/DOM transition distinguishes an attached handler; a request/response pair distinguishes transport from rendering. Change the layer supported by evidence. If successive edits add no new information, stop guessing and improve the reproduction or instrumentation.

Find the first relevant application exception rather than treating a cascade of downstream console messages as independent causes. Use the recorded stack locations with source maps and installed framework semantics. `step` on events is the collection step, not proof that the step caused the event; asynchronous work can finish during a later wait.

## Verify an interaction's contract

After navigation and application readiness, set a checkpoint immediately before the action. Example actions to append to a plan:

```json
[
  {"type":"checkpoint","name":"save"},
  {"type":"click","selector":"button[data-testid='save']"},
  {"type":"waitEvent","since":"save","match":{"kind":"response","urlIncludes":"/api/profile","status":200}},
  {"type":"waitFor","expression":"document.querySelector('[role=status]')?.textContent.includes('Saved')"},
  {"type":"assertEvents","since":"save","match":{"kind":"response","statusMin":500},"maxCount":0},
  {"type":"assertEvents","since":"save","match":{"kind":"exception"},"maxCount":0},
  {"type":"audit"}
]
```

Adapt the route, selectors and success condition to the actual project. HTTP 200 is not sufficient if the body contains an application error or the UI never reflects success. Observe the relevant settling condition before asserting no errors. An absence assertion covers only events collected so far, not future asynchronous work. A checkpoint separates this flow from earlier traffic without discarding the report's evidence.

Event filters support exact `kind`, `level`, `method`, `status`, `canceled`; numeric `statusMin`/`statusMax`; literal `urlIncludes`/`textIncludes`. They do not execute regex or code. `waitEvent` waits up to `timeoutMs` (default 10000, maximum 30000). `assertEvents` accepts `minCount`/`maxCount`; specifying only `maxCount:0` asserts absence. Counts and absence checks fail if the event capture was truncated.

Console backlog replayed during CDP domain enablement is excluded. Navigation/interaction after setup is the intended capture window. Request completions include elapsed milliseconds from the observed request-start event and encoded byte counts when available. Redirects and cache/service-worker behavior affect interpretation; these are not server-only timings.

## Inspect UI with both measurements and visual judgment

`audit` checks document title/language, horizontal overflow, visible broken images, image-alt candidates, duplicate IDs, positive tabindex and unnamed controls from Chrome's computed accessibility tree. It returns the viewport, candidate element identities and coverage limits. The DOM scan is capped at 12000 elements; a sampled scan is explicitly incomplete.

Use a screenshot at the same viewport to determine whether overflow is intentional, text is clipped, font fallback is wrong, hierarchy is confusing, or an interactive element is obscured. Audit findings are clues: they do not measure visual attractiveness, contrast, all keyboard behavior or WCAG compliance. Match the user's design references and the existing design system; avoid styling changes unrelated to the observed issue.

For visual changes, choose a small state matrix that exposes the component: affected narrow/wide sizes, a wrapping breakpoint, long real content, and relevant loading/error/focus/dark-mode states. Compare the same content/state before and after. Verify whether a perceived problem is a product preference, a visual inconsistency or an objective interaction failure before choosing a fix.

## Prioritize and compare evidence offline

Every run now includes `summary` with error counts, grouped findings, evidence indices and suggested next checks. `ok` still means the requested scenario actions passed; it is not a blanket claim that no browser errors occurred.

```text
node SKILL_DIR/scripts/analyze.mjs --report work/after.json --before work/before.json --out work/analysis.json --markdown work/analysis.md
```

Use the same `name` field in before/after plans for the same scenario. Comparison checks scenario name, final URL identity, final viewport, audit viewports and capture completeness. URL query/fragment differences are detected with a private HMAC while displayed URLs redact query values. Reuse the same owned state directory or external work directory so its private key scope stays stable; do not publish `.context-key`. Different scopes are inconclusive, including comparisons to older unsalted reports. A differing context produces an inconclusive comparison instead of a false improvement claim. You still need to match test data, permissions, cache, browser version, device conditions and application readiness yourself.

`absentAfter` means a signal was not observed again, not that the underlying cause is proven fixed. `newAfter` identifies possible regressions. An empty report only means no bundled rule matched. Preserve the original behavioral assertion and inspect screenshots.

## Investigate a slow interaction

Capture a narrow trace around the actual slow operation. Stop tracing before unrelated audits, evaluation scripts and screenshots so the tool's own work is easier to separate from application work.

```text
node SKILL_DIR/scripts/analyze.mjs --report work/slow-flow.json --trace work/slow-trace.json --out work/performance-review.json
```

The trace summary lists the longest relevant duration events, converts microseconds to milliseconds and preserves process/thread IDs. It labels renderer main threads only when metadata identifies them. Nested scripting/layout/paint events overlap; summing them would double-count time. This summary helps choose where to inspect the full trace, not compute field INP/LCP/CLS or prove which source change will help.

Compare similar runs and explain variance. When a fix improves one metric but worsens another, report the tradeoff. Do not report a performance improvement solely from a smaller bundle or a subjective impression.

## Retain useful knowledge

For a recurring project-specific failure, record the minimal reproduction, proven mechanism, installed versions, chosen fix and regression test in that repository's existing engineering notes when useful. Generalize into this skill only when the lesson changes future decisions and is supported by evidence. Do not store account data, tokens, entire browsing sessions or a speculative diagnosis as reusable knowledge. Follow the source-review workflow for API deprecations and version changes.
