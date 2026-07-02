# The model

This document specifies the semantics of the JSON corpus: what an axis, a position, a profile and the relation graphs mean. Read it before contributing, and give it to an LLM alongside the data when you use the referential programmatically. (The layout of the repository is in the [README](README.md); the sub-problem grid carried by axes has [its own document](docs/problems-ontology.md).)

## Three registers

Before placing anyone, the model tells apart three registers of what a person, a work or a movement commits to:

- **Descriptive beliefs** (*what is*): theories about reality, answerable to true/false. Axes with `"layer": "THEORY"`.
- **Prescriptive beliefs** (*what ought to be*): values, ends and rules — owned, argued for, contested rather than verified. Axes with `"layer": "VALUE"`.
- **Practices** (*what one does*): concrete routines that put a belief to the test of action. Practices are part of the Philoscopia apps, not of this referential; the two belief registers are.

The registers do not collapse into one (Hume's is/ought gap), but a descriptive belief often *grounds* a prescriptive one: those supports are what the foundation graph maps (see below).

## Axes

An **axis** (`data/axes/`) is one live philosophical question with its space of answers. Its fields:

- `relation` — what the question puts at stake: `TRUTH`, `SELF`, `OTHERS` or `WORLD`. Four orientations, not airtight boxes; an axis is filed under the relation that dominates.
- `territory` — a finer thematic grouping within the relation.
- `layer` — `THEORY` (descriptive) or `VALUE` (prescriptive).
- `question`, `label`, `stakes` — the reader-facing framing.
- `type` and `poles` — the shape of the answer space:

| `type` | Poles | Position value |
|---|---|---|
| `BIPOLAR` | exactly 2 opposed poles | `scalar` in [−1, +1] |
| `BIPOLAR_MEDIAN` | 2 poles + a **named median** (`medianLabel`/`medianDescription`), a genuine third stance (e.g. compatibilism), at scalar 0 | `scalar` in [−1, +1] |
| `TRIANGULAR` | exactly 3 irreducible poles | `weights` (barycentric) |
| `CATEGORICAL` | ≥ 3 unordered poles | `weights` (distribution) |
| `CATEGORICAL_ORDERED` | ≥ 3 poles forming a scale | `weights` (distribution) |

- Each pole has a `label`, a `description`, optional `nuances`, and anchor `figures`.
- `commonOpinion` — the pole closest to lay opinion, when one clearly dominates.
- `core` — the ~2 dozen nodal axes that structure the referential; `difficulty` (1–3); `clusters` — correlation clusters used by the similarity engine; `relatedAxes` — the axis's neighbours in the parenthood graph.
- `problems` — the axis's map of live sub-problems (see [docs/problems-ontology.md](docs/problems-ontology.md)).

### Position values

- `{"kind": "scalar", "value": v}` — for 2-pole axes. **−1 means fully the first pole of the `poles` array, +1 fully the second**; the share of the second pole is `(v + 1) / 2`. On a `BIPOLAR_MEDIAN` axis, values near 0 mean the named median stance, not indifference.
- `{"kind": "weights", "weights": [...]}` — one weight per pole, **in the order of the `poles` array**, summing to 1.

## Profiles

A profile (`data/philosophers/`, `data/movements/`, `data/characters/`) positions a figure on the axes. Its `entries` each concern one axis:

- `status` — how the figure relates to the question:
  - `POSITIONED`: takes a stance (then carries a value and a justification);
  - `NO_POSITION`: the question is live for them but they do not settle it;
  - `CONTEXTUALIST`: the answer depends on context, refuses a single placement;
  - `REJECTS_ALTERNATIVE`: rejects the very terms of the axis (the `note` explains);
  - `NOT_APPLICABLE`: the question does not arise in their framework.
- `declaredValue` vs `practicedValue` — what the figure *professes* vs what their conduct or work *enacts*. The gap between the two is meaningful (it is rendered explicitly when both are present).
- `epistemicStatus` — how the placement is known: `EXPLICIT` (textual, quotable), `INFERABLE` (deduced from a principle, consistent with the corpus), `EXTRAPOLATED` (speculative — must always be displayed as such). `UNDOCUMENTED` is not acceptable on a positioned entry.
- `salience` — how much the axis matters *to this figure*: `MAJOR`, `MINOR`, `NOT_RELEVANT`. For movements: `MAJOR` = definitory of the school, `MINOR` = typical of it.
- `justification` — mandatory on every positioned entry: a sourced `text`, `references` (primary texts first), an optional striking `quote` with its `source`, and a `strength` (`STRONG`/`MEDIUM`/`WEAK`).

Profile-level fields:

- `structuring` — the ordered list (~4–5, most structuring first) of the positions at the **core of the figure's system**: what distinguishes the thinker and what they genuinely worked to justify. Orthogonal to salience. Each may carry a `thesis`: the position stated as one precise, assertive, debatable sentence in the thinker's voice.
- `stub: true` (philosophers only) — a mini-card (name, dates, movement, one-line summary) with **no positions yet**, published so references resolve and as an explicit invitation to contribute the full profile.
- `validation` — how the profile was checked (`DOUBLE_LLM_PASS`, `EXPERT_REVIEW`, `NOT_VALIDATED`).

## The relation graphs

- **Influences** (`data/influences/`) — directed historical filiations, `from` = influencer, `to` = influenced. `directness`: `ATTESTED` (documented, should cite `sources`) or `INDIRECT`. `mode`: `CONTINUES`, `REACTS_AGAINST`, `SYNTHESIZES`, `TRANSMITS`, `REINTERPRETS`. `strength` is the confidence that the link is real and significant. Edges are selective (decisive links only), membership in a movement is not influence, and mutual influence is legitimate (the graph is not acyclic).
- **Foundations** (`data/foundations/`) — grounding relations between *beliefs* (a belief = a pole, or the named median, of an axis). The `ground` is always a descriptive (`THEORY`) belief; `kind` is `T_T` (theory grounds theory) or `T_V` (theory grounds value). This graph **is** acyclic (checked at validation). It is the operational form of the fact→value bridge above.
- **Tensions** (`data/tensions/`) — justified pairs of positions that sit uneasily *within one profile*: `T_T` (two beliefs hard to hold together) or `T_V` (a belief against a value), with an `explanation`. Used to detect internal tensions in a profile.

## Supporting types

- **Glossary** (`data/glossary/`) — the concepts referenced by `<c id='…'>` tags. A `figure` field marks a *proprietary* concept (Nietzsche's amor fati); its absence marks a generic tool for thinking. Optional `positions` list the poles the concept carries a stance toward.
- **Works** (`data/works/`) — the registry behind `<w id='…'>` tags: usage `title` per language, optional `originalTitle`, `author`, `year`, one-line `presentation`.
- **Thought experiments** (`data/thought-experiments/`) — classic experiments with their `source`, the `question` they sharpen, and the `axisIds` they put under stress.

## Conventions

- Every reader-facing string is a `LocalizedText`: `{ "fr": …, "en": … }`.
- File name = entity id (axes: the `UPPER_SNAKE` id lowercased with `-`).
- Corpus texts carry the semantic annotation layer described in the [README](README.md#data-model-in-three-points); referenced ids must resolve within this corpus.
