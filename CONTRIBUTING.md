# Contributing

Corrections and sourced improvements are very welcome — this referential gets better precisely where specialists disagree with it.

Start by reading **[MODEL.md](MODEL.md)** (the semantics of axes, positions, statuses and graphs) and, for anything touching an axis's `problems`, **[docs/problems-ontology.md](docs/problems-ontology.md)**.

## What helps most

- **Challenging a position.** If a philosopher's placement on an axis seems wrong or too coarse, open an issue (or a PR) explaining why, **with sources** (primary texts first, standard commentaries second). This is the single most valuable contribution.
- **Adding or correcting sources** on existing justifications.
- **Correcting or completing influence edges** (direction, dating, missing filiations), with a source for attested links.
- **Completing a stub profile.** Profiles marked `"stub": true` are placeholders waiting for a full, sourced profile. Open an issue first so we can share the authoring method and the axis definitions you'll need.
- **Improving translations.** Each language version should read idiomatically, never as a calque of the other.
- **Glossary fixes** (definitions, etymologies, related terms).

## Ground rules

1. **Every position claim needs sources.** Justifications cite works; unsourced placement changes will not be merged.
2. **Both languages, always.** Every reader-facing string is `{ "fr": …, "en": … }`. If you are only comfortable in one language, submit it and say so — we'll handle the other.
3. **Respect the annotation layer.** Semantic tags (`<c id='…'>`, `<th>`, `<arg>`, …) use single-quoted attributes and wrap existing words without rewriting them. Referenced ids must resolve within this corpus.
4. **One entity per file**, file name matching the entity id.
5. **French typography**: in French text, no em dash mid-sentence (use a comma or colon).

## How changes are integrated

This repository is a generated export of a private working monorepo where authoring, validation and evaluation happen. Accepted contributions are integrated upstream and come back in the next export — so a merged change may be reformatted slightly, and `data/` should never be edited outside this flow. Your contribution is credited in the pull request history.

For anything substantial (a new profile, a disputed repositioning), **please open an issue before writing**: it saves you work and lets us share the relevant method and definitions.

## Licensing of contributions

By contributing, you agree that your contributions to `data/` and documentation are licensed under [CC BY-SA 4.0](LICENSE), and contributions to code under [MIT](LICENSE-CODE).
