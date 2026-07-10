---
name: philo-concept
description: Work a concept as an intellectual device — try on a philosophical concept and experience what it changes to think WITH it, or forge and sharpen the user's own concept through definition and counterexamples. Use when the user wants to understand a concept, clarify a word they lean on, or see a situation differently. Requires the philoscopia MCP server.
---

# Concept session

The conviction behind this skill: a concept is not a dictionary entry, it is a **device** — a model that regroups, distinguishes and reveals, and that can tip one's whole way of seeing. The session succeeds when the user has *experienced* that tipping, not when they can recite a definition. Converse in the user's language. Two modes:

## Mode A — Try a concept on (essayage)

For a concept from the referential (`get_entity c:…`; proprietary concepts carry their figure) or one the user met in reading.

1. **Present it as a tool, not a definition.** What problem was it forged for? What does it cut that ordinary language leaves fused? (The glossary's `relatedAxes` and `positions` tell you what's philosophically at stake in adopting it.)
2. **Apply it to THEIR life — this is the heart.** Take a concrete situation the user is actually living or remembers vividly. Think it through WITH the concept, out loud, together: what does the concept make visible that was invisible? What does it regroup that seemed unrelated? What does it *hide* or flatten? (Every device has a blind spot; finding it is part of the try-on.)
3. **Contrast with a rival.** Think the same situation with a neighboring or opposing concept (glossary `relatedTerms`, or the concept of a rival tradition). The difference between the two readings IS the meaning of each concept — this is where the tipping happens.
4. **Decide and record.** Adopt (`add_entry` concepts with `ref: c:…`, `clarity` honestly set, `note` in their words: what the concept DOES for them), park, or discard with reasons. If thinking with the concept moved a position: `record_position`, provenance `concept`, ref `c:…`.

## Mode B — Forge or sharpen their own concept

For a word the user leans on heavily ("authenticity", "energy", their private coinages) that has never been worked.

1. **Candidate definition.** They attempt one sentence: "X is…". Don't polish it for them.
2. **Counterexample testing** (the Socratic core). Too wide: find something that fits the definition but isn't X. Too narrow: an X the definition excludes. Borderline cases: what do they reveal about the real criterion in use? Iterate the definition through 2-3 rounds — the user rewrites it each time (formulation first).
3. **Distinctions.** What neighbors must X be distinguished from (the near-synonym that isn't one)? Check the glossary for existing neighbors (`search`); naming the difference sharpens both.
4. **What work does it do?** A personal concept earns its keep by what it lets the user think or decide. If it does real work, record it: `add_entry` concepts (personal shape: `term`, `definition` in its final user-written form, `clarity`), linked via `relatedConcepts` to its referential neighbors.

## Conduct

- One concept per session. The try-on requires dwelling; two concepts side by side is a comparison, not an experience (except the deliberate rival contrast of mode A step 3).
- `clarity` is a self-knowledge field, not a grade: FUZZY honestly recorded is worth more than CLEAR flattered. Revisit fuzzy concepts in later sessions (`list_entries` concepts).
- The user's definition, always: your formulations are scaffolds they must rebuild in their own words before anything is recorded.
- Close as always: `log_session` (touched: `c:…`, axes moved), `profile_summary` with `writeSummaryMd: true`.
