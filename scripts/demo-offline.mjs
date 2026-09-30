/**
 * Offline demo — sealed fixture, no public RPC / keys / capital.
 * Diff vs docs/fixtures/offline.expected.txt — exits non-zero on drift.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultPermit2BoundPolicy,
  gatePermit2Bound,
  PERMIT2_ETH_MAINNET,
  PERMIT2_ZKSYNC,
  SELECTOR_PERMIT2_APPROVE,
  SELECTOR_PERMIT2_PERMIT_SINGLE,
  SELECTOR_PERMIT2_PERMIT_BATCH,
  SELECTOR_PERMIT2_PERMIT_TRANSFER_FROM,
  UINT160_MAX,
} from "../dist/api.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXPECTED = join(root, "docs/fixtures/offline.expected.txt");

const SPENDER_OK = "0x1111111111111111111111111111111111111111";
const SPENDER_BAD = "0x2222222222222222222222222222222222222222";
const OTHER = "0x3333333333333333333333333333333333333333";
const TOKEN = "0x4444444444444444444444444444444444444444";
const OWNER = "0x5555555555555555555555555555555555555555";
const RECIPIENT = "0x6666666666666666666666666666666666666666";
const EXP_OK = 1_700_000_000n;
const DEADLINE_OK = 1_800_000_000n;

function addrWord(addr) {
  return addr.replace(/^0x/i, "").toLowerCase().padStart(64, "0");
}
function uintWord(n) {
  return BigInt(n).toString(16).padStart(64, "0");
}
function encodeApprove(spender, amount, exp) {
  return (
    SELECTOR_PERMIT2_APPROVE +
    addrWord(TOKEN) +
    addrWord(spender) +
    uintWord(amount) +
    uintWord(exp)
  );
}
function encodePermitSingle(amount, expiration, spender, sigDeadline) {
  const sig = "ab".repeat(65);
  return (
    SELECTOR_PERMIT2_PERMIT_SINGLE +
    addrWord(OWNER) +
    addrWord(TOKEN) +
    uintWord(amount) +
    uintWord(expiration) +
    uintWord(1n) +
    addrWord(spender) +
    uintWord(sigDeadline) +
    uintWord(0x100n) +
    uintWord(65n) +
    sig.padEnd(128, "0")
  );
}
function encodePermitBatch(details, spender, sigDeadline) {
  const n = details.length;
  const sig = "ab".repeat(65);
  const detailsWords = 1 + n * 4;
  const sigWordIndex = 3 + 3 + detailsWords;
  let body =
    addrWord(OWNER) +
    uintWord(0x60n) +
    uintWord(BigInt(sigWordIndex * 32)) +
    uintWord(0x60n) +
    addrWord(spender) +
    uintWord(sigDeadline) +
    uintWord(BigInt(n));
  let i = 0;
  for (const d of details) {
    body +=
      addrWord(TOKEN) +
      uintWord(d.amount) +
      uintWord(d.expiration) +
      uintWord(BigInt(i + 1));
    i++;
  }
  body += uintWord(65n) + sig.padEnd(128, "0");
  return SELECTOR_PERMIT2_PERMIT_BATCH + body;
}
function encodePermitTransferFrom(amount, deadline) {
  const sig = "ab".repeat(65);
  return (
    SELECTOR_PERMIT2_PERMIT_TRANSFER_FROM +
    addrWord(TOKEN) +
    uintWord(amount) +
    uintWord(1n) +
    uintWord(deadline) +
    addrWord(RECIPIENT) +
    uintWord(amount) +
    addrWord(OWNER) +
    uintWord(0x100n) +
    uintWord(65n) +
    sig.padEnd(128, "0")
  );
}

const lines = [];
const out = (s) => {
  lines.push(s);
  process.stdout.write(s + "\n");
};

out("send-permit2-bound offline demo");
out("no keys · no capital · no public RPC · pin Permit2 · no phishing UX");
out("");

const policy = defaultPermit2BoundPolicy();
policy.permit2ByChainId = new Map([["1", PERMIT2_ETH_MAINNET.toLowerCase()]]);
policy.spenders = new Set([SPENDER_OK.toLowerCase()]);
policy.maxAmountRaw = 1000n;
policy.maxExpiration = 2_000_000_000n;
policy.requirePinnedTo = true;

const r1 = gatePermit2Bound(policy, {
  to: PERMIT2_ETH_MAINNET,
  data: encodeApprove(SPENDER_OK, 500n, EXP_OK),
  chainId: 1,
});
out(`1 bounded pinned approve → allow=${r1.allow}`);

const r2 = gatePermit2Bound(policy, {
  to: OTHER,
  data: encodeApprove(SPENDER_OK, 10n, EXP_OK),
  chainId: 1,
});
out(`2 unpinned to → allow=${r2.allow} code=${r2.code}`);

const r3 = gatePermit2Bound(policy, {
  to: PERMIT2_ETH_MAINNET,
  data: encodeApprove(SPENDER_OK, 1001n, EXP_OK),
  chainId: 1,
});
out(`3 over cap → allow=${r3.allow} code=${r3.code}`);

const r4 = gatePermit2Bound(policy, {
  to: PERMIT2_ETH_MAINNET,
  data: encodeApprove(SPENDER_BAD, 10n, EXP_OK),
  chainId: 1,
});
out(`4 bad spender → allow=${r4.allow} code=${r4.code}`);

const r5 = gatePermit2Bound(policy, {
  to: OTHER,
  data: "0xa9059cbb" + "00".repeat(64),
  chainId: 1,
});
out(`5 non-permit2 pass-through → allow=${r5.allow}`);

const r6 = gatePermit2Bound(policy, {
  to: PERMIT2_ETH_MAINNET,
  data: encodeApprove(SPENDER_OK, 10n, 0n),
  chainId: 1,
});
out(`6 expiration 0 → allow=${r6.allow} code=${r6.code}`);

const r7 = gatePermit2Bound(policy, {
  to: PERMIT2_ETH_MAINNET,
  data: encodePermitSingle(500n, EXP_OK, SPENDER_OK, DEADLINE_OK),
  chainId: 1,
});
out(`7 PermitSingle under cap → allow=${r7.allow}`);

const r8 = gatePermit2Bound(policy, {
  to: PERMIT2_ETH_MAINNET,
  data: encodePermitBatch(
    [
      { amount: 100n, expiration: EXP_OK },
      { amount: 9999n, expiration: EXP_OK },
    ],
    SPENDER_OK,
    DEADLINE_OK
  ),
  chainId: 1,
});
out(`8 PermitBatch hide-over-cap → allow=${r8.allow} code=${r8.code}`);

const r9 = gatePermit2Bound(policy, {
  to: PERMIT2_ETH_MAINNET,
  data: encodePermitTransferFrom(1001n, DEADLINE_OK),
  chainId: 1,
});
out(`9 permitTransferFrom over cap → allow=${r9.allow} code=${r9.code}`);

const r10 = gatePermit2Bound(policy, {
  to: PERMIT2_ETH_MAINNET,
  data: encodeApprove(SPENDER_OK, UINT160_MAX, EXP_OK),
  chainId: 1,
});
out(`10 uint160 max → allow=${r10.allow} code=${r10.code}`);

const r11 = gatePermit2Bound(policy, {
  to: PERMIT2_ETH_MAINNET,
  data: "0x36c78516" + "00".repeat(128),
  chainId: 1,
});
out(`11 transferFrom pass-through → allow=${r11.allow}`);

const zk = defaultPermit2BoundPolicy();
zk.permit2ByChainId = new Map([["324", PERMIT2_ZKSYNC.toLowerCase()]]);
zk.spenders = new Set([SPENDER_OK.toLowerCase()]);
zk.maxAmountRaw = 1000n;
zk.maxExpiration = 2_000_000_000n;
const r12 = gatePermit2Bound(zk, {
  to: PERMIT2_ZKSYNC,
  data: encodeApprove(SPENDER_OK, 10n, EXP_OK),
  chainId: 324,
});
out(`12 zkSync pin under cap → allow=${r12.allow}`);

out("");
out("charter: no Soft* · no Polar · no custody · LaunchGate-before-expansion");

const expected = readFileSync(EXPECTED, "utf8").replace(/\r\n/g, "\n").trimEnd();
const actual = lines.join("\n").trimEnd();
if (actual !== expected) {
  console.error("\n[demo-offline] stdout drifted from docs/fixtures/offline.expected.txt");
  console.error("--- expected ---\n" + expected);
  console.error("--- actual ---\n" + actual);
  process.exit(1);
}
console.error("[demo-offline] OK — matches offline.expected.txt");
