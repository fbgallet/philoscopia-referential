# The problems grid — an ontology of philosophical problems

Each axis may carry a `problems` array: the map of its **live sub-problems**. This document explains the grid behind that map, enough to read it and to contribute to it. It is the condensed, operational version of a fuller essay (in French, publication planned); the grid itself is what you need here.

## Why a grid

An axis names a broad question ("are we free?"). What makes it *live* are its sub-problems — the specific points where the question bites. Left to inspiration, such lists come out generic and lopsided. The grid decomposes an axis methodically, by crossing **what the belief is about** with **the relation it takes to it**, plus a third dimension for values. It is an author's lens, not a user-facing taxonomy: readers see the four relations (truth, self, others, world); the grid works backstage.

## The three dimensions

**Object — three types of being a belief can be about:**

- `INDIVIDUAL` — beings and their attributes, their existence: a person, God, the self, a work.
- `RELATION` — interactions and events, what happens and is undergone: an action, an affection, an encounter, a causal link.
- `STRUCTURE` — the orders and laws that govern relations: laws of nature, social rules, language, a theory, an institution.

**Mode — three relations a belief can take to its object:**

- `DESCRIPTIVE` — what is, and what can be known of it.
- `PRESCRIPTIVE` — what is *worth*: the value of an **end**, and what ought to be done in consequence.
- `PRACTICAL` — *how to proceed*: means, techniques, exercises toward an end **taken for granted**; only the efficacy of the means is in play.

The prescriptive/practical boundary is the boundary of **end vs means**. One decisive nuance: as soon as you question not the efficacy but the *permissibility* of a means (torture for a good cause), you are back in the prescriptive — the means has become a second end whose value is weighed. And since the same thing is an end here and a means there (health vs the diet, health vs the good life), **the grid classifies problems, not axes**.

**Sphere — which value is at stake (prescriptive problems mainly):**

Value comes in irreducible spheres, and the moral good is only one of them: the beautiful (aesthetic), the true held as a good (epistemic), the pleasant and the vital, the sacred, meaning, the useful, the political-juridical (organizing and legitimating a collective order is not the same question as judging what a person morally deserves). The `sphere` field draws on an **open, anchored menu — a checklist, not a quota**. Each mode has its own fixed norm of correctness (the descriptive aims at the true, the practical at the efficient); what is proper to the prescriptive is that its value is *in question and plural* — there alone a sphere must be chosen. Note that every sphere also has a descriptive *meta* face: "is beauty objective?" is a descriptive question (a door to the meta-aesthetics axis), not a prescriptive sub-problem.

**The object × mode crossing:**

| | `INDIVIDUAL` | `RELATION` | `STRUCTURE` |
|---|---|---|---|
| `DESCRIPTIVE` *(what is)* | its existence, its essence | what happens, its cause, its meaning | the laws, the rules, their status |
| `PRESCRIPTIVE` *(what is worth)* | the value of a being (good, beautiful, worthy) | the value of an act (acting well, just response) | the value of an order (the just, the harmonious) |
| `PRACTICAL` *(how to do)* | forming oneself (attitudes, askēsis) | training oneself (habits) | building, regulating (techniques, institutions) |

The grid is not arbitrary: read row by row, it reconstructs the classical partition of philosophy (metaphysics of substance, philosophy of action and event, social ontology; then axiology, ethics of action, political philosophy…). Its deeper use is that **the type of object predicts the shape of the difficulty** — knowing a singular individual, an unperceivable causal tie, or a law that outruns any finite evidence are not the same problem, and each has its own canonical moves. That analysis belongs to the fuller essay; for contributing, the labels above suffice.

## Two resolutions: SURFACED and LATENT

A problem map has two levels:

- **`SURFACED`** (1 to 3 per axis) — problems made visible to the reader, each realized by a concrete corpus object (`ref`) and carrying a one-sentence `explicitation` of what is in tension — one sentence, never an essay. In this public export, `ref` points to a thought experiment; problems realized by the apps' interactive activities (positioning questions, scenarios) are exported as LATENT instead.
- **`LATENT`** — the long tail: short titled seeds (`title` + `explicitation`), anchored to figures or traditions (`anchors`), not written out. They are **prompt anchors**: they steer on-demand AI deepening away from generic output by giving it the table of contents, one entry of which it unfolds on request.

Two dosage principles: **checklist, not quota** (surface only the perspectives genuinely alive for this axis) and **depth, not quota** (a dense axis carries many seeds, a poor one a single seed).

## Cross-axis control: doorways

Every seed is tested against the referential: if it substantially overlaps another axis, it is a **door, not an internal sub-problem**. It is authored ONCE on its home axis and linked from elsewhere via `doorways` (which must stay within the axis's `relatedAxes`), never duplicated. Side benefit: mapping one axis densifies the parenthood graph of the whole referential.

## Field reference

| Field | Meaning |
|---|---|
| `id` | Globally unique problem slug (across all axes). |
| `resolution` | `SURFACED` (carries `ref`) or `LATENT` (carries `title`). |
| `object`, `mode`, `sphere` | The grid coordinates above. |
| `relation` | `SUBPROBLEM` (internal to this axis, default) or `RELATED` (a boundary problem). |
| `objectLabel` | The concrete object the abstract `object` points to ("a whole life", "the city"). |
| `poles` | Pole(s) of this axis the problem bears on. |
| `keywords` | Localized discovery keywords. |
| `anchors` | Figures/traditions anchoring the problem (specificity for AI deepening, links for readers). |
| `doorways` | Links to the neighbouring axis (and optionally the specific problem there). |
| `title`, `explicitation` | Short reader title; the one-sentence statement of what is in tension. |
| `ref` | For `SURFACED`: the corpus object realizing the problem. |
