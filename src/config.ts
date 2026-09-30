import { loadPermit2BoundPolicy } from "./policy/load.js";
import type { SendPermit2BoundConfig } from "./types.js";

function env(key: string, fallback?: string): string | undefined {
  const v = process.env[key];
  if (v !== undefined && v !== "") return v;
  return fallback;
}

function intEnv(key: string, fallback: number): number {
  const v = env(key);
  if (v === undefined) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`${key} must be a number`);
  return n;
}

/**
 * Load process config from env.
 * Missing / schema-invalid policy → throw (exit non-zero before listen).
 */
export function loadConfig(): SendPermit2BoundConfig {
  const upstream =
    env("SEND_PERMIT2_BOUND_UPSTREAM_RPC") ??
    env("SEND_PERMIT2_BOUND_RPC_URL");
  if (!upstream) {
    throw new Error(
      "SEND_PERMIT2_BOUND_UPSTREAM_RPC is required (JSON-RPC URL behind send-permit2-bound)"
    );
  }

  const policyPath = env("SEND_PERMIT2_BOUND_POLICY_FILE");
  if (!policyPath) {
    throw new Error(
      "SEND_PERMIT2_BOUND_POLICY_FILE is required. Refusing to start without an explicit policy file (DC12)."
    );
  }

  const policy = loadPermit2BoundPolicy(policyPath);
  if (!policy.enabled) {
    console.error(
      "[send-permit2-bound] gate_disabled — policy.enabled=false; Permit2 checks skipped"
    );
  }

  return {
    listenHost: env("SEND_PERMIT2_BOUND_HOST") ?? "127.0.0.1",
    listenPort: intEnv("SEND_PERMIT2_BOUND_PORT", 8548),
    upstreamRpcUrl: upstream,
    policy,
    decisionLogPath: env("SEND_PERMIT2_BOUND_DECISION_LOG"),
  };
}
