import { describe, expect, it } from "vitest";
import * as api from "../src/api.js";

// Runtime export names of send-permit2-bound@0.1.0 as published on npm (re-review item N-SHIM-1).
const V010_EXPORTS = ["ERR_PERMIT2_DENIED","ERR_UNSIGNED_SEND_REFUSED","P0_PERMIT2_SELECTORS","PACKAGE_VERSION","PERMIT2_ETH_MAINNET","PERMIT2_ZKSYNC","SELECTOR_PERMIT2_APPROVE","SELECTOR_PERMIT2_PERMIT","SELECTOR_PERMIT2_PERMIT_BATCH","SELECTOR_PERMIT2_PERMIT_SINGLE","SELECTOR_PERMIT2_PERMIT_TRANSFER_FROM","SELECTOR_PERMIT2_PERMIT_TRANSFER_FROM_BATCH","SELECTOR_PERMIT2_PERMIT_WITNESS_TRANSFER_FROM","SELECTOR_PERMIT2_PERMIT_WITNESS_TRANSFER_FROM_ALT","SEND_METHODS","UINT160_MAX","UINT256_MAX","UNSIGNED_SEND_METHODS","createServer","decodePermit2Calldata","defaultPermit2BoundPolicy","evaluatePermit2Bound","gatePermit2Bound","handlePayload","handleRequest","listen","loadConfig","loadPermit2BoundPolicy","loadPermit2BoundPolicyFile","parsePermit2BoundPolicyDocument","parseRawTransaction"];

describe("0.2.0 behaves like 0.1.0", () => {
  it("still exports every name 0.1.0 exported", () => {
    const missing = V010_EXPORTS.filter((n) => !(n in api));
    expect(missing).toEqual([]);
  });
  it("P0_PERMIT2_SELECTORS is the same set as PERMIT2_SELECTORS", () => {
    expect(api.P0_PERMIT2_SELECTORS).toBe(api.PERMIT2_SELECTORS);
  });
});
