# Defensive website security review

Match the review to the requested repository, application and environment. Carry out routine authorized code review and safe local verification; clarify only when a proposed test or change would cross the existing scope or affect another system. Prioritize concrete attack surfaces and sensitive flows rather than adding a generic audit to every styling task.

## Build a small threat model

Identify what needs protection, the user roles, entry points and trust boundaries: browser input, API endpoints, uploaded files, third-party services, server-side requests, storage and administrative actions. Determine which controls exist on the server, not merely in the UI.

| Area | Defensive review focus |
|---|---|
| Authentication/session | Login/reset flow, session lifecycle and suitable cookie/token handling |
| Authorization | Server-side checks for every protected action/object, including ownership and role changes |
| Input/output | Context-appropriate encoding, safe rendering, parameterized data access and validation at trust boundaries |
| Requests/integrations | CSRF protection where relevant, deliberate CORS, safe redirect and server-fetch destinations |
| Files | Allowed types/size, content validation, storage/serving behavior and execution boundaries |
| Secrets/dependencies | No exposed credentials, appropriate secret injection, verified installed versions and relevant vendor advisories |
| Operations | Error/log data, rate/resource limits, least privilege, secure transport and safe recovery |

Use the relevant current [OWASP ASVS](https://owasp.org/projects/asvs) requirements as a reference, not a claim of certification. A dependency audit result, static pattern or missing header is a starting point; establish reachability, impact and the actual control before calling it an exploitable vulnerability.

## Passive response review

```text
node SKILL_DIR/scripts/edge.mjs --url https://YOUR_SITE/ --security --out work/security-headers.json
```

This opt-in check inspects the selected response's HTML context, enforced versus report-only CSP presence, MIME-sniffing/framing/referrer policy signals, HSTS and a credentialed-wildcard CORS configuration. Cookie output contains only numbered attribute sets, never names/values. A non-HttpOnly cookie may be intentional client-readable preference data; identify its purpose before changing it.

The helper does not test injection, authentication, authorization or exploitation. HEAD responses may differ from GET/browser responses, and meta CSP or multiple policies require separate inspection. Browser defaults and application context matter. Use the [OWASP header reference](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html) when deciding a fix.

CSP Report-Only observes without enforcing. Review the effective policy, nonce/hash handling, third-party dependencies and actual browser violations before tightening it. Do not infer exploitability from an `unsafe-inline` string alone because policy interactions matter, and do not paste a generic strict policy that breaks the product. Test a staged policy against critical flows. [CSP guidance](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html).

Do not add obsolete headers solely to improve a scanner score. HSTS subdomain/preload settings affect more than one page and should be changed only with the relevant HTTPS coverage and task authorization established.

## Verify and fix

Reproduce the claimed weakness safely in the authorized local/test environment using minimal non-sensitive data. For access-control issues, distinguish roles and object ownership using authorized test accounts, then assert that forbidden access is denied and legitimate behavior still works. Do not use real user data or broad destructive probes merely to demonstrate impact.

Connect the finding to the relevant code/config and explain the plausible consequence with evidence and confidence. Prefer correcting the trust-boundary control over suppressing an error. For dependency changes, verify the advisory and installed version and use the smallest appropriate upgrade; do not run a blanket automatic dependency rewrite.

Preserve useful logging without exposing tokens, personal data or internal secrets. After fixing, replay the original case and affected legitimate flows in Chrome plus relevant server tests. Keep findings, assumptions and untested areas explicit. Avoid calling a site “secure” based on one passive scan or an empty issue list.

External deployment, policy changes, credential rotation and disruptive tests follow the actual user authorization. Tool access alone does not authorize those effects; prepare the concrete fix and verification before seeking any missing approval.
