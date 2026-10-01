# Website design from a short brief

Use for new websites, substantial page creation and requested redesign. For a focused visual defect, use [UI diagnosis](ui-design.md) and retain the existing system. A lightweight skill can still produce visually ambitious work; do not confuse low instruction/tool overhead with a requirement for a plain website.

## Infer the brief and choose a direction

Read the request, existing pages/components, brand constraints and permitted assets. Identify the audience, main action, content hierarchy, language and necessary states. Reuse the project's design system unless redesign is requested. Infer reversible visual choices rather than sending a font/color/spacing questionnaire. Ask when an unknown materially changes the product or its factual content, while progressing independent work.

Choose the page's job before the visual language. Marketing, commerce, reading, booking and operational work need different structures; one site may contain several. Consult only relevant entries in [patterns and visual references](design-patterns.md). Treat style names as search vocabulary, not a complete specification.

For substantial design work, inspect a small set of relevant rendered references when available, starting with any the user supplied. Record the useful mechanism: composition, type, imagery, depth or interaction. Inspect the actual page and relevant scroll/state changes; a thumbnail or promotional description is insufficient evidence of the whole design. If reference access is unavailable, disclose that and choose a coherent original direction from available evidence.

Consider alternatives when the direction is uncertain and choose one. Alternatives should differ in composition or experience, not just palette. This need not create extra artifacts, agent sessions or paid calls. Briefly explain the chosen direction and its fit. Do not require the user to art-direct every component.

## Make the visual decisions concrete

Use existing project notes or a concise working note to prevent drift across screens. Include only decisions useful to this task:

- Primary action, content order and the facts/assets available to support them.
- A clear visual idea and focal point: a product scene, expressive type, an inspectable demonstration or another appropriate composition.
- Typography character, scale contrast, intended line breaks, reading measure and script-aware fallback.
- Grid and alignment axes, occupied/quiet areas, purposeful overlap, color roles and surface/depth treatment.
- Image subject, lighting, material, crop, focal position and space for text; provenance and missing assets.
- Narrow-screen recomposition and the rhythm of subsequent sections or task states.
- Meaningful motion: trigger, beginning/middle/end compositions, interruption and reduced-motion/static behavior.

For example, “premium” leaves decisions open; a specific product image with controlled light, large restrained type, an intentional crop and fine specification rows can form a direction. These are choices to resolve, not mandatory ingredients or universal pixel values. Keep project-specific preferences and private assets in that project, not in the distributed skill or cross-project memory.

## Build and refine a representative slice

For substantial work, resolve the opening plus one meaningful following section, or the core task and its next state, before extending the design. Solve the main image and type treatment early enough to judge the result honestly. Use authentic available assets or acquire/create suitable assets through task-authorized tools; check provenance and licensing. Do not replace a visually essential product image with an unrelated stock image or crude placeholder merely for convenience. When assets are unavailable, state the limitation and compose effectively with what exists.

Inspect the slice at wide and narrow sizes. Give the reader a deliberate entry point and change visual intensity as the content develops. Related sections can differ in density, scale and alignment. Tune optical alignment, font rendering, crop, borders, shadows, icons and control states. Distinctive design comes from these relationships, not a requirement to add effects everywhere.

Bento groupings, oversized type, gradients, serif accents, translucency and familiar layouts are optional techniques. Avoid repeating the same hero/badges/three-card sequence for unrelated products. Do not turn a reaction against generic output into blanket bans on a color, font family or component. Preserve useful conventions and match the actual brief.

Use the existing stack and appropriate semantic controls. A new framework or animation package needs a concrete benefit. Use intrinsic sizing, fluid type and component-level responsiveness where useful. Check specific feature support against target browsers; container-query variants and transition APIs do not all share one support level. [Container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_queries), [View Transitions](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API).

Motion should connect understandable states or demonstrate the product. Inspect beginning, intermediate and settled states; preserve native scrolling, interruption and a usable reduced-motion/static composition. Avoid hiding necessary content until animation runs. Keep a functional fallback when an enhancement is unavailable.

Write specific, natural copy in the requested language using [language guidance](natural-language.md) as needed. Never invent customer logos, testimonials, prices, stock or business claims to fill a layout. Clearly label synthetic prototype content; a local demo must not imply a payment, booking or message was submitted. English skill instructions do not force English websites. Inspect actual Thai/complex-script glyphs and wrapping when relevant.

## Review pixels and behavior separately

Use [direct Chrome](chrome.md) when the execution runtime supports it. Capture and actually view representative narrow, intermediate and wide layouts and relevant states. Missing browser or image access is a verification gap. Do not silently substitute provider browser control or claim an unseen screenshot was reviewed.

Judge visual craft against the selected direction: recognizable focal idea, appropriate text/media relationship, intentional typography/assets, coherent details, useful section rhythm and a considered narrow composition. Compare with relevant reference mechanisms without treating pixel similarity as the goal. A recolored default layout can pass functional checks while still missing a requested distinctive redesign.

Then verify the primary action, keyboard/focus behavior, long content and affected loading/error states using [UI diagnosis](ui-design.md). Preserve security, privacy and index intent across the redesign. DOM measurements identify candidates; they cannot establish aesthetic quality or full accessibility. No automatic beauty score is provided.

Fix the largest observed discrepancy, recapture affected views, and stop when the scoped criteria are met or a material limitation remains. Scale iteration to the task; do not redesign unrelated areas or accumulate polish indefinitely. Deliver concise rationale, actual tested dimensions/states and unresolved facts/assets. Keep measured defects, subjective judgments and unverified behavior distinct.
