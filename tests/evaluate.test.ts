import { describe, it, expect } from "vitest";
import { decodePermit2Calldata } from "../src/decode.js";
import { gatePermit2Bound } from "../src/gate.js";
import {
  SELECTOR_PERMIT2_PERMIT_BATCH,
  SELECTOR_PERMIT2_PERMIT_SINGLE,
} from "../src/pins.js";
import {
  SPENDER_OK,
  SPENDER_BAD,
  OTHER,
  TOKEN,
  PERMIT2_ETH_MAINNET,
  PERMIT2_ZKSYNC,
  UINT160_MAX,
  UINT256_MAX,
  encodePermit2Approve,
  encodePermit2ApproveDirtySpender,
  encodePermitSingle,
  encodePermitBatch,
  encodePermitTransferFrom,
  encodePermitTransferFromBatch,
  encodePermitWitnessTransferFrom,
  examplePolicy,
} from "./fixtures.js";

const EXP_OK = 1_700_000_000n;
const DEADLINE_OK = 1_800_000_000n;

describe("decodePermit2Calldata", () => {
  it("decodes approve", () => {
    const c = decodePermit2Calldata(
      PERMIT2_ETH_MAINNET,
      encodePermit2Approve(TOKEN, SPENDER_OK, 42n, EXP_OK),
      1
    );
    expect(c.kind).toBe("approve");
    expect(c.isPermit2Selector).toBe(true);
    expect(c.leaves[0]?.spender).toBe(SPENDER_OK);
    expect(c.leaves[0]?.amount).toBe(42n);
    expect(c.leaves[0]?.expiration).toBe(EXP_OK);
  });

  it("dirty address padding on approve spender → undecodable (DC15.7)", () => {
    const c = decodePermit2Calldata(
      PERMIT2_ETH_MAINNET,
      encodePermit2ApproveDirtySpender(TOKEN, SPENDER_OK, 10n, EXP_OK),
      1
    );
    expect(c.isPermit2Selector).toBe(true);
    expect(c.undecodable).toBe(true);
  });

  it("short permit body → undecodable, no invented zeros (DC15.5)", () => {
    const c = decodePermit2Calldata(
      PERMIT2_ETH_MAINNET,
      SELECTOR_PERMIT2_PERMIT_SINGLE + "00".repeat(16),
      1
    );
    expect(c.isPermit2Selector).toBe(true);
    expect(c.undecodable).toBe(true);
    expect(c.leaves.length).toBe(0);
  });

  it("short batch body → undecodable", () => {
    const c = decodePermit2Calldata(
      PERMIT2_ETH_MAINNET,
      SELECTOR_PERMIT2_PERMIT_BATCH + "00".repeat(8),
      1
    );
    expect(c.undecodable).toBe(true);
  });

  it("decodes PermitSingle", () => {
    const data = encodePermitSingle({
      amount: 500n,
      expiration: EXP_OK,
      spender: SPENDER_OK,
      sigDeadline: DEADLINE_OK,
    });
    expect(data.slice(0, 10)).toBe(SELECTOR_PERMIT2_PERMIT_SINGLE);
    const c = decodePermit2Calldata(PERMIT2_ETH_MAINNET, data, 1);
    expect(c.kind).toBe("permitSingle");
    expect(c.undecodable).toBeFalsy();
    expect(c.leaves[0]?.amount).toBe(500n);
    expect(c.leaves[0]?.spender).toBe(SPENDER_OK);
    expect(c.sigDeadline).toBe(DEADLINE_OK);
  });

  it("decodes PermitBatch two leaves", () => {
    const data = encodePermitBatch({
      spender: SPENDER_OK,
      sigDeadline: DEADLINE_OK,
      details: [
        { amount: 100n, expiration: EXP_OK },
        { amount: 200n, expiration: EXP_OK },
      ],
    });
    expect(data.slice(0, 10)).toBe(SELECTOR_PERMIT2_PERMIT_BATCH);
    const c = decodePermit2Calldata(PERMIT2_ETH_MAINNET, data, 1);
    expect(c.kind).toBe("permitBatch");
    expect(c.leaves.length).toBe(2);
    expect(c.leaves[0]?.amount).toBe(100n);
    expect(c.leaves[1]?.amount).toBe(200n);
  });

  it("non-P0 selector → other / pass-through", () => {
    const c = decodePermit2Calldata(PERMIT2_ETH_MAINNET, "0xa9059cbb" + "00".repeat(64), 1);
    expect(c.kind).toBe("other");
    expect(c.isPermit2Selector).toBe(false);
  });

  it("transferFrom selector to pinned Permit2 → other (DC14 pass-through)", () => {
    const c = decodePermit2Calldata(
      PERMIT2_ETH_MAINNET,
      "0x36c78516" + "00".repeat(128),
      1
    );
    expect(c.isPermit2Selector).toBe(false);
  });
});

describe("gatePermit2Bound — core + DC15", () => {
  it("pass-through non-permit2", () => {
    const r = gatePermit2Bound(examplePolicy(), {
      to: OTHER,
      data: "0xa9059cbb" + "00".repeat(64),
      chainId: 1,
    });
    expect(r.allow).toBe(true);
  });

  it("denies unpinned Permit2 to", () => {
    const r = gatePermit2Bound(examplePolicy(), {
      to: OTHER,
      data: encodePermit2Approve(TOKEN, SPENDER_OK, 10n, EXP_OK),
      chainId: 1,
    });
    expect(r.allow).toBe(false);
    expect(r.code).toBe("permit2_unpinned");
  });

  it("denies bad spender", () => {
    const r = gatePermit2Bound(examplePolicy(), {
      to: PERMIT2_ETH_MAINNET,
      data: encodePermit2Approve(TOKEN, SPENDER_BAD, 10n, EXP_OK),
      chainId: 1,
    });
    expect(r.allow).toBe(false);
    expect(r.code).toBe("permit2_spender_denied");
  });

  it("denies over amount cap", () => {
    const r = gatePermit2Bound(examplePolicy(), {
      to: PERMIT2_ETH_MAINNET,
      data: encodePermit2Approve(TOKEN, SPENDER_OK, 1001n, EXP_OK),
      chainId: 1,
    });
    expect(r.allow).toBe(false);
    expect(r.code).toBe("permit2_over_cap");
  });

  it("denies uint160 max as over cap", () => {
    const r = gatePermit2Bound(examplePolicy(), {
      to: PERMIT2_ETH_MAINNET,
      data: encodePermit2Approve(TOKEN, SPENDER_OK, UINT160_MAX, EXP_OK),
      chainId: 1,
    });
    expect(r.allow).toBe(false);
    expect(r.code).toBe("permit2_over_cap");
  });

  it("denies expiration over max", () => {
    const r = gatePermit2Bound(examplePolicy(), {
      to: PERMIT2_ETH_MAINNET,
      data: encodePermit2Approve(TOKEN, SPENDER_OK, 10n, 2_000_000_001n),
      chainId: 1,
    });
    expect(r.allow).toBe(false);
    expect(r.code).toBe("permit2_over_cap");
  });

  it("approve expiration 0 → permit2_over_cap under positive maxExpiration (DC15.4)", () => {
    const r = gatePermit2Bound(examplePolicy(), {
      to: PERMIT2_ETH_MAINNET,
      data: encodePermit2Approve(TOKEN, SPENDER_OK, 10n, 0n),
      chainId: 1,
    });
    expect(r.allow).toBe(false);
    expect(r.code).toBe("permit2_over_cap");
  });

  it("allows bounded pinned approve", () => {
    const r = gatePermit2Bound(examplePolicy(), {
      to: PERMIT2_ETH_MAINNET,
      data: encodePermit2Approve(TOKEN, SPENDER_OK, 500n, EXP_OK),
      chainId: 1,
    });
    expect(r.allow).toBe(true);
  });

  it("disabled policy pass-through", () => {
    const p = examplePolicy({ enabled: false });
    const r = gatePermit2Bound(p, {
      to: OTHER,
      data: encodePermit2Approve(TOKEN, SPENDER_BAD, UINT160_MAX, 9_999_999_999n),
      chainId: 1,
    });
    expect(r.allow).toBe(true);
  });

  it("PermitSingle over-cap deny (DC15.1)", () => {
    const r = gatePermit2Bound(examplePolicy(), {
      to: PERMIT2_ETH_MAINNET,
      data: encodePermitSingle({
        amount: 1001n,
        expiration: EXP_OK,
        spender: SPENDER_OK,
        sigDeadline: DEADLINE_OK,
      }),
      chainId: 1,
    });
    expect(r.allow).toBe(false);
    expect(r.code).toBe("permit2_over_cap");
  });

  it("PermitSingle under-cap allow (DC15.1)", () => {
    const r = gatePermit2Bound(examplePolicy(), {
      to: PERMIT2_ETH_MAINNET,
      data: encodePermitSingle({
        amount: 500n,
        expiration: EXP_OK,
        spender: SPENDER_OK,
        sigDeadline: DEADLINE_OK,
      }),
      chainId: 1,
    });
    expect(r.allow).toBe(true);
  });

  it("PermitBatch leaf0 under / leaf1 over → deny (DC15.2)", () => {
    const r = gatePermit2Bound(examplePolicy(), {
      to: PERMIT2_ETH_MAINNET,
      data: encodePermitBatch({
        spender: SPENDER_OK,
        sigDeadline: DEADLINE_OK,
        details: [
          { amount: 100n, expiration: EXP_OK },
          { amount: 9999n, expiration: EXP_OK },
        ],
      }),
      chainId: 1,
    });
    expect(r.allow).toBe(false);
    expect(r.code).toBe("permit2_over_cap");
  });

  it("PermitBatch leaf0 over / leaf1 under → deny swapped (DC15.2)", () => {
    const r = gatePermit2Bound(examplePolicy(), {
      to: PERMIT2_ETH_MAINNET,
      data: encodePermitBatch({
        spender: SPENDER_OK,
        sigDeadline: DEADLINE_OK,
        details: [
          { amount: 9999n, expiration: EXP_OK },
          { amount: 100n, expiration: EXP_OK },
        ],
      }),
      chainId: 1,
    });
    expect(r.allow).toBe(false);
    expect(r.code).toBe("permit2_over_cap");
  });

  it("PermitBatch both under → allow", () => {
    const r = gatePermit2Bound(examplePolicy(), {
      to: PERMIT2_ETH_MAINNET,
      data: encodePermitBatch({
        spender: SPENDER_OK,
        sigDeadline: DEADLINE_OK,
        details: [
          { amount: 100n, expiration: EXP_OK },
          { amount: 200n, expiration: EXP_OK },
        ],
      }),
      chainId: 1,
    });
    expect(r.allow).toBe(true);
  });

  it("SignatureTransfer permitTransferFrom over-cap deny (DC15.3)", () => {
    const r = gatePermit2Bound(examplePolicy(), {
      to: PERMIT2_ETH_MAINNET,
      data: encodePermitTransferFrom({
        amount: 1001n,
        deadline: DEADLINE_OK,
      }),
      chainId: 1,
    });
    expect(r.allow).toBe(false);
    expect(r.code).toBe("permit2_over_cap");
  });

  it("SignatureTransfer under-cap allow (no spender in calldata)", () => {
    const r = gatePermit2Bound(examplePolicy(), {
      to: PERMIT2_ETH_MAINNET,
      data: encodePermitTransferFrom({
        amount: 500n,
        deadline: DEADLINE_OK,
      }),
      chainId: 1,
    });
    expect(r.allow).toBe(true);
  });

  it("SignatureTransfer uint256 max → over_cap", () => {
    const r = gatePermit2Bound(examplePolicy(), {
      to: PERMIT2_ETH_MAINNET,
      data: encodePermitTransferFrom({
        amount: UINT256_MAX,
        deadline: DEADLINE_OK,
      }),
      chainId: 1,
    });
    expect(r.allow).toBe(false);
    expect(r.code).toBe("permit2_over_cap");
  });

  it("SignatureTransfer batch any leaf over → deny", () => {
    const r = gatePermit2Bound(examplePolicy(), {
      to: PERMIT2_ETH_MAINNET,
      data: encodePermitTransferFromBatch({
        amounts: [100n, 5000n],
        deadline: DEADLINE_OK,
      }),
      chainId: 1,
    });
    expect(r.allow).toBe(false);
    expect(r.code).toBe("permit2_over_cap");
  });

  it("witness transferFrom under-cap allow", () => {
    const r = gatePermit2Bound(examplePolicy(), {
      to: PERMIT2_ETH_MAINNET,
      data: encodePermitWitnessTransferFrom({
        amount: 50n,
        deadline: DEADLINE_OK,
      }),
      chainId: 1,
    });
    expect(r.allow).toBe(true);
  });

  it("zkSync pin: canonical address on mismatched chainId → unpinned (DC15.6)", () => {
    const p = examplePolicy({
      chainId: 324,
      pin: PERMIT2_ZKSYNC,
    });
    const r = gatePermit2Bound(p, {
      to: PERMIT2_ETH_MAINNET,
      data: encodePermit2Approve(TOKEN, SPENDER_OK, 10n, EXP_OK),
      chainId: 324,
    });
    expect(r.allow).toBe(false);
    expect(r.code).toBe("permit2_unpinned");
  });

  it("zkSync pin: correct pin allows under-cap approve (DC15.6)", () => {
    const p = examplePolicy({
      chainId: 324,
      pin: PERMIT2_ZKSYNC,
    });
    const r = gatePermit2Bound(p, {
      to: PERMIT2_ZKSYNC,
      data: encodePermit2Approve(TOKEN, SPENDER_OK, 10n, EXP_OK),
      chainId: 324,
    });
    expect(r.allow).toBe(true);
  });

  it("empty pin map + requirePinnedTo → unpinned", () => {
    const p = examplePolicy();
    p.permit2ByChainId = new Map();
    const r = gatePermit2Bound(p, {
      to: PERMIT2_ETH_MAINNET,
      data: encodePermit2Approve(TOKEN, SPENDER_OK, 10n, EXP_OK),
      chainId: 1,
    });
    expect(r.allow).toBe(false);
    expect(r.code).toBe("permit2_unpinned");
  });

  it("missing chainId under requirePinnedTo → unpinned", () => {
    const r = gatePermit2Bound(examplePolicy(), {
      to: PERMIT2_ETH_MAINNET,
      data: encodePermit2Approve(TOKEN, SPENDER_OK, 10n, EXP_OK),
    });
    expect(r.allow).toBe(false);
    expect(r.code).toBe("permit2_unpinned");
  });

  it("dirty spender → undecodable deny", () => {
    const r = gatePermit2Bound(examplePolicy(), {
      to: PERMIT2_ETH_MAINNET,
      data: encodePermit2ApproveDirtySpender(TOKEN, SPENDER_OK, 10n, EXP_OK),
      chainId: 1,
    });
    expect(r.allow).toBe(false);
    expect(r.code).toBe("permit2_undecodable");
  });

  it("multicall selector pass-through even to pinned Permit2", () => {
    const r = gatePermit2Bound(examplePolicy(), {
      to: PERMIT2_ETH_MAINNET,
      data: "0x252dba42" + "00".repeat(64),
      chainId: 1,
    });
    expect(r.allow).toBe(true);
  });
});
