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
import { registerPrompts } from "./prompts.js";
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
  // The workspace's user block (expertise, goals, motivations) rides along
  // with the guide so every session opens in the right register, even before
  // any tool call.
  let userContext = "";
  if (ws.exists()) {
    try {
      const manifest = ws.manifest();
      locale = manifest.locale === "fr" ? "fr" : "en";
      const user = manifest.user;
      if (user) {
        const parts = [
          ...(user.expertise ? [`expertise: ${user.expertise}`] : []),
          ...(user.goals ? [`goals: ${user.goals}`] : []),
          ...(user.motivations ? [`motivations: ${user.motivations}`] : []),
        ];
        if (parts.length > 0) {
          userContext = `\n\n${
            locale === "fr"
              ? "QUI EXPLORE (bloc user du workspace ; registre à adapter en conséquence, voir RÈGLES DE SOIN)"
              : "WHO IS EXPLORING (the workspace's user block; adapt the register accordingly, see RULES OF CARE)"
          }\n- ${parts.join("\n- ")}`;
        }
      }
    } catch {
      // unreadable manifest: keep the flag/default
    }
  }

  const server = new McpServer(
    { name: "philoscopia", version: "0.1.0" },
    { instructions: GUIDE[locale] + userContext },
  );
  registerTools(server, corpus, ws, locale);
  registerPrompts(server, locale);

  await server.connect(new StdioServerTransport());
  console.error(
    `[philoscopia-mcp] serving ${corpus.axes.size} axes · workspace: ${workspaceDir} (${ws.exists() ? "found" : "not initialized"}) · locale: ${locale}`,
  );
}

main().catch((error) => {
  console.error(`[philoscopia-mcp] fatal: ${(error as Error).message}`);
  process.exit(1);
});
