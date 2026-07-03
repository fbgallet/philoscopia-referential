// Tool registration: the referential-access tools (read-only, corpus-backed)
// and the workspace tools (file persistence, schema-validated). The server is
// deliberately dumb: all conversational methodology (discovery protocols,
// Socratic examination) lives in the skills that drive these tools.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  axesDigest,
  pickLocale,
  searchCorpus,
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
        "Compact digest of the referential's axes (id, question, poles, type). Start here to pick an axis. Optionally filter by relation: TRUTH, SELF, OTHERS or WORLD.",
      inputSchema: { relation: z.enum(["TRUTH", "SELF", "OTHERS", "WORLD"]).optional() },
    },
    async ({ relation }) => asText(axesDigest(corpus, locale, relation)),
  );

  server.registerTool(
    "get_axis",
    {
      title: "Read one axis",
      description:
        "The full axis file: poles with descriptions and anchor figures, stakes, named median, related axes, and its map of live sub-problems (SURFACED and LATENT seeds for deepening).",
      inputSchema: { axisId: z.string().describe("Axis id, e.g. FREEDOM") },
    },
    async ({ axisId }) => {
      const axis = corpus.axes.get(axisId.toUpperCase());
      if (!axis) return asError(new Error(`Unknown axis "${axisId}". Use list_axes or search.`));
      return asText(pickLocale(axis, locale));
    },
  );

  server.registerTool(
    "get_entity",
    {
      title: "Read a referential entity",
      description:
        "Fetch any referential entity by prefixed ref: ph:epictetus (philosopher, incl. positions), mv:stoicism, chr:… (character), c:… (glossary concept), te:… (thought experiment), w:… (work), ax:… (axis).",
      inputSchema: { ref: z.string().describe("Prefixed ref, e.g. ph:epictetus") },
    },
    async ({ ref }) => {
      const entity = corpus.byRef.get(ref);
      if (!entity) return asError(new Error(`"${ref}" not found. Prefixes: ax, ph, mv, chr, c, te, w.`));
      return asText(pickLocale(entity, locale));
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
        "Create the my-philosophy/ folder (manifest, empty profile and collections, journal/). Fails if one already exists.",
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
      description: "The user's positions on the axes (profile.json), optionally one axis only.",
      inputSchema: { axisId: z.string().optional() },
    },
    async ({ axisId }) => {
      try {
        const profile = ws.profile();
        if (axisId) return asText(profile.entries[axisId.toUpperCase()] ?? null);
        return asText(profile);
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
        "Append one entry to a collection: beliefs (personal beliefs; fields per the published schema), concepts, affinities (loves & hates), inquiries (open questions), practices. The id is generated if omitted; the file is schema-validated before writing.",
      inputSchema: {
        collection: z.enum(COLLECTIONS),
        entry: z.record(z.string(), z.any()).describe("The entry object, per schemas/workspace/<collection>.schema.json"),
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
        "Shallow-merge a patch into one entry (by id, or by ref for adopted concepts). To supersede a belief: add the new belief first, then patch the old one with status SUPERSEDED and supersededBy.",
      inputSchema: {
        collection: z.enum(COLLECTIONS),
        id: z.string(),
        patch: z.record(z.string(), z.any()),
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
      description: "Read a collection, optionally filtered by status or free-text match.",
      inputSchema: {
        collection: z.enum(COLLECTIONS),
        status: z.string().optional(),
        text: z.string().optional(),
      },
    },
    async ({ collection, status, text }) => {
      try {
        return asText(ws.list(collection, { status, text }));
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
        "Coverage (by relation, core axes), structuring positions, tensions triggered by the referential's tension rules, ungrounded prescriptive beliefs, stale entries, open work. Set writeSummaryMd to also regenerate the human-readable summary.md portrait.",
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
        "Move closed records (SUPERSEDED/ABANDONED beliefs, RESOLVED inquiries, ABANDONED practices) to archive/, keeping active files lean. Nothing is deleted.",
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
