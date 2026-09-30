import { decodePermit2Calldata } from "./decode.js";
import { evaluatePermit2Bound } from "./evaluate.js";
import type { Permit2BoundPolicy, Permit2CheckResult } from "./types.js";

export interface Permit2GateInput {
  to?: string | null;
  data?: string | null;
  chainId?: number;
  typedLinkageOk?: boolean;
}

/**
 * Compose-friendly gate: decode → evaluate. Fail-closed on definite deny.
 * Evaluate stays pure; no import of sibling policy engines.
 */
export function gatePermit2Bound(
  policy: Permit2BoundPolicy,
  input: Permit2GateInput
): Permit2CheckResult {
  const call = decodePermit2Calldata(input.to, input.data, input.chainId);
  if (input.typedLinkageOk !== undefined) {
    call.typedLinkageOk = input.typedLinkageOk;
  }
  return evaluatePermit2Bound(policy, call);
}
