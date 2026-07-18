// Tool registration: the referential-access tools (read-only, corpus-backed)
// and the workspace tools (file persistence, schema-validated). The server is
// deliberately dumb: all conversational methodology (discovery protocols,
// Socratic examination) lives in the skills that drive these tools.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  axesDigest,
  axisView,
  entityRichView,
  entityView,
  pickLocale,
  positionSlice,
  searchCorpus,
  stripMachineFields,
  type Corpus,
  type Locale,
} from "./corpus.js";
import { GUIDE } from "./help.js";
import { computeOrient } from "./orient.js";
import { computeSummary, renderSummaryMd } from "./summary.js";
import { COLLECTIONS, EXPERTISE_LEVELS, type Workspace } from "./workspace.js";

/* eslint-disable @typescript-eslint/no-explicit-any */

const asText = (data: unknown) => ({
  content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }],
});

const asError = (error: unknown) => ({
  content: [{ type: "text" as const, text: `Error: ${(error as Error).message}` }],
  isError: true as const,
});

const positionValueShape = z.union([
  z.object({ kind: z.literal("scalar"), value: z.number().min(-1).max(1) }),
  z.object({ kind: z.literal("weights"), weights: z.array(z.number().min(0).max(1)).min(2) }),
]);

export function registerTools(server: McpServer, corpus: Corpus, ws: Workspace, locale: Locale) {
  server.registerTool(
    "help",
    {
      title: "How to use Philoscopia",
      description:
        "The complete usage guide: what this server offers, the typical session flow (explore, elicit, record with provenance, journal, summarize) and the rules of care. Call it when unsure how to proceed.",
      inputSchema: {},
    },
    async () => asText(GUIDE[locale]),
  );

  server.registerTool(
    "orient",
    {
      title: "Where are we? (session opening)",
      description:
        "The opening overview, made to be RESTATED to the user in a few simple sentences (never dumped): what the referential offers, who the user is (expertise, goals, motivations), their carnet's state, the thread left open last time (next), suggested threads to pick up, and the session menu. Call it at the FIRST interaction of every conversation, or whenever the user seems lost.",
      inputSchema: {},
    },
    async () => {
      try {
        return asText(computeOrient(corpus, ws, locale));
      } catch (error) {
        return asError(error);
      }
    },
  );

  // ── Referential access ─────────────────────────────────────────────────

  server.registerTool(
    "list_axes",
    {
      title: "List the axes",
      description:
        "The axis map (id, question, poles), grouped by relation. Default = the CORE axes only (the referential's backbone, ~2 dozen nodal questions) with a note counting the rest; pass relation (TRUTH, SELF, OTHERS or WORLD) for that quarter's FULL list, or all:true for the whole map. To locate one specific axis, search is cheaper.",
      inputSchema: {
        relation: z.enum(["TRUTH", "SELF", "OTHERS", "WORLD"]).optional(),
        all: z.boolean().optional().describe("The whole 70+ axis map"),
      },
    },
    async ({ relation, all }) => {
      const groups = axesDigest(corpus, locale, relation);
      if (relation || all === true) return asText(groups);
      // Default: the core (nodal) axes only — the map's backbone. The full map
      // stays one call away; the note keeps the model from assuming these are
      // ALL the axes. Mirrors the web companion's list_axes.
      const core: Record<string, unknown> = {};
      let rest = 0;
      for (const [rel, list] of Object.entries(groups as Record<string, Array<{ core?: boolean }>>)) {
        const kept = list.filter((axis) => axis.core);
        rest += list.length - kept.length;
        if (kept.length > 0) core[rel] = kept.map(({ core: _core, ...axis }) => axis);
      }
      return asText({
        ...core,
        note: `CORE axes only. ${rest} more axes exist: relation:"TRUTH|SELF|OTHERS|WORLD" for a full quarter, all:true for the whole map, or search to locate one.`,
      });
    },
  );

  server.registerTool(
    "get_axis",
    {
      title: "Read one axis",
      description:
        "One axis (~600 tokens): poles with descriptions and anchor figures, stakes, named median, related axes, plus `arguments` — the canonical reasons (SUPPORTS) and objections (OBJECTS) per pole as {ref, kind, on, claim}; fetch one via get_entity(arg:…) before challenging or grounding a position. Its sub-problem map is separate: problemCount > 0 means get_axis_problems has material.",
      inputSchema: { axisId: z.string().describe("Axis id, e.g. FREEDOM") },
    },
    async ({ axisId }) => {
      const axis = corpus.axes.get(axisId.toUpperCase());
      if (!axis) return asError(new Error(`Unknown axis "${axisId}". Use list_axes or search.`));
      return asText(axisView(pickLocale(axis, locale)));
    },
  );

  server.registerTool(
    "get_axis_problems",
    {
      title: "Read an axis's sub-problems",
      description:
        "The axis's map of live sub-problems (~1-2k tokens; SURFACED and LATENT seeds for deepening). Only when the conversation explores the axis in depth — never just to situate it.",
      inputSchema: { axisId: z.string().describe("Axis id, e.g. FREEDOM") },
    },
    async ({ axisId }) => {
      const axis = corpus.axes.get(axisId.toUpperCase());
      if (!axis) return asError(new Error(`Unknown axis "${axisId}". Use list_axes or search.`));
      const problems = Array.isArray(axis.problems) ? pickLocale(axis.problems, locale) : [];
      return asText(
        problems.length > 0
          ? { axisId: axis.id, problems }
          : { axisId: axis.id, problems, note: "No sub-problem map recorded for this axis yet." },
      );
    },
  );

  server.registerTool(
    "get_entity",
    {
      title: "Read a referential entity",
      description:
        "Any entity by prefixed ref: ph:epictetus, mv:stoicism, chr:… (character), c:… (concept), te:… (thought experiment), w:… (work), ax:… (axis), problem:… (one axis sub-problem, with its home axis), arg:… (a corpus argument: its claim, step-by-step development, source, and — for an objection — the resolution options). A figure arrives as a DIGEST (~1k tokens): identity, structuring theses, and every position WITHOUT its justification — get_position supplies the justifications you actually discuss. full:true (the RICH view, ~2-5k tokens: summary, voice, the justified MAJOR/structuring positions — minor positions stay compact lines, get_position widens one) only for a whole-figure portrait, or when you do not know the figure at all.",
      inputSchema: {
        ref: z.string().describe("Prefixed ref, e.g. ph:epictetus"),
        full: z.boolean().optional().describe("Whole profile (unknown figure / full portrait)"),
      },
    },
    async ({ ref, full }) => {
      const entity = corpus.byRef.get(ref);
      if (!entity) return asError(new Error(`"${ref}" not found. Prefixes: ax, ph, mv, chr, c, te, w, problem, arg.`));
      const flat = pickLocale(entity, locale);
      return asText(full ? entityRichView(ref, flat) : entityView(ref, flat));
    },
  );

  server.registerTool(
    "get_position",
    {
      title: "Read a figure's position on an axis",
      description:
        "One figure's position on ONE axis (axisId) or several at once (axisIds), each with its sourced justification (~300 tokens per axis). The default read whenever the question concerns a figure on an axis; batch one figure's axes in a single call.",
      inputSchema: {
        ref: z.string().describe("Figure ref: ph:…, mv:… or chr:…"),
        axisId: z.string().optional().describe("Axis id, e.g. FREEDOM"),
        axisIds: z.array(z.string()).min(1).max(12).optional().describe("Several axis ids at once"),
      },
    },
    async ({ ref, axisId, axisIds }) => {
      const entity = corpus.byRef.get(ref);
      if (!entity) return asError(new Error(`"${ref}" not found. Prefixes: ax, ph, mv, chr, c, te, w.`));
      const ids = axisIds?.length ? axisIds : axisId ? [axisId] : null;
      if (!ids) return asError(new Error("get_position requires axisId or axisIds."));
      const flat = pickLocale(entity, locale);
      try {
        if (ids.length === 1) return asText(positionSlice(ref, flat, ids[0]));
        // Batch: a missing axis yields an inline error entry, the rest answer.
        const positions = ids.map((id) => {
          try {
            const { ref: _ref, name: _name, ...slice } = positionSlice(ref, flat, id);
            return slice;
          } catch (error) {
            return { axisId: id.toUpperCase(), error: (error as Error).message };
          }
        });
        return asText({ ref, name: flat.name ?? flat.label, positions });
      } catch (error) {
        return asError(error);
      }
    },
  );

  server.registerTool(
    "search",
    {
      title: "Search the referential",
      description:
        "Substring search across axes, philosophers, movements, characters, glossary, thought experiments, works, axis sub-problems (problem:… hits — the way to find the corpus problem behind a user's question) and arguments (arg:… hits — the canonical reasons and objections for a position). Returns prefixed refs to feed get_entity/get_axis.",
      inputSchema: { query: z.string().min(2), limit: z.number().int().min(1).max(50).optional() },
    },
    async ({ query, limit }) => asText(searchCorpus(corpus, query, locale, limit ?? 20)),
  );

  server.registerTool(
    "get_tensions_for",
    {
      title: "Tensions touching an axis",
      description:
        "The referential's tension rules involving this axis: pairs of positions that are hard to hold together, with the justification. Useful for Socratic tension analysis.",
      inputSchema: { axisId: z.string() },
    },
    async ({ axisId }) => {
      const id = axisId.toUpperCase();
      const rules = corpus.tensions.filter((r) => r.a.axisId === id || r.b.axisId === id);
      return asText(pickLocale(rules, locale));
    },
  );

  server.registerTool(
    "get_foundations_for",
    {
      title: "Grounding relations touching an axis",
      description:
        "Foundation edges (which descriptive belief grounds which belief/value) where this axis appears as ground or grounded. Useful for Socratic root exploration.",
      inputSchema: { axisId: z.string() },
    },
    async ({ axisId }) => {
      const id = axisId.toUpperCase();
      const edges = corpus.foundations.filter(
        (e) => e.ground.axisId === id || e.grounded.axisId === id,
      );
      return asText(pickLocale(edges, locale));
    },
  );

  // ── Workspace ──────────────────────────────────────────────────────────

  const userShape = {
    expertise: z
      .enum(EXPERTISE_LEVELS)
      .optional()
      .describe(
        "BEGINNER (little background), AMATEUR (cultivated, already initiated) or EXPERT (student/teacher/researcher) — shapes the depth and technicity of every session",
      ),
    goals: z
      .string()
      .optional()
      .describe("What they want from this work, in THEIR words (e.g. see clearer on a few questions / rethink their whole philosophy of life / dig into fine-grained problems)"),
    motivations: z
      .string()
      .optional()
      .describe("What draws them to philosophy, in THEIR words — expected to evolve"),
  };

  server.registerTool(
    "init_workspace",
    {
      title: "Create the workspace",
      description:
        "Create the my-philosophy/ folder (manifest, empty profile and collections, journal/). Fails if one already exists; foreign files in the folder (a web vault's session.json, notes/…) are left untouched. Pass the user block (expertise, goals, motivations) once elicited conversationally — never as a form; it can also come later via set_user.",
      inputSchema: { locale: z.enum(["fr", "en"]).optional(), user: z.object(userShape).optional() },
    },
    async (args) => {
      try {
        return asText({ created: ws.init(args.locale ?? locale, args.user) });
      } catch (error) {
        return asError(error);
      }
    },
  );

  server.registerTool(
    "set_user",
    {
      title: "Update who the user is",
      description:
        "Merge a patch into the workspace's user block: expertise (BEGINNER | AMATEUR | EXPERT), goals and motivations in the user's own words. Elicit conversationally, update whenever they evolve; null deletes a field. Served back by orient and injected into future sessions.",
      inputSchema: {
        expertise: userShape.expertise,
        goals: userShape.goals.nullable(),
        motivations: userShape.motivations.nullable(),
      },
    },
    async (args) => {
      try {
        return asText(ws.setUser(args));
      } catch (error) {
        return asError(error);
      }
    },
  );

  server.registerTool(
    "get_profile",
    {
      title: "Read the user's profile",
      description:
        "The user's own positions. Without axisId: a compact digest, one line per touched axis. With axisId: that entry in full (rationale, reasons, last 3 history records). Read it before comparing, examining or recording — never page through axes you will not discuss.",
      inputSchema: { axisId: z.string().optional() },
    },
    async ({ axisId }) => {
      try {
        if (!axisId) return asText(ws.profileDigest());
        const entry = ws.profileEntry(axisId);
        return asText(entry ?? { axisId: axisId.toUpperCase(), note: "No entry on this axis yet." });
      } catch (error) {
        return asError(error);
      }
    },
  );

  server.registerTool(
    "record_position",
    {
      title: "Record a position",
      description:
        "Record or update the user's position on an axis: consolidates the entry and appends one elicitation record to its history. Always pass provenance (which modality elicited it). POSITIONED requires a value; use status EXPLORING while thinking. Values follow the axis's shape: scalar in [-1,1] for 2-pole axes (-1 = first pole), weights in pole order otherwise.",
      inputSchema: {
        axisId: z.string(),
        status: z
          .enum(["POSITIONED", "EXPLORING", "NO_POSITION", "CONTEXTUALIST", "REJECTS_ALTERNATIVE", "NOT_APPLICABLE"])
          .optional(),
        value: positionValueShape.optional(),
        confidence: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
        salience: z.enum(["MAJOR", "MINOR", "NOT_RELEVANT"]).optional(),
        rationale: z.string().optional().describe("One-paragraph gloss in the user's own words"),
        reason: z
          .object({
            statement: z.string().describe("The reason, summarized in the user's words"),
            stance: z.enum(["SUPPORTS", "OBJECTION_MET"]),
            origin: z.enum(["OWN", "PROPOSED"]),
          })
          .optional(),
        provenance: z.object({
          modality: z.enum([
            "common-opinion",
            "thought-experiment",
            "dilemma",
            "affinity",
            "theory",
            "quote",
            "problem",
            "concept",
            "examination",
            "self-declared",
            "import",
          ]),
          ref: z.string().optional().describe("e.g. te:trolley-problem, problem:…, or a workspace id"),
        }),
        note: z.string().optional(),
        session: z.string().optional().describe("journal/<file>.md path"),
      },
    },
    async (args) => {
      try {
        return asText(ws.recordPosition(args as any));
      } catch (error) {
        return asError(error);
      }
    },
  );

  server.registerTool(
    "add_entry",
    {
      title: "Add a workspace entry",
      description:
        "Append one entry to a personal collection (schema-validated; id generated if omitted). Sentences (statement, definition, why…) are the USER's words; enums and per-field markers are on the fields. Required per collection — beliefs: statement + mode + adherence (a conviction that IS an axis position goes through record_position instead). inquiries (a live questioning): statement + kind (DOUBT = putting one of their OWN convictions to the test, named in relatedBeliefs). concepts: term + definition + clarity, or ref (c:…) to adopt a referential concept. affinities (a love or hate): feeling + subject; MODELS live here — an admired figure/lifestyle/school is LOVE + exemplar true (an anti-model: HATE + exemplar true), with figureRef and facets. practices (what they actually DO): statement + kind. quotes (the florilège): text VERBATIM — never invented, completed or approximated — plus source. readings (the reading register): title or workRef (w:…, search first) + scope; status TO_READ makes it a reading list, half the register's value.",
      inputSchema: {
        collection: z.enum(COLLECTIONS),
        entry: z.object({
          id: z.string().optional().describe("Omit: generated from the main sentence"),
          statement: z.string().optional().describe("beliefs/inquiries/practices: the user's sentence"),
          mode: z.enum(["DESCRIPTIVE", "PRESCRIPTIVE"]).optional().describe("beliefs: the is/ought split (you classify)"),
          adherence: z.enum(["STRONG", "MODERATE", "WEAK"]).optional().describe("beliefs"),
          status: z
            .enum(["HELD", "SUSPENDED", "ABANDONED", "ACTIVE", "DORMANT", "RESOLVED", "TO_READ", "READING", "READ"])
            .optional()
            .describe("beliefs (default HELD) / inquiries (default ACTIVE) / readings (default READ; ABANDONED works here too)"),
          topics: z.array(z.string()).optional().describe("beliefs: free-text themes"),
          relatedAxes: z.array(z.string()).optional().describe("beliefs/affinities/readings: ax:… refs"),
          grounds: z.array(z.string()).optional().describe("beliefs: belief ids or pole:… refs that ground this one"),
          challengedBy: z.array(z.string()).optional().describe("beliefs: belief ids or refs in tension with it"),
          rationale: z.string().optional().describe("beliefs"),
          ref: z.string().optional().describe("concepts: c:… ref to adopt a referential concept"),
          term: z.string().optional().describe("concepts (personal)"),
          definition: z.string().optional().describe("concepts (personal): the user's working definition"),
          clarity: z.enum(["CLEAR", "SOMEWHAT_CLEAR", "FUZZY", "UNDEFINED"]).optional().describe("concepts: honest self-knowledge, not a grade"),
          relatedConcepts: z.array(z.string()).optional().describe("concepts: ids or c:… refs"),
          note: z.string().optional().describe("concepts (adopted): personal gloss / quotes: what it does to THEM, why they keep it"),
          notes: z.string().optional().describe("concepts (personal) / readings: the reading notes proper (markdown)"),
          feeling: z.enum(["LOVE", "HATE"]).optional().describe("affinities"),
          subject: z.string().optional().describe("affinities: the loved/hated thing (a model's name goes here)"),
          category: z
            .enum(["PERSON", "RELATION", "STRUCTURE", "IDEA", "ANIMAL", "ACTIVITY", "PLACE", "OBJECT", "ART", "LIFESTYLE", "SITUATION"])
            .optional()
            .describe("affinities (RELATION = family/friend/community; STRUCTURE = institution/order; IDEA = a value/ideal)"),
          why: z.string().optional().describe("affinities: the user's paragraph (for a model: what inspires them)"),
          exemplar: z.boolean().optional().describe("affinities: true = a model (LOVE) or anti-model (HATE) the user orients themselves by"),
          facets: z
            .array(z.enum(["THEORY", "POSITION", "THINKING_STYLE", "COMMITMENTS", "ACTIONS", "ATTITUDES"]))
            .optional()
            .describe("affinities (exemplar only): what inspires them, several allowed"),
          figureRef: z.string().optional().describe("affinities (exemplar only): ph:/mv:/chr: ref when the subject is a referential figure"),
          revealedBeliefs: z.array(z.string()).optional().describe("affinities: belief ids this feeling reveals"),
          kind: z
            .enum(["QUESTION", "TENSION", "DILEMMA", "CLARIFICATION", "DOUBT", "PRACTICE", "ATTITUDE", "RULE_OF_ACTION", "EXERCISE"])
            .optional()
            .describe("inquiries / practices"),
          tensionType: z.enum(["T_T", "T_V"]).optional().describe("inquiries (kind TENSION only): belief↔belief (T_T) or belief↔value (T_V)"),
          priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional().describe("inquiries"),
          anchors: z.array(z.string()).optional().describe("inquiries/quotes/readings: problem:…/ax:…/ph:… refs"),
          relatedBeliefs: z.array(z.string()).optional().describe("inquiries: belief ids (a TENSION's two poles; a DOUBT's tested conviction)"),
          reflections: z.string().optional().describe("inquiries"),
          frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "AS_NEEDED"]).optional().describe("practices: neutral cadence descriptor"),
          purpose: z.string().optional().describe("practices"),
          method: z.string().optional().describe("practices: how, incl. a bad-day fallback"),
          inspiredBy: z.array(z.string()).optional().describe("practices: ph:…/mv:… refs"),
          servesBeliefs: z.array(z.string()).optional().describe("practices: belief ids this practice serves"),
          feedback: z.string().optional().describe("practices"),
          text: z.string().optional().describe("quotes: the quotation VERBATIM — never invented or approximated"),
          source: z.string().optional().describe("quotes: author / work, free text"),
          quoteRef: z.string().optional().describe("quotes: q:… corpus quote it was promoted from (app-scoped)"),
          explanation: z.string().optional().describe("quotes: what the quote says (objective gloss; you may propose it)"),
          title: z.string().optional().describe("readings: the text's title, free text (an article, a handout…)"),
          author: z.string().optional().describe("readings: the author, free text"),
          workRef: z.string().optional().describe("readings: w:… ref when the works registry knows it (search first)"),
          scope: z.enum(["WORK", "EXCERPT", "ARTICLE", "OTHER"]).optional().describe("readings: what was actually read"),
          appraisal: z
            .enum(["ESSENTIAL", "VALUABLE", "MIXED", "DISAPPOINTING"])
            .optional()
            .describe("readings: the value the READER confers"),
          verdict: z.string().optional().describe("readings: the appraisal in the reader's own words"),
          agreements: z
            .array(z.object({ statement: z.string(), ref: z.string().optional() }))
            .optional()
            .describe("readings: where the reader stands WITH the text (ref: a belief id or referential position it echoes)"),
          disagreements: z
            .array(z.object({ statement: z.string(), ref: z.string().optional() }))
            .optional()
            .describe("readings: where the reader stands AGAINST the text"),
          quotes: z.array(z.string()).optional().describe("readings: qt-… florilège ids harvested from this reading (add them first)"),
        }),
      },
    },
    async ({ collection, entry }) => {
      try {
        return asText(ws.add(collection, entry));
      } catch (error) {
        return asError(error);
      }
    },
  );

  server.registerTool(
    "update_entry",
    {
      title: "Update a workspace entry",
      description:
        "Shallow-merge a patch into one entry (by id, or by c:… ref for adopted concepts); null deletes an optional field. A substantive revision of a belief is a NEW belief: add it first, then retire the old one with status ABANDONED — the trajectory is the treasure.",
      inputSchema: {
        collection: z.enum(COLLECTIONS),
        id: z.string(),
        patch: z.record(z.string(), z.any()).describe("Fields per schemas/workspace/<collection>.schema.json (same fields as add_entry)"),
      },
    },
    async ({ collection, id, patch }) => {
      try {
        return asText(ws.update(collection, id, patch));
      } catch (error) {
        return asError(error);
      }
    },
  );

  server.registerTool(
    "list_entries",
    {
      title: "List workspace entries",
      description:
        "One personal collection, compact (one line per entry, with ids); filter by status, kind, axis or text — or pass id for ONE entry in full. Use it before add_entry to link entries (grounds, relatedBeliefs, servesBeliefs) and avoid duplicates.",
      inputSchema: {
        collection: z.enum(COLLECTIONS),
        id: z.string().optional().describe("Return this entry in full"),
        status: z.string().optional(),
        kind: z.string().optional(),
        axis: z.string().optional().describe("Only entries touching this axis (relatedAxes/anchors)"),
        text: z.string().optional().describe("Case-insensitive substring"),
      },
    },
    async ({ collection, id, status, kind, axis, text }) => {
      try {
        return asText(ws.listView(collection, { id, status, kind, axis, text }));
      } catch (error) {
        return asError(error);
      }
    },
  );

  server.registerTool(
    "log_session",
    {
      title: "Write a journal session",
      description:
        "Write the session's prose to journal/<date>-<slug>.md with frontmatter (modalities, touched refs). Do it at the end of every conversation; link records to it via their session/sessions fields. When a thread stays open, ask the user what to pick up next time and pass it as next (their words): orient serves it back at the next opening.",
      inputSchema: {
        slug: z.string().describe("Short kebab slug, e.g. freedom"),
        content: z.string().describe("The session narrative, markdown"),
        modalities: z.array(z.string()).optional(),
        touched: z.array(z.string()).optional().describe("Refs and ids touched, e.g. ax:FREEDOM"),
        next: z
          .string()
          .optional()
          .describe("The thread to pick up next time, in the user's words; replaces the previous one"),
      },
    },
    async (args) => {
      try {
        return asText({ written: ws.logSession(args) });
      } catch (error) {
        return asError(error);
      }
    },
  );

  server.registerTool(
    "profile_summary",
    {
      title: "Summarize the profile",
      description:
        "Coverage (by relation, core axes), structuring positions, tensions triggered by the referential's tension rules, ungrounded prescriptive beliefs, stale entries, open work, dangling refs (written against another corpus version — signal, never fix silently). Set writeSummaryMd to also regenerate the human-readable summary.md portrait.",
      inputSchema: { writeSummaryMd: z.boolean().optional() },
    },
    async ({ writeSummaryMd }) => {
      try {
        const summary = computeSummary(corpus, ws, locale);
        if (writeSummaryMd) renderSummaryMd(corpus, ws, locale);
        return asText(writeSummaryMd ? { ...summary, summaryMd: "summary.md regenerated" } : summary);
      } catch (error) {
        return asError(error);
      }
    },
  );

  server.registerTool(
    "get_syntheses",
    {
      title: "Read past profile syntheses",
      description:
        "The AI-generated profile portraits already in syntheses/ (from this server or the web app). Without id: a compact list, newest first. With id: that generation in full. Read the previous ones BEFORE writing a new synthesis — the evolution between generations is part of the portrait.",
      inputSchema: { id: z.string().optional().describe("syn-… id for one generation in full") },
    },
    async ({ id }) => {
      try {
        const all = ws.syntheses();
        if (id) {
          const found = all.find((s) => s.id === id);
          return found ? asText(found) : asError(new Error(`No synthesis "${id}" in syntheses/.`));
        }
        return asText({
          count: all.length,
          format: "id · date · scope? · model? — one generation in full via get_syntheses id",
          entries: [...all].reverse().map((s) => [s.id, s.at.slice(0, 10), s.scope, s.model].filter(Boolean).join(" · ")),
        });
      } catch (error) {
        return asError(error);
      }
    },
  );

  server.registerTool(
    "write_synthesis",
    {
      title: "Write a profile synthesis",
      description:
        "Persist one AI-generated profile synthesis to syntheses/syn-<date>-<slug>.md — an immutable, dated generation (never rewritten; a new synthesis is a new file, the history of generations is the record of how the portrait evolved). Only AFTER the user has read the proposed text and amended it (formulation first). Cross positions + carnet + user block to say what none says alone; every claim must be traceable to workspace material.",
      inputSchema: {
        text: z.string().describe("The synthesis prose (markdown), as approved by the user"),
        scope: z
          .string()
          .optional()
          .describe('Perimeter of this generation, e.g. "full profile" or a theme ("freedom and responsibility")'),
        model: z.string().optional().describe("The model id that generated it, e.g. claude-fable-5"),
        slug: z.string().optional().describe("Short kebab slug for the filename (defaults from scope)"),
      },
    },
    async (args) => {
      try {
        return asText(ws.writeSynthesis(args));
      } catch (error) {
        return asError(error);
      }
    },
  );

  server.registerTool(
    "compact",
    {
      title: "Archive closed records",
      description:
        "Move closed records (ABANDONED beliefs, RESOLVED inquiries) to archive/, keeping active files lean. Nothing is deleted; only the format's own files are touched.",
      inputSchema: {},
    },
    async () => {
      try {
        return asText({ moved: ws.compact() });
      } catch (error) {
        return asError(error);
      }
    },
  );
}
