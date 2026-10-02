# Web Debug 1.8.2 validation

Local checks performed on 2026-10-02 with Windows, Node 24.18.0 and Chrome 154.0.8037.59. Publication additionally requires the exact-content privacy/quality gate and successful exact-release-commit hosted CI.

## Picker walkthrough

The author refined the existing synthetic planner, preserving the earlier source and evidence. Two select-only surfaces use one underlying form value each. They include selected indicators, category colors, keyboard navigation, type-ahead, cancel/commit, popup positioning and reduced-motion behavior.

Two final direct-CDP runs passed 28 assertions across 1440×1000, 1024×768, 390×844 and 320×568 CSS-pixel states. Checks covered expanded options, preserved values while navigating, Escape cancellation before dialog dismissal, Home/End/Enter/Space/Tab, repeated-letter type-ahead, pointer and emulated touch selection, values reaching the created local record, changed week options, long/literal labels, active-option visibility, resize and reduced motion. Real mobile hardware was not tested.

Ten representative captures were inspected, including the expanded day/work-type lists. Visual review removed an unnecessary popup scrollbar and fixed time-field columns causing horizontal dialog overflow at 320px. Final runs recorded zero JavaScript exceptions, console/HTTP errors and failed network requests; isolated profiles were purged and the loopback server stopped. Chrome's accessibility tree exposed the two named comboboxes, the open listbox and its options; this is not a screen-reader test.

Initial harness attempts had unsupported convenience-key names, an option click before entrance animation became visible, and a malformed assertion expression. The harness used explicit CDP keyboard events for the additional keys, a settled-state wait and corrected/prevalidated expressions. Failed attempts remain private evidence. No failed scenario was waived.

## Package and instruction checks

Local Node suites passed 141 cases with one POSIX-only permissions skip and zero failures (142 cases). Seven Python maintenance-tool tests, 14 installer/portable-ledger checks and the skill metadata validator passed. Packaging checks local links, integrity manifests, archive inventories and byte-identical core/Cowork helpers; each host variant contains 42 skill files. Final hashes come from the final release build.

Instruction review covers modern visual treatment without a universal ban on native controls, use of existing project components, one form value, nested dismissal, browser-support limits and preservation of the direct-CDP/Cowork boundaries. The only changed executable line is the release version.

The local prototype, images, fonts, screenshots, private browser/report state and deployment markers are excluded from release archives. [Scoped metadata](validation/design-1.8.2.json) identifies the final planner source. Historical reports retain their original versions and dates.

This is an author walkthrough, not owner aesthetic acceptance or an independent cross-model design evaluation. Live Cowork execution, other browsers, assistive technology and real mobile devices were not established. Signatures authenticate bytes, not visual quality or absence of vulnerabilities.
