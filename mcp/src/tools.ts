// Tool registration: the referential-access tools (read-only, corpus-backed)
// and the workspace tools (file persistence, schema-validated). The server is
// deliberately dumb: all conversational methodology (discovery protocols,
// Socratic examination) lives in the skills that drive these tools.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  axesDigest,
  axisView,
  entityView,
  pickLocale,
  positionSlice,
  searchCorpus,
  stripMachineFields,
  type Corpus,
  type Locale,
} from "./corpus.js";
import { GUIDE } from "./help.js";
import { computeSummary, renderSummaryMd } from "./summary.js";
import { COLLECTIONS, type Workspace } from "./workspace.js";

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

  // ── Referential access ─────────────────────────────────────────────────

  server.registerTool(
    "list_axes",
    {
      title: "List the axes",
      description:
        "The axis map (id, question, poles), grouped by relation. Start here to pick an axis; pass relation (TRUTH, SELF, OTHERS or WORLD) to fetch a quarter of it.",
      inputSchema: { relation: z.enum(["TRUTH", "SELF", "OTHERS", "WORLD"]).optional() },
    },
    async ({ relation }) => asText(axesDigest(corpus, locale, relation)),
  );

  server.registerTool(
    "get_axis",
    {
      title: "Read one axis",
      description:
        "One axis (~600 tokens): poles with descriptions and anchor figures, stakes, named median, related axes. Its sub-problem map is separate: problemCount > 0 means get_axis_problems has material.",
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
        "Any entity by prefixed ref: ph:epictetus, mv:stoicism, chr:… (character), c:… (concept), te:… (thought experiment), w:… (work), ax:… (axis). A figure arrives as a DIGEST (~1k tokens): identity, structuring theses, and every position WITHOUT its justification — get_position supplies the justifications you actually discuss. full:true (~5-8k tokens) only for a whole-figure portrait, or when you do not know the figure at all.",
      inputSchema: {
        ref: z.string().describe("Prefixed ref, e.g. ph:epictetus"),
        full: z.boolean().optional().describe("Whole profile (unknown figure / full portrait)"),
      },
    },
    async ({ ref, full }) => {
      const entity = corpus.byRef.get(ref);
      if (!entity) return asError(new Error(`"${ref}" not found. Prefixes: ax, ph, mv, chr, c, te, w.`));
      const flat = pickLocale(entity, locale);
      return asText(full ? stripMachineFields(flat, ref.startsWith("ax:")) : entityView(ref, flat));
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
        "Substring search across axes, philosophers, movements, characters, glossary, thought experiments and works. Returns prefixed refs to feed get_entity/get_axis.",
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

  server.registerTool(
    "init_workspace",
    {
      title: "Create the workspace",
      description:
        "Create the my-philosophy/ folder (manifest, empty profile and collections, journal/). Fails if one already exists; foreign files in the folder (a web vault's session.json, notes/…) are left untouched.",
      inputSchema: { locale: z.enum(["fr", "en"]).optional() },
    },
    async (args) => {
      try {
        return asText({ created: ws.init(args.locale ?? locale) });
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
        "Append one entry to a personal collection (schema-validated; id generated if omitted). Sentences (statement, definition, why…) are the USER's words. Required per collection — beliefs: statement + mode + adherence (a conviction that IS an axis position goes through record_position instead); inquiries (a live questioning): statement + kind (DOUBT = putting one of their OWN convictions to the test, name it in relatedBeliefs); concepts: term + definition + clarity, or ref (c:…) to adopt a referential concept; affinities (a love or hate): feeling + subject — MODELS live here: an admired figure/lifestyle/school is feeling LOVE + exemplar true (an anti-model: HATE + exemplar true), with figureRef and facets; practices (what they actually DO): statement + kind.",
      inputSchema: {
        collection: z.enum(COLLECTIONS),
        entry: z.object({
          id: z.string().optional().describe("Omit: generated from the main sentence"),
          statement: z.string().optional().describe("beliefs/inquiries/practices: the user's sentence"),
          mode: z.enum(["DESCRIPTIVE", "PRESCRIPTIVE"]).optional().describe("beliefs: the is/ought split (you classify)"),
          adherence: z.enum(["STRONG", "MODERATE", "WEAK"]).optional().describe("beliefs"),
          status: z
            .enum(["HELD", "SUSPENDED", "ABANDONED", "ACTIVE", "DORMANT", "RESOLVED"])
            .optional()
            .describe("beliefs (default HELD) / inquiries (default ACTIVE)"),
          topics: z.array(z.string()).optional().describe("beliefs: free-text themes"),
          relatedAxes: z.array(z.string()).optional().describe("beliefs/affinities: ax:… refs"),
          grounds: z.array(z.string()).optional().describe("beliefs: belief ids or pole:… refs that ground this one"),
          challengedBy: z.array(z.string()).optional().describe("beliefs: belief ids or refs in tension with it"),
          rationale: z.string().optional().describe("beliefs"),
          ref: z.string().optional().describe("concepts: c:… ref to adopt a referential concept"),
          term: z.string().optional().describe("concepts (personal)"),
          definition: z.string().optional().describe("concepts (personal): the user's working definition"),
          clarity: z.enum(["CLEAR", "SOMEWHAT_CLEAR", "FUZZY", "UNDEFINED"]).optional().describe("concepts: honest self-knowledge, not a grade"),
          relatedConcepts: z.array(z.string()).optional().describe("concepts: ids or c:… refs"),
          note: z.string().optional().describe("concepts (adopted): personal gloss"),
          notes: z.string().optional().describe("concepts (personal)"),
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
          anchors: z.array(z.string()).optional().describe("inquiries: problem:…/ax:… refs"),
          relatedBeliefs: z.array(z.string()).optional().describe("inquiries: belief ids (a TENSION's two poles; a DOUBT's tested conviction)"),
          reflections: z.string().optional().describe("inquiries"),
          frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "AS_NEEDED"]).optional().describe("practices: neutral cadence descriptor"),
          purpose: z.string().optional().describe("practices"),
          method: z.string().optional().describe("practices: how, incl. a bad-day fallback"),
          inspiredBy: z.array(z.string()).optional().describe("practices: ph:…/mv:… refs"),
          servesBeliefs: z.array(z.string()).optional().describe("practices: belief ids this practice serves"),
          feedback: z.string().optional().describe("practices"),
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
        "Write the session's prose to journal/<date>-<slug>.md with frontmatter (modalities, touched refs). Do it at the end of every conversation; link records to it via their session/sessions fields.",
      inputSchema: {
        slug: z.string().describe("Short kebab slug, e.g. freedom"),
        content: z.string().describe("The session narrative, markdown"),
        modalities: z.array(z.string()).optional(),
        touched: z.array(z.string()).optional().describe("Refs and ids touched, e.g. ax:FREEDOM"),
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
