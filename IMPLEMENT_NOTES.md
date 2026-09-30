# IMPLEMENT_NOTES — send-permit2-bound P0

**As of:** 2026-09-30 (ET)  
**Against:** `/workspace/send-permit2-bound-lg/DESIGN-GATE.md` PASS-with-conditions (DC1–DC17)  
**Artifact:** `/workspace/send-permit2-bound` (still `"private": true`; public GitHub OK; no npm publish)

## What changed vs scaffold

| Area | Scaffold | P0 implement |
| --- | --- | --- |
| Selectors | `0x2a2d80d1` mislabeled PermitSingle; no SignatureTransfer | Verified set: approve / PermitSingle `0x2b67b570` / PermitBatch `0x2a2d80d1` / permitTransferFrom\* / witness (+ alt) |
| Decode | Permit stub invented `amount:0` / `expiration:0` | Full ABI decode; incomplete → `permit2_undecodable` (DC2) |
| Batch | None | Any leaf over-cap / bad spender denies whole call (DC4) |
| Expiration 0 | Only `exp > max` | `1 <= exp/deadline/sigDeadline <= maxExpiration`; 0 → `permit2_over_cap` (DC6) |
| Pins | Flat `permit2Addresses` set | `permit2ByChainId` map; canonical + zkSync optional; `requirePinnedTo` default true (DC8) |
| Policy | `maxAmount` / `maxExpiration:0` skip | `maxAmountRaw`; `maxExpiration >= 1` at load; non-empty `spenders` when enabled |
| Middleware | Absent | Thin signed-raw handler: unsigned → `-32081`; denies + unparseable → `-32086`; never fail-open |
| Docs | Scaffold deny table | Verbatim honesty lines DC6/DC10/DC14/DC17 in README + SECURITY |
| package.json | private | Still private; homepage/OSS URLs present; `files[]` includes CHANGELOG + docs/DEMO.md; no npm publish |

## DC checklist

| ID | Status | Notes |
| --- | --- | --- |
| DC1 | satisfied | Selector pins + labels match keccak table; batch no longer mislabeled |
| DC2 | satisfied | No invented fields; short/non-canonical → `permit2_undecodable` |
| DC3 | satisfied | approve / PermitSingle / PermitBatch full field decode + leaf bounds |
| DC4 | satisfied | Two-leaf hide-over-cap deny both orderings (tests) |
| DC5 | satisfied | SignatureTransfer amount + deadline bound; spender not invented; honesty on recipient |
| DC6 | satisfied | Verbatim expiration-0 line; load refuses `maxExpiration: 0`; `1..max` rule |
| DC7 | satisfied | uint160 max / uint256 max always `permit2_over_cap` while enabled |
| DC8 | satisfied | `permit2ByChainId`; zkSync documented; `requirePinnedTo` default true; no oracle |
| DC9 | satisfied | Non-empty `spenders` when enabled; empty → load refuse |
| DC10 | satisfied (narrowed) | Typed linkage **removed** from P0 API; verbatim no-phishing-UX line; attest→raw out of P0 |
| DC11 | satisfied | Handler: `-32081` unsigned; `-32086` deny/unparseable; create forward; no fail-open |
| DC12 | satisfied | Explicit `enabled`; invalid/missing file refuses start; `gate_disabled` on stderr; example `enabled:true` |
| DC13 | satisfied | Closed deny-code set only (+ `tx_unparseable`) |
| DC14 | satisfied | Pass-through honesty + ERC-20 approve-to-Permit2 sibling honesty (verbatim) |
| DC15 | satisfied | Tests cover (1)–(9) + prior cases; demo fixture updated |
| DC16 | satisfied | private; no public URLs / oracle / auto-revoke / phishing UX / sim / Soft\* conversion |
| DC17 | satisfied | Verbatim raw-units line in README |

## Rejected (not shipped)

R1–R17 from DESIGN-GATE remain rejected: no phishing wallet UX, no ERC-20 approve-to-Permit2 here, no multicall unwind, no eth_call remaining allowance, no fail-open, no auto-revoke, no live pin oracle, no public remote/npm/Polar, no Soft\* conversion copy, no expiration-0-as-infinite, no batch leaf rescue, no `-32085` reuse.

## Verification (this implement)

- `npm test` — **52 passed** (3 files: evaluate, policy.load, handler)
- `npm run demo:offline` — OK, matches `docs/fixtures/offline.expected.txt`

## DC still open

None of DC1–DC17 are left intentionally open for this P0. Expansion (extra chains beyond documented pins, live intel adapters, fat typed product, multicall unwind) remains LaunchGate-gated and out of this implement. Sibling packages held.

## DHH close (2026-09-30)

Removed typed-linkage boolean stub (`requireTypedLinkage` / `typedLinkageOk` / `permit2_linkage_missing`) from policy, evaluate, gate, handler, README lead, and demo. P0 one-job story is pin Permit2 + bound approve/permit*/permitTransferFrom* calldata only. Packaging: `CHANGELOG.md` + `docs/DEMO.md` in `files[]`. Soft\* ban-token only. Still **not** ready-for-npm (LaunchGate + founder GO out of this audit).
