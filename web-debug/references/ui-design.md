# UI and design debugging

For a visual or interaction problem, write down the intended user action and observable result, then examine the component in its actual layout context. Preserve existing tokens, typography, spacing rhythm, icon conventions and interaction patterns unless the task asks to redesign them.

## Choose the state matrix that exposes the issue

- A narrow screen, a content-driven breakpoint and a wide screen; include intermediate widths where wrapping changes. Avoid relying only on device presets.
- Relevant states: empty, loading, success, validation error, long/translated content, offline/failed request, and disabled controls. Test only those that touch the component's responsibility.
- Light/dark preferences or reduced motion when supported by the design, plus keyboard focus and zoom/reflow for affected controls.
- If the task includes Thai or other complex scripts, inspect the actual font fallback, line breaking and line height with representative text. Do not force Latin-oriented letter spacing or fixed heights that clip glyphs.

Use screenshots to check alignment, spacing, hierarchy, contrast, clipping, overlap, font loading and content density. An overflow metric is only a candidate finding: intentionally offscreen drawers, transforms and hidden elements can be legitimate. Confirm what is actually visible before editing code.

For animated or stateful controls, include relevant intermediate, reversed and interrupted states. Check the actual outcome after input: a successful click command does not establish that a view changed, Escape closed a panel or a dragged value persisted. Wait for a meaningful loaded/state condition before capturing; a loading shell can resemble an empty result.

## Semantics and interaction

Use buttons for actions and links for navigation. Ensure accessible names match intent, labels are associated with inputs, errors are discoverable and the focus order follows the interaction. Check tab/shift-tab, activation, Escape behavior and focus restoration for dialogs/menus. Native controls can reduce custom state and keyboard code; confirm their behavior against the design and supported browsers.

### Selects and option surfaces

Open each relevant select, combobox, date picker or menu during visual review. Styling the closed trigger does not establish the appearance of its options: browser/OS pickers may remain unchanged. For a polished branded interface, resolve the popup's typography, spacing, surface, active/selected states and alignment with the trigger. Capture both closed and expanded states, including a narrow viewport and a constrained edge or scrolling dialog.

Reuse a suitable component already in the project. Native controls remain appropriate when their actual open appearance and behavior fit the brief; customizable native select features require target-browser checks. If a custom single-choice surface is needed, retain one authoritative form value and a tested keyboard/focus contract: open, navigate, type-ahead, commit, cancel, move on and restore context. Keep the active option visible, dismiss the innermost popup before its dialog, and avoid duplicate focusable native/custom controls. Verify that a choice reaches the submitted data, not only the trigger label. Inspect long options, pointer/touch behavior and resize/scroll positioning. [MDN select](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/select), [W3C select-only combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/).

An ARIA pattern or attractive popup alone does not establish assistive-technology compatibility; test the intended combinations and state any gaps.

The accessibility tree helps inspect roles/names/states but is not a complete audit. Verify visible focus, keyboard reachability, meaningful status feedback, text alternatives and contrast with appropriate tools/manual checks. Automated findings need interpretation. Use the project's existing axe integration when available instead of injecting an unpinned third-party script into a live page.

WCAG 2.2 is a useful named reference; do not declare compliance merely because a screenshot or automated scan passes. Verify the requested conformance level and the relevant success criteria at the [W3C quick reference](https://www.w3.org/WAI/WCAG22/quickref/). Do not invent measurements from appearance alone.

## Responsive layout repair

Inspect containing blocks, min/max constraints, grid/flex item sizes, intrinsic dimensions, sticky ancestors, overflow and stacking contexts. Let content drive minimum sizes. Prefer fixes at the component that introduces the constraint over global clipping. Include long labels and dynamic data when verifying; a short placeholder may hide the original defect.

Responsive behavior includes navigation, touch target usability, readable line length and information priority, not just shrinking a desktop layout. Confirm that a visually hidden panel does not leave interactive descendants in the keyboard path. Use reduced motion where animation is nonessential; avoid automatically removing useful state feedback.

If the representation changes across widths, verify that selected context and data meaning survive: for example, the same selected date/event when a week grid becomes a day timeline. A separate mobile markup tree must not silently diverge from the data or expose duplicate focusable controls.

## Finish criteria

### Interpret the design measurements

Add `{"type":"designAudit"}` to a Chrome plan at the viewport/state under review. It inventories visible font families/sizes, small-control candidates and a conservative subset of computed text contrast. It scans at most 500 selected visible elements and reports truncation.

Contrast is computed only when text has its own opaque RGB background and foreground and the inspected ancestry has no gradients/images, shadows, filters, opacity or blend effects. Complex samples are skipped, not assigned a made-up ratio. This is not a full rendered-pixel analysis of overlap, pseudo-elements or all accessibility requirements. Verify the actual screenshot and use established tools/manual checks as appropriate. [Contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

Controls below 24 CSS pixels in either dimension are review candidates. Spacing, inline-link, native-control and equivalent-target exceptions need context; do not label every small control a violation. [Target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

### Replay the affected case

Compare before and after at the same viewport/data state. Reproduce the actual user action and inspect the resulting pixels and accessible state. Report tested dimensions and states, with any unverified device/assistive-technology behavior. Do not expand a small UI fix into a complete redesign or claim visual verification without viewing the image.
