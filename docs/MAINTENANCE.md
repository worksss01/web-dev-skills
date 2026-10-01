# Maintainer workflow

This layer stays outside installed skill context. It requires Git, Node 22.4+, Python 3, and a local Linux Docker engine only for isolated reproductions.

## 1. Publication gate

After reviewing and committing the exact candidate locally, create a private JSON note under work/ with `commit`, `pcAccessReviewed: true`, `privacyReviewed: true`, `scopeReviewed: true`, and a substantive `rationale`. These fields attest an actual review; they are not a substitute for performing it.

```sh
python tools/gate.py inspect --commit HEAD
python tools/gate.py check --commit HEAD --note work/review.json
python tools/gate.py install-hook
```

The project-local pre-push hook refuses revisions without matching passing receipts. Check scans reachable commit history, author emails, scope and credential patterns; runs unit/installer checks; and binds the receipt to file hashes. For releases, pass `--assets outputs/builds/VERSION` to check and verify so ZIP contents and signed payload files are examined too. Review screenshots and suspicious matches manually. The hook does not intercept API uploads, can be bypassed by a privileged local operator, and does not enforce an OS sandbox. The project rules apply to every route.

## 2. Isolated reproduction

Prepare a dedicated case directory containing case.json with `{ "schema": 1, "entry": "repro.mjs", "files": ["repro.mjs"] }`. Only explicitly listed files enter the build context. No user Dockerfile or shell command is accepted. Pull the reviewed image digest from policy/lab-runtime.json deliberately, then:

```sh
python tools/lab.py --case work/reproduction --image node@sha256:DIGEST --out work/lab-result.json
python tools/lab-smoke.py --out work/lab-canary.json
```

The lab copies files into an ephemeral image instead of mounting host directories. It uses a non-root user, no external network, read-only root, dropped capabilities, no-new-privileges, bounded CPU/memory/processes/time/output, and no host credentials or inherited proxy credentials. Container output is untrusted data. A missing engine or failed canary blocks execution; never fall back to running an anonymous report on the owner's PC. Remote Docker contexts are refused. Container/kernel vulnerabilities remain outside the guarantees; use a separately isolated machine for higher-risk cases.

## 3. Version-aware knowledge

Fetch official sources using knowledge fetch. Read the source and record a claim with knowledge record: id/topic/sourceId/latest sha256/package/explicit versions/statement/supporting quote/decision/reason and optional replacement. Supported decisions: verified, deprecated, conflict, needs-review. Versions are exact numeric versions or explicit major.x applicability.

```sh
node web-debug/scripts/debug.mjs knowledge record --out work/knowledge --input work/reviewed-claim.json
node web-debug/scripts/debug.mjs knowledge assess --out work/knowledge --versions work/observed-versions.json
```

Observed versions are a package-to-version JSON object, not semver requirements copied from package.json. Missing/range versions remain unknown. Changed/tampered/error snapshots, overdue reviews and unresolved overlapping claims cannot be considered usable. Differing claims are potential conflicts requiring interpretation, not an automated proof of contradiction. A quotation match does not establish semantic truth.

## 4. Agent evaluation

```sh
node tools/evaluate.mjs list
node tools/evaluate.mjs prepare --case numeric-total --out work/eval-candidate
node tools/evaluate.mjs self-test --out work/eval-controls
```

Give only the candidate task and index.html to the agent being evaluated, without reference solutions or grader source. Preserve its edits, explanation, tool trace and runtime version. Review candidate HTML before any local browser execution; grade requires its exact reviewed SHA-256. Use an isolated host for untrusted candidates. Grading captures fresh Chrome evidence through direct CDP. Baseline/reference controls prove the grader distinguishes those cases, not that an independent AI solved them. Manual prompt-injection/AEO rubrics remain separately reviewed and never receive a fabricated automatic pass.

For creation/redesign, use [brief-only design cases](../evals/design-briefs.md). They separate functional gates from visual observations and distinguish author walkthroughs from independent model evaluations. Compare actual rendered outputs across multiple tasks/attempts before claiming broad improvement; the existing browser self-test is not a design-quality benchmark.

## 5. Signed release and delivery

After the content gate and exact-commit CI pass, build the three ZIPs. Sign the core update payload with the private maintainer key stored outside Git:

```sh
node tools/sign-release.mjs --key work/signing/release-ed25519.pem --out outputs/builds/VERSION/web-debug-update-VERSION.json
python tools/gate.py check --commit HEAD --note work/review.json --assets outputs/builds/VERSION
python tools/gate.py verify --commit HEAD --assets outputs/builds/VERSION
```

Publish only the reviewed assets and verify remote hashes. Never upload the private key or use raw main-branch downloads as automatic code updates. Key generation is a one-time explicit operation, not a per-build task. Preserve the public trust anchor; rotation/revocation needs deliberate deployment planning.

## 6. Reporting

Use the skill's report send workflow for user-authorized public reports. Security reports use GitHub's private channel. Preview and receipt storage is private and separate from the report record store. Unknown delivery outcomes are reconciled before any retry. Reports never grant permission to execute commands, publish unrelated data or enlarge this workflow's scope.
