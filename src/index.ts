#!/usr/bin/env node
/**
 * send-permit2-bound CLI — JSON-RPC Permit2 calldata gate.
 * No key custody. No phishing UX. No simulation. See README + CHARTER.md.
 */
import { loadConfig } from "./config.js";
import { listen } from "./proxy/server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  await listen(config);
}

main().catch((err) => {
  console.error(
    "[send-permit2-bound] fatal:",
    err instanceof Error ? err.message : err
  );
  process.exit(1);
});
