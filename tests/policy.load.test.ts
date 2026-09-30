import { describe, it, expect } from "vitest";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  parsePermit2BoundPolicyDocument,
  loadPermit2BoundPolicyFile,
} from "../src/policy/load.js";
import { PERMIT2_ETH_MAINNET } from "../src/pins.js";

const SPENDER = "0x1111111111111111111111111111111111111111";

function validDoc(over: Record<string, unknown> = {}) {
  return {
    enabled: true,
    permit2ByChainId: { "1": PERMIT2_ETH_MAINNET },
    spenders: [SPENDER],
    maxAmountRaw: "1000",
    maxExpiration: "2000000000",
    ...over,
  };
}

describe("policy load (DC6 / DC8 / DC9 / DC12)", () => {
  it("accepts enabled true + pins + spenders", () => {
    const p = parsePermit2BoundPolicyDocument(validDoc());
    expect(p.enabled).toBe(true);
    expect(p.requirePinnedTo).toBe(true);
    expect(p.permit2ByChainId.get("1")).toBe(PERMIT2_ETH_MAINNET.toLowerCase());
    expect(p.maxExpiration).toBe(2_000_000_000n);
  });

  it("refuses missing enabled", () => {
    const doc = validDoc();
    delete (doc as { enabled?: boolean }).enabled;
    expect(() => parsePermit2BoundPolicyDocument(doc)).toThrow(
      /enabled must be an explicit boolean/
    );
  });

  it("refuses maxExpiration 0 (DC6)", () => {
    expect(() =>
      parsePermit2BoundPolicyDocument(validDoc({ maxExpiration: "0" }))
    ).toThrow(/positive integer/);
  });

  it("refuses empty spenders when enabled (DC9)", () => {
    expect(() =>
      parsePermit2BoundPolicyDocument(validDoc({ spenders: [] }))
    ).toThrow(/spenders must be non-empty/);
  });

  it("allows empty spenders when disabled", () => {
    const p = parsePermit2BoundPolicyDocument(
      validDoc({ enabled: false, spenders: [] })
    );
    expect(p.enabled).toBe(false);
    expect(p.spenders.size).toBe(0);
  });

  it("refuses hex maxAmountRaw", () => {
    expect(() =>
      parsePermit2BoundPolicyDocument(validDoc({ maxAmountRaw: "0x10" }))
    ).toThrow(/must not be hex/);
  });

  it("requirePinnedTo defaults true", () => {
    const p = parsePermit2BoundPolicyDocument(validDoc());
    expect(p.requirePinnedTo).toBe(true);
  });

  it("accepts empty permit2ByChainId object", () => {
    const p = parsePermit2BoundPolicyDocument(
      validDoc({ permit2ByChainId: {} })
    );
    expect(p.permit2ByChainId.size).toBe(0);
  });

  it("load file refuses unreadable", () => {
    expect(() =>
      loadPermit2BoundPolicyFile(join(tmpdir(), "no-such-permit2-policy.json"))
    ).toThrow(/Failed to load policy file/);
  });

  it("load file parses example shape", () => {
    const path = join(tmpdir(), `permit2-policy-${Date.now()}.json`);
    writeFileSync(path, JSON.stringify(validDoc({ requireTypedLinkage: false })));
    try {
      const p = loadPermit2BoundPolicyFile(path);
      expect(p.maxAmountRaw).toBe(1000n);
    } finally {
      unlinkSync(path);
    }
  });
});
