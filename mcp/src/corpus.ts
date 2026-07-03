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
      pickLocale(entity.label ?? entity.name ?? entity.term ?? entity.title, locale) ?? entity.id;
    const haystackParts: string[] = [entity.id, name];
    if (entity.question) haystackParts.push(pickLocale(entity.question, locale));
    if (entity.definition) haystackParts.push(pickLocale(entity.definition, locale));
    if (entity.summary) haystackParts.push(pickLocale(entity.summary, locale));
    if (entity.poles) {
      for (const pole of entity.poles) haystackParts.push(pickLocale(pole.label, locale));
    }
    if (fold(haystackParts.join(" | ")).includes(needle)) {
      const hint = entity.question
        ? pickLocale(entity.question, locale)
        : entity.tagline
          ? pickLocale(entity.tagline, locale)
          : undefined;
      results.push({ ref, name, hint });
    }
  }
  return results;
}

/** The compact axes digest: everything an agent needs to pick an axis. */
export function axesDigest(corpus: Corpus, locale: Locale, relation?: string) {
  return [...corpus.axes.values()]
    .filter((axis) => !relation || axis.relation === relation)
    .map((axis) => ({
      id: axis.id,
      relation: axis.relation,
      territory: axis.territory,
      layer: axis.layer,
      type: axis.type,
      core: axis.core,
      label: pickLocale(axis.label, locale),
      question: pickLocale(axis.question, locale),
      poles: axis.poles.map((p: any) => ({ id: p.id, label: pickLocale(p.label, locale) })),
      ...(axis.medianLabel ? { median: pickLocale(axis.medianLabel, locale) } : {}),
    }));
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
