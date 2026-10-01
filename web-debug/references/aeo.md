# AEO: answer-oriented, evidence-backed website content

In this skill, AEO means Answer Engine Optimization: improving how a page answers real questions and how those answers can be understood and retrieved. It is not a standardized ranking score or a guarantee that an AI product will cite the site.

## Start with the reader's questions

Identify the actual audience and decision: what they need to know, the answer they can act on, the conditions/exceptions, and what evidence supports it. Use concise question headings when they fit the page; do not convert every page into an FAQ.

For each material question, map:

| Question | Direct answer | Supporting evidence | Conditions/freshness |
|---|---|---|---|
| The user's real query | A clear answer near the relevant heading | First-party detail, verifiable source, example or measurement | Version, date, location, eligibility or uncertainty where it changes meaning |

Lead with the answer, then explain the reasoning and needed detail. Tables work for genuine comparisons; ordered steps work for procedures. Keep important information in accessible text rather than only in images. Clarify entities, product names, units and dates. Link related pages in context and maintain consistent facts across the site.

## Ground authority in real information

Use real authorship, organization details, dates and sources where relevant. Preserve limitations and contradictions that matter to a decision. Do not create fake expertise, citations, statistics, customer experience or freshness dates. If the supplied material cannot support a claim, revise its scope or identify the missing evidence rather than making it sound more confident.

Match any structured data to the visible content and actual entity. The `seoAudit` action can inventory JSON-LD syntax/types, not verify the truth or quality of an answer. A valid schema does not make an unsupported claim authoritative.

## Verify the named engine's requirements

For Google's AI search features, the consulted documentation says normal SEO practices remain relevant and does not require special AI markup or a new machine-readable text file. Do not present `llms.txt`, a special schema or a guessed content formula as a universal eligibility requirement. Other engines may have different crawler/access policies; check their official documentation when the task names them. [Google AI-feature guidance](https://developers.google.com/search/docs/appearance/ai-features).

Respect robots/indexing intent, authentication and CDN rules. Do not bypass controls or expose private content to increase visibility. Separate search crawling, AI answer retrieval and model-training policies instead of treating them as identical.

## Evaluate without inventing success

Review answer accuracy, completeness, clarity, source quality, useful structure and crawl/render evidence. A manually observed answer-engine citation is a dated observation affected by query, locale, personalization and product changes. It is not proof of consistent inclusion. Use available search/referral/conversion data within its limits; do not label a heuristic content score as an official AEO score.

Preserve natural language and product usefulness. Avoid repetitive keyword questions, copied competitor answers and large volumes of low-value pages. The goal is that a person can find and understand the supported answer, whether they arrive through search, a link or an answer engine.
