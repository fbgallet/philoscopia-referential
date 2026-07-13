// Corpus access: loads the open referential (data/) into memory and answers
// the referential-side tools. The corpus is resolved from the npm bundle
// (mcp/corpus/data, created at pack time) or, when running inside the repo,
// from the repo's own data/ directory.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export type Locale = "fr" | "en";

/** mcp/ package root (dist/ lives directly under it). */
const PKG_ROOT = fileURLToPath(new URL("..", import.meta.url));

export interface CorpusPaths {
  data: string;
  schemas: string;
  meta?: { commit?: string; bundledAt?: string };
}

export function resolveCorpusPaths(): CorpusPaths {
  const bundled = join(PKG_ROOT, "corpus");
  if (existsSync(join(bundled, "data"))) {
    let meta: CorpusPaths["meta"];
    const metaFile = join(bundled, "corpus-meta.json");
    if (existsSync(metaFile)) meta = JSON.parse(readFileSync(metaFile, "utf8"));
    return { data: join(bundled, "data"), schemas: join(bundled, "schemas"), meta };
  }
  const inRepo = join(PKG_ROOT, "..");
  if (existsSync(join(inRepo, "data"))) {
    return { data: join(inRepo, "data"), schemas: join(inRepo, "schemas") };
  }
  throw new Error("Cannot locate the referential corpus (neither corpus/data nor ../data).");
}

const TYPE_DIRS = {
  ax: "axes",
  ph: "philosophers",
  mv: "movements",
  chr: "characters",
  c: "glossary",
  te: "thought-experiments",
  w: "works",
  arg: "arguments",
} as const;

export type RefPrefix = keyof typeof TYPE_DIRS;

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Corpus {
  paths: CorpusPaths;
  /** Entities keyed by prefixed ref (`ax:FREEDOM`, `ph:epictetus`…). */
  byRef: Map<string, any>;
  axes: Map<string, any>;
  foundations: any[];
  influences: any[];
  tensions: any[];
}

function loadDir(dir: string): any[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => JSON.parse(readFileSync(join(dir, name), "utf8")));
}

export function loadCorpus(): Corpus {
  const paths = resolveCorpusPaths();
  const byRef = new Map<string, any>();
  const axes = new Map<string, any>();
  for (const [prefix, dir] of Object.entries(TYPE_DIRS)) {
    for (const entity of loadDir(join(paths.data, dir))) {
      byRef.set(`${prefix}:${entity.id}`, entity);
      if (prefix === "ax") axes.set(entity.id, entity);
    }
  }
  // Axis sub-problems are addressable too (`problem:<id>` — the ref grammar of
  // inquiry anchors and provenance): each is registered with its home axis, so
  // search can FIND the problem behind a user's question and get_entity can
  // return it without shipping the whole axis map.
  for (const axis of axes.values()) {
    if (!Array.isArray(axis.problems)) continue;
    for (const problem of axis.problems) {
      byRef.set(`problem:${problem.id}`, { ...problem, axisId: axis.id, axisLabel: axis.label });
    }
  }
  // Each axis carries a compact list of its canonical arguments ({ref, kind,
  // on, claim}) so a host sees WHICH reasons/objections exist per pole before
  // fetching one — mirrors the web build's ax entities. Pole order, SUPPORTS
  // first; claims stay LocalizedText here (views flatten via pickLocale).
  const argumentRefsByAxis = new Map<string, any[]>();
  for (const [ref, entity] of byRef) {
    if (!ref.startsWith("arg:")) continue;
    const list = argumentRefsByAxis.get(entity.position.axisId) ?? [];
    list.push({ ref, kind: entity.kind, on: entity.position.poleId ?? "MEDIAN", claim: entity.claim });
    argumentRefsByAxis.set(entity.position.axisId, list);
  }
  for (const axis of axes.values()) {
    const list = argumentRefsByAxis.get(axis.id);
    if (!list?.length) continue;
    const rank = (a: any) =>
      a.on === "MEDIAN" ? axis.poles.length : axis.poles.findIndex((p: any) => p.id === a.on);
    axis.arguments = [...list].sort(
      (a, b) => rank(a) - rank(b) || (a.kind === b.kind ? 0 : a.kind === "SUPPORTS" ? -1 : 1),
    );
  }
  return {
    paths,
    byRef,
    axes,
    foundations: loadDir(join(paths.data, "foundations")),
    influences: loadDir(join(paths.data, "influences")),
    tensions: loadDir(join(paths.data, "tensions")),
  };
}

/** Deep-converts every `{fr, en}` LocalizedText into the chosen locale's string. */
export function pickLocale(value: any, locale: Locale): any {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => pickLocale(item, locale));
  if (typeof value.fr === "string" && typeof value.en === "string") {
    return value[locale] ?? value.en;
  }
  const out: Record<string, any> = {};
  for (const [key, child] of Object.entries(value)) out[key] = pickLocale(child, locale);
  return out;
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Naive but effective substring search across the whole corpus. */
export function searchCorpus(
  corpus: Corpus,
  query: string,
  locale: Locale,
  limit = 20,
): { ref: string; name: string; hint?: string }[] {
  const needle = fold(query);
  const results: { ref: string; name: string; hint?: string }[] = [];
  for (const [ref, entity] of corpus.byRef) {
    if (results.length >= limit) break;
    const name: string =
      pickLocale(
        entity.label ?? entity.name ?? entity.term ?? entity.title ?? entity.claim ?? entity.objectLabel,
        locale,
      ) ?? entity.id;
    const haystackParts: string[] = [entity.id, name];
    if (entity.question) haystackParts.push(pickLocale(entity.question, locale));
    if (entity.definition) haystackParts.push(pickLocale(entity.definition, locale));
    if (entity.summary) haystackParts.push(pickLocale(entity.summary, locale));
    // Problems: the one-sentence explicitation + the search-only keywords.
    if (entity.explicitation) haystackParts.push(pickLocale(entity.explicitation, locale));
    if (Array.isArray(entity.keywords)) {
      for (const keyword of entity.keywords) haystackParts.push(pickLocale(keyword, locale));
    }
    if (entity.poles && typeof entity.poles[0] === "object") {
      for (const pole of entity.poles) haystackParts.push(pickLocale(pole.label, locale));
    }
    // Arguments: the claim plus their position ids, so "objection FREEDOM"
    // or a pole name finds the canonical reasons.
    if (ref.startsWith("arg:")) {
      haystackParts.push(pickLocale(entity.claim, locale), entity.kind, entity.position.axisId, entity.position.poleId ?? "median");
    }
    if (fold(haystackParts.join(" | ")).includes(needle)) {
      const hint = entity.question
        ? pickLocale(entity.question, locale)
        : entity.explicitation
          ? pickLocale(entity.explicitation, locale)
          : entity.tagline
            ? pickLocale(entity.tagline, locale)
            : ref.startsWith("arg:") && entity.name
              ? pickLocale(entity.claim, locale)
              : undefined;
      results.push({ ref, name, hint });
    }
  }
  return results;
}

/** Relation order of the grouped digest (stable across calls). */
const RELATIONS = ["TRUTH", "SELF", "OTHERS", "WORLD"] as const;

/**
 * The compact axes digest, grouped by relation: everything an agent needs to
 * PICK an axis, nothing more (get_axis has the rest). Poles are compact
 * "POLE_ID: label" strings; the taxonomy fields (territory/layer/core/type)
 * stay out — the model never selects on them. Token discipline: this lands
 * verbatim in the host's context. Mirrors the web companion's digest.
 */
export function axesDigest(corpus: Corpus, locale: Locale, relation?: string) {
  const groups: Record<string, any[]> = Object.fromEntries(RELATIONS.map((r) => [r, []]));
  for (const axis of corpus.axes.values()) {
    (groups[axis.relation] ??= []).push({
      id: axis.id,
      label: pickLocale(axis.label, locale),
      question: pickLocale(axis.question, locale),
      poles: axis.poles.map((p: any) => `${p.id}: ${pickLocale(p.label, locale)}`),
      ...(axis.medianLabel ? { median: pickLocale(axis.medianLabel, locale) } : {}),
    });
  }
  return relation ? (groups[relation] ?? []) : groups;
}

// ── Scoped views (token discipline) ─────────────────────────────────────────
// Whatever a tool returns stays in the host's conversation context for good:
// the default views carry only what the current question can use, and the tool
// descriptions tell the model how to widen. All views take a pickLocale'd
// (locale-flattened) entity. Mirrors the web companion engine
// (philo-profiles apps/web/src/lib/companion/engine.ts) — keep both in sync.

/** Machine/authoring fields the model never uses. */
const MACHINE_FIELDS = ["updatedAt", "validation", "aliases"] as const;
/** Axis fields that serve the referential's taxonomy, never a conversation. */
const AXIS_MACHINE_FIELDS = ["clusters", "difficulty", "layer", "core", "territory"] as const;

export function stripMachineFields(flat: any, isAxis: boolean): any {
  const out = { ...flat };
  for (const key of MACHINE_FIELDS) delete out[key];
  if (isAxis) for (const key of AXIS_MACHINE_FIELDS) delete out[key];
  return out;
}

/** get_axis view: the axis minus its sub-problem map (80% of the file's
 * bytes); problemCount > 0 signals that get_axis_problems has material. */
export function axisView(flat: any): any {
  const { problems, ...rest } = stripMachineFields(flat, true);
  const count = Array.isArray(problems) ? problems.length : 0;
  return count > 0 ? { ...rest, problemCount: count } : rest;
}

/** Compact rendering of a PositionValue: "-0.6" (scalar) | "[0.7,0.3]" (weights). */
export const positionValueText = (value: any): string | null => {
  if (!value || typeof value !== "object") return null;
  if (typeof value.value === "number") return String(value.value);
  if (Array.isArray(value.weights)) return `[${value.weights.join(",")}]`;
  return JSON.stringify(value);
};

/** One position as a compact line (see POSITIONS_FORMAT) — repeated JSON keys
 * over ~40 entries are half a digest's weight, so text lines win. */
const positionLine = (entry: any): string => {
  const parts: string[] = [entry.axisId];
  const declared = positionValueText(entry.declaredValue);
  if (declared) parts.push(declared);
  const practiced = positionValueText(entry.practicedValue);
  if (practiced) parts.push(`practiced ${practiced}`);
  const status = [entry.status, entry.epistemicStatus].filter(Boolean).join("/");
  if (status) parts.push(status);
  if (entry.salience) parts.push(String(entry.salience));
  if (entry.note) parts.push(String(entry.note));
  return parts.join(" · ");
};

const POSITIONS_FORMAT =
  "AXIS_ID · value (scalar in [-1,1] | [pole weights]) · STATUS/EPISTEMIC · SALIENCE · note — justifications via get_position";

/** get_entity default view. Figures with positions are digested: summary and
 * voice dropped, entries rendered as compact lines WITHOUT their
 * justifications (get_position serves the ones actually discussed). Stubs
 * pass through whole (their summary is all they have). Axes as axisView. */
export function entityView(ref: string, flat: any): any {
  if (ref.startsWith("ax:")) return axisView(flat);
  if (ref.startsWith("problem:")) {
    // One sub-problem + its home axis; keywords are search-only synonyms.
    const { keywords: _keywords, ...rest } = flat;
    return stripMachineFields(rest, false);
  }
  if (ref.startsWith("arg:")) {
    // Response hints are position-scoring machinery, difficulty is site
    // taxonomy: neither serves a conversation (mirrors the web build's strip).
    const { difficulty: _difficulty, ...rest } = stripMachineFields(flat, false);
    if (Array.isArray(rest.responses)) {
      rest.responses = rest.responses.map(({ hints: _hints, ...response }: any) => response);
    }
    return rest;
  }
  if (!/^(ph|mv|chr):/.test(ref)) return stripMachineFields(flat, false);
  const clean = stripMachineFields(flat, false);
  if (!Array.isArray(clean.entries)) return clean;
  const { entries, summary: _summary, voice: _voice, ...identity } = clean;
  return { ...identity, positionsFormat: POSITIONS_FORMAT, positions: entries.map(positionLine) };
}

/** One figure's position on ONE axis: the scoped slice behind get_position. */
export function positionSlice(ref: string, flat: any, axisId: string): any {
  if (!Array.isArray(flat.entries)) {
    throw new Error(`"${ref}" has no per-axis positions. Use get_entity or get_axis instead.`);
  }
  const id = axisId.toUpperCase();
  const entry = flat.entries.find((e: any) => e?.axisId === id);
  if (!entry) {
    throw new Error(`"${ref}" has no recorded position on axis "${id}". Use get_entity for its digest.`);
  }
  const structuring = Array.isArray(flat.structuring)
    ? flat.structuring.find((s: any) => s?.axisId === id)
    : undefined;
  return {
    ref,
    name: flat.name ?? flat.label,
    axisId: id,
    position: entry,
    ...(structuring ? { structuring } : {}),
  };
}

/** Weight of one pole in a position value, following MODEL.md conventions. */
export function poleWeight(axis: any, value: any, poleId: string): number {
  const index = axis.poles.findIndex((p: any) => p.id === poleId);
  if (index < 0) return 0;
  if (value.kind === "scalar") {
    const share = (value.value + 1) / 2;
    if (index === 0) return 1 - share;
    if (index === axis.poles.length - 1) return share;
    return 0;
  }
  return value.weights[index] ?? 0;
}
