# philoscopia-mcp

An MCP server that lets any LLM work with the [Philoscopia referential](https://github.com/fbgallet/philoscopia-referential): explore the axes of philosophical positions, read figures' profiles, and build **your own philosophical profile** in a local, private workspace.

Everything runs on your machine. The corpus is bundled in the package (each version pins one exact state of the referential); the server makes **no network calls**, and your workspace is a plain folder of JSON and markdown you own, read, edit and version as you wish.

## Setup

With Claude Code:

```bash
claude mcp add philoscopia -- npx -y philoscopia-mcp --workspace ~/my-philosophy
```

With Claude Desktop (or any MCP client), add to the configuration:

```json
{
  "mcpServers": {
    "philoscopia": {
      "command": "npx",
      "args": ["-y", "philoscopia-mcp"]
    }
  }
}
```

Options: `--workspace <dir>` (default `$PHILOSCOPIA_WORKSPACE`, then `~/my-philosophy`) and `--locale fr|en` (once a workspace exists, its manifest's locale wins). In a JSON client config, pass `--workspace` an **absolute** path — `~` is only expanded by a shell.

## Tools

Guidance — the server also ships `instructions` (injected into the assistant's context at connection), so any MCP client knows how to proceed without extra setup:

| Tool | Purpose |
|---|---|
| `help` | The full usage guide: typical session flow, recording rules, rules of care |
| `orient` | The session-opening overview, meant to be restated simply to the user: what the referential offers, who the user is (expertise, goals, motivations), where their carnet stands, the thread left open last time, and the session menu |

Referential (read-only):

| Tool | Purpose |
|---|---|
| `list_axes` | Compact digest of all axes (id, question, poles), grouped by relation — the entry point |
| `get_axis` | One axis: poles, stakes, anchor figures, per-pole canonical arguments (sub-problems split out, see below) |
| `get_axis_problems` | The axis's map of live sub-problems, for in-depth exploration |
| `get_entity` | Any entity by prefixed ref: `ph:epictetus`, `c:eudaimonia`, `arg:…` (an argument/objection)… — figures arrive as a digest (`full:true` for the whole profile) |
| `get_position` | One figure's sourced position on one axis (`axisId`) or several (`axisIds`) |
| `search` | Substring search across the whole corpus (diacritics-insensitive) |
| `get_tensions_for` | Position pairs in tension involving an axis |
| `get_foundations_for` | Grounding relations (belief → belief/value) involving an axis |

Workspace (local files, schema-validated on every write):

| Tool | Purpose |
|---|---|
| `init_workspace` | Create `my-philosophy/` (manifest, empty profile and collections), optionally with the user block |
| `set_user` | Update who the user is: expertise (`BEGINNER` / `AMATEUR` / `EXPERT`), goals and motivations in their own words — the register every session adapts to |
| `get_profile` / `record_position` | Read and record positions on the axes, with provenance, reasons and an append-only history |
| `add_entry` / `update_entry` / `list_entries` | Personal beliefs, concepts, loves & hates, open inquiries, practices, kept quotes (the florilège — always verbatim) and the reading register (with a `TO_READ` reading list) |
| `log_session` | Write the session's narrative to `journal/`; optionally set `next`, the thread to pick up next time (served back by `orient`) |
| `profile_summary` | Coverage, triggered tensions, ungrounded beliefs, open work; optionally regenerates the readable `summary.md` |
| `get_syntheses` / `write_synthesis` | Read past profile syntheses and write a new one: a dated, immutable prose portrait in `syntheses/`, crossing positions, carnet and user block (see the `philo-synthesize` skill) |
| `compact` | Move closed records to `archive/` (nothing is deleted) |

The workspace file format is specified by the published [JSON Schemas](../schemas/workspace/); every write is validated against them, plus the rules schemas cannot carry (a POSITIONED entry needs a value, values must fit the axis's pole shape, referential refs must resolve). The server only ever touches the files the format names: extra files another writer keeps in the same folder (e.g. the web app's local vault: `session.json`, `notes/`, `Inbox.md`) are ignored, and a ref that stopped resolving after a corpus update is surfaced by `profile_summary`, never a write blocker.

## Session prompts (nothing to install)

Besides tools, the server exposes **session prompts** — starters your client surfaces in its prompt menu (Claude Desktop's `+`). Pick one and the matching session protocol loads into the conversation, with an optional focus to fill in (a theme, a belief, a figure…):

| Prompt | Starts |
|---|---|
| `discover` | Elicit, situate and record what you think about a question |
| `examine` | Put one of your positions through Socratic examination |
| `compare` | A face-to-face with a philosopher's or movement's positions |
| `read` | Read a passage together, in three passes |
| `concept` | Try a concept on a real situation, or forge your own |
| `articulate` | Formulation exercises for your own thought |
| `synthesize` | A dated prose portrait of your whole profile |

Each prompt carries the full protocol of the matching skill — they are generated from the same `SKILL.md`, so they never drift — with **graceful degradation**: if you have installed the skill, the prompt just triggers it; if not, the protocol rides along in the message. Either way, no setup is needed for real guidance, and the menu makes the possibilities **discoverable** — something a silently auto-triggered skill cannot do.

## Going further: the exploration skills

The server alone guides your assistant through the basics (the built-in guide above), and the session prompts carry the full craft on demand. For the smoothest experience, install the seven **[exploration skills](../skills/)**: guided discovery through six doors, Socratic examination with an intensity dial, figure comparison, difficulty-driven text reading, concept work, formulation training, and the dated profile synthesis. A skill is just a markdown instruction sheet your assistant reads — nothing executes; the [skills README](../skills/README.md) walks you through setup for each client, including a zero-install option (paste the skill's content into the conversation).

Skills and the prompts above are **complementary**: a skill is *auto-triggered* — the assistant reaches for it on its own when your phrasing matches, hands-free, though that match is never guaranteed — while a prompt is *chosen from the menu*, deterministic and self-advertising. Installing the skills gives the hands-free path; the prompts need nothing and share the same source of truth.

## What to ask your assistant

- "Show me the axes about the self, and let's find where I stand on free will."
- "Challenge my position on FREEDOM with a thought experiment, then record what survives."
- "Compare my profile with Epictetus."
- "Summarize my philosophy and what's left unexamined."

## Development

Inside the repo the server reads `../data` live (no bundling needed):

```bash
cd mcp && npm install && npm run smoke   # build + end-to-end test over stdio
```

`npm pack`/`npm publish` snapshot `../data` and `../schemas` into the package via the `prepack` hook.

## Support & follow

If this project is useful to you, you can support our work on **[Ko-fi](https://ko-fi.com/philoscopia)** (also via [GitHub Sponsors](https://github.com/sponsors/fbgallet)), and follow along on **[X (@fbgallet)](https://x.com/fbgallet)** and **[Bluesky (@fbgallet.bsky.social)](https://bsky.app/profile/fbgallet.bsky.social)**.

## License

MIT (code). The bundled corpus is [CC BY-SA 4.0](../LICENSE).
