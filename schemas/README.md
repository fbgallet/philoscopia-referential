# JSON Schemas

Draft 2020-12 JSON Schemas, generated from the source Zod schemas. Use them
to validate or generate files that conform to the referential.

## Corpus content types

| Type | Schema |
|---|---|
| axes | [`axes.schema.json`](axes.schema.json) |
| philosophers | [`philosophers.schema.json`](philosophers.schema.json) |
| movements | [`movements.schema.json`](movements.schema.json) |
| characters | [`characters.schema.json`](characters.schema.json) |
| glossary | [`glossary.schema.json`](glossary.schema.json) |
| works | [`works.schema.json`](works.schema.json) |
| foundations | [`foundations.schema.json`](foundations.schema.json) |
| influences | [`influences.schema.json`](influences.schema.json) |
| tensions | [`tensions.schema.json`](tensions.schema.json) |
| thought-experiments | [`thought-experiments.schema.json`](thought-experiments.schema.json) |
| arguments | [`arguments.schema.json`](arguments.schema.json) |

**Scope.** These describe the *structure* of each file (fields, types, enums,
pole and position-value shapes). The referential also has cross-file and
cross-field rules — reference resolution, graph acyclicity, pole-count-by-type,
weights summing to 1 — that JSON Schema cannot express; they are enforced by
the corpus validator. See [../MODEL.md](../MODEL.md) for the full semantics.

## User workspace (`my-philosophy/`)

The personal, local-first workspace written by the Philoscopia MCP server and
exploration skills (one folder per person; monolingual). One schema per file:

| File | Schema |
|---|---|
| `philoscopia.json` | [`workspace/philoscopia.schema.json`](workspace/philoscopia.schema.json) |
| `profile.json` | [`workspace/profile.schema.json`](workspace/profile.schema.json) |
| `beliefs.json` | [`workspace/beliefs.schema.json`](workspace/beliefs.schema.json) |
| `concepts.json` | [`workspace/concepts.schema.json`](workspace/concepts.schema.json) |
| `affinities.json` | [`workspace/affinities.schema.json`](workspace/affinities.schema.json) |
| `inquiries.json` | [`workspace/inquiries.schema.json`](workspace/inquiries.schema.json) |
| `practices.json` | [`workspace/practices.schema.json`](workspace/practices.schema.json) |
| `quotes.json` | [`workspace/quotes.schema.json`](workspace/quotes.schema.json) |
| `readings.json` | [`workspace/readings.schema.json`](workspace/readings.schema.json) |

Referential refs inside workspace files use the prefixed grammar of the
semantic tags: `ax:FREEDOM`, `pole:FREEDOM/FREE_WILL`, `c:eudaimonia`,
`ph:epictetus`, `te:trolley-problem`, `problem:…`. `journal/*.md` session
files are free markdown with YAML frontmatter and carry no schema.
