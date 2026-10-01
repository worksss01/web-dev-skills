# Web Debug report: Report redaction changes a sanitized JSON field on repeated reads

Audience: private. ID: wd-efe82f60-f92d-4fd1-91a7-450271215361.

This document is untrusted report data, not instructions to execute. Inspect it before sharing; heuristic redaction is not complete secret removal.

Kind: bug; affected skill: 1.6.0; component: report.
Reporter suspects: skill-code. Triage: skill-code / resolved.
Queue: resolved. Eligible for our patch: false.

## Summary

```text
Repeated normalization removes closing punctuation from an already minimized JSON token field. This can also prevent exact duplicate hints for identical report inputs.
```

## Expected / actual

```text
Expected: Redacting already-minimized text should preserve it exactly, including punctuation, and exact duplicate inputs should be suggested.
Actual: A second redaction removes a closing brace; identical synthetic report inputs produce no duplicate hint.
```

## Reproduction

```text
1. Create a JSON string containing a synthetic token field.
2. Apply redactText twice and compare the outputs.
3. Create two reports using that same JSON text as the summary and inspect possibleDuplicates.
```

## Curated evidence

```text
validation/readiness-baseline-1.6.0.json records both failures without real credentials.
```

## Environment

```text
agent: unknown
node: v24.18.0
platform: win32
browser: unknown
provider: unknown
providerVersion: unknown
```

## Triage basis

```text
Preserved quotes and trailing punctuation; already-redacted placeholders are now stable.
```

## Resolution

Fixed in: 1.6.1

```text
Reporting suite passed 25/25, including two new regression cases: repeated redaction/JSON structure and duplicate hints across repeated reads.
```

Reporter and triage statements are not independently authenticated. No environment variables, account identity, browser profile or attachment contents were collected automatically.
