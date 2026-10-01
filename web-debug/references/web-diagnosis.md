# Modern web diagnosis

Use the symptom to choose a narrow investigation. This guide is deliberately version-aware: read the installed dependency version and its documentation before applying framework-specific recipes.

## Identify the failure layer

| Evidence | Likely next investigation | Avoid assuming |
|---|---|---|
| Build fails before a page is served | Node engine, lockfile, package exports, ESM/CJS, compiler/plugin versions, env configuration | Chrome can explain a server build error |
| Document or JS request fails | Server route, asset base path, redirects, deployment path, CDN/content type | Every blank page is a component bug |
| HTML arrives but hydration fails | Server/client markup parity, data serialization, locale/time/randomness, invalid nesting | Suppressing warnings repairs the mismatch |
| Layout differs across sizes | Computed styles, min-content sizing, overflow, positioning, container context | A global overflow:hidden is the root fix |
| Click does nothing | Overlays/hit testing, disabled state, focus, hydration, listener attachment, async result | A programmatic DOM click proves pointer usability |
| Works after clearing storage | Cache keys, service worker lifecycle, stale assets, schema migration | Clearing every user's data is an acceptable permanent fix |
| Slow interaction | Main-thread trace, long tasks, layout, rendering, JS cost, network wait | A synthetic Lighthouse score explains all user latency |

Observe both browser and server logs for full-stack issues; the Chrome helper cannot collect backend exceptions. When a request fails, correlate the request and response IDs, status and server trace instead of adding arbitrary client retries.

## CSS, HTML and browser APIs

Prefer native semantic HTML and platform features when they fit supported browsers. For flex/grid overflow, inspect automatic minimum sizes, fixed widths, intrinsic media sizes, unbreakable text, scroll containers and shrink constraints. For layering, inspect stacking contexts and clipping ancestors before changing z-index. Check fonts loading, fallback metrics and explicit media dimensions when layout shifts.

Container queries, subgrid, nesting, :has(), native dialog/popover, newer viewport units, view transitions and anchor positioning are **candidates to verify**, not an assertion that all have identical browser support. For the exact syntax or subfeature, check current MDN compatibility and the project's browser targets. Use `CSS.supports`, feature detection and `@supports` for meaningful fallback paths; a JavaScript property existing alone may not establish complete behavior.

Baseline is a cross-browser availability summary. It does not prove accessibility, performance, support in older webviews or compatibility with every user device. Separate newly available from widely available and check the actual target matrix. See [MDN](https://developer.mozilla.org/en-US/docs/Glossary/Baseline/Compatibility) and [Baseline](https://web.dev/baseline). Test Firefox/WebKit or physical devices when the bug or delivery requirements concern them; a Chrome-only run cannot establish those results.

## Framework and build behavior

- **React / SSR:** Inspect the first server markup and the first client render. Dates, random values, locale/time-zone formatting, browser-only branches, invalid HTML and inconsistent data can produce hydration differences. Handle a known intentional difference locally only after explaining it; do not blanket-apply suppression. Effects, subscriptions and async requests need correct cleanup/race handling. Reproduce relevant production behavior rather than treating dev-only repeated work as a production regression. [React hydration](https://react.dev/reference/react-dom/client/hydrateRoot).
- **Next.js:** Establish App Router versus Pages Router, installed major/minor, server/client boundary, runtime and request/cache semantics. Check the matching upgrade guide for changed request APIs, caching, routing and build integration; avoid applying an example from another major. Do not broaden `use client` boundaries to mask a server-side design issue. [Official upgrade entry point](https://nextjs.org/docs/app/guides/upgrading).
- **Vite:** Check the installed major, runtime engine, plugins, resolve aliases, dependency optimization, server proxy and production base path. Development and production bundles can differ. Do not assume the current build engine or configuration migration from old Vite examples. [Version migration](https://vite.dev/guide/migration).
- **Tailwind:** Determine the installed major and build integration. Configuration, import syntax, theme behavior and detected utility classes depend on the version. Check whether a dynamic class string is discoverable in source; use a finite static mapping when appropriate. Do not paste v3 setup into a v4 project or run a migration without a task reason. [Upgrade guide](https://tailwindcss.com/docs/upgrade-guide).
- **Vue, Svelte, Angular, Astro and other stacks:** Apply the same installed-version rule. Inspect their actual component/lifecycle, SSR and routing conventions; fetch that framework's official reference before a version-dependent change. The bundle does not contain an exhaustive manual for every framework.

Respect the lockfile/package manager already in the repository. A floating `latest` command can change the project beyond a debug task. Prefer the pinned project test tools, including Playwright or Puppeteer, for durable end-to-end regression coverage if they are already used.

## Network, browser state and client security

Use network evidence to separate DNS/TLS, redirect loops, preflight/CORS, authentication, cookie policy, mixed content, CSP, unavailable endpoints, HTTP errors and content parsing. A cookie being set does not guarantee it is sent in a particular site context. Check request origin, top-level site, credentials mode and actual browser policy/version. Diagnose CORS at the responding server/proxy; do not disable browser protections.

Compare cache and service-worker behavior deliberately. Preserve a before/after trail when disabling cache for diagnosis and restore altered settings. Avoid logging tokens or dumping all storage. Keep secrets on the server; inspect the framework's exposed-environment-variable conventions before changing names.

Client validation is UX, not authorization. Use safe DOM/text rendering for untrusted content and check server authorization when a bug concerns access. These checks support the observed issue and do not turn every UI request into a broad security audit.

## Performance

Measure the relevant user flow before optimizing. Use navigation/resource timings to locate loading phases, and a trace to distinguish network delay, scripting, style, layout, paint and long tasks. Preserve viewport, cache state, data and throttling when comparing runs; repeat only enough to distinguish a real change from variability.

The reference Core Web Vitals are LCP, INP and CLS; the published good thresholds are LCP ≤2.5 s, INP ≤200 ms and CLS ≤0.1 at the 75th percentile of field visits, segmented by mobile/desktop. Recheck current definitions before reporting compliance. A one-off local trace or CDP `metrics` result is not a field percentile and does not provide a valid INP score without appropriate interaction instrumentation. [Web Vitals](https://web.dev/articles/vitals).

Fix the measured bottleneck: explicit media sizes for shifts; appropriate image formats/sizes and prioritization for loading; split only expensive code on the relevant route; avoid layout read/write thrashing; reduce long synchronous interaction work. Explain tradeoffs such as cache staleness or bundle duplication. Do not invent a percentage improvement from an unmeasured change.

## Regression evidence

Keep a failing case that expresses the original symptom and passes after the fix. Pair assertions with real browser interactions for interactive bugs; type checking alone cannot verify a menu opens or a request finishes. Use screenshot inspection for layout changes and purposeful keyboard checks for focus issues. State build/test commands and relevant results, while separating pre-existing failures from failures introduced by the change.
