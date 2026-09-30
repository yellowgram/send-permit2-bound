import type {
  Permit2BoundPolicy,
  Permit2Call,
  Permit2CheckResult,
  Permit2Leaf,
} from "./types.js";
import { UINT160_MAX, UINT256_MAX } from "./pins.js";

function pinForChain(
  policy: Permit2BoundPolicy,
  chainId: number | undefined
): string | undefined {
  if (chainId === undefined) return undefined;
  return policy.permit2ByChainId.get(String(chainId));
}

function checkTimeBound(
  value: bigint,
  maxExpiration: bigint,
  label: string
): Permit2CheckResult | null {
  // DC6: 1 <= value <= maxExpiration; 0 → over_cap under positive maxExpiration
  if (value < 1n || value > maxExpiration) {
    return {
      allow: false,
      code: "permit2_over_cap",
      reason: `Permit2 ${label} ${value} outside 1..maxExpiration(${maxExpiration})`,
    };
  }
  return null;
}

function checkLeafAmount(
  leaf: Permit2Leaf,
  policy: Permit2BoundPolicy,
  family: Permit2Call["family"]
): Permit2CheckResult | null {
  const amount = leaf.amount;
  if (family === "allowanceTransfer") {
    if (amount >= UINT160_MAX) {
      return {
        allow: false,
        code: "permit2_over_cap",
        reason: `Permit2 AllowanceTransfer amount ${amount} is uint160 max / over`,
      };
    }
  } else if (family === "signatureTransfer") {
    if (amount >= UINT256_MAX) {
      return {
        allow: false,
        code: "permit2_over_cap",
        reason: `Permit2 SignatureTransfer amount ${amount} is uint256 max`,
      };
    }
  }
  if (amount > policy.maxAmountRaw) {
    return {
      allow: false,
      code: "permit2_over_cap",
      reason: `Permit2 amount ${amount} over maxAmountRaw ${policy.maxAmountRaw}`,
    };
  }
  return null;
}

function checkLeafSpender(
  leaf: Permit2Leaf,
  policy: Permit2BoundPolicy
): Permit2CheckResult | null {
  if (leaf.spender === undefined) return null; // SignatureTransfer: not in calldata
  const s = leaf.spender.toLowerCase();
  if (policy.spenders.size === 0 || !policy.spenders.has(s)) {
    return {
      allow: false,
      code: "permit2_spender_denied",
      reason: `Permit2 spender ${s} not allowlisted`,
    };
  }
  return null;
}

/**
 * Pure Permit2-bound check. No network / eth_call / oracle.
 * Any failing batch leaf denies the entire call (DC4).
 */
export function evaluatePermit2Bound(
  policy: Permit2BoundPolicy,
  call: Permit2Call
): Permit2CheckResult {
  if (!policy.enabled || !call.isPermit2Selector) {
    return { allow: true, kind: call.kind };
  }

  if (call.undecodable) {
    return {
      allow: false,
      code: "permit2_undecodable",
      reason: "Permit2-shaped calldata undecodable",
      kind: call.kind,
    };
  }

  const to = call.to?.toLowerCase();
  if (policy.requirePinnedTo) {
    const pinned = pinForChain(policy, call.chainId);
    if (!to || !pinned || to !== pinned) {
      return {
        allow: false,
        code: "permit2_unpinned",
        reason: "Permit2 selector to non-pinned address for chain",
        kind: call.kind,
      };
    }
  }

  if (!call.leaves || call.leaves.length === 0) {
    return {
      allow: false,
      code: "permit2_undecodable",
      reason: "Permit2-shaped calldata missing policy leaves",
      kind: call.kind,
    };
  }

  // DC4: any leaf over-cap / bad spender denies the whole call.
  for (const leaf of call.leaves) {
    const spend = checkLeafSpender(leaf, policy);
    if (spend) return { ...spend, kind: call.kind };

    const amt = checkLeafAmount(leaf, policy, call.family);
    if (amt) return { ...amt, kind: call.kind };

    if (leaf.expiration !== undefined) {
      const t = checkTimeBound(leaf.expiration, policy.maxExpiration, "expiration");
      if (t) return { ...t, kind: call.kind };
    }
  }

  if (call.sigDeadline !== undefined) {
    const t = checkTimeBound(
      call.sigDeadline,
      policy.maxExpiration,
      "sigDeadline"
    );
    if (t) return { ...t, kind: call.kind };
  }

  if (call.deadline !== undefined) {
    const t = checkTimeBound(call.deadline, policy.maxExpiration, "deadline");
    if (t) return { ...t, kind: call.kind };
  }

  return { allow: true, kind: call.kind };
}
