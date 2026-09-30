# Offline demo

No keys, no capital, no public RPC.

```bash
npm ci
npm test
npm run build
npm run demo:offline
```

`demo:offline` exits non-zero if stdout drifts from [`fixtures/offline.expected.txt`](./fixtures/offline.expected.txt).

What it shows (sealed allow **and** deny):

1. Bounded pinned approve → `allow=true`
2. Unpinned `to` → deny `permit2_unpinned`
3. Over amount cap → deny `permit2_over_cap`
4. Bad spender → deny `permit2_spender_denied`
5. Non-Permit2 calldata → pass-through allow
6. Expiration `0` → deny `permit2_over_cap`
7. PermitSingle under cap → allow
8. PermitBatch hide-over-cap leaf → deny `permit2_over_cap`
9. `permitTransferFrom` over cap → deny `permit2_over_cap`
10. uint160 max amount → deny `permit2_over_cap`
11. Permit2 `transferFrom` selector → pass-through allow
12. zkSync pin under cap → allow

Fixture SoT; compose after send-approve-bound. No typed-linkage / phishing UX in P0.
