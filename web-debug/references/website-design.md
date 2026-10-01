# Website design: intent, hierarchy and interactive quality

For design work, identify the page's user, primary task, content, brand constraints and success state. Inspect the existing design system and references before choosing visual changes. When a missing preference matters, ask about the intended direction while completing independent layout/content work.

## Design from the task

Create a coherent information hierarchy: what the user must understand first, what supports that decision, the main action and what happens afterward. Keep meaningful content and truthful conditions visible. Avoid decorative sections, repetitive cards, excessive badges or animation that do not serve the product.

Reuse existing tokens for color, typography, spacing, radii and elevation. For a new system, define a small consistent set driven by content and brand; do not copy a public design system's identity or force every website into the same visual template. Use references for principles such as reusable styles and consistency. [GOV.UK design styles](https://design-system.service.gov.uk/styles/).

Build responsive layouts around content constraints and readable density. Include intermediate widths, long real content and the relevant form/navigation states. Choose native semantics and components whose focus, keyboard and error behavior fit the interaction. Consult [UI diagnosis](ui-design.md) for specific failure checks.

## Pair measurements with visual review

Add `{"type":"designAudit"}` to a Chrome plan at the viewport/state being reviewed. It inventories visible font families/sizes, small control candidates and a conservative subset of computed text contrast. It scans at most 500 selected visible elements and reports truncation.

Contrast is computed only when the element has its own opaque RGB background and text color and the inspected ancestry has no gradients/images, shadows, filters, opacity or blend effects. Complex samples are skipped, not assigned a made-up ratio. This is not a complete analysis of rendered pixels, overlapping elements, pseudo-elements or all accessibility requirements. Verify the actual screenshot and use established accessibility tooling/manual checks where appropriate. [Contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

Controls smaller than 24 CSS pixels in either dimension are review candidates. Spacing, inline-link, native-control and equivalent-target exceptions require context; do not label every small control a WCAG violation. [Target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

Inspect screenshots for hierarchy, alignment, rhythm, font rendering, clipping, density, visual balance and whether the main action is clear. Review the real interaction for focus, feedback, validation and recovery. A screenshot cannot establish working behavior, and a DOM audit cannot establish that a page looks good.

## Deliver a reviewable change

Explain the design decision in terms of the user's task and observed problem. Show the implemented result at representative sizes and relevant states. Preserve established brand/content requirements and call out unresolved preferences instead of silently changing them. For a requested redesign, make the intended new system coherent across components rather than applying isolated visual tricks.

There is no automatic beauty score. Use explicit criteria, visual comparison and task completion, and distinguish a measured defect from a subjective preference.
