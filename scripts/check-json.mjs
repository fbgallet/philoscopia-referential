// Dependency-free sanity check of the exported corpus, run in CI on every
// push and PR. It is intentionally lighter than the full validation of the
// source monorepo (Zod schemas, referential integrity, graph acyclicity):
// it catches what a hand-edit or a broken export would most likely break.
//
//   node scripts/check-json.mjs
//
// Checks: valid JSON, file name matches the entity id, bilingual completeness
// (every localized object carries both `fr` and `en`), balanced semantic tags.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const DATA_DIR = fileURLToPath(new URL("../data", import.meta.url));

const TAG_NAMES = [
  "c", "ph", "mv", "chr", "ax", "te", "w",
  "th", "bel", "arg", "obj", "pb", "stk", "dif", "ex", "ety", "per", "q", "kw",
];
const TAG_RE = new RegExp(`</?(${TAG_NAMES.join("|")})(?:\\s[^<>]*)?>`, "g");

const errors = [];
const error = (file, message) => errors.push(`${file} — ${message}`);

function checkTagsBalanced(file, text, where) {
  const stack = [];
  for (const match of text.matchAll(TAG_RE)) {
    const closing = match[0].startsWith("</");
    const name = match[1];
    if (!closing) {
      stack.push(name);
    } else if (stack.pop() !== name) {
      error(file, `${where}: unbalanced </${name}>`);
      return;
    }
  }
  if (stack.length > 0) error(file, `${where}: unclosed <${stack[stack.length - 1]}>`);
}

function walk(file, value, path) {
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => walk(file, item, `${path}[${i}]`));
    return;
  }
  const hasFr = typeof value.fr === "string";
  const hasEn = typeof value.en === "string";
  if (hasFr || hasEn) {
    if (!hasFr) error(file, `${path}: missing "fr" version`);
    if (!hasEn) error(file, `${path}: missing "en" version`);
    if (hasFr) checkTagsBalanced(file, value.fr, `${path}.fr`);
    if (hasEn) checkTagsBalanced(file, value.en, `${path}.en`);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    walk(file, child, path ? `${path}.${key}` : key);
  }
}

let count = 0;
for (const type of readdirSync(DATA_DIR)) {
  if (type.startsWith(".")) continue;
  for (const name of readdirSync(join(DATA_DIR, type))) {
    if (!name.endsWith(".json")) continue;
    const file = `${type}/${name}`;
    count += 1;
    let entity;
    try {
      entity = JSON.parse(readFileSync(join(DATA_DIR, type, name), "utf8"));
    } catch (cause) {
      error(file, `invalid JSON: ${cause.message}`);
      continue;
    }
    if (typeof entity.id === "string") {
      // Axis ids are UPPER_SNAKE; every other id is already the kebab slug.
      const expected = `${entity.id.toLowerCase().replace(/_/g, "-")}.json`;
      if (name !== expected) error(file, `file name should be ${expected} (id "${entity.id}")`);
    }
    walk(file, entity, "");
  }
}

for (const message of errors) console.log(`✖ ${message}`);
console.log(`\n${count} files checked, ${errors.length} error(s).`);
if (errors.length > 0) process.exit(1);
