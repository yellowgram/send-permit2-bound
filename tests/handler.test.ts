import { describe, it, expect, vi } from "vitest";
import { handleRequest } from "../src/proxy/handler.js";
import {
  ERR_PERMIT2_DENIED,
  ERR_UNSIGNED_SEND_REFUSED,
  type SendPermit2BoundConfig,
} from "../src/types.js";
import {
  SPENDER_OK,
  PERMIT2_ETH_MAINNET,
  TOKEN,
  UNDECODABLE_RAW,
  encodePermit2Approve,
  examplePolicy,
  signRaw,
  UINT160_MAX,
} from "./fixtures.js";

const EXP_OK = 1_700_000_000n;

function cfg(opts: { enabled?: boolean } = {}): SendPermit2BoundConfig {
  const policy = examplePolicy({ enabled: opts.enabled });
  return {
    listenHost: "127.0.0.1",
    listenPort: 8548,
    upstreamRpcUrl: "http://upstream.test",
    policy,
  };
}

describe("handler — DC15 (8)", () => {
  it("refuses eth_sendTransaction with -32081 and zero upstream calls", async () => {
    const forward = vi.fn();
    const res = await handleRequest(
      cfg(),
      { jsonrpc: "2.0", id: 1, method: "eth_sendTransaction", params: [{}] },
      { forward }
    );
    expect(res.error?.code).toBe(ERR_UNSIGNED_SEND_REFUSED);
    expect(forward).not.toHaveBeenCalled();
  });

  it("unparseable raw → -32086 tx_unparseable, zero upstream calls", async () => {
    const forward = vi.fn();
    const res = await handleRequest(
      cfg(),
      {
        jsonrpc: "2.0",
        id: 1,
        method: "eth_sendRawTransaction",
        params: [UNDECODABLE_RAW],
      },
      { forward }
    );
    expect(res.error?.code).toBe(ERR_PERMIT2_DENIED);
    expect((res.error?.data as { code?: string })?.code).toBe("tx_unparseable");
    expect((res.error?.data as { package?: string })?.package).toBe(
      "send-permit2-bound"
    );
    expect(forward).not.toHaveBeenCalled();
  });

  it("Permit2 deny → -32086 with package send-permit2-bound, not forwarded", async () => {
    const forward = vi.fn();
    const raw = await signRaw({
      to: PERMIT2_ETH_MAINNET as `0x${string}`,
      data: encodePermit2Approve(
        TOKEN,
        SPENDER_OK,
        1001n,
        EXP_OK
      ) as `0x${string}`,
      chainId: 1,
    });
    const res = await handleRequest(
      cfg(),
      {
        jsonrpc: "2.0",
        id: 2,
        method: "eth_sendRawTransaction",
        params: [raw],
      },
      { forward }
    );
    expect(res.error?.code).toBe(ERR_PERMIT2_DENIED);
    expect((res.error?.data as { code?: string })?.code).toBe("permit2_over_cap");
    expect((res.error?.data as { package?: string })?.package).toBe(
      "send-permit2-bound"
    );
    expect(forward).not.toHaveBeenCalled();
  });

  it("non-Permit2 forwarded once", async () => {
    const forward = vi.fn(async () => ({
      jsonrpc: "2.0" as const,
      id: 1,
      result: "0x" + "ab".repeat(32),
    }));
    const raw = await signRaw({
      to: TOKEN as `0x${string}`,
      data: ("0xa9059cbb" + "00".repeat(64)) as `0x${string}`,
      chainId: 1,
    });
    const res = await handleRequest(
      cfg(),
      {
        jsonrpc: "2.0",
        id: 1,
        method: "eth_sendRawTransaction",
        params: [raw],
      },
      { forward }
    );
    expect(res.error).toBeUndefined();
    expect(res.result).toMatch(/^0x/);
    expect(res.sendPermit2Bound?.decision).toBe("forward");
    expect(forward).toHaveBeenCalledOnce();
  });

  it("enabled false forwards over-cap approve", async () => {
    const forward = vi.fn(async () => ({
      jsonrpc: "2.0" as const,
      id: 3,
      result: "0x" + "cd".repeat(32),
    }));
    const raw = await signRaw({
      to: PERMIT2_ETH_MAINNET as `0x${string}`,
      data: encodePermit2Approve(
        TOKEN,
        SPENDER_OK,
        UINT160_MAX,
        EXP_OK
      ) as `0x${string}`,
      nonce: 1,
      chainId: 1,
    });
    const res = await handleRequest(
      cfg({ enabled: false }),
      {
        jsonrpc: "2.0",
        id: 3,
        method: "eth_sendRawTransaction",
        params: [raw],
      },
      { forward }
    );
    expect(res.error).toBeUndefined();
    expect(forward).toHaveBeenCalledOnce();
  });

  it("passthrough for eth_chainId", async () => {
    const forward = vi.fn(async () => ({
      jsonrpc: "2.0" as const,
      id: 1,
      result: "0x1",
    }));
    const res = await handleRequest(
      cfg(),
      { jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] },
      { forward }
    );
    expect(res.result).toBe("0x1");
    expect(res.sendPermit2Bound?.decision).toBe("passthrough");
  });

  it("does not use -32083 / -32084 / -32085 for Permit2 denies", async () => {
    const forward = vi.fn();
    const raw = await signRaw({
      to: PERMIT2_ETH_MAINNET as `0x${string}`,
      data: encodePermit2Approve(
        TOKEN,
        SPENDER_OK,
        9999n,
        EXP_OK
      ) as `0x${string}`,
      nonce: 2,
      chainId: 1,
    });
    const res = await handleRequest(
      cfg(),
      {
        jsonrpc: "2.0",
        id: 4,
        method: "eth_sendRawTransaction",
        params: [raw],
      },
      { forward }
    );
    expect(res.error?.code).toBe(ERR_PERMIT2_DENIED);
    expect(res.error?.code).not.toBe(-32083);
    expect(res.error?.code).not.toBe(-32084);
    expect(res.error?.code).not.toBe(-32085);
  });

  it("bounded pinned approve forwards once", async () => {
    const forward = vi.fn(async () => ({
      jsonrpc: "2.0" as const,
      id: 5,
      result: "0x" + "ef".repeat(32),
    }));
    const raw = await signRaw({
      to: PERMIT2_ETH_MAINNET as `0x${string}`,
      data: encodePermit2Approve(
        TOKEN,
        SPENDER_OK,
        500n,
        EXP_OK
      ) as `0x${string}`,
      nonce: 3,
      chainId: 1,
    });
    const res = await handleRequest(
      cfg(),
      {
        jsonrpc: "2.0",
        id: 5,
        method: "eth_sendRawTransaction",
        params: [raw],
      },
      { forward }
    );
    expect(res.error).toBeUndefined();
    expect(forward).toHaveBeenCalledOnce();
  });
});
