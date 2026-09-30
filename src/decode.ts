import type { Permit2Call, Permit2Kind, Permit2Leaf } from "./types.js";
import {
  P0_PERMIT2_SELECTORS,
  SELECTOR_PERMIT2_APPROVE,
  SELECTOR_PERMIT2_PERMIT_BATCH,
  SELECTOR_PERMIT2_PERMIT_SINGLE,
  SELECTOR_PERMIT2_PERMIT_TRANSFER_FROM,
  SELECTOR_PERMIT2_PERMIT_TRANSFER_FROM_BATCH,
  SELECTOR_PERMIT2_PERMIT_WITNESS_TRANSFER_FROM,
  SELECTOR_PERMIT2_PERMIT_WITNESS_TRANSFER_FROM_ALT,
} from "./pins.js";

function strip0x(hex: string): string {
  return hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
}

/** Canonical ABI address word: 24 zero hex + 20-byte address. Dirty high bytes → undefined. */
function canonicalAddr(word: string): string | undefined {
  if (word.length !== 64) return undefined;
  if (!/^[0-9a-f]{64}$/.test(word)) return undefined;
  if (word.slice(0, 24) !== "0".repeat(24)) return undefined;
  return "0x" + word.slice(24);
}

function parseUint(word: string): bigint | undefined {
  if (word.length !== 64) return undefined;
  if (!/^[0-9a-f]{64}$/.test(word)) return undefined;
  try {
    return BigInt("0x" + word);
  } catch {
    return undefined;
  }
}

function wordAt(body: string, index: number): string | undefined {
  const start = index * 64;
  if (body.length < start + 64) return undefined;
  return body.slice(start, start + 64);
}

function offsetWords(body: string, wordIndex: number): number | undefined {
  const w = wordAt(body, wordIndex);
  if (!w) return undefined;
  const n = parseUint(w);
  if (n === undefined) return undefined;
  if (n % 32n !== 0n) return undefined;
  const bytes = Number(n);
  if (!Number.isSafeInteger(bytes)) return undefined;
  return bytes / 32;
}

function base(
  kind: Permit2Kind,
  family: Permit2Call["family"],
  to?: string | null
): Permit2Call {
  return {
    kind,
    family,
    isPermit2Selector: kind !== "other",
    to: to ? to.toLowerCase() : undefined,
    leaves: [],
  };
}

function undecodable(
  kind: Permit2Kind,
  family: Permit2Call["family"],
  to?: string | null
): Permit2Call {
  return { ...base(kind, family, to), undecodable: true };
}

function decodeApprove(body: string, to?: string | null): Permit2Call {
  const kind = "approve" as const;
  const family = "allowanceTransfer" as const;
  // token, spender, amount, expiration
  if (body.length < 256) return undecodable(kind, family, to);
  const token = canonicalAddr(body.slice(0, 64));
  const spender = canonicalAddr(body.slice(64, 128));
  const amount = parseUint(body.slice(128, 192));
  const expiration = parseUint(body.slice(192, 256));
  if (!token || !spender || amount === undefined || expiration === undefined) {
    return undecodable(kind, family, to);
  }
  const leaf: Permit2Leaf = { spender, amount, expiration };
  return { ...base(kind, family, to), leaves: [leaf] };
}

/** PermitSingle: static tuple inlined after owner. */
function decodePermitSingle(body: string, to?: string | null): Permit2Call {
  const kind = "permitSingle" as const;
  const family = "allowanceTransfer" as const;
  // owner, token, amount, expiration, nonce, spender, sigDeadline, sigOffset (+ sig)
  if (body.length < 512) return undecodable(kind, family, to);
  const owner = canonicalAddr(wordAt(body, 0)!);
  const token = canonicalAddr(wordAt(body, 1)!);
  const amount = parseUint(wordAt(body, 2)!);
  const expiration = parseUint(wordAt(body, 3)!);
  const nonce = parseUint(wordAt(body, 4)!);
  const spender = canonicalAddr(wordAt(body, 5)!);
  const sigDeadline = parseUint(wordAt(body, 6)!);
  if (
    !owner ||
    !token ||
    amount === undefined ||
    expiration === undefined ||
    nonce === undefined ||
    !spender ||
    sigDeadline === undefined
  ) {
    return undecodable(kind, family, to);
  }
  return {
    ...base(kind, family, to),
    leaves: [{ spender, amount, expiration }],
    sigDeadline,
  };
}

/** PermitBatch: owner + offsets; batch has details[] + spender + sigDeadline. */
function decodePermitBatch(body: string, to?: string | null): Permit2Call {
  const kind = "permitBatch" as const;
  const family = "allowanceTransfer" as const;
  if (body.length < 192) return undecodable(kind, family, to);

  const owner = canonicalAddr(wordAt(body, 0)!);
  if (!owner) return undecodable(kind, family, to);

  const batchWord = offsetWords(body, 1);
  const _sigWord = offsetWords(body, 2);
  if (batchWord === undefined || _sigWord === undefined) {
    return undecodable(kind, family, to);
  }

  // At batch: offset_to_details, spender, sigDeadline
  const detailsOffRel = offsetWords(body, batchWord);
  const spender = canonicalAddr(wordAt(body, batchWord + 1)!);
  const sigDeadline = parseUint(wordAt(body, batchWord + 2)!);
  if (
    detailsOffRel === undefined ||
    !spender ||
    sigDeadline === undefined
  ) {
    return undecodable(kind, family, to);
  }

  const detailsAbs = batchWord + detailsOffRel;
  const lenWord = wordAt(body, detailsAbs);
  if (!lenWord) return undecodable(kind, family, to);
  const len = parseUint(lenWord);
  if (len === undefined || len < 1n || len > 256n) {
    return undecodable(kind, family, to);
  }
  const n = Number(len);
  const leaves: Permit2Leaf[] = [];
  for (let i = 0; i < n; i++) {
    const baseIdx = detailsAbs + 1 + i * 4;
    const token = canonicalAddr(wordAt(body, baseIdx)!);
    const amount = parseUint(wordAt(body, baseIdx + 1)!);
    const expiration = parseUint(wordAt(body, baseIdx + 2)!);
    const nonce = parseUint(wordAt(body, baseIdx + 3)!);
    if (
      !token ||
      amount === undefined ||
      expiration === undefined ||
      nonce === undefined
    ) {
      return undecodable(kind, family, to);
    }
    leaves.push({ spender, amount, expiration });
  }

  return { ...base(kind, family, to), leaves, sigDeadline };
}

/** SignatureTransfer single: static permit + transferDetails + owner + sig. */
function decodePermitTransferFrom(
  body: string,
  to?: string | null
): Permit2Call {
  const kind = "permitTransferFrom" as const;
  const family = "signatureTransfer" as const;
  // token, amount, nonce, deadline, to, requestedAmount, owner, sigOffset
  if (body.length < 512) return undecodable(kind, family, to);
  const token = canonicalAddr(wordAt(body, 0)!);
  const amount = parseUint(wordAt(body, 1)!);
  const nonce = parseUint(wordAt(body, 2)!);
  const deadline = parseUint(wordAt(body, 3)!);
  const recipient = canonicalAddr(wordAt(body, 4)!);
  const requestedAmount = parseUint(wordAt(body, 5)!);
  const owner = canonicalAddr(wordAt(body, 6)!);
  if (
    !token ||
    amount === undefined ||
    nonce === undefined ||
    deadline === undefined ||
    !recipient ||
    requestedAmount === undefined ||
    !owner
  ) {
    return undecodable(kind, family, to);
  }
  // Spender is not in calldata (hash-bound / msg.sender). Bound permitted amount + deadline.
  return {
    ...base(kind, family, to),
    leaves: [{ amount }],
    deadline,
  };
}

/** SignatureTransfer batch. */
function decodePermitTransferFromBatch(
  body: string,
  to?: string | null
): Permit2Call {
  const kind = "permitTransferFromBatch" as const;
  const family = "signatureTransfer" as const;
  if (body.length < 256) return undecodable(kind, family, to);

  const permitOff = offsetWords(body, 0);
  const _tdOff = offsetWords(body, 1);
  const owner = canonicalAddr(wordAt(body, 2)!);
  const _sigOff = offsetWords(body, 3);
  if (
    permitOff === undefined ||
    _tdOff === undefined ||
    !owner ||
    _sigOff === undefined
  ) {
    return undecodable(kind, family, to);
  }

  // At permit: offset_to_permitted, nonce, deadline
  const permArrRel = offsetWords(body, permitOff);
  const nonce = parseUint(wordAt(body, permitOff + 1)!);
  const deadline = parseUint(wordAt(body, permitOff + 2)!);
  if (permArrRel === undefined || nonce === undefined || deadline === undefined) {
    return undecodable(kind, family, to);
  }

  const arrAbs = permitOff + permArrRel;
  const lenWord = wordAt(body, arrAbs);
  if (!lenWord) return undecodable(kind, family, to);
  const len = parseUint(lenWord);
  if (len === undefined || len < 1n || len > 256n) {
    return undecodable(kind, family, to);
  }
  const n = Number(len);
  const leaves: Permit2Leaf[] = [];
  for (let i = 0; i < n; i++) {
    const baseIdx = arrAbs + 1 + i * 2;
    const token = canonicalAddr(wordAt(body, baseIdx)!);
    const amount = parseUint(wordAt(body, baseIdx + 1)!);
    if (!token || amount === undefined) return undecodable(kind, family, to);
    leaves.push({ amount });
  }

  return { ...base(kind, family, to), leaves, deadline };
}

/**
 * Witness variants share static prefix: permit (4) + transferDetails (2) + owner (1).
 * Bound amount + deadline from that prefix; do not invent spender.
 */
function decodePermitWitnessTransferFrom(
  body: string,
  to?: string | null
): Permit2Call {
  const kind = "permitWitnessTransferFrom" as const;
  const family = "signatureTransfer" as const;
  if (body.length < 448) return undecodable(kind, family, to);
  const token = canonicalAddr(wordAt(body, 0)!);
  const amount = parseUint(wordAt(body, 1)!);
  const nonce = parseUint(wordAt(body, 2)!);
  const deadline = parseUint(wordAt(body, 3)!);
  const recipient = canonicalAddr(wordAt(body, 4)!);
  const requestedAmount = parseUint(wordAt(body, 5)!);
  const owner = canonicalAddr(wordAt(body, 6)!);
  if (
    !token ||
    amount === undefined ||
    nonce === undefined ||
    deadline === undefined ||
    !recipient ||
    requestedAmount === undefined ||
    !owner
  ) {
    return undecodable(kind, family, to);
  }
  return {
    ...base(kind, family, to),
    leaves: [{ amount }],
    deadline,
  };
}

/**
 * Decode P0 Permit2 calldata. Non-P0 selector → kind "other" (pass-through).
 * Incomplete / non-canonical → undecodable (never invent amount/expiration 0).
 */
export function decodePermit2Calldata(
  to: string | undefined | null,
  data: string | undefined | null,
  chainId?: number
): Permit2Call {
  if (!data || data === "0x" || data === "0X") {
    return { ...base("other", "none", to), chainId };
  }
  const hex = strip0x(data).toLowerCase();
  if (hex.length < 8) {
    return { ...base("other", "none", to), chainId };
  }
  const selector = "0x" + hex.slice(0, 8);
  const body = hex.slice(8);

  if (!P0_PERMIT2_SELECTORS.has(selector)) {
    return { ...base("other", "none", to), chainId };
  }

  let call: Permit2Call;
  switch (selector) {
    case SELECTOR_PERMIT2_APPROVE:
      call = decodeApprove(body, to);
      break;
    case SELECTOR_PERMIT2_PERMIT_SINGLE:
      call = decodePermitSingle(body, to);
      break;
    case SELECTOR_PERMIT2_PERMIT_BATCH:
      call = decodePermitBatch(body, to);
      break;
    case SELECTOR_PERMIT2_PERMIT_TRANSFER_FROM:
      call = decodePermitTransferFrom(body, to);
      break;
    case SELECTOR_PERMIT2_PERMIT_TRANSFER_FROM_BATCH:
      call = decodePermitTransferFromBatch(body, to);
      break;
    case SELECTOR_PERMIT2_PERMIT_WITNESS_TRANSFER_FROM:
    case SELECTOR_PERMIT2_PERMIT_WITNESS_TRANSFER_FROM_ALT:
      call = decodePermitWitnessTransferFrom(body, to);
      break;
    default:
      call = undecodable("other", "none", to);
      call.isPermit2Selector = true;
  }
  if (chainId !== undefined) call.chainId = chainId;
  return call;
}
