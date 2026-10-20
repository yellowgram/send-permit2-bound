import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

// Run the real entry point (src/index.ts) the way the bin runs it, with none of the gate's
// environment set, so --help is proven not to need an upstream RPC or policy.
const tsx = createRequire(import.meta.url).resolve("tsx/cli");
const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("SEND_PERMIT2_BOUND_")));
function run(...args: string[]) {
  const r = spawnSync(process.execPath, [tsx, "src/index.ts", ...args], { encoding: "utf8", env: cleanEnv, timeout: 30000 });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

describe("send-permit2-bound CLI", () => {
  it.each(["--help", "-h"])("%s prints help on stdout and exits 0 with no config", (flag) => {
    const r = run(flag);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/^send-permit2-bound 0\.2\.0: DEPRECATED/);
    expect(r.out).toContain("l2-send-guard 1.x");
    expect(r.out).toContain("SEND_PERMIT2_BOUND_UPSTREAM_RPC");
    expect(r.out).toContain("Usage:");
    expect(r.err).not.toMatch(/fatal/);
  });
  it("--version prints the version", () => {
    const r = run("--version");
    expect(r.code).toBe(0);
    expect(r.out).toBe("0.2.0\n");
  });
  it("an unknown argument is a usage error (exit 2), not a silent start", () => {
    const r = run("--bogus");
    expect(r.code).toBe(2);
    expect(r.err).toContain('unknown argument "--bogus"');
  });
  it("a config error still shows the deprecation warning before exiting 1", () => {
    const r = run();
    expect(r.code).toBe(1);
    expect(r.err).toContain("fatal: SEND_PERMIT2_BOUND_UPSTREAM_RPC is required");
    expect(r.err).toMatch(/DeprecationWarning: send-permit2-bound is deprecated/);
  });
});
