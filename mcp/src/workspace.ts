// User workspace (`my-philosophy/`): file persistence with JSON Schema
// validation on every write. Format: docs/user-workspace-format.md in the
// source monorepo; the published schemas under schemas/workspace/ are the
// contract this module enforces (plus the write-time rules JSON Schema cannot
// express: POSITIONED requires a value, values must fit the axis's shape).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Ajv2020, type ValidateFunction } from "ajv/dist/2020.js";
import { poleWeight, type Corpus, type Locale } from "./corpus.js";

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
    mkdirSync(join(this.dir, "journal"), { recursive: true });
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

  list(name: CollectionName, filter?: { status?: string; text?: string }): any[] {
    this.requireWorkspace();
    let items: any[] = this.read(name);
    if (filter?.status) items = items.filter((i) => i.status === filter.status);
    if (filter?.text) {
      const needle = filter.text.toLowerCase();
      items = items.filter((i) => JSON.stringify(i).toLowerCase().includes(needle));
    }
    return items;
  }

  add(name: CollectionName, entry: any): any {
    this.requireWorkspace();
    const items: any[] = this.read(name);
    const now = new Date().toISOString();
    if (!entry.id) {
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
    if (items.some((i) => i.id === entry.id)) throw new Error(`Duplicate id "${entry.id}" in ${name}.json.`);
    if (!entry.ref) {
      entry.createdAt ??= now;
      if (name !== "concepts" && name !== "affinities") entry.updatedAt ??= now;
    }
    this.checkRefs(entry);
    this.write(name, [...items, entry]);
    return entry;
  }

  update(name: CollectionName, id: string, patch: Record<string, any>): any {
    this.requireWorkspace();
    const items: any[] = this.read(name);
    const index = items.findIndex((i) => i.id === id || i.ref === id);
    if (index < 0) throw new Error(`No entry "${id}" in ${name}.json.`);
    const updated = { ...items[index], ...patch };
    for (const [key, value] of Object.entries(patch)) if (value === null && key !== "revisedFrom" && key !== "resolution") delete updated[key];
    if ("updatedAt" in items[index] || (name !== "concepts" && name !== "affinities" && !updated.ref)) {
      updated.updatedAt = new Date().toISOString();
    }
    this.checkRefs(updated);
    items[index] = updated;
    this.write(name, items);
    return updated;
  }

  /** Referential refs must resolve against the bundled corpus; problem refs
   * and workspace-local ids are checked loosely (existence where cheap). */
  private checkRefs(entry: any): void {
    const refs: string[] = [];
    for (const key of ["relatedAxes", "anchors", "grounds", "challengedBy", "inspiredBy", "relatedConcepts"]) {
      if (Array.isArray(entry[key])) refs.push(...entry[key]);
    }
    if (typeof entry.ref === "string") refs.push(entry.ref);
    for (const ref of refs) {
      const match = ref.match(/^(ax|pole|c|ph|mv|chr|te|w|problem):(.+)$/);
      if (!match) continue; // workspace-local id: resolution is the caller's business
      const [, prefix, rest] = match;
      if (prefix === "pole") {
        const [axisId, poleId] = rest.split("/");
        const axis = this.corpus.axes.get(axisId);
        if (!axis || !axis.poles.some((p: any) => p.id === poleId)) {
          throw new Error(`Ref "${ref}" does not resolve (unknown axis or pole).`);
        }
      } else if (prefix === "problem") {
        const found = [...this.corpus.axes.values()].some((axis) =>
          (axis.problems ?? []).some((pr: any) => pr.id === rest),
        );
        if (!found) throw new Error(`Ref "${ref}" does not resolve to any axis problem.`);
      } else if (!this.corpus.byRef.has(`${prefix}:${rest}`)) {
        throw new Error(`Ref "${ref}" does not resolve in the referential.`);
      }
    }
  }

  // ── journal ────────────────────────────────────────────────────────────

  logSession(args: { slug: string; content: string; modalities?: string[]; touched?: string[] }): string {
    this.requireWorkspace();
    const date = new Date().toISOString().slice(0, 10);
    const name = `${date}-${args.slug}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
    const path = `journal/${name}.md`;
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
    return path;
  }

  // ── compaction ─────────────────────────────────────────────────────────

  compact(): Record<string, number> {
    this.requireWorkspace();
    const closed: Record<CollectionName, (item: any) => boolean> = {
      beliefs: (i) => i.status === "SUPERSEDED" || i.status === "ABANDONED",
      inquiries: (i) => i.status === "RESOLVED",
      practices: (i) => i.consistency === "ABANDONED",
      concepts: () => false,
      affinities: () => false,
    };
    const moved: Record<string, number> = {};
    mkdirSync(join(this.dir, "archive"), { recursive: true });
    for (const name of COLLECTIONS) {
      const items: any[] = this.read(name);
      const toArchive = items.filter(closed[name]);
      if (toArchive.length === 0) continue;
      const archiveFile = join(this.dir, "archive", `${name}.json`);
      const existing: any[] = existsSync(archiveFile) ? JSON.parse(readFileSync(archiveFile, "utf8")) : [];
      writeFileSync(archiveFile, `${JSON.stringify([...existing, ...toArchive], null, 2)}\n`);
      this.write(name, items.filter((i) => !closed[name](i)));
      moved[name] = toArchive.length;
    }
    return moved;
  }
}
