<!--
Thanks for contributing. This repository is a generated mirror of a private
working monorepo: an accepted PR is replayed upstream (its data/ changes apply
verbatim) and comes back in the next export, credited to you. So a merged change
may return slightly reformatted, and the mirror updates on the next export
rather than at merge time. This is normal — see CONTRIBUTING.md.
-->

## What this changes

<!-- One or two sentences. Which entities/axes, and why. -->

## Type

- [ ] Position change (a figure's placement on an axis)
- [ ] Correction (fact, source, glossary)
- [ ] Influence edge
- [ ] Translation
- [ ] New / completed profile
- [ ] Other:

## Checklist

- [ ] I edited only `data/**` JSON — **not** `views/` or `schemas/` (both are generated; changes there are dropped on the next export).
- [ ] Every position or factual claim I touched cites **sources** (primary texts first).
- [ ] Reader-facing strings keep **both languages** (`{ "fr": …, "en": … }`); each reads idiomatically, not as a calque. (If you did only one language, say so and we'll handle the other.)
- [ ] Semantic tags use single-quoted attributes, wrap existing words, and reference ids that resolve in this corpus.
- [ ] French text uses no em dash mid-sentence (comma or colon instead).
- [ ] One entity per file; file name matches the entity id.

<!-- CI runs scripts/check-json.mjs on this PR. The full upstream validation
(referential integrity, graph acyclicity, tag closure across the private layer)
runs when the change is replayed in the monorepo. -->

## Sources

<!-- List them here if not already inline in the justifications. -->
