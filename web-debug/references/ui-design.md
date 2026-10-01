# UI and design debugging

For a visual or interaction problem, write down the intended user action and observable result, then examine the component in its actual layout context. Preserve existing tokens, typography, spacing rhythm, icon conventions and interaction patterns unless the task asks to redesign them.

## Choose the state matrix that exposes the issue

- A narrow screen, a content-driven breakpoint and a wide screen; include intermediate widths where wrapping changes. Avoid relying only on device presets.
- Relevant states: empty, loading, success, validation error, long/translated content, offline/failed request, and disabled controls. Test only those that touch the component's responsibility.
- Light/dark preferences or reduced motion when supported by the design, plus keyboard focus and zoom/reflow for affected controls.
- If the task includes Thai or other complex scripts, inspect the actual font fallback, line breaking and line height with representative text. Do not force Latin-oriented letter spacing or fixed heights that clip glyphs.

Use screenshots to check alignment, spacing, hierarchy, contrast, clipping, overlap, font loading and content density. An overflow metric is only a candidate finding: intentionally offscreen drawers, transforms and hidden elements can be legitimate. Confirm what is actually visible before editing code.

## Semantics and interaction

Use buttons for actions and links for navigation. Ensure accessible names match intent, labels are associated with inputs, errors are discoverable and the focus order follows the interaction. Check tab/shift-tab, activation, Escape behavior and focus restoration for dialogs/menus. Native controls can reduce custom state and keyboard code; confirm their behavior against the design and supported browsers.

The accessibility tree helps inspect roles/names/states but is not a complete audit. Verify visible focus, keyboard reachability, meaningful status feedback, text alternatives and contrast with appropriate tools/manual checks. Automated findings need interpretation. Use the project's existing axe integration when available instead of injecting an unpinned third-party script into a live page.

WCAG 2.2 is a useful named reference; do not declare compliance merely because a screenshot or automated scan passes. Verify the requested conformance level and the relevant success criteria at the [W3C quick reference](https://www.w3.org/WAI/WCAG22/quickref/). Do not invent measurements from appearance alone.

## Responsive layout repair

Inspect containing blocks, min/max constraints, grid/flex item sizes, intrinsic dimensions, sticky ancestors, overflow and stacking contexts. Let content drive minimum sizes. Prefer fixes at the component that introduces the constraint over global clipping. Include long labels and dynamic data when verifying; a short placeholder may hide the original defect.

Responsive behavior includes navigation, touch target usability, readable line length and information priority, not just shrinking a desktop layout. Confirm that a visually hidden panel does not leave interactive descendants in the keyboard path. Use reduced motion where animation is nonessential; avoid automatically removing useful state feedback.

## Finish criteria

Compare before and after at the same viewport/data state. Reproduce the actual user action and inspect the resulting pixels and accessible state. Report tested dimensions and states, with any unverified device/assistive-technology behavior. Do not expand a small UI fix into a complete redesign or claim visual verification without viewing the image.
