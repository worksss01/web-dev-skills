# SEO: technical access, meaning and verification

Establish whether the page is intended to be indexed, its audience/language, primary purpose and the affected URL/template. Private account screens, staging sites and duplicate/filter views can intentionally restrict indexing. Do not remove noindex or open crawling just to improve an audit count.

## Observe before changing

Add this action to a Chrome plan after application readiness:

```json
{"type":"seoAudit","indexing":"public"}
```

Use `private` for intentionally non-indexed pages or `unknown` when intent is not established. The action reads rendered title/descriptions, canonical links, bot-specific robots meta, headings, hreflang links, crawlable href count and bounded JSON-LD syntax/types. It reports malformed JSON without executing it. JSON syntax is only the first check: it does not validate schema properties, visible-content consistency or rich-result eligibility.

Pair DOM observations with the original HTTP response and relevant headers; `edge.mjs` now records X-Robots-Tag when present. Inspect the selected robots.txt/sitemap when the question requires them, and actual Search Console evidence when authorized/available. This helper does not crawl the entire site, impersonate a crawler or prove the page is indexed. Content appearing after JavaScript execution may differ from original HTML or crawler-visible content. [JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).

## Make targeted improvements

- **Access and indexing:** Separate robots.txt crawling rules, robots meta, X-Robots-Tag, authentication, response status and CDN blocking. A crawler must retrieve a rule to see it; robots.txt is not an authentication or reliable removal mechanism. Preserve intended private/staging restrictions. [Robots reference](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag).
- **Canonicalization:** Compare canonical links, redirects, internal links and sitemap URLs. A canonical is a signal, not a command or permission to delete duplicate routes. Check cross-domain/language canonicals intentionally and avoid contradictory signals. [Canonical guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).
- **Content and links:** Make the page's actual purpose and next action clear. Use meaningful titles/headings and crawlable links. Do not enforce invented universal title lengths, exactly one H1, keyword densities or content word counts. Avoid keyword stuffing, duplicate city pages and wording that harms readers.
- **Metadata:** Keep the title and description accurate, specific and consistent with the page. Search systems can choose different snippets; a description is not a guarantee of displayed text. Social preview metadata is a separate presentation concern.
- **Structured data:** Choose a supported type appropriate to the content, use truthful visible data, and verify required/recommended properties with the current engine documentation and its validation tools. Never invent reviews, ratings, authors or qualifications. Do not add FAQ markup indiscriminately. [Structured-data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies).
- **Experience:** Preserve usable mobile layouts, meaningful media alternatives, responsiveness and measured performance. Treat these as product quality as well as search work; do not claim a numeric ranking gain from an unmeasured code change.

## Validate the result

Replay the affected route and inspect its rendered metadata, original response and user-visible text. Check neighboring templates when changing shared metadata generation. Distinguish a fix in code, a successful crawl, indexing and actual search performance. Review relevant query/page metrics over a suitable period if data is available; do not attribute every traffic change to the edit or guarantee placement. [Google SEO fundamentals](https://developers.google.com/search/docs/fundamentals/seo-starter-guide).
