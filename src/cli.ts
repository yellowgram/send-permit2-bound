import { PACKAGE_VERSION } from "./version.js";

/** What the command line asked for. Parsing never reads the environment, so --help needs no config. */
export type CliCommand = { kind: "run" } | { kind: "help" } | { kind: "version" } | { kind: "error"; message: string };

export function parseCli(argv: readonly string[]): CliCommand {
  if (argv.length === 0) return { kind: "run" };
  if (argv.length === 1 && (argv[0] === "--help" || argv[0] === "-h")) return { kind: "help" };
  if (argv.length === 1 && (argv[0] === "--version" || argv[0] === "-v")) return { kind: "version" };
  return { kind: "error", message: `unknown argument ${JSON.stringify(argv[0])}; run send-permit2-bound --help` };
}

export const HELP = `send-permit2-bound ${PACKAGE_VERSION}: DEPRECATED. It gets no security fixes; it is merged into l2-send-guard 1.x.
Migrate: https://github.com/yellowgram/l2-safety-proxy#migrating

JSON-RPC gate that bounds Permit2 approvals in transaction calldata.

Usage:
  send-permit2-bound             start the gate (configured by the environment below)
  send-permit2-bound --help      show this help (also -h)
  send-permit2-bound --version   print the version (also -v)

Environment:
  SEND_PERMIT2_BOUND_UPSTREAM_RPC  required. JSON-RPC URL behind the gate (alias SEND_PERMIT2_BOUND_RPC_URL)
  SEND_PERMIT2_BOUND_POLICY_FILE   required. Policy JSON; the gate refuses to start without it
  SEND_PERMIT2_BOUND_HOST          listen host (default 127.0.0.1)
  SEND_PERMIT2_BOUND_PORT          listen port (default 8548)
  SEND_PERMIT2_BOUND_DECISION_LOG  append one JSON line per decision to this file
`;

/**
 * End the process with `code` after pending output is written. Setting exitCode instead of
 * calling process.exit() lets the deprecation warning (emitted on the next tick) reach stderr.
 * The unref'd timer only matters if some handle would keep the process alive.
 */
export function exitSoon(code: number): void {
  process.exitCode = code;
  setTimeout(() => process.exit(code), 2000).unref();
}
