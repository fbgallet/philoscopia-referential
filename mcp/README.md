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
      "args": ["-y", "philoscopia-mcp", "--workspace", "/Users/you/my-philosophy"]
    }
  }
}
```

Options: `--workspace <dir>` (default `$PHILOSCOPIA_WORKSPACE`, then `~/my-philosophy`) and `--locale fr|en` (once a workspace exists, its manifest's locale wins).

## Tools

Guidance — the server also ships `instructions` (injected into the assistant's context at connection), so any MCP client knows how to proceed without extra setup:

| Tool | Purpose |
|---|---|
| `help` | The full usage guide: typical session flow, recording rules, rules of care |

Referential (read-only):

| Tool | Purpose |
|---|---|
| `list_axes` | Compact digest of all axes (id, question, poles) — the entry point |
| `get_axis` | One full axis: poles, stakes, anchor figures, live sub-problems |
| `get_entity` | Any entity by prefixed ref: `ph:epictetus`, `c:eudaimonia`, `te:trolley-problem`… |
| `search` | Substring search across the whole corpus (diacritics-insensitive) |
| `get_tensions_for` | Position pairs in tension involving an axis |
| `get_foundations_for` | Grounding relations (belief → belief/value) involving an axis |

Workspace (local files, schema-validated on every write):

| Tool | Purpose |
|---|---|
| `init_workspace` | Create `my-philosophy/` (manifest, empty profile and collections) |
| `get_profile` / `record_position` | Read and record positions on the axes, with provenance, reasons and an append-only history |
| `add_entry` / `update_entry` / `list_entries` | Personal beliefs, concepts, loves & hates, open inquiries, practices |
| `log_session` | Write the session's narrative to `journal/` |
| `profile_summary` | Coverage, triggered tensions, ungrounded beliefs, open work; optionally regenerates the readable `summary.md` |
| `compact` | Move closed records to `archive/` (nothing is deleted) |

The workspace file format is specified by the published [JSON Schemas](../schemas/workspace/); every write is validated against them, plus the rules schemas cannot carry (a POSITIONED entry needs a value, values must fit the axis's pole shape, referential refs must resolve).

## Going further: the exploration skills

The server alone guides your assistant through the basics (the built-in guide above). For real sessions, six **[exploration skills](../skills/)** add the conversational craft: guided discovery through six doors, Socratic examination with an intensity dial, figure comparison, difficulty-driven text reading, concept work, and formulation training. A skill is just a markdown instruction sheet your assistant reads — nothing executes; the [skills README](../skills/README.md) walks you through setup for each client, including a zero-install option (paste the skill's content into the conversation).

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

## License

MIT (code). The bundled corpus is [CC BY-SA 4.0](../LICENSE).
