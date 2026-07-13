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
check(`22 tools registered (got ${tools.tools.length})`, tools.tools.length === 22);

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

const orientBefore = (await call("orient")).json();
check(
  "orient before init: referential counts + invitation to create the carnet",
  orientBefore.workspace?.initialized === false &&
    orientBefore.referential?.figures > 0 &&
    orientBefore.sessionMenu?.length === 6 &&
    orientBefore.workspace.note.includes("init_workspace"),
);

const init = (
  await call("init_workspace", {
    locale: "fr",
    user: { expertise: "BEGINNER", goals: "Y voir plus clair sur quelques questions.", motivations: "Un deuil récent." },
  })
).json();
check("init_workspace creates the folder", init.created === workspace);
const initManifest = JSON.parse(readFileSync(join(workspace, "philoscopia.json"), "utf8"));
check(
  "init_workspace persists the user block (expertise + goals + motivations)",
  initManifest.user?.expertise === "BEGINNER" && Boolean(initManifest.user?.updatedAt),
);

const patchedUser = (await call("set_user", { expertise: "AMATEUR", motivations: null })).json();
check(
  "set_user merges the patch (null deletes a field, goals untouched)",
  patchedUser.expertise === "AMATEUR" && !("motivations" in patchedUser) && patchedUser.goals?.includes("quelques questions"),
);

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

// ── Florilège (quotes) & reading register (readings) ────────────────────────

const today = new Date().toISOString().slice(0, 10);
const quote = (
  await call("add_entry", {
    collection: "quotes",
    entry: {
      text: "Ce ne sont pas les choses qui troublent les hommes, mais les jugements qu'ils portent sur les choses.",
      source: "Épictète, Manuel, §5",
      explanation: "Le trouble vient de l'opinion, pas de l'événement.",
      note: "Ma phrase de garde quand tout déraille.",
      anchors: ["ph:epictetus", "ax:EMOTIONS"],
    },
  })
).json();
check("quote entry gets a dated qt- id, createdAt, no updatedAt", quote.id?.startsWith(`qt-${today}-`) && Boolean(quote.createdAt) && !("updatedAt" in quote));

const noTitle = await call("add_entry", { collection: "readings", entry: { scope: "WORK" } });
check("reading without title or workRef is rejected", noTitle.isError && noTitle.text.includes("workRef"));

const badWork = await call("add_entry", {
  collection: "readings",
  entry: { workRef: "w:not-a-work", scope: "WORK" },
});
check("dangling workRef is rejected", badWork.isError && badWork.text.includes("does not resolve"));

const badQuoteLink = await call("add_entry", {
  collection: "readings",
  entry: { workRef: "w:enchiridion-epictetus", scope: "EXCERPT", quotes: ["qt-not-kept"] },
});
check("reading linking an unknown quote id is rejected", badQuoteLink.isError && badQuoteLink.text.includes("quotes.json"));

const reading = (
  await call("add_entry", {
    collection: "readings",
    entry: {
      workRef: "w:enchiridion-epictetus",
      scope: "EXCERPT",
      appraisal: "ESSENTIAL",
      verdict: "Le premier texte qui m'a donné une prise sur mes émotions.",
      agreements: [{ statement: "Le partage de ce qui dépend de moi est opérant au quotidien." }],
      disagreements: [{ statement: "L'indifférence aux « choses » me semble intenable en amitié.", ref: "ax:EMOTIONS" }],
      relatedAxes: ["ax:EMOTIONS"],
      quotes: [quote.id],
    },
  })
).json();
check(
  "reading gets a dated rd- id (from workRef) and status defaults to READ",
  reading.id?.startsWith(`rd-${today}-enchiridion`) && reading.status === "READ" && reading.quotes[0] === quote.id,
);

const toRead = (
  await call("add_entry", {
    collection: "readings",
    entry: { title: "La Consolation de Philosophie", author: "Boèce", scope: "WORK", status: "TO_READ" },
  })
).json();
check("reading list entry (TO_READ, free-text title) accepted", toRead.status === "TO_READ" && toRead.id?.startsWith("rd-"));

const readingLines = (await call("list_entries", { collection: "readings", status: "TO_READ" })).json();
check(
  "list_entries readings is compact and filters by status",
  readingLines.count === 1 && readingLines.entries[0].startsWith(toRead.id) && readingLines.entries[0].includes("TO_READ"),
);
const quoteLines = (await call("list_entries", { collection: "quotes" })).json();
check("list_entries quotes serves the florilège compactly", quoteLines.count === 1 && quoteLines.entries[0].includes("jugements"));

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
    next: "Reprendre la tension entre ma liberté et mon besoin de sécurité.",
  })
).json();
check("log_session writes the journal file", existsSync(join(workspace, session.written)));
const nextManifest = JSON.parse(readFileSync(join(workspace, "philoscopia.json"), "utf8"));
check(
  "log_session next persists the open thread in the manifest",
  nextManifest.next?.statement.includes("sécurité") && nextManifest.next?.session === session.written,
);

const orientAfter = (await call("orient")).json();
check(
  "orient after a session: user block, carnet counts, last session, next, threads",
  orientAfter.workspace?.user?.expertise === "AMATEUR" &&
    orientAfter.workspace?.carnet?.axesTouched === 1 &&
    orientAfter.workspace?.lastSession?.path === session.written &&
    orientAfter.workspace?.next?.statement.includes("sécurité") &&
    orientAfter.workspace?.threads?.some((t) => t.includes("conviction sur le travail")),
);

const summary = (await call("profile_summary", { writeSummaryMd: true })).json();
check(
  "profile_summary computes coverage + major positions",
  summary.coverage.touched === 1 && summary.majorPositions.length === 1,
);
check(
  "profile_summary open work lists the reading list, not finished readings",
  summary.openWork.openReadings?.includes(toRead.id) && !summary.openWork.openReadings.includes(reading.id),
);
const summaryMd = readFileSync(join(workspace, "summary.md"), "utf8");
check("summary.md rendered in FR with the position", summaryMd.includes("Mes positions structurantes") && summaryMd.includes("Compatibiliste"));
check("summary.md carries the florilège verbatim", summaryMd.includes("## Florilège") && summaryMd.includes("les jugements qu'ils portent"));
check(
  "summary.md lists open readings only",
  summaryMd.includes("Lectures, en cours et à lire") && summaryMd.includes("Boèce") && !summaryMd.includes("enchiridion"),
);

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

// Close the DOUBT and abandon the queued reading, then compact: ABANDONED
// beliefs/readings + RESOLVED inquiries move.
await call("update_entry", { collection: "inquiries", id: doubt.id, patch: { status: "RESOLVED", resolution: "Conviction reformulée puis retirée." } });
await call("update_entry", { collection: "readings", id: toRead.id, patch: { status: "ABANDONED" } });
const compacted = (await call("compact", {})).json();
check(
  "compact archives ABANDONED beliefs/readings + RESOLVED inquiries",
  compacted.moved.beliefs === 1 && compacted.moved.inquiries === 1 && compacted.moved.readings === 1 && existsSync(join(workspace, "archive/beliefs.json")),
);
check(
  "active files keep the live records",
  JSON.parse(readFileSync(join(workspace, "beliefs.json"), "utf8")).length === 1 &&
    JSON.parse(readFileSync(join(workspace, "inquiries.json"), "utf8")).length === 1 &&
    JSON.parse(readFileSync(join(workspace, "readings.json"), "utf8")).length === 1,
);

// No removed-format field or value anywhere: files and tool outputs.
const everything = [
  ...["beliefs", "concepts", "affinities", "inquiries", "practices", "quotes", "readings", "profile"].map((n) =>
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

// ── Syntheses: immutable generations, web-parser-compatible frontmatter ─────

// The reference parser, copied verbatim from the source monorepo
// (packages/profile/src/vault/syntheses.ts parseSynthesisMarkdown): what the
// web app's vault reader will accept when it unions the two writers' files.
const parseSynthesisMarkdown = (text) => {
  const fm = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!fm) return null;
  const head = fm[1];
  if (!/^\s*collection:\s*syntheses\s*$/m.test(head)) return null;
  const id = head.match(/^\s*id:\s*(\S+)\s*$/m)?.[1];
  const at = head.match(/^at:\s*(\S+)\s*$/m)?.[1];
  if (!id || !at) return null;
  const unquote = (v) =>
    v === undefined ? undefined : v.replace(/^"(.*)"$/s, "$1").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  const model = unquote(head.match(/^model:\s*(.+?)\s*$/m)?.[1]);
  const scope = unquote(head.match(/^scope:\s*(.+?)\s*$/m)?.[1]);
  const body = fm[2].trim();
  if (!body) return null;
  return { id, at, text: body, ...(model ? { model } : {}), ...(scope ? { scope } : {}) };
};

const emptySynthesis = await call("write_synthesis", { text: "   " });
check("write_synthesis refuses an empty text", emptySynthesis.isError);

const synthesisText =
  "Un fil traverse ce carnet : ce qui trouble n'est pas l'événement mais le jugement (qt du Manuel, position sur FREEDOM).\n\nTension vive : liberté revendiquée contre besoin de sécurité.";
const syn = (
  await call("write_synthesis", { text: synthesisText, scope: "profil complet, premier portrait", model: "smoke-model/1.0" })
).json();
check("write_synthesis writes syntheses/syn-<date>-<slug>.md", syn.id?.startsWith(`syn-${today}-`) && existsSync(join(workspace, syn.path)));

const parsed = parseSynthesisMarkdown(readFileSync(join(workspace, syn.path), "utf8"));
check(
  "the written file round-trips through the monorepo's parseSynthesisMarkdown",
  parsed?.id === syn.id &&
    parsed?.text === synthesisText &&
    parsed?.model === "smoke-model/1.0" &&
    parsed?.scope === "profil complet, premier portrait" &&
    !Number.isNaN(Date.parse(parsed?.at)),
);

const firstFile = readFileSync(join(workspace, syn.path), "utf8");
const syn2 = (
  await call("write_synthesis", { text: "Deuxième génération, même périmètre.", scope: "profil complet, premier portrait" })
).json();
check(
  "a same-day generation gets a new suffixed id; the first file is untouched",
  syn2.id === `${syn.id}-2` && readFileSync(join(workspace, syn.path), "utf8") === firstFile,
);

const synList = (await call("get_syntheses", {})).json();
check(
  "get_syntheses lists the generations newest first",
  synList.count === 2 && synList.entries[0].startsWith(syn2.id) && synList.entries[1].includes("smoke-model/1.0"),
);
const synFull = (await call("get_syntheses", { id: syn.id })).json();
check("get_syntheses id returns one generation in full", synFull.id === syn.id && synFull.text === synthesisText);

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
