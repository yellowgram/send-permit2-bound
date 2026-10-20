#!/usr/bin/env node
import "./deprecated.js";
/**
 * send-permit2-bound CLI — JSON-RPC Permit2 calldata gate.
 * No key custody. No phishing UX. No simulation. Deprecated: use l2-send-guard.
 */
import { loadConfig } from "./config.js";
import { listen } from "./proxy/server.js";
import { exitSoon, HELP, parseCli } from "./cli.js";
import { PACKAGE_VERSION } from "./version.js";

async function main(): Promise<void> {
  const config = loadConfig();
  await listen(config);
}

const cmd = parseCli(process.argv.slice(2));
if (cmd.kind === "help") process.stdout.write(HELP);
else if (cmd.kind === "version") process.stdout.write(`${PACKAGE_VERSION}\n`);
else if (cmd.kind === "error") {
  console.error(`[send-permit2-bound] ${cmd.message}`);
  exitSoon(2);
} else {
  main().catch((err) => {
    console.error("[send-permit2-bound] fatal:", err instanceof Error ? err.message : err);
    exitSoon(1);
  });
}
