/** Closed deny-code set for P0 (DC13). */
export type Permit2DenyCode =
  | "permit2_unpinned"
  | "permit2_over_cap"
  | "permit2_spender_denied"
  | "permit2_undecodable"
  | "permit2_linkage_missing"
  | "tx_unparseable";

export type Permit2Kind =
  | "approve"
  | "permitSingle"
  | "permitBatch"
  | "permitTransferFrom"
  | "permitTransferFromBatch"
  | "permitWitnessTransferFrom"
  | "other";

export type Permit2Family = "allowanceTransfer" | "signatureTransfer" | "none";

/** One amount/expiration (or deadline) leaf to bound. */
export interface Permit2Leaf {
  /** Present on AllowanceTransfer paths; absent on SignatureTransfer (spender is msg.sender / hash-bound). */
  spender?: string;
  amount: bigint;
  /** AllowanceTransfer details.expiration or approve expiration. */
  expiration?: bigint;
}

export interface Permit2BoundPolicy {
  /** When false, gate is a no-op. Must be explicit in policy file. Never silent default. */
  enabled: boolean;
  /** chainId string → lowercased Permit2 address. Local pins only. */
  permit2ByChainId: Map<string, string>;
  /** Default true: P0 selector requires tx.to match pin for chainId. */
  requirePinnedTo: boolean;
  /** Lowercased spender allowlist. Non-empty required when enabled. */
  spenders: Set<string>;
  /** Raw integer cap (token smallest unit / uint160 path). */
  maxAmountRaw: bigint;
  /** Unix-seconds ceiling. Must be >= 1 at policy load (DC6). */
  maxExpiration: bigint;
  /** Optional typed linkage: attest→raw match only. */
  requireTypedLinkage: boolean;
}

export interface Permit2Call {
  kind: Permit2Kind;
  family: Permit2Family;
  isPermit2Selector: boolean;
  to?: string;
  chainId?: number;
  leaves: Permit2Leaf[];
  /** AllowanceTransfer permit sigDeadline — checked like expiration (DC3). */
  sigDeadline?: bigint;
  /** SignatureTransfer permit deadline. */
  deadline?: bigint;
  undecodable?: boolean;
  typedLinkageOk?: boolean;
}

export interface Permit2CheckResult {
  allow: boolean;
  code?: Permit2DenyCode;
  reason?: string;
  kind?: Permit2Kind;
}

export interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method: string;
  params?: unknown[];
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: string | number | null;
  result?: unknown;
  error?: JsonRpcError;
  sendPermit2Bound?: SendPermit2BoundResponseMeta;
}

export type Decision =
  | "forward"
  | "policy_denied"
  | "unsigned_refused"
  | "passthrough"
  | "create_forward";

export interface SendPermit2BoundResponseMeta {
  sendPermit2Bound: true;
  decision: Decision;
  policyCode: Permit2DenyCode | null;
  aborted: boolean;
  reason?: string;
}

export interface SendPermit2BoundConfig {
  listenHost: string;
  listenPort: number;
  upstreamRpcUrl: string;
  policy: Permit2BoundPolicy;
  decisionLogPath?: string;
}

/** Align with send-allow / send-approve-bound for unsigned refuse. */
export const ERR_UNSIGNED_SEND_REFUSED = -32081;
/** Permit2 deny + unparseable raw (this package only; not -32083/-32084/-32085). */
export const ERR_PERMIT2_DENIED = -32086;

export const SEND_METHODS = new Set([
  "eth_sendRawTransaction",
  "eth_sendRawTransactionSync",
]);

export const UNSIGNED_SEND_METHODS = new Set(["eth_sendTransaction"]);

export function defaultPermit2BoundPolicy(): Permit2BoundPolicy {
  return {
    enabled: true,
    permit2ByChainId: new Map(),
    requirePinnedTo: true,
    spenders: new Set(),
    maxAmountRaw: 0n,
    maxExpiration: 1n,
    requireTypedLinkage: false,
  };
}
