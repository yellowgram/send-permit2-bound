import { appendFileSync } from "node:fs";
import type { Hex } from "viem";
import { parseRawTransaction } from "../raw.js";
import { gatePermit2Bound } from "../gate.js";
import {
  ERR_PERMIT2_DENIED,
  ERR_UNSIGNED_SEND_REFUSED,
  SEND_METHODS,
  UNSIGNED_SEND_METHODS,
  type Permit2DenyCode,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type SendPermit2BoundConfig,
  type SendPermit2BoundResponseMeta,
} from "../types.js";

export interface HandlerDeps {
  forward?: (
    url: string,
    body: JsonRpcRequest
  ) => Promise<JsonRpcResponse>;
  /** Optional typed-linkage attestation for the raw being submitted. */
  typedLinkageOk?: boolean;
}

async function forwardRaw(
  url: string,
  body: JsonRpcRequest
): Promise<JsonRpcResponse> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as JsonRpcResponse;
}

function writeLog(
  config: SendPermit2BoundConfig,
  method: string,
  meta: SendPermit2BoundResponseMeta,
  code: number | null
): void {
  if (!config.decisionLogPath) return;
  try {
    appendFileSync(
      config.decisionLogPath,
      JSON.stringify({
        ts: new Date().toISOString(),
        method,
        code,
        ...meta,
      }) + "\n"
    );
  } catch {
    // never brick the send path on log I/O
  }
}

function denied(
  config: SendPermit2BoundConfig,
  req: JsonRpcRequest,
  opts: { code: Permit2DenyCode; reason: string }
): JsonRpcResponse {
  const meta: SendPermit2BoundResponseMeta = {
    sendPermit2Bound: true,
    decision: "policy_denied",
    policyCode: opts.code,
    aborted: true,
    reason: opts.reason,
  };
  writeLog(config, req.method, meta, ERR_PERMIT2_DENIED);
  return {
    jsonrpc: "2.0",
    id: req.id,
    sendPermit2Bound: meta,
    error: {
      code: ERR_PERMIT2_DENIED,
      message: `send-permit2-bound: ${opts.code} — ${opts.reason}`,
      data: {
        package: "send-permit2-bound",
        code: opts.code,
        reason: opts.reason,
      },
    },
  };
}

/**
 * Thin middleware (DC11):
 * 1. Refuse eth_sendTransaction (-32081). No key custody.
 * 2. Non-send methods → passthrough to upstream.
 * 3. Parse signed raw. Unparseable → -32086 tx_unparseable (never fail-open).
 * 4. Contract create (to null) → forward without Permit2 decode.
 * 5. If policy enabled, gatePermit2Bound. Deny → -32086. Else forward.
 * Evaluate stays pure; middleware is the only I/O.
 */
export async function handleRequest(
  config: SendPermit2BoundConfig,
  req: JsonRpcRequest,
  deps: HandlerDeps = {}
): Promise<JsonRpcResponse> {
  const forward =
    deps.forward ?? ((url, body) => forwardRaw(url, body));

  if (UNSIGNED_SEND_METHODS.has(req.method)) {
    const meta: SendPermit2BoundResponseMeta = {
      sendPermit2Bound: true,
      decision: "unsigned_refused",
      policyCode: null,
      aborted: true,
      reason: "eth_sendTransaction refused — no key custody",
    };
    writeLog(config, req.method, meta, ERR_UNSIGNED_SEND_REFUSED);
    return {
      jsonrpc: "2.0",
      id: req.id,
      sendPermit2Bound: meta,
      error: {
        code: ERR_UNSIGNED_SEND_REFUSED,
        message:
          "send-permit2-bound: eth_sendTransaction refused — no key custody. Sign externally and submit via eth_sendRawTransaction.",
        data: {
          package: "send-permit2-bound",
          code: "unsigned_refused",
          useMethod: "eth_sendRawTransaction",
        },
      },
    };
  }

  if (!SEND_METHODS.has(req.method)) {
    const res = await forward(config.upstreamRpcUrl, req);
    return {
      ...res,
      sendPermit2Bound: {
        sendPermit2Bound: true,
        decision: "passthrough",
        policyCode: null,
        aborted: false,
      },
    };
  }

  const raw = req.params?.[0];
  if (typeof raw !== "string" || !raw.startsWith("0x")) {
    return {
      jsonrpc: "2.0",
      id: req.id,
      error: {
        code: -32602,
        message: "invalid params: expected hex raw transaction",
      },
    };
  }

  let parsed: ReturnType<typeof parseRawTransaction>;
  try {
    parsed = parseRawTransaction(raw as Hex);
  } catch (err) {
    return denied(config, req, {
      code: "tx_unparseable",
      reason: `raw transaction unparseable: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // DC11: contract create — forward; constructor-hidden grants outside P0.
  if (parsed.isCreate) {
    const upstream = await forward(config.upstreamRpcUrl, req);
    const meta: SendPermit2BoundResponseMeta = {
      sendPermit2Bound: true,
      decision: "create_forward",
      policyCode: null,
      aborted: false,
      reason: "contract create — Permit2 decode skipped",
    };
    writeLog(config, req.method, meta, null);
    return { ...upstream, sendPermit2Bound: meta };
  }

  // DC12: enabled false → forward (gate_disabled already logged at boot).
  if (config.policy.enabled) {
    const check = gatePermit2Bound(config.policy, {
      to: parsed.to,
      data: parsed.data,
      chainId: parsed.chainId,
      typedLinkageOk: deps.typedLinkageOk,
    });
    if (!check.allow) {
      return denied(config, req, {
        code: check.code ?? "permit2_undecodable",
        reason: check.reason ?? "permit2-bound denied",
      });
    }
  }

  const upstream = await forward(config.upstreamRpcUrl, req);
  const meta: SendPermit2BoundResponseMeta = {
    sendPermit2Bound: true,
    decision: "forward",
    policyCode: null,
    aborted: false,
  };
  writeLog(config, req.method, meta, null);
  return { ...upstream, sendPermit2Bound: meta };
}

export async function handlePayload(
  config: SendPermit2BoundConfig,
  body: unknown,
  deps?: HandlerDeps
): Promise<JsonRpcResponse | JsonRpcResponse[]> {
  if (Array.isArray(body)) {
    return Promise.all(
      body.map((item) =>
        handleRequest(config, item as JsonRpcRequest, deps)
      )
    );
  }
  return handleRequest(config, body as JsonRpcRequest, deps);
}
