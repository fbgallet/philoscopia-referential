// prepack: snapshot the repo's data/ and schemas/ into mcp/corpus/ so the npm
// package is fully offline. Each published version thereby pins one exact
// state of the referential (the workspace manifest records it).

import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = join(pkgRoot, "..");
const corpusDir = join(pkgRoot, "corpus");

rmSync(corpusDir, { recursive: true, force: true });
mkdirSync(corpusDir, { recursive: true });
cpSync(join(repoRoot, "data"), join(corpusDir, "data"), { recursive: true });
cpSync(join(repoRoot, "schemas"), join(corpusDir, "schemas"), { recursive: true });

let commit;
try {
  commit = execSync("git rev-parse --short HEAD", { cwd: repoRoot }).toString().trim();
} catch {
  // not a git checkout: leave commit undefined
}
writeFileSync(
  join(corpusDir, "corpus-meta.json"),
  `${JSON.stringify({ commit, bundledAt: new Date().toISOString() }, null, 2)}\n`,
);
console.log(`corpus bundled into mcp/corpus (commit ${commit ?? "unknown"})`);
