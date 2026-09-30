import {
  SELECTOR_PERMIT2_APPROVE,
  SELECTOR_PERMIT2_PERMIT_BATCH,
  SELECTOR_PERMIT2_PERMIT_SINGLE,
  SELECTOR_PERMIT2_PERMIT_TRANSFER_FROM,
  SELECTOR_PERMIT2_PERMIT_TRANSFER_FROM_BATCH,
  SELECTOR_PERMIT2_PERMIT_WITNESS_TRANSFER_FROM,
  UINT160_MAX,
  UINT256_MAX,
  PERMIT2_ETH_MAINNET,
  PERMIT2_ZKSYNC,
} from "../src/pins.js";
import {
  defaultPermit2BoundPolicy,
  type Permit2BoundPolicy,
} from "../src/types.js";
import { type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const SPENDER_OK = "0x1111111111111111111111111111111111111111";
export const SPENDER_BAD = "0x2222222222222222222222222222222222222222";
export const OTHER = "0x3333333333333333333333333333333333333333";
export const TOKEN = "0x4444444444444444444444444444444444444444";
export const OWNER = "0x5555555555555555555555555555555555555555";
export const RECIPIENT = "0x6666666666666666666666666666666666666666";

export { PERMIT2_ETH_MAINNET, PERMIT2_ZKSYNC, UINT160_MAX, UINT256_MAX };

/** Anvil/Hardhat account #0 — public test key only. */
export const TEST_PK =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;

export const UNDECODABLE_RAW = "0xdeadbeef" as Hex;

export function addrWord(addr: string): string {
  return addr.replace(/^0x/i, "").toLowerCase().padStart(64, "0");
}
export function uintWord(n: bigint): string {
  return n.toString(16).padStart(64, "0");
}
/** Dirty high-byte address word (non-canonical padding). */
export function dirtyAddrWord(addr: string): string {
  return (
    "000000000000000000000001" +
    addr.replace(/^0x/i, "").toLowerCase().padStart(40, "0")
  );
}

export function encodePermit2Approve(
  token: string,
  spender: string,
  amount: bigint,
  expiration: bigint
): string {
  return (
    SELECTOR_PERMIT2_APPROVE +
    addrWord(token) +
    addrWord(spender) +
    uintWord(amount) +
    uintWord(expiration)
  );
}

export function encodePermit2ApproveDirtySpender(
  token: string,
  spender: string,
  amount: bigint,
  expiration: bigint
): string {
  return (
    SELECTOR_PERMIT2_APPROVE +
    addrWord(token) +
    dirtyAddrWord(spender) +
    uintWord(amount) +
    uintWord(expiration)
  );
}

/** PermitSingle — static tuple inlined after owner. */
export function encodePermitSingle(opts: {
  owner?: string;
  token?: string;
  amount: bigint;
  expiration: bigint;
  nonce?: bigint;
  spender: string;
  sigDeadline: bigint;
  signatureHex?: string;
}): string {
  const owner = opts.owner ?? OWNER;
  const token = opts.token ?? TOKEN;
  const nonce = opts.nonce ?? 1n;
  const sig = opts.signatureHex ?? "ab".repeat(65);
  const sigLen = BigInt(sig.length / 2);
  // words: owner,token,amount,exp,nonce,spender,sigDeadline,sigOffset(=0x100)
  return (
    SELECTOR_PERMIT2_PERMIT_SINGLE +
    addrWord(owner) +
    addrWord(token) +
    uintWord(opts.amount) +
    uintWord(opts.expiration) +
    uintWord(nonce) +
    addrWord(opts.spender) +
    uintWord(opts.sigDeadline) +
    uintWord(0x100n) +
    uintWord(sigLen) +
    sig.padEnd(Math.ceil(sig.length / 64) * 64, "0")
  );
}

/** PermitBatch with N details leaves (shared spender). */
export function encodePermitBatch(opts: {
  owner?: string;
  spender: string;
  sigDeadline: bigint;
  details: Array<{
    token?: string;
    amount: bigint;
    expiration: bigint;
    nonce?: bigint;
  }>;
  signatureHex?: string;
}): string {
  const owner = opts.owner ?? OWNER;
  const n = opts.details.length;
  const sig = opts.signatureHex ?? "ab".repeat(65);
  const sigLen = BigInt(sig.length / 2);

  // Head: owner, offset_batch(=0x60), offset_sig
  // Batch at word 3: offset_details(=0x60 from batch = word 3+3=6), spender, sigDeadline
  // Details at word 6: length, then n*(token,amount,exp,nonce)
  // Sig after details
  const detailsWords = 1 + n * 4;
  const batchWords = 3; // offset_details, spender, sigDeadline
  // head = 3 words; batch starts at word 3; details at word 6; sig after
  const sigWordIndex = 3 + batchWords + detailsWords; // = 6 + detailsWords
  const sigOffsetBytes = BigInt(sigWordIndex * 32);

  let body =
    addrWord(owner) +
    uintWord(0x60n) + // offset to batch
    uintWord(sigOffsetBytes) + // offset to sig
    uintWord(0x60n) + // offset to details (relative to batch)
    addrWord(opts.spender) +
    uintWord(opts.sigDeadline) +
    uintWord(BigInt(n));

  let i = 0;
  for (const d of opts.details) {
    body +=
      addrWord(d.token ?? TOKEN) +
      uintWord(d.amount) +
      uintWord(d.expiration) +
      uintWord(d.nonce ?? BigInt(i + 1));
    i++;
  }

  body += uintWord(sigLen) + sig.padEnd(Math.ceil(sig.length / 64) * 64, "0");
  return SELECTOR_PERMIT2_PERMIT_BATCH + body;
}

export function encodePermitTransferFrom(opts: {
  token?: string;
  amount: bigint;
  nonce?: bigint;
  deadline: bigint;
  recipient?: string;
  requestedAmount?: bigint;
  owner?: string;
  signatureHex?: string;
}): string {
  const sig = opts.signatureHex ?? "ab".repeat(65);
  const sigLen = BigInt(sig.length / 2);
  return (
    SELECTOR_PERMIT2_PERMIT_TRANSFER_FROM +
    addrWord(opts.token ?? TOKEN) +
    uintWord(opts.amount) +
    uintWord(opts.nonce ?? 1n) +
    uintWord(opts.deadline) +
    addrWord(opts.recipient ?? RECIPIENT) +
    uintWord(opts.requestedAmount ?? opts.amount) +
    addrWord(opts.owner ?? OWNER) +
    uintWord(0x100n) +
    uintWord(sigLen) +
    sig.padEnd(Math.ceil(sig.length / 64) * 64, "0")
  );
}

export function encodePermitTransferFromBatch(opts: {
  amounts: bigint[];
  deadline: bigint;
  nonce?: bigint;
  owner?: string;
  signatureHex?: string;
}): string {
  const n = opts.amounts.length;
  const sig = opts.signatureHex ?? "ab".repeat(65);
  const sigLen = BigInt(sig.length / 2);

  // Head: offset_permit(=0x80), offset_td, owner, offset_sig
  // Permit at word 4: offset_permitted(=0x60), nonce, deadline → details at word 7
  // permitted: length + n*(token,amount)
  // We'll put transferDetails as empty-ish minimal after permitted, then sig
  const permitWords = 3 + 1 + n * 2; // offset+nonce+deadline + len + pairs
  // td: length + n*(to, requestedAmount)
  const tdWords = 1 + n * 2;
  const headWords = 4;
  const permitStart = headWords; // 4
  const tdStart = permitStart + permitWords;
  const sigStart = tdStart + tdWords;

  let body =
    uintWord(BigInt(permitStart * 32)) +
    uintWord(BigInt(tdStart * 32)) +
    addrWord(opts.owner ?? OWNER) +
    uintWord(BigInt(sigStart * 32)) +
    // permit
    uintWord(0x60n) + // offset to permitted relative to permit
    uintWord(opts.nonce ?? 1n) +
    uintWord(opts.deadline) +
    uintWord(BigInt(n));

  for (const amt of opts.amounts) {
    body += addrWord(TOKEN) + uintWord(amt);
  }

  // transferDetails
  body += uintWord(BigInt(n));
  for (const amt of opts.amounts) {
    body += addrWord(RECIPIENT) + uintWord(amt);
  }

  body += uintWord(sigLen) + sig.padEnd(Math.ceil(sig.length / 64) * 64, "0");
  return SELECTOR_PERMIT2_PERMIT_TRANSFER_FROM_BATCH + body;
}

export function encodePermitWitnessTransferFrom(opts: {
  amount: bigint;
  deadline: bigint;
}): string {
  // Shared static prefix (7 words) + dummy dynamic offsets
  const sig = "ab".repeat(65);
  return (
    SELECTOR_PERMIT2_PERMIT_WITNESS_TRANSFER_FROM +
    addrWord(TOKEN) +
    uintWord(opts.amount) +
    uintWord(1n) +
    uintWord(opts.deadline) +
    addrWord(RECIPIENT) +
    uintWord(opts.amount) +
    addrWord(OWNER) +
    uintWord(0n) + // witness bytes32
    uintWord(0x120n) + // string offset
    uintWord(0x160n) + // sig offset
    uintWord(0n) + // string len 0
    uintWord(65n) +
    sig.padEnd(128, "0")
  );
}

export function examplePolicy(opts?: {
  chainId?: number;
  pin?: string;
  maxAmountRaw?: bigint;
  maxExpiration?: bigint;
  spenders?: string[];
  requirePinnedTo?: boolean;
  enabled?: boolean;
}): Permit2BoundPolicy {
  const p = defaultPermit2BoundPolicy();
  const chainId = opts?.chainId ?? 1;
  const pin = (opts?.pin ?? PERMIT2_ETH_MAINNET).toLowerCase();
  p.permit2ByChainId = new Map([[String(chainId), pin]]);
  p.spenders = new Set(
    (opts?.spenders ?? [SPENDER_OK]).map((s) => s.toLowerCase())
  );
  p.maxAmountRaw = opts?.maxAmountRaw ?? 1000n;
  p.maxExpiration = opts?.maxExpiration ?? 2_000_000_000n;
  p.requirePinnedTo = opts?.requirePinnedTo ?? true;
  p.enabled = opts?.enabled ?? true;
  return p;
}

/** Sign an EIP-1559 raw tx offline (no RPC). */
export async function signRaw(opts: {
  to?: Hex;
  data?: Hex;
  value?: bigint;
  nonce?: number;
  chainId?: number;
}): Promise<Hex> {
  const account = privateKeyToAccount(TEST_PK);
  return account.signTransaction({
    to: opts.to,
    data: opts.data ?? "0x",
    value: opts.value ?? 0n,
    nonce: opts.nonce ?? 0,
    gas: 100000n,
    maxFeePerGas: 1_000_000_000n,
    maxPriorityFeePerGas: 1_000_000_000n,
    chainId: opts.chainId ?? 1,
    type: "eip1559",
  });
}
