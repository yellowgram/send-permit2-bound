# send-permit2-bound — charter fences

**Status:** public GitHub · not on npm · LaunchGate-before-expansion  
**As of:** 2026-09-30 (ET)

This package is a **narrow** at-send middleware slice. Keep the surface honest. Public GitHub source is OK. No npm publish and no Polar until founder + LaunchGate.

## Job (P0)

Pin Uniswap **Permit2** and bound `approve` / `permit*` / `permitTransferFrom*` calldata at `eth_sendRawTransaction`.

- Pin known Permit2 addresses (chain map; local pins, not live oracle SaaS)
- Bound spender / amount / expiration on Permit2 paths
- Fail-closed on definite policy miss; sealed offline fixtures
- **No** typed-data attest→raw linkage in P0 (no phishing UX)

## Compose slot

```
… → send-allow → send-approve-bound → send-permit2-bound → …
```

Closes send-allow ★ P0 Permit2 bypass (ERC-20 Approval-blind). ERC-20 approve *into* Permit2 stays `send-approve-bound`.

## In scope (P0)

- Pure evaluate + thin middleware hook
- Permit2 contract pin + selector/calldata bounds (AllowanceTransfer + SignatureTransfer P0 set)
- Amount / expiration caps; deny over-cap / unknown Permit2 target under strict pin
- Batch leaf deny-all
- offline `demo:offline` + unit tests
- MIT, self-hosted; public GitHub OK; not on npm until founder
- JSON-RPC deny code **-32086** (unsigned refuse stays **-32081**)

## Out of scope / fences

| Fence | Meaning |
| --- | --- |
| **No key custody** | No signing product. |
| **No phishing UX** | Not a typed-data wallet wizard. Attest→raw linkage is out of P0. |
| **No Soft\*** | Forbidden in naming and docs. |
| **No Polar / checkout URLs** | None in this tree. |
| **No npm / Polar until founder** | Public GitHub OK. No `npm publish`, no Polar/checkout until LaunchGate + founder GO. |
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
| Non-Permit2 calldata | **pass-through** | including transferFrom/lockdown |

## Soft* ban

Forbidden: any Soft* monetization / conversion naming or copy in this package (including hyphenated or spaced Soft* WTP forms). Use Soft* only as the ban token.

## Acceptance sketch (tandem)

Permit2 over cap → deny before broadcast (sealed fixture).
