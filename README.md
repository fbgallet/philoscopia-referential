# Philoscopia — an open map of philosophical debates and worldviews, and the tools to build your own philosophical profile

**🇬🇧 English · [🇫🇷 Français](README.fr.md)**

An open, bilingual (EN/FR) referential for mapping philosophical positions: **80 axes** covering the great debates, **sourced profiles** of philosophers and movements, **influence and foundation graphs**, a glossary and a registry of works — all as validated, machine-readable JSON, designed for reuse by humans and LLMs alike.

This referential powers **Philoscopia**, a philosophical companion for discovering the worldviews of philosophers and building one's own. The data is published here so that anyone — researchers, teachers, developers, or anyone with an LLM — can explore, reuse, criticize and improve it.

More than an encyclopedic referential, this is a **didactic** one — distilled from over twenty years of philosophy teaching. Every layer is built so that you (and your AI assistant) can actually *do* philosophy, not just look it up: uncover the positions you already hold, put them to the test against the strongest objections, and build a structured workspace of your own ideas.

## What's inside

Everything lives under `data/`, one JSON file per entity:

| Folder | What it contains |
|---|---|
| `axes/` | The core of the referential: 80 axes of philosophical positions (e.g. free will, the sovereign good, the nature of truth). Each axis defines its poles, its territory and layer (descriptive theory vs value), its type (bipolar, spectrum, …), its related axes, and a map of the live sub-problems it carries. |
| `themes/` | A beginner-friendly discovery layer: everyday entry words (life themes and school-programme notions — freedom, happiness, justice, …) each mapped to the axes that treat them. A simple, clear way into the referential without knowing its axis vocabulary; `featured` themes surface first. |
| `philosophers/` | Profiles positioning a philosopher on the axes, with **sourced justifications**, a declared/practiced distinction, statuses and salience. Full profiles coexist with lightweight stubs (`"stub": true`) that mark coverage still to be authored. |
| `movements/` | Same model for schools and movements (Stoicism, utilitarianism, …). |
| `characters/` | Same model for fictional characters. |
| `influences/` | A directed graph of historical filiations between figures and movements: who continued, transmitted or reacted against whom, with sources on attested edges. |
| `foundations/` | A directed acyclic graph of grounding relations between beliefs: which descriptive belief grounds which other belief or value. |
| `tensions/` | Justified pairs of positions that sit in tension within one profile (two incompatible beliefs, or a belief vs a value). |
| `glossary/` | Definitions of the concepts referenced across the corpus. |
| `works/` | A registry of the works cited or tagged in the corpus. |
| `thought-experiments/` | Classic thought experiments (the trolley problem, the experience machine, the ring of Gyges, …) linked to the axes they put under stress. |
| `arguments/` | The canonical arguments (SUPPORTS) and objections (OBJECTS) bearing on a position: a chain of reasons with optional deepenings, sources, and — for objections — the honest ways out (revise / qualify / hold firm). |

Most entities (themes, axes, philosophers, movements, glossary, characters) also carry **`aliases`** — bilingual lists of alternative names and everyday search terms — so a reader or LLM can reach the right entry from the words they'd naturally use, not just its canonical id.

## Browse the corpus

You don't need to read JSON: every entity also has a generated, hyperlinked markdown page — semantic tags become links between pages, influence and grounding relations are shown on the pages they concern.

**[Browse in English](views/en/README.md) · [Parcourir en français](views/fr/README.md)**

## Data model in three points

1. **Bilingual by structure.** Every reader-facing string is a `LocalizedText` object: `{ "fr": "…", "en": "…" }`. More locales may be added over time.
2. **One entity, one file.** File names match entity ids (`philosophers/epictetus.json`, `axes/freedom.json`). Cross-references use these ids.
The full semantics of the model — the three registers, axis types and position values, profile statuses and salience, the relation graphs — are specified in **[MODEL.md](MODEL.md)**; the sub-problem grid carried by axes (`problems`) in **[docs/problems-ontology.md](docs/problems-ontology.md)**.

3. **A light semantic annotation layer.** Corpus texts carry inline tags that mark their philosophical structure, with single-quoted attributes. Referencing tags link to other entities: `<c id='eudaimonia'>` (concept → glossary), `<ph>`, `<mv>`, `<chr>` (philosopher / movement / character), `<ax id='FREEDOM'>` (axis, optionally `pole='…'`), `<te>` (thought experiment), `<w>` (work). Discursive tags mark the role of a span: `<th>` thesis, `<arg>` argument, `<obj>` objection, `<pb>` problem, `<stk>` stakes, `<dif>` difficulty, `<ex>` example, `<ety>` etymology, `<q>` quotation, `<kw>` key term, `<per>` person, `<bel>` belief. Tags wrap existing words without rewriting them. Strip them and you get plain prose; keep them and you get a semantically structured corpus.

## Using this data with an LLM

The easiest way: the **[MCP server](mcp/)** (`npx philoscopia-mcp`). It serves the whole referential to any MCP-capable assistant and maintains your own philosophical profile in a local, private `my-philosophy/` folder — plain JSON and markdown you own, validated against the published schemas, no network calls. It is the same workspace you build on the Philoscopia site, so the two complete each other. On top of it, six **[exploration skills](skills/)** give your assistant the conversational craft: `philo-discover` (uncover positions you didn't know you held), `philo-examine` (Socratic testing of a belief), `philo-compare` (face to face with a figure), `philo-read` (follow the thread of a text together), `philo-concept` (experience what a concept changes), `philo-articulate` (train saying what you think). Together, server and skills form a coherent, complete set of protocols for exploring one's ideas and putting them to the test.

**What this is not.** Said plainly: an AI companion does not replace a living conversation with humans — a friend, a teacher, a philosopher; it does not replace reading the philosophers themselves, because following the thread of a thought is an experience of its own (the reading skill brings texts *into* the practice precisely for that reason); and it does not replace the lived practice of one's principles. The system is designed to point toward all three.

The corpus is also directly legible by language models without any tooling: give a model [MODEL.md](MODEL.md), the relevant axis files and the annotation vocabulary above, and it can position a philosopher who is not yet covered here, compare worldviews, or help you explore your own — in any interface that can read JSON.

## Provenance and how this repo is maintained

This repository is a **generated export** from a private working monorepo, where the content is authored, validated (schema validation, referential integrity, tag resolution, graph acyclicity) and evaluated. Do not edit `data/` files here directly: changes are integrated upstream and re-exported (see [CONTRIBUTING](CONTRIBUTING.md) — corrections and sourced improvements are very welcome, especially from specialists of the philosophers covered).

A note on completeness: some axis sub-problems are marked `"resolution": "LATENT"`; they are realized by interactive activities (questions, scenarios) in the Philoscopia apps, which are not part of this referential.

## Roadmap

- [x] [JSON Schemas](schemas/) published for every content type
- [ ] The tag parser / validator as a small MIT-licensed package
- [x] Generated human-readable views (one page per entity, EN + FR)
- [ ] The full specification of the axis model, in English
- [x] An [MCP server](mcp/) for LLM-driven exploration and self-profiling
- [x] [Exploration skills](skills/) (guided discovery, Socratic examination, figure comparison)

## Support & follow

If you find Philoscopia useful, you can support our work on **[Ko-fi](https://ko-fi.com/philoscopia)** — one-off or recurring, also possible via [GitHub Sponsors](https://github.com/sponsors/fbgallet).

Follow the project and get in touch on **[X (@fbgallet)](https://x.com/fbgallet)** and **[Bluesky (@fbgallet.bsky.social)](https://bsky.app/profile/fbgallet.bsky.social)**.

## Licensing

- **Data and documentation** (`data/`, `*.md`): [Creative Commons Attribution-ShareAlike 4.0](LICENSE) (CC BY-SA 4.0). You may share and adapt them, including commercially, provided you credit *Philoscopia — Fabrice Gallet* and license your derivatives under the same terms.
- **Code** (`scripts/`, and future schema/parser packages): [MIT](LICENSE-CODE).

## Citation

> Gallet, F. (2026). *Philoscopia: an open referential of philosophical worldviews.* https://github.com/fbgallet/philoscopia-referential
