# send-permit2-bound — charter fences

**Status:** LOCAL_SCAFFOLD · private · LaunchGate-before-expansion  
**As of:** 2026-09-30 (ET)

This package is a **narrow** at-send middleware slice. Keep the surface honest. No public remote / npm until founder + LaunchGate.

## Job (P0)

Pin Uniswap **Permit2** and bound `approve` / `permit*` calldata (and optional typed-data linkage stub) at `eth_sendRawTransaction`.

- Pin known Permit2 addresses (chain map; local pins, not live oracle SaaS)
- Bound spender / amount / expiration on Permit2 paths
- Optional **typed linkage stub** only when submit consumes a prior typed signature — **no phishing UX**
- Fail-closed on definite policy miss; sealed offline fixtures

## Compose slot

```
… → send-allow → send-approve-bound → send-permit2-bound → …
```

Closes send-allow ★ P0 Permit2 bypass (ERC-20 Approval-blind). Complements `recv-permit2-watch` (priced-with under `recv-approval-watch`). ERC-20 approve *into* Permit2 stays `send-approve-bound`.

## In scope (P0)

- Pure evaluate + thin middleware hook
- Permit2 contract pin + selector/calldata bounds (AllowanceTransfer + SignatureTransfer P0 set)
- Amount / expiration caps; deny over-cap / unknown Permit2 target under strict pin
- Batch leaf deny-all; optional typed linkage stub (attest → raw match) — not a general EIP-712 phishing product
- offline `demo:offline` + unit tests
- MIT, self-hosted, local-only until founder
- JSON-RPC deny code **-32086** (unsigned refuse stays **-32081**)

## Out of scope / fences

| Fence | Meaning |
| --- | --- |
| **No key custody** | No signing product. |
| **No phishing UX** | Not a general typed-data wallet wizard. Linkage stub only. |
| **No Soft\*** | Forbidden in naming and docs. |
| **No Polar / checkout URLs** | None in this tree. |
| **No public/npm until founder** | Private local scaffold only. |
| **No Safe / custody / SaaS / mainnet SLA** | Charter out. |
| **No auto-revoke** | Detection/emit is receive-side; this package only bounds at-send. |
| **No ERC-20 approve-to-Permit2 here** | That surface is `send-approve-bound`. |
| **LaunchGate-before-expansion** | Extra chains, live intel adapters, fat typed product need LaunchGate. |

## Fail modes (default)

| Case | Default | Notes |
| --- | --- | --- |
| Call to non-pinned Permit2 under pin-required | **fail-closed** | `permit2_unpinned` |
| Amount / expiration over cap | **fail-closed** | `permit2_over_cap` |
| Spender not allowlisted | **fail-closed** | `permit2_spender_denied` |
| Typed linkage required but missing/drift | **fail-closed** | stub path |
| Non-Permit2 calldata | **pass-through** | including transferFrom/lockdown |

## Soft* ban

Forbidden: any Soft* monetization / conversion naming or copy in this package (including hyphenated or spaced Soft* WTP forms). Use Soft* only as the ban token.

## Acceptance sketch (tandem)

Permit2 over cap → deny before broadcast (sealed fixture).
