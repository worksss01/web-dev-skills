# Natural language for website content and UI

Write for the audience, locale, task and brand voice. Natural language means clear, idiomatic and appropriate expression; it does not require pretending a text has a particular author or passing an AI detector.

## Preserve meaning before polishing

Extract the facts that must remain: names, numbers, prices, dates, requirements, promises, exceptions, uncertainty and intended action. Use only supported detail. After editing, compare the revised copy against those facts and inspect it in the actual UI so a shorter label does not become ambiguous.

Use familiar words, concrete subjects/actions and sentence lengths appropriate to the material. Remove needless introductions, repeated conclusions and generic promotional language when they do not help the reader. Keep technical terms that are necessary and explain them at the right level rather than replacing precision with vagueness.

Voice can be warm, formal, playful or technical depending on the product. Do not impose a single conversational template everywhere. Read the draft aloud and revise wording that feels translated or mechanically repetitive. Practical principles such as direct wording and clear next steps are illustrated by the [Microsoft style guide](https://learn.microsoft.com/en-us/style-guide/top-10-tips-style-voice); its English-specific conventions are not universal Thai rules.

## Thai and multilingual copy

Use natural Thai word order and terms the audience actually uses. Choose a consistent politeness level and pronouns appropriate to the brand instead of appending ครับ/ค่ะ to every UI label. Avoid unnecessary transliteration when a familiar Thai term is clearer; retain recognized technical names when translation would confuse.

Do not evaluate Thai by splitting only on spaces or applying English readability formulas. Check word breaks, line height, diacritics, font fallback and long labels in the rendered layout. Preserve locale-specific dates, currency, addresses and numerals according to the product's audience; do not silently convert them based on the machine path or locale.

For multilingual pages, maintain equivalent meaning and conditions rather than matching sentence structure literally. Check that links, metadata, labels, errors and structured data refer to the correct language version.

## UI microcopy

Tell the user what an action does and what happens next. An error should explain what can be corrected without exposing internal details or blaming the user. Confirm a success only when the operation has succeeded. Keep destructive consequences and material conditions understandable; do not use polished language to hide them.

Example of removing a needless wrapper while preserving intent:

- Before: “ผู้ใช้งานสามารถดำเนินการกดปุ่มด้านล่างเพื่อทำการยืนยันข้อมูลการจองได้”
- After: “ตรวจสอบข้อมูลการจอง แล้วกดยืนยัน” — use this only when reviewing the information is actually part of the flow; otherwise keep the original action's scope.

## Local editorial cues

```text
node SKILL_DIR/scripts/copy.mjs --file work/page-copy.txt --language th --out work/copy-review.json
```

Use an appropriate BCP 47 language tag (`th`, `en`, etc.). The helper uses locale-aware segmentation and reports repeated passages, generic standalone CTA labels and claims that may need evidence. These are review prompts, not errors to automatically remove. It does not overwrite input, rewrite text, upload content, verify facts or assign a human/AI/naturalness score. Respect the document's Markdown structure and legal/technical meaning when interpreting results.

For a rewrite, deliver the actual improved copy and explain only material meaning changes or unresolved claims. Do not fabricate personal experiences, testimonials, credentials or citations to make text sound more human. SEO/AEO goals should not make the language repetitive or misleading.
