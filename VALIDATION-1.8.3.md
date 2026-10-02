# Web Debug 1.8.3 validation

Scope: instruction routing, a modern-by-default requirement for the full design and its controls, evaluation guidance and versioned packaging. This patch changes no browser/helper behavior except the release identifier. Historical 1.8.2 browser results retain their original identity and are not reported as new 1.8.3 tests.

## Instruction review

Manual review checked the same requirement in the core and Cowork entry points, its direct website-design route and its detailed contract. The review considered these contexts:

| Context | Required disposition |
|---|---|
| Short catalog brief without any style or dropdown-specific prompt | Apply the modern default to the full page and the designed expanded-surface requirement to sorting. |
| Styled trigger opens a stock browser/OS options popup | Treat visual completion as failed even when selection/sorting works. |
| Explicit request for classic/retro/platform-native appearance | Preserve that request rather than forcing the modern default. |
| Focused sort/data bug fix in an existing interface | Preserve unrelated UI outside the authorized redesign. |
| Target-platform/accessibility constraint | Identify the concrete constraint and propose a contemporary alternative; do not silently ship legacy UI as complete. |
| Browser/image access unavailable | Report an unverified expanded state rather than claiming visual acceptance. |

These are manual instruction-review cases, not independent agent generation runs. No new website, owner aesthetic acceptance, screen-reader compatibility or universal model adherence is claimed. The catalog brief in the evaluator is a future behavioral case; it has not been run as an independent comparison here.

## Local checks and publication boundary

Local checks on 2026-10-02, Windows / Node 24.18.0: 141 Node regression cases passed, one POSIX permissions case was skipped and none failed; seven Python maintenance tests, 14 installer/portable-ledger checks and the skill metadata validator passed. Packaging checks local links, manifests, all three archive inventories and identical core/Cowork helper bytes; both host variants retain 42 skill files.

The exact-content gate must review source/history and all outgoing archives/signed payloads; exact-release-commit hosted CI is an additional release requirement. Final checksums identify the published bytes. These compatibility checks do not measure independent AI adherence to the new instruction.

The reported external project was inspected as source only to confirm an ordinary select with closed-trigger styling. Its contents, name, paths and screenshot are excluded from public skill packages and were not modified or executed by this patch. Installed-version checks establish the current local deployment version; they do not prove which instructions another AI session loaded.

Core/Cowork executable helpers remain identical. No automated host-level design enforcement, network listener, dependency or new access permission is added. Instruction requirements guide the agent; they cannot technically compel an arbitrary host/model to comply. Missing independent generation evidence remains a limitation.
