# Exploration skills

Seven [agent skills](https://agentskills.io) that turn any capable assistant into a philosophical companion over the [Philoscopia MCP server](../mcp/): they carry the conversational craft (how to conduct a session), while the server carries the data and the persistence.

| Skill | Job |
|---|---|
| [`philo-discover`](philo-discover/SKILL.md) | Elicit positions the person doesn't know they hold, through six doors (common opinions, thought experiments, dilemmas, loves & hates, theories, quotes) |
| [`philo-examine`](philo-examine/SKILL.md) | Test an existing position or belief with Socratic rigor (objections, roots, tensions, alternatives, livability) |
| [`philo-compare`](philo-compare/SKILL.md) | Compare the person's profile with a philosopher or movement, and mine the differences |
| [`philo-read`](philo-read/SKILL.md) | Read a philosophical text WITH the person: follow the thread, identify and work its difficulties (comprehension → explanation, receivability → justification), let the text interrogate them |
| [`philo-concept`](philo-concept/SKILL.md) | Work a concept as an intellectual device: try it on and experience what it changes, or forge one's own through counterexamples |
| [`philo-articulate`](philo-articulate/SKILL.md) | Train formulating one's thought: one-sentence theses, audience shifts, steelmanning, the minute-essay |
| [`philo-synthesize`](philo-synthesize/SKILL.md) | Generate the person's profile synthesis: a dated prose portrait crossing positions, carnet and who they are — central values and their order, through-lines, live tensions, blind spots, evolution |

## What is a "skill", and what does "installing" one mean?

A skill is **a plain text file of instructions** (`SKILL.md`) that your AI assistant reads before conducting a session — a method sheet, not a program. Nothing runs on your machine, nothing is downloaded beyond the file itself. "Installing" a skill simply means **putting that file where your assistant looks for its instructions** — or, simplest of all, pasting its content into the conversation.

Division of labor: the **MCP server** gives your assistant the referential (the axes, the figures, the texts' concepts) and saves your work in your local `my-philosophy/` folder; the **skills** teach it how to conduct a real session (when to press, when to record, how to read a text, how to scale to your level).

## Do I need them?

Strictly, no — there are now two ways to get real guidance with **nothing to install**:

- The server's **session prompts** — in your client's prompt menu (Claude Desktop's `+`): pick *"Discover what I think"*, *"Examine one of my convictions"*, and so on, and the matching protocol loads into the conversation. Each prompt is generated from these very skill files, so it carries the same craft — and the menu makes the possibilities **discoverable**.
- The server's **built-in guide** (received automatically on connection, re-readable with the `help` tool) for casual exploration.

So why install the skills? Because a skill is **auto-triggered**: the assistant reaches for it on its own when your phrasing matches (*"help me figure out what I think about free will"*), hands-free — whereas a prompt waits for you to pick it, and you won't always have the right one in mind. Installed skills give the smoothest, hands-free experience; the prompts and the guide are the no-setup fallback. All three share one source of truth, so you lose no method whichever you use.

## Setup, step by step

**Prerequisite** — the `philoscopia` MCP server configured in your assistant (5 minutes, guided in [mcp/README.md](../mcp/README.md)). The skills drive its tools; without it they will ask you to set it up first.

**Get the files**: clone this repository (`git clone https://github.com/fbgallet/philoscopia-referential`) or download it as a ZIP (green "Code" button → Download ZIP). The skills are the folders under `skills/`.

Then, depending on your assistant:

- **Claude Code** (terminal): copy the skill folders into your personal skills directory:

  ```bash
  cp -r philoscopia-referential/skills/philo-* ~/.claude/skills/
  ```

  That's all. In any conversation you can now type `/philo-discover` (or any skill name), or simply say what you want ("help me figure out what I think about free will") — the assistant picks the right skill by itself.

- **Claude Desktop / claude.ai**: in Settings, open the Capabilities/Skills section and add each skill by uploading its folder (or a ZIP of it). The exact menu location varies slightly across versions; search "skills" in the settings if needed.

- **Any other assistant — the zero-install way**: open the `SKILL.md` of the session you want, copy its whole content, and paste it at the start of your conversation with one line: *"Follow these instructions for this session."* This works with any assistant that can reach the philoscopia MCP server, with nothing to install at all.

## Starting a session

You never call tools yourself — you just talk. Some openers, and the skill they summon:

- "I'd like to find out what I really think about freedom." → `philo-discover`
- "Challenge my belief that hard work always pays off — don't go easy." → `philo-examine`
- "Compare me with Spinoza." → `philo-compare`
- "Here's a passage from the *Enchiridion* — let's read it together." → `philo-read`
- "What would *amor fati* change in how I see my situation?" → `philo-concept`
- "Help me say clearly what I think about work." → `philo-articulate`
- "After all these sessions — what do I actually think, overall?" → `philo-synthesize`

Every session ends the same way: your journal gets the session's narrative, your `summary.md` portrait is refreshed, and everything stays in your local `my-philosophy/` folder — yours to read, edit and version.

## Design

One session = one conversation = one journal entry. The skills share a common discipline, learned from years of iteration on an earlier system: one axis at a time; `EXPLORING` before `POSITIONED`; always record *provenance* (which door elicited the position) and *reasons* in the user's own words; **formulation first** (before anything is recorded, the user states it in a sentence they'd sign — the assistant's phrasing is at best a scaffold); close with `log_session` and a refreshed `summary.md`. The user's files remain the source of truth, local and private.

Sessions also chain: each conversation opens with the server's `orient` tool (who you are — beginner, cultivated amateur or expert, your goals and motivations — where your carnet stands, the thread you left open) and can close by naming what to pick up next time (`log_session`'s `next`). Every skill scales its register to that user block: the same session is conducted very differently for someone clearing up a few questions and for a researcher digging a fine-grained problem.

And a limit owned plainly: none of this replaces a living conversation with humans, the experience of reading the philosophers themselves, or actually living by one's principles. The skills are built to point toward all three, not to substitute for them.

## Support & follow

If this project is useful to you, you can support our work on **[Ko-fi](https://ko-fi.com/philoscopia)** (also via [GitHub Sponsors](https://github.com/sponsors/fbgallet)), and follow along on **[X (@fbgallet)](https://x.com/fbgallet)** and **[Bluesky (@fbgallet.bsky.social)](https://bsky.app/profile/fbgallet.bsky.social)**.
