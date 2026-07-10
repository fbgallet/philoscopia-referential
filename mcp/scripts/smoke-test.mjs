// End-to-end smoke test: drives the built server through a real MCP client
// over stdio, exercising the referential tools, the full workspace lifecycle
// and the error paths. Run: npm run smoke [--] --keep (keeps the tmp workspace).

import { mkdtempSync, mkdirSync, readFileSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const pkgRoot = fileURLToPath(new URL("..", import.meta.url));
const workspace = mkdtempSync(join(tmpdir(), "philoscopia-smoke-"));
let failures = 0;

const check = (label, ok, detail = "") => {
  console.log(`${ok ? "✓" : "✖"} ${label}${ok || !detail ? "" : ` — ${detail}`}`);
  if (!ok) failures += 1;
};

const client = new Client({ name: "smoke", version: "0.0.0" });
await client.connect(
  new StdioClientTransport({
    command: process.execPath,
    args: [join(pkgRoot, "dist/index.js"), "--workspace", workspace, "--locale", "fr"],
  }),
);

const call = async (name, args = {}) => {
  const result = await client.callTool({ name, arguments: args });
  const text = result.content?.[0]?.text ?? "";
  return { isError: Boolean(result.isError), text, json: () => JSON.parse(text) };
};

// Guidance.
const tools = await client.listTools();
check(`18 tools registered (got ${tools.tools.length})`, tools.tools.length === 18);

const instructions = client.getInstructions();
check("server instructions delivered at init (FR)", Boolean(instructions?.includes("DÉROULÉ TYPE")));

const helpText = (await call("help")).text;
check("help tool returns the localized guide", helpText.includes("record_position") && helpText.includes("RÈGLES DE SOIN"));
check("guide routes the six session types", helpText.includes("TYPES DE SESSIONS") && helpText.includes("DIFFICULTÉS"));

const axes = (await call("list_axes")).json();
const axisCount = Object.values(axes).flat().length;
check(`list_axes returns the grouped axes (got ${axisCount})`, axisCount >= 70 && Array.isArray(axes.SELF));
check("digest is FR-localized", JSON.stringify(axes).includes("Liberté"));

const relationOnly = (await call("list_axes", { relation: "SELF" })).json();
check("list_axes relation filter returns one group", Array.isArray(relationOnly) && relationOnly.length === axes.SELF.length);

const freedom = (await call("get_axis", { axisId: "freedom" })).json();
check("get_axis is case-tolerant and localized", freedom.id === "FREEDOM" && typeof freedom.label === "string");
check(
  "get_axis strips problems, signals problemCount",
  !("problems" in freedom) && (freedom.problemCount === undefined || freedom.problemCount > 0),
);

const freedomProblems = (await call("get_axis_problems", { axisId: "FREEDOM" })).json();
check("get_axis_problems serves the map", freedomProblems.axisId === "FREEDOM" && Array.isArray(freedomProblems.problems));

const found = (await call("search", { query: "liberte" })).json();
check("search folds diacritics", found.some((r) => r.ref === "ax:FREEDOM"));

const epictetus = (await call("get_entity", { ref: "ph:epictetus" })).json();
check(
  "get_entity serves the figure DIGEST (positions, no entries/summary/justifications)",
  Array.isArray(epictetus.positions) && !epictetus.entries && !epictetus.summary && !JSON.stringify(epictetus.positions).includes("justification"),
);
const epictetusFull = (await call("get_entity", { ref: "ph:epictetus", full: true })).json();
check("get_entity full:true returns the whole profile", Array.isArray(epictetusFull.entries) && typeof epictetusFull.summary === "string");

const onePosition = (await call("get_position", { ref: "ph:epictetus", axisId: "FREEDOM" })).json();
check("get_position returns the sourced slice", onePosition.axisId === "FREEDOM" && Boolean(onePosition.position?.justification));
const batch = (await call("get_position", { ref: "ph:epictetus", axisIds: ["FREEDOM", "NOT_AN_AXIS"] })).json();
check(
  "get_position batches, tolerating a missing axis inline",
  batch.positions?.length === 2 && Boolean(batch.positions[0].position) && Boolean(batch.positions[1].error),
);

const tensions = (await call("get_tensions_for", { axisId: "FREEDOM" })).json();
check("get_tensions_for answers (array)", Array.isArray(tensions));

// Workspace lifecycle.
const before = await call("get_profile");
check("get_profile before init errors politely", before.isError && before.text.includes("init_workspace"));

const init = (await call("init_workspace", { locale: "fr" })).json();
check("init_workspace creates the folder", init.created === workspace);

const dup = await call("init_workspace", {});
check("second init_workspace refuses", dup.isError);

// Web-vault cohabitation: foreign files must never be touched by any write.
const strayFiles = {
  "session.json": '{"app":"internal"}\n',
  "Inbox.md": "- a quick capture\n",
  "Sync report.md": "nothing yet\n",
  "notes/beliefs/b-x.md": "mirror file\n",
};
mkdirSync(join(workspace, "notes/beliefs"), { recursive: true });
for (const [file, content] of Object.entries(strayFiles)) writeFileSync(join(workspace, file), content);

const bad = await call("record_position", {
  axisId: "FREEDOM",
  value: { kind: "weights", weights: [0.5, 0.5] },
  provenance: { modality: "self-declared" },
});
check("weights on a scalar axis are rejected", bad.isError && bad.text.includes("scalar"));

const pos = (
  await call("record_position", {
    axisId: "FREEDOM",
    status: "POSITIONED",
    value: { kind: "scalar", value: 0.3 },
    confidence: "MEDIUM",
    salience: "MAJOR",
    rationale: "Compatibiliste : libre quand j'agis selon mes raisons.",
    reason: { statement: "Délibérer fait partie de la chaîne causale.", stance: "OBJECTION_MET", origin: "PROPOSED" },
    provenance: { modality: "thought-experiment", ref: "te:its-my-nature" },
  })
).json();
check("record_position consolidates + history", pos.status === "POSITIONED" && pos.history.length === 1 && pos.reasons.length === 1);

const badRef = await call("add_entry", {
  collection: "beliefs",
  entry: {
    statement: "Test ref cassée.",
    mode: "PRESCRIPTIVE",
    adherence: "WEAK",
    relatedAxes: ["ax:NOT_AN_AXIS"],
  },
});
check("dangling referential ref is rejected", badRef.isError && badRef.text.includes("does not resolve"));

const belief = (
  await call("add_entry", {
    collection: "beliefs",
    entry: {
      statement: "Le travail n'est pas le lieu où se décide le sens d'une vie.",
      mode: "PRESCRIPTIVE",
      adherence: "STRONG",
      relatedAxes: ["ax:WORK_MEANING"],
    },
  })
).json();
check("add_entry generates id + defaults status", belief.id?.startsWith("b-") && belief.status === "HELD");

// ── Current-format fields (2026-07 notebook refactor) ──────────────────────

const doubt = (
  await call("add_entry", {
    collection: "inquiries",
    entry: {
      statement: "Cette conviction sur le travail tient-elle vraiment ?",
      kind: "DOUBT",
      relatedBeliefs: [belief.id],
    },
  })
).json();
check("inquiry kind DOUBT accepted, status defaults to ACTIVE", doubt.kind === "DOUBT" && doubt.status === "ACTIVE");

const tension = (
  await call("add_entry", {
    collection: "inquiries",
    entry: {
      statement: "Ma liberté revendiquée contre mon besoin de sécurité.",
      kind: "TENSION",
      tensionType: "T_V",
      relatedBeliefs: [belief.id],
      anchors: ["ax:FREEDOM"],
    },
  })
).json();
check("inquiry kind TENSION carries tensionType", tension.tensionType === "T_V");

const badTension = await call("add_entry", {
  collection: "inquiries",
  entry: { statement: "Type sans tension.", kind: "QUESTION", tensionType: "T_T" },
});
check("tensionType outside kind TENSION is rejected", badTension.isError && badTension.text.includes("TENSION"));

const model = (
  await call("add_entry", {
    collection: "affinities",
    entry: {
      feeling: "LOVE",
      subject: "Épictète",
      category: "PERSON",
      exemplar: true,
      facets: ["ATTITUDES", "THINKING_STYLE"],
      figureRef: "ph:epictetus",
      why: "La distinction de ce qui dépend de moi m'apaise.",
    },
  })
).json();
check("exemplar affinity (model) with facets + figureRef accepted", model.exemplar === true && model.facets?.length === 2);

const badFacets = await call("add_entry", {
  collection: "affinities",
  entry: { feeling: "LOVE", subject: "La marche", facets: ["ACTIONS"] },
});
check("facets without exemplar are rejected", badFacets.isError && badFacets.text.includes("exemplar"));

const badFigure = await call("add_entry", {
  collection: "affinities",
  entry: { feeling: "LOVE", subject: "X", exemplar: true, figureRef: "ph:not-a-philosopher" },
});
check("dangling figureRef is rejected", badFigure.isError && badFigure.text.includes("does not resolve"));

const practice = (
  await call("add_entry", {
    collection: "practices",
    entry: {
      statement: "Relire ma journée chaque soir, sans juger.",
      kind: "EXERCISE",
      inspiredBy: ["ph:seneca"],
      servesBeliefs: [belief.id],
    },
  })
).json();
check("practice without frequency accepted (frequency now optional)", practice.id?.startsWith("p-") && !("frequency" in practice));

const adopted = (
  await call("add_entry", { collection: "concepts", entry: { ref: "c:ataraxia", clarity: "SOMEWHAT_CLEAR" } })
).json();
check("adopted referential concept (ref, no id) accepted", adopted.ref === "c:ataraxia" && !adopted.id);

// ── Scoped reads ────────────────────────────────────────────────────────────

const digest = (await call("get_profile")).json();
check(
  "get_profile without axisId returns the compact digest",
  digest.count === 1 && Array.isArray(digest.entries) && typeof digest.entries[0] === "string" && digest.entries[0].startsWith("FREEDOM"),
);
const freedomEntry = (await call("get_profile", { axisId: "freedom" })).json();
check("get_profile axisId returns the entry with history", Array.isArray(freedomEntry.history) && freedomEntry.rationale?.includes("Compatibiliste"));

const compactList = (await call("list_entries", { collection: "inquiries", kind: "DOUBT" })).json();
check(
  "list_entries is compact and filters by kind",
  compactList.count === 1 && compactList.entries[0].startsWith(doubt.id) && compactList.entries[0].includes("DOUBT"),
);
const fullEntry = (await call("list_entries", { collection: "inquiries", id: doubt.id })).json();
check("list_entries id returns one entry in full", fullEntry.id === doubt.id && fullEntry.relatedBeliefs?.[0] === belief.id);
const byAxis = (await call("list_entries", { collection: "inquiries", axis: "FREEDOM" })).json();
check("list_entries filters by axis (anchors)", byAxis.count === 1 && byAxis.entries[0].startsWith(tension.id));

const session = (
  await call("log_session", {
    slug: "freedom",
    content: "Discussion « c'est ma nature » ; position compatibiliste consolidée.",
    modalities: ["thought-experiment"],
    touched: ["ax:FREEDOM", "te:its-my-nature"],
  })
).json();
check("log_session writes the journal file", existsSync(join(workspace, session.written)));

const summary = (await call("profile_summary", { writeSummaryMd: true })).json();
check(
  "profile_summary computes coverage + major positions",
  summary.coverage.touched === 1 && summary.majorPositions.length === 1,
);
const summaryMd = readFileSync(join(workspace, "summary.md"), "utf8");
check("summary.md rendered in FR with the position", summaryMd.includes("Mes positions structurantes") && summaryMd.includes("Compatibiliste"));

// Revision doctrine: a substantive revision is a NEW belief; the old one is retired.
const revised = (
  await call("add_entry", {
    collection: "beliefs",
    entry: { statement: "Le sens d'une vie peut se décider au travail, mais jamais par défaut.", mode: "PRESCRIPTIVE", adherence: "MODERATE" },
  })
).json();
const retired = await call("update_entry", { collection: "beliefs", id: belief.id, patch: { status: "ABANDONED" } });
check("update_entry retires the old belief (ABANDONED)", !retired.isError);

const legacyStatus = await call("update_entry", { collection: "beliefs", id: revised.id, patch: { status: "SUPERSEDED" } });
check("status SUPERSEDED no longer validates", legacyStatus.isError);

// Dangling refs (written against another corpus version): surfaced, never a write blocker.
const beliefsOnDisk = JSON.parse(readFileSync(join(workspace, "beliefs.json"), "utf8"));
beliefsOnDisk.find((b) => b.id === revised.id).relatedAxes = ["ax:FROM_A_NEWER_CORPUS"];
writeFileSync(join(workspace, "beliefs.json"), `${JSON.stringify(beliefsOnDisk, null, 2)}\n`);
const unrelatedPatch = await call("update_entry", { collection: "beliefs", id: revised.id, patch: { adherence: "STRONG" } });
check("pre-existing dangling ref does not block an unrelated patch", !unrelatedPatch.isError);
const newDangling = await call("update_entry", { collection: "beliefs", id: revised.id, patch: { relatedAxes: ["ax:NOT_AN_AXIS"] } });
check("a patch INTRODUCING a dangling ref is still rejected", newDangling.isError && newDangling.text.includes("does not resolve"));
const surfaced = (await call("profile_summary", {})).json();
check("profile_summary surfaces the dangling ref", Boolean(surfaced.danglingRefs?.some((d) => d.ref === "ax:FROM_A_NEWER_CORPUS")));

// Referential pin discipline: a writer carrying a newer corpus refreshes the pin.
const manifestFile = join(workspace, "philoscopia.json");
const staleManifest = JSON.parse(readFileSync(manifestFile, "utf8"));
staleManifest.referential.syncedAt = "2020-01-01T00:00:00.000Z";
writeFileSync(manifestFile, `${JSON.stringify(staleManifest, null, 2)}\n`);
await call("update_entry", { collection: "beliefs", id: revised.id, patch: { adherence: "MODERATE" } });
const refreshedManifest = JSON.parse(readFileSync(manifestFile, "utf8"));
check("a write refreshes the stale referential pin", refreshedManifest.referential.syncedAt > "2020-01-01");

// Legacy (pre-2026-07) records freeze the file with an actionable message.
const cleanBeliefs = readFileSync(join(workspace, "beliefs.json"), "utf8");
const legacyItems = JSON.parse(cleanBeliefs);
legacyItems[0].sphere = "MEANING";
writeFileSync(join(workspace, "beliefs.json"), `${JSON.stringify(legacyItems, null, 2)}\n`);
const legacyWrite = await call("add_entry", {
  collection: "beliefs",
  entry: { statement: "N'importe quoi d'autre.", mode: "DESCRIPTIVE", adherence: "WEAK" },
});
check("legacy fields yield the actionable pre-2026-07 error", legacyWrite.isError && legacyWrite.text.includes("pre-2026-07"));
writeFileSync(join(workspace, "beliefs.json"), cleanBeliefs);

// Close the DOUBT, then compact: ABANDONED beliefs + RESOLVED inquiries move.
await call("update_entry", { collection: "inquiries", id: doubt.id, patch: { status: "RESOLVED", resolution: "Conviction reformulée puis retirée." } });
const compacted = (await call("compact", {})).json();
check(
  "compact archives ABANDONED beliefs + RESOLVED inquiries",
  compacted.moved.beliefs === 1 && compacted.moved.inquiries === 1 && existsSync(join(workspace, "archive/beliefs.json")),
);
check(
  "active files keep the live records",
  JSON.parse(readFileSync(join(workspace, "beliefs.json"), "utf8")).length === 1 &&
    JSON.parse(readFileSync(join(workspace, "inquiries.json"), "utf8")).length === 1,
);

// No removed-format field or value anywhere: files and tool outputs.
const everything = [
  ...["beliefs", "concepts", "affinities", "inquiries", "practices", "profile"].map((n) =>
    readFileSync(join(workspace, `${n}.json`), "utf8"),
  ),
  readFileSync(join(workspace, "archive/beliefs.json"), "utf8"),
  JSON.stringify((await call("profile_summary", {})).json()),
  (await call("list_entries", { collection: "practices" })).text,
  (await call("get_profile")).text,
].join("\n");
const removedMarkers = ['"object"', '"sphere"', '"revisedFrom"', '"supersededBy"', "SUPERSEDED", '"consistency"', '"importance"', "EXPLORATION", '"PRACTICAL"'];
check(
  "no removed-format field or value in any file or output",
  removedMarkers.every((marker) => !everything.includes(marker)),
);

// Web-vault cohabitation: every foreign file is byte-identical after the session.
check(
  "web-vault files untouched by MCP writes",
  Object.entries(strayFiles).every(([file, content]) => readFileSync(join(workspace, file), "utf8") === content),
);

await client.close();

if (process.argv.includes("--keep")) console.log(`workspace kept: ${workspace}`);
else rmSync(workspace, { recursive: true, force: true });

console.log(failures === 0 ? "\nSMOKE OK" : `\nSMOKE FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
