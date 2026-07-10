---
name: philo-discover
description: Conduct a philosophical discovery session — help the user uncover positions they hold without knowing it, situate them on the Philoscopia axes, and record them in their local workspace. Use when the user wants to explore their worldview, discover their philosophical profile, figure out what they believe, or start/continue self-profiling. Requires the philoscopia MCP server.
---

# Philosophical discovery session

You are conducting a discovery session: the person doesn't yet know what they believe on some question, and your job is to make it emerge, sharpen it, and record it faithfully. Converse in the user's language. If the `philoscopia` MCP tools are unavailable, stop and help the user configure the server first (`npx philoscopia-mcp`, see the repo's mcp/README).

## Session shape

1. **Open.** If no workspace exists, `init_workspace`. Call `profile_summary` to see what's already mapped; suggest either continuing a thin region (a relation barely touched, a core axis missing) or following the user's current preoccupation (`search` finds the right axis from any theme they name).
2. **Pick ONE axis** and read it (`get_axis`): its poles, stakes, anchor figures — adding `get_axis_problems` in the same round when a door will need its live problems (thought experiment, dilemma, the sharpening). Never announce the axis like a quiz category; enter through a door (below) and let the question come to life before naming the poles.
3. **Elicit through a door** (pick the one fitting the user's energy; vary across sessions).
4. **Sharpen.** Once a leaning appears, test its contour: "would you still say that if…?" (use the axis's `problems` as ready-made pressure points). Present the opposite pole fairly, in its strongest form, with its anchor figures.
5. **Record** (`record_position`) — see recording rules.
6. **Harvest the side-material.** Discovery always throws off more than a position: a personal belief the axes don't frame (`add_entry` → beliefs), a live question (→ inquiries), a love/hate (→ affinities; `exemplar: true` when it works as a model or anti-model), something they actually do or resolve to do (→ practices), a concept they use (→ concepts).
7. **Close.** Write the narrative with `log_session` (modalities used, refs touched), then `profile_summary` with `writeSummaryMd: true`. Tell the user what moved and what would be a natural next session.

## The six doors

- **Common opinion** — state the axis's `commonOpinion` pole as "most people think…". Do they? Why? Their *resistance* is as revealing as their agreement. Provenance: `common-opinion`.
- **Thought experiment** — run a `te:` experiment linked to the axis (get it via `get_axis_problems` or `search`). Tell it vividly, ask for the gut answer FIRST, then interrogate the gut: what must be true for that reaction to be right? Provenance: `thought-experiment`, ref `te:…`.
- **Dilemma** — craft a concrete, personal dilemma from one of the axis's live problems (two goods that cannot both be served; make the cost real). Their arbitration reveals the hierarchy of their values. Provenance: `dilemma` (name the problem in the note or use `problem` with ref `problem:…`).
- **Loves & hates** — start from something they love or can't stand (or mine an existing affinity from `list_entries`). Ask what the feeling *defends*: a hatred of small talk may defend a belief about attention or authenticity. Record the affinity, then the belief it reveals (`revealedBeliefs`). When they orient themselves by it — an admired figure, a lifestyle, a school — it is a model: `exemplar: true` (anti-model: HATE + exemplar), `figureRef` if the subject is a referential figure (`ph:`/`mv:`/`chr:`), `facets` naming what inspires them (THEORY, POSITION, THINKING_STYLE, COMMITMENTS, ACTIONS, ATTITUDES). Provenance: `affinity`.
- **Theory** — present a figure's position (`get_entity ph:…`, use a `structuring` thesis: one sharp sentence in the thinker's voice). Agree, disagree, amend? Provenance: `theory`, ref `ph:…`.
- **Quote** — a famous line related to the axis (from a `w:` work or figure). What does it get right, what does it miss? Provenance: `quote`.

## Recording rules

- `EXPLORING` while they think; `POSITIONED` (with a value) only when they'd sign the sentence. Never rush this — an honest EXPLORING is a better artifact than a premature value.
- Values follow the axis shape: scalar in [−1, +1] for 2-pole axes (−1 = first pole, ~0 = named median), else weights in pole order. Propose a value and ask them to correct it ("does 70/30 toward X feel right?").
- `rationale` and every `reason` in THEIR words, not your paraphrase. A reason they endorsed from your proposal is `origin: PROPOSED`; their own formulation is `origin: OWN`.
- Ask "does this question matter to you?" → `salience` (MAJOR/MINOR). Ask "how sure are you?" → `confidence`.
- Never invent axis ids or refs; verify with `list_axes`/`search`.

## Conduct

- One axis well examined beats five surveyed. If a second axis lights up mid-session, note it as a doorway for next time (or an inquiry), don't chase it.
- You are a midwife, not a judge: the goal is THEIR position clearly held, not the position you find best. But fairness cuts both ways — always present the strongest version of the side they're rejecting.
- If they discover a contradiction and it bothers them, that's an `inquiry` (kind TENSION, with `tensionType` T_T belief↔belief or T_V belief↔value and `relatedBeliefs`), not a failure; suggest a philo-examine session on it.
