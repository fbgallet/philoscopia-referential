// User workspace (`my-philosophy/`): file persistence with JSON Schema
// validation on every write. Format: docs/user-workspace-format.md in the
// source monorepo; the published schemas under schemas/workspace/ are the
// contract this module enforces (plus the write-time rules JSON Schema cannot
// express: POSITIONED requires a value, values must fit the axis's shape).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Ajv2020, type ValidateFunction } from "ajv/dist/2020.js";
import { poleWeight, positionValueText, type Corpus, type Locale } from "./corpus.js";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const COLLECTIONS = ["beliefs", "concepts", "affinities", "inquiries", "practices"] as const;
export type CollectionName = (typeof COLLECTIONS)[number];

const ID_PREFIX: Record<CollectionName, string> = {
  beliefs: "b",
  concepts: "k",
  affinities: "a",
  inquiries: "q",
  practices: "p",
};

/** Markers of the pre-2026-07 workspace format, detected when a strict-schema
 * validation fails so the error explains the situation instead of a raw ajv
 * message. Writes never migrate silently (maintainer decision pending). */
const LEGACY_MARKERS: Partial<Record<CollectionName, (item: any) => string | null>> = {
  beliefs: (i) => {
    for (const key of ["object", "sphere", "revisedFrom", "supersededBy"]) {
      if (key in i) return `field "${key}" was removed`;
    }
    if (i.status === "SUPERSEDED") return "status SUPERSEDED was removed (a closed revision is ABANDONED)";
    if (i.mode === "PRACTICAL") return 'mode PRACTICAL was removed (the "how to live" register moved to practices)';
    return null;
  },
  concepts: (i) => ("importance" in i ? 'field "importance" was removed' : null),
  practices: (i) => ("consistency" in i ? 'field "consistency" was removed' : null),
  inquiries: (i) => (i.kind === "EXPLORATION" ? "kind EXPLORATION was removed (an open theme is a QUESTION)" : null),
};

/** Compact line formats served by listView (one per collection). */
const LIST_FORMATS: Record<CollectionName, string> = {
  beliefs: "id · MODE/STATUS/ADHERENCE · statement",
  concepts: "id · CLARITY · term (personal) | c:ref · CLARITY (adopted)",
  affinities: "id · FEELING[+exemplar] · CATEGORY? · subject (figureRef?)",
  inquiries: "id · KIND[/T_T|T_V]/STATUS[/PRIORITY] · statement",
  practices: "id · KIND[/FREQUENCY] · statement",
};

const compactLine = (name: CollectionName, i: any): string => {
  switch (name) {
    case "beliefs":
      return [i.id, [i.mode, i.status, i.adherence].filter(Boolean).join("/"), i.statement].join(" · ");
    case "concepts":
      return i.ref
        ? [i.ref, i.clarity].filter(Boolean).join(" · ")
        : [i.id, i.clarity, i.term].filter(Boolean).join(" · ");
    case "affinities":
      return [
        i.id,
        i.exemplar ? `${i.feeling}+exemplar` : i.feeling,
        i.category,
        i.figureRef ? `${i.subject} (${i.figureRef})` : i.subject,
      ]
        .filter(Boolean)
        .join(" · ");
    case "inquiries":
      return [i.id, [i.kind, i.tensionType, i.status, i.priority].filter(Boolean).join("/"), i.statement].join(" · ");
    case "practices":
      return [i.id, [i.kind, i.frequency].filter(Boolean).join("/"), i.statement].join(" · ");
  }
};

const PROFILE_FORMAT =
  "AXIS_ID · value (scalar | [pole weights]) · STATUS[/CONFIDENCE] · SALIENCE? · updated — entry in full via get_profile axisId";

export class Workspace {
  private validators = new Map<string, ValidateFunction>();

  constructor(
    readonly dir: string,
    private corpus: Corpus,
  ) {
    const schemasDir = join(corpus.paths.schemas, "workspace");
    if (existsSync(schemasDir)) {
      // useDefaults fills schema defaults (e.g. a belief's status: HELD) at
      // validation time, so hand-written and tool-written entries converge.
      const ajv = new Ajv2020({ allErrors: true, useDefaults: true });
      for (const name of ["philoscopia", "profile", ...COLLECTIONS]) {
        const file = join(schemasDir, `${name}.schema.json`);
        if (!existsSync(file)) continue;
        const schema = JSON.parse(readFileSync(file, "utf8"));
        delete schema.$id; // avoid cross-run id clashes in ajv's registry
        this.validators.set(name, ajv.compile(schema));
      }
    } else {
      console.error(`[philoscopia-mcp] workspace schemas not found under ${schemasDir}; writes are unvalidated`);
    }
  }

  exists(): boolean {
    return existsSync(join(this.dir, "philoscopia.json"));
  }

  private requireWorkspace(): void {
    if (!this.exists()) {
      throw new Error(
        `No workspace at ${this.dir} (philoscopia.json missing). Run the init_workspace tool first.`,
      );
    }
  }

  private validate(name: string, data: unknown): void {
    const validator = this.validators.get(name);
    if (!validator) return;
    if (!validator(data)) {
      const legacy = LEGACY_MARKERS[name as CollectionName];
      if (legacy && Array.isArray(data)) {
        for (const item of data as any[]) {
          const marker = item && typeof item === "object" ? legacy(item) : null;
          if (marker) {
            throw new Error(
              `${name}.json holds record "${item.id ?? "?"}" in a pre-2026-07 format: ${marker}. ` +
                `This server only writes the current published format (schemas/workspace/); ` +
                `update the legacy record(s) first, then retry.`,
            );
          }
        }
      }
      const details = (validator.errors ?? [])
        .map((e) => `${e.instancePath || "(root)"} ${e.message}`)
        .join("; ");
      throw new Error(`${name}.json would become invalid: ${details}`);
    }
  }

  private read(name: string): any {
    const file = join(this.dir, `${name}.json`);
    if (!existsSync(file)) throw new Error(`${name}.json not found in ${this.dir}`);
    return JSON.parse(readFileSync(file, "utf8"));
  }

  private write(name: string, data: unknown): void {
    this.validate(name, data);
    writeFileSync(join(this.dir, `${name}.json`), `${JSON.stringify(data, null, 2)}\n`);
  }

  // ── init ───────────────────────────────────────────────────────────────

  init(locale: Locale): string {
    if (this.exists()) throw new Error(`A workspace already exists at ${this.dir}.`);
    try {
      mkdirSync(join(this.dir, "journal"), { recursive: true });
    } catch (error) {
      const code = (error as { code?: string }).code ?? "error";
      throw new Error(
        `Cannot create the workspace at ${this.dir} (${code}). ` +
          `Check the --workspace path in the MCP client config: it must be an absolute, ` +
          `writable path (e.g. under your home folder); "~" is not expanded in JSON configs. ` +
          `Omit --workspace to use the default ~/my-philosophy.`,
      );
    }
    const now = new Date().toISOString();
    this.write("philoscopia", {
      format: 1,
      locale,
      createdAt: now,
      referential: {
        source: "https://github.com/fbgallet/philoscopia-referential",
        syncedAt: this.corpus.paths.meta?.bundledAt ?? now,
        ...(this.corpus.paths.meta?.commit ? { commit: this.corpus.paths.meta.commit } : {}),
      },
    });
    this.write("profile", { entries: {} });
    for (const name of COLLECTIONS) this.write(name, []);
    return this.dir;
  }

  manifest(): any {
    this.requireWorkspace();
    return this.read("philoscopia");
  }

  // ── profile ────────────────────────────────────────────────────────────

  profile(): any {
    this.requireWorkspace();
    return this.read("profile");
  }

  /** Scoped read, no axisId: one compact line per touched axis (the entry-level
   * consolidation only — rationale, reasons and history stay behind the
   * per-axis read). Mirrors the web companion's get_profile digest. */
  profileDigest(): any {
    const profile = this.profile();
    const entries = Object.entries<any>(profile.entries ?? {}).map(([axisId, e]) => {
      const value = e.value ? positionValueText(e.value) : null;
      return [
        axisId,
        value,
        [e.status, e.confidence].filter(Boolean).join("/"),
        e.salience,
        e.updatedAt?.slice(0, 10),
      ]
        .filter(Boolean)
        .join(" · ");
    });
    return { count: entries.length, format: PROFILE_FORMAT, entries };
  }

  /** Scoped read, one axis: the whole entry, history capped to the last 3
   * records (`historyOmitted` counts the rest). Null when the axis is untouched. */
  profileEntry(axisId: string): any {
    const profile = this.profile();
    const entry = profile.entries?.[axisId.toUpperCase()];
    if (!entry) return null;
    const history: any[] = entry.history ?? [];
    if (history.length <= 3) return entry;
    return { ...entry, history: history.slice(-3), historyOmitted: history.length - 3 };
  }

  recordPosition(args: {
    axisId: string;
    status?: string;
    value?: any;
    confidence?: string;
    salience?: string;
    rationale?: string;
    reason?: { statement: string; stance: string; origin: string };
    provenance: { modality: string; ref?: string };
    note?: string;
    session?: string;
  }): any {
    this.requireWorkspace();
    const axis = this.corpus.axes.get(args.axisId);
    if (!axis) throw new Error(`Unknown axis "${args.axisId}". Use list_axes or search first.`);
    if (args.value) this.checkValueShape(axis, args.value);
    if (args.provenance?.ref && this.refResolves(args.provenance.ref) === false) {
      throw new Error(`Provenance ref "${args.provenance.ref}" does not resolve in the referential.`);
    }

    const profile = this.read("profile");
    const now = new Date().toISOString();
    const entry = profile.entries[args.axisId] ?? { status: "EXPLORING", updatedAt: now, history: [] };

    if (args.status) entry.status = args.status;
    if (args.value) entry.value = args.value;
    if (args.confidence) entry.confidence = args.confidence;
    if (args.salience) entry.salience = args.salience;
    if (args.rationale) entry.rationale = args.rationale;
    if (args.reason) {
      entry.reasons = [...(entry.reasons ?? []), { ...args.reason, at: now }];
    }
    entry.updatedAt = now;
    entry.history.push({
      at: now,
      ...(args.value ? { value: args.value } : {}),
      provenance: args.provenance,
      ...(args.session ? { session: args.session } : {}),
      ...(args.note ? { note: args.note } : {}),
    });

    if (entry.status === "POSITIONED" && !entry.value) {
      throw new Error("A POSITIONED entry needs a value (pass one, or use status EXPLORING).");
    }
    profile.entries[args.axisId] = entry;
    this.write("profile", profile);
    this.refreshPin();
    return entry;
  }

  /** Write-time rule JSON Schema cannot carry: the value must fit the axis. */
  private checkValueShape(axis: any, value: any): void {
    const scalarAxis = axis.type === "BIPOLAR" || axis.type === "BIPOLAR_MEDIAN";
    if (value.kind === "scalar" && !scalarAxis) {
      throw new Error(`Axis ${axis.id} is ${axis.type}: use weights (one per pole, in pole order).`);
    }
    if (value.kind === "weights") {
      if (scalarAxis) throw new Error(`Axis ${axis.id} is ${axis.type}: use a scalar in [-1, 1].`);
      if (value.weights.length !== axis.poles.length) {
        throw new Error(`Axis ${axis.id} has ${axis.poles.length} poles; got ${value.weights.length} weights.`);
      }
      const sum = value.weights.reduce((acc: number, w: number) => acc + w, 0);
      if (Math.abs(sum - 1) > 1e-6) throw new Error(`Weights must sum to 1 (got ${sum}).`);
    }
  }

  // ── collections ────────────────────────────────────────────────────────

  list(
    name: CollectionName,
    filter?: { status?: string; kind?: string; axis?: string; text?: string },
  ): any[] {
    this.requireWorkspace();
    let items: any[] = this.read(name);
    if (filter?.status) items = items.filter((i) => i.status === filter.status);
    if (filter?.kind) items = items.filter((i) => i.kind === filter.kind);
    if (filter?.axis) {
      const ref = filter.axis.startsWith("ax:") ? filter.axis : `ax:${filter.axis.toUpperCase()}`;
      items = items.filter((i) => [...(i.relatedAxes ?? []), ...(i.anchors ?? [])].includes(ref));
    }
    if (filter?.text) {
      const needle = filter.text.toLowerCase();
      items = items.filter((i) => JSON.stringify(i).toLowerCase().includes(needle));
    }
    return items;
  }

  /** The list_entries view: one entry in full (by id), or compact lines.
   * Filtering happens server-side so only what the conversation can use
   * enters the host's context. */
  listView(
    name: CollectionName,
    filter?: { id?: string; status?: string; kind?: string; axis?: string; text?: string },
  ): any {
    if (filter?.id) {
      const found = this.list(name).find((i) => i.id === filter.id || i.ref === filter.id);
      if (!found) throw new Error(`No entry "${filter.id}" in ${name}.json.`);
      return found;
    }
    const items = this.list(name, filter);
    return { count: items.length, format: LIST_FORMATS[name], entries: items.map((i) => compactLine(name, i)) };
  }

  add(name: CollectionName, entry: any): any {
    this.requireWorkspace();
    const items: any[] = this.read(name);
    const now = new Date().toISOString();
    // An adopted concept ({ ref: "c:…" }) is keyed by its ref: no id, no dates.
    if (entry.ref && items.some((i) => i.ref === entry.ref)) {
      throw new Error(`"${entry.ref}" is already adopted in ${name}.json.`);
    }
    if (!entry.id && !entry.ref) {
      const base: string = entry.statement ?? entry.subject ?? entry.term ?? "entry";
      const slug = base
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .split("-")
        .slice(0, 5)
        .join("-");
      entry.id = `${ID_PREFIX[name]}-${slug}`;
      let n = 2;
      while (items.some((i) => i.id === entry.id)) entry.id = `${ID_PREFIX[name]}-${slug}-${n++}`;
    }
    if (entry.id && items.some((i) => i.id === entry.id)) throw new Error(`Duplicate id "${entry.id}" in ${name}.json.`);
    if (!entry.ref) {
      entry.createdAt ??= now;
      if (name !== "concepts" && name !== "affinities") entry.updatedAt ??= now;
    }
    if (name === "inquiries") entry.status ??= "ACTIVE";
    this.checkRefs(entry);
    this.checkRules(name, entry);
    this.write(name, [...items, entry]);
    this.refreshPin();
    return entry;
  }

  update(name: CollectionName, id: string, patch: Record<string, any>): any {
    this.requireWorkspace();
    const items: any[] = this.read(name);
    const index = items.findIndex((i) => i.id === id || i.ref === id);
    if (index < 0) throw new Error(`No entry "${id}" in ${name}.json.`);
    const updated = { ...items[index], ...patch };
    for (const [key, value] of Object.entries(patch)) if (value === null && key !== "resolution") delete updated[key];
    if ("updatedAt" in items[index] || (name !== "concepts" && name !== "affinities" && !updated.ref)) {
      updated.updatedAt = new Date().toISOString();
    }
    // Only the refs the patch introduces are gated: a ref already on disk that
    // stopped resolving (written against another corpus version) is surfaced
    // by profile_summary, never a write blocker (vault §10.4).
    this.checkRefs(patch);
    this.checkRules(name, updated);
    items[index] = updated;
    this.write(name, items);
    this.refreshPin();
    return updated;
  }

  /** Coherence rules the published JSON Schemas cannot express. */
  private checkRules(name: CollectionName, entry: any): void {
    if (name === "inquiries" && entry.tensionType && entry.kind !== "TENSION") {
      throw new Error("tensionType (T_T: belief vs belief, T_V: belief vs value) is only for kind TENSION.");
    }
    if (name === "affinities" && !entry.exemplar && (entry.facets || entry.figureRef)) {
      throw new Error(
        "facets/figureRef describe an exemplar affinity: set exemplar true (a model when LOVE, an anti-model when HATE) or drop them.",
      );
    }
  }

  /** Every prefixed ref carried by an entry (list fields + ref/figureRef). */
  private collectRefs(entry: any): string[] {
    const refs: string[] = [];
    for (const key of ["relatedAxes", "anchors", "grounds", "challengedBy", "inspiredBy", "relatedConcepts"]) {
      if (Array.isArray(entry[key])) refs.push(...entry[key]);
    }
    for (const key of ["ref", "figureRef"]) {
      if (typeof entry[key] === "string") refs.push(entry[key]);
    }
    return refs;
  }

  /** Does a ref resolve in the bundled corpus? Null when it is not a prefixed
   * referential ref (workspace-local ids are the caller's business). */
  private refResolves(ref: string): boolean | null {
    const match = ref.match(/^(ax|pole|c|ph|mv|chr|te|w|problem):(.+)$/);
    if (!match) return null;
    const [, prefix, rest] = match;
    if (prefix === "pole") {
      const [axisId, poleId] = rest.split("/");
      const axis = this.corpus.axes.get(axisId);
      return Boolean(axis?.poles.some((p: any) => p.id === poleId));
    }
    if (prefix === "problem") {
      return [...this.corpus.axes.values()].some((axis) =>
        (axis.problems ?? []).some((pr: any) => pr.id === rest),
      );
    }
    return this.corpus.byRef.has(`${prefix}:${rest}`);
  }

  /** Referential refs a write introduces must resolve against the bundled
   * corpus (never invent refs); workspace-local ids pass through. */
  private checkRefs(entry: any): void {
    for (const ref of this.collectRefs(entry)) {
      if (this.refResolves(ref) === false) {
        throw new Error(`Ref "${ref}" does not resolve in the referential.`);
      }
    }
  }

  /** Prefixed refs already in the workspace that no longer resolve in the
   * bundled corpus — surfaced (profile_summary), never a failure (vault §10.4). */
  danglingRefs(): Array<{ file: string; id: string; ref: string }> {
    this.requireWorkspace();
    const out: Array<{ file: string; id: string; ref: string }> = [];
    for (const name of COLLECTIONS) {
      for (const item of this.read(name) as any[]) {
        for (const ref of this.collectRefs(item)) {
          if (this.refResolves(ref) === false) out.push({ file: `${name}.json`, id: item.id ?? item.ref, ref });
        }
      }
    }
    const profile = this.read("profile");
    for (const [axisId, entry] of Object.entries<any>(profile.entries ?? {})) {
      if (!this.corpus.axes.has(axisId)) out.push({ file: "profile.json", id: axisId, ref: `ax:${axisId}` });
      for (const record of entry.history ?? []) {
        const ref = record?.provenance?.ref;
        if (typeof ref === "string" && this.refResolves(ref) === false) {
          out.push({ file: "profile.json", id: axisId, ref });
        }
      }
    }
    return out;
  }

  /** Vault §10.4: every writer refreshes the manifest's referential pin when
   * it carries a newer corpus than the pin records. Idempotent (both writers
   * converge on the newest corpus) and never fatal. */
  private refreshPin(): void {
    const bundledAt = this.corpus.paths.meta?.bundledAt;
    if (!bundledAt) return;
    try {
      const manifest = this.read("philoscopia");
      if (!manifest?.referential || manifest.referential.syncedAt >= bundledAt) return;
      manifest.referential.syncedAt = bundledAt;
      if (this.corpus.paths.meta?.commit) manifest.referential.commit = this.corpus.paths.meta.commit;
      this.write("philoscopia", manifest);
    } catch (error) {
      console.error(`[philoscopia-mcp] referential pin not refreshed: ${(error as Error).message}`);
    }
  }

  // ── journal ────────────────────────────────────────────────────────────

  logSession(args: { slug: string; content: string; modalities?: string[]; touched?: string[] }): string {
    this.requireWorkspace();
    const date = new Date().toISOString().slice(0, 10);
    const name = `${date}-${args.slug}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
    let path = `journal/${name}.md`;
    let n = 2;
    while (existsSync(join(this.dir, path))) path = `journal/${name}-${n++}.md`;
    const frontmatter = [
      "---",
      `date: ${date}`,
      ...(args.modalities?.length ? [`modalities: [${args.modalities.join(", ")}]`] : []),
      ...(args.touched?.length ? [`touched: [${args.touched.join(", ")}]`] : []),
      "---",
      "",
    ].join("\n");
    mkdirSync(join(this.dir, "journal"), { recursive: true });
    writeFileSync(join(this.dir, path), `${frontmatter}${args.content.trim()}\n`);
    this.refreshPin();
    return path;
  }

  // ── compaction ─────────────────────────────────────────────────────────

  /** Only the files the format names are ever touched: a web vault's extras
   * (session.json, notes/, Inbox.md, Index.md, Sync report.md, README.md)
   * are invisible to compaction, as to every other write path. */
  compact(): Record<string, number> {
    this.requireWorkspace();
    const closed: Record<CollectionName, (item: any) => boolean> = {
      beliefs: (i) => i.status === "ABANDONED",
      inquiries: (i) => i.status === "RESOLVED",
      practices: () => false, // the format has no closed state for practices
      concepts: () => false,
      affinities: () => false,
    };
    const moved: Record<string, number> = {};
    for (const name of COLLECTIONS) {
      const items: any[] = this.read(name);
      const toArchive = items.filter(closed[name]);
      if (toArchive.length === 0) continue;
      mkdirSync(join(this.dir, "archive"), { recursive: true });
      const archiveFile = join(this.dir, "archive", `${name}.json`);
      const existing: any[] = existsSync(archiveFile) ? JSON.parse(readFileSync(archiveFile, "utf8")) : [];
      writeFileSync(archiveFile, `${JSON.stringify([...existing, ...toArchive], null, 2)}\n`);
      this.write(name, items.filter((i) => !closed[name](i)));
      moved[name] = toArchive.length;
    }
    this.refreshPin();
    return moved;
  }
}
