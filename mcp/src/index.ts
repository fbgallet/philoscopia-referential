#!/usr/bin/env node
// philoscopia-mcp: MCP server over the Philoscopia referential + the user's
// local my-philosophy/ workspace. Everything runs locally; no network calls.
//
//   npx philoscopia-mcp [--workspace <dir>] [--locale fr|en]
//
// The workspace dir defaults to $PHILOSCOPIA_WORKSPACE, then ~/my-philosophy.
// The locale defaults to the workspace manifest's, then --locale, then "en".

import { homedir } from "node:os";
import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadCorpus, type Locale } from "./corpus.js";
import { GUIDE } from "./help.js";
import { registerTools } from "./tools.js";
import { Workspace } from "./workspace.js";

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const corpus = loadCorpus();

  const workspaceDir = resolve(
    argValue("--workspace") ?? process.env.PHILOSCOPIA_WORKSPACE ?? resolve(homedir(), "my-philosophy"),
  );
  const ws = new Workspace(workspaceDir, corpus);

  let locale = (argValue("--locale") as Locale) ?? "en";
  if (ws.exists()) {
    try {
      locale = ws.manifest().locale === "fr" ? "fr" : "en";
    } catch {
      // unreadable manifest: keep the flag/default
    }
  }

  const server = new McpServer(
    { name: "philoscopia", version: "0.1.0" },
    { instructions: GUIDE[locale] },
  );
  registerTools(server, corpus, ws, locale);

  await server.connect(new StdioServerTransport());
  console.error(
    `[philoscopia-mcp] serving ${corpus.axes.size} axes · workspace: ${workspaceDir} (${ws.exists() ? "found" : "not initialized"}) · locale: ${locale}`,
  );
}

main().catch((error) => {
  console.error(`[philoscopia-mcp] fatal: ${(error as Error).message}`);
  process.exit(1);
});
