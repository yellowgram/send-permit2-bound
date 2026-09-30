import { readFileSync } from "node:fs";
import { getAddress } from "viem";
import {
  defaultPermit2BoundPolicy,
  type Permit2BoundPolicy,
} from "../types.js";

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
const RAW_INT_RE = /^(0|[1-9][0-9]*)$/;
const POS_INT_RE = /^[1-9][0-9]*$/;

function normKey(addr: string): string {
  return getAddress(addr).toLowerCase();
}

function isAddress(s: unknown): s is string {
  return typeof s === "string" && ADDR_RE.test(s);
}

function parseRawUint(v: unknown, label: string): bigint {
  if (typeof v !== "string") {
    throw new Error(
      `${label}: must be a decimal integer string (no 0x, no decimals, no scientific notation)`
    );
  }
  if (v.startsWith("0x") || v.startsWith("0X")) {
    throw new Error(`${label}: must not be hex (no 0x prefix)`);
  }
  if (v.includes(".") || v.includes("e") || v.includes("E") || v.includes("+")) {
    throw new Error(
      `${label}: must be a plain decimal integer (no decimals / scientific)`
    );
  }
  if (!RAW_INT_RE.test(v)) {
    throw new Error(
      `${label}: must be a decimal integer string (no leading zeros except 0)`
    );
  }
  try {
    return BigInt(v);
  } catch {
    throw new Error(`${label}: is not a valid integer`);
  }
}

function parsePositiveUint(v: unknown, label: string): bigint {
  if (typeof v !== "string" && typeof v !== "number") {
    throw new Error(`${label}: must be a positive decimal integer`);
  }
  const s = typeof v === "number" ? String(v) : v;
  if (typeof s !== "string" || !POS_INT_RE.test(s)) {
    throw new Error(
      `${label}: must be a positive integer (>= 1). maxExpiration: 0 is refused at policy load (DC6).`
    );
  }
  return BigInt(s);
}

interface PolicyFileJson {
  enabled?: unknown;
  permit2ByChainId?: unknown;
  requirePinnedTo?: unknown;
  spenders?: unknown;
  maxAmountRaw?: unknown;
  maxExpiration?: unknown;
}

/**
 * Validate and load a Permit2-bound policy document.
 * Schema-invalid / unreadable → throw (caller exits non-zero; never boot as allow).
 */
export function parsePermit2BoundPolicyDocument(
  json: unknown,
  source = "policy"
): Permit2BoundPolicy {
  if (json === null || typeof json !== "object" || Array.isArray(json)) {
    throw new Error(`${source}: root must be an object`);
  }
  const doc = json as PolicyFileJson;

  if (typeof doc.enabled !== "boolean") {
    throw new Error(
      `${source}: enabled must be an explicit boolean (DC12). Refusing to start.`
    );
  }

  if (
    doc.permit2ByChainId === undefined ||
    doc.permit2ByChainId === null ||
    typeof doc.permit2ByChainId !== "object" ||
    Array.isArray(doc.permit2ByChainId)
  ) {
    throw new Error(
      `${source}: permit2ByChainId must be an object keyed by chainId string`
    );
  }

  const permit2ByChainId = new Map<string, string>();
  for (const [chainKey, addr] of Object.entries(
    doc.permit2ByChainId as Record<string, unknown>
  )) {
    if (!/^[0-9]+$/.test(chainKey)) {
      throw new Error(
        `${source}: permit2ByChainId key ${chainKey} must be a decimal chainId`
      );
    }
    if (!isAddress(addr)) {
      throw new Error(
        `${source}: permit2ByChainId[${chainKey}] is not a 20-byte address`
      );
    }
    permit2ByChainId.set(chainKey, normKey(addr));
  }

  let requirePinnedTo = true;
  if (doc.requirePinnedTo !== undefined) {
    if (typeof doc.requirePinnedTo !== "boolean") {
      throw new Error(`${source}: requirePinnedTo must be a boolean`);
    }
    requirePinnedTo = doc.requirePinnedTo;
  }

  if (!Array.isArray(doc.spenders)) {
    throw new Error(`${source}: spenders must be an array of addresses`);
  }
  const spenders = new Set<string>();
  for (const s of doc.spenders) {
    if (!isAddress(s)) {
      throw new Error(
        `${source}: spenders entry is not an address: ${String(s)}`
      );
    }
    spenders.add(normKey(s));
  }

  if (doc.enabled && spenders.size === 0) {
    throw new Error(
      `${source}: spenders must be non-empty when enabled (DC9). Empty set is not allow-all.`
    );
  }

  if (doc.maxAmountRaw === undefined || doc.maxAmountRaw === null) {
    throw new Error(`${source}: maxAmountRaw is required`);
  }
  const maxAmountRaw = parseRawUint(doc.maxAmountRaw, `${source}.maxAmountRaw`);

  if (doc.maxExpiration === undefined || doc.maxExpiration === null) {
    throw new Error(`${source}: maxExpiration is required (positive unix seconds)`);
  }
  const maxExpiration = parsePositiveUint(
    doc.maxExpiration,
    `${source}.maxExpiration`
  );

  return {
    enabled: doc.enabled,
    permit2ByChainId,
    requirePinnedTo,
    spenders,
    maxAmountRaw,
    maxExpiration,
  };
}

export function loadPermit2BoundPolicyFile(path: string): Permit2BoundPolicy {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (err) {
    throw new Error(
      `Failed to load policy file ${path}: ${err instanceof Error ? err.message : String(err)}. Refusing to start — policy will not silently disable.`
    );
  }
  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch (err) {
    throw new Error(
      `Invalid JSON in policy file ${path}: ${err instanceof Error ? err.message : String(err)}. Refusing to start.`
    );
  }
  return parsePermit2BoundPolicyDocument(json, path);
}

export function loadPermit2BoundPolicy(
  filePath?: string
): Permit2BoundPolicy {
  if (!filePath) {
    return defaultPermit2BoundPolicy();
  }
  return loadPermit2BoundPolicyFile(filePath);
}
