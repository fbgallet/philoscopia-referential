// End-to-end smoke test: drives the built server through a real MCP client
// over stdio, exercising the referential tools, the full workspace lifecycle
// and the error paths. Run: npm run smoke [--] --keep (keeps the tmp workspace).

import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
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
check(`16 tools registered (got ${tools.tools.length})`, tools.tools.length === 16);

const instructions = client.getInstructions();
check("server instructions delivered at init (FR)", Boolean(instructions?.includes("DÉROULÉ TYPE")));

const helpText = (await call("help")).text;
check("help tool returns the localized guide", helpText.includes("record_position") && helpText.includes("RÈGLES DE SOIN"));
check("guide routes the six session types", helpText.includes("TYPES DE SESSIONS") && helpText.includes("DIFFICULTÉS"));

const axes = (await call("list_axes")).json();
check(`list_axes returns the axes (got ${axes.length})`, axes.length >= 70);
check("digest is FR-localized", JSON.stringify(axes).includes("Liberté"));

const freedom = (await call("get_axis", { axisId: "freedom" })).json();
check("get_axis is case-tolerant and localized", freedom.id === "FREEDOM" && typeof freedom.label === "string");

const found = (await call("search", { query: "liberte" })).json();
check("search folds diacritics", found.some((r) => r.ref === "ax:FREEDOM"));

const epictetus = (await call("get_entity", { ref: "ph:epictetus" })).json();
check("get_entity returns a profile with entries", Array.isArray(epictetus.entries));

const tensions = (await call("get_tensions_for", { axisId: "FREEDOM" })).json();
check("get_tensions_for answers (array)", Array.isArray(tensions));

// Workspace lifecycle.
const before = await call("get_profile");
check("get_profile before init errors politely", before.isError && before.text.includes("init_workspace"));

const init = (await call("init_workspace", { locale: "fr" })).json();
check("init_workspace creates the folder", init.created === workspace);

const dup = await call("init_workspace", {});
check("second init_workspace refuses", dup.isError);

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
    provenance: { modality: "thought-experiment", ref: "te:the-tumor-case" },
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
      object: "INDIVIDUAL",
      sphere: "MEANING",
      adherence: "STRONG",
      relatedAxes: ["ax:WORK_MEANING"],
    },
  })
).json();
check("add_entry generates id + defaults status", belief.id?.startsWith("b-") && belief.status === "HELD");

const session = (
  await call("log_session", {
    slug: "freedom",
    content: "Discussion du cas de la tumeur ; position compatibiliste consolidée.",
    modalities: ["thought-experiment"],
    touched: ["ax:FREEDOM", "te:the-tumor-case"],
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

const superseded = await call("update_entry", {
  collection: "beliefs",
  id: belief.id,
  patch: { status: "SUPERSEDED", supersededBy: belief.id },
});
check("update_entry patches + validates", !superseded.isError);

const compacted = (await call("compact", {})).json();
check("compact archives the superseded belief", compacted.moved.beliefs === 1 && existsSync(join(workspace, "archive/beliefs.json")));
check("active beliefs file is empty again", JSON.parse(readFileSync(join(workspace, "beliefs.json"), "utf8")).length === 0);

await client.close();

if (process.argv.includes("--keep")) console.log(`workspace kept: ${workspace}`);
else rmSync(workspace, { recursive: true, force: true });

console.log(failures === 0 ? "\nSMOKE OK" : `\nSMOKE FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
