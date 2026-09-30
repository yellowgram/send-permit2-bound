# send-permit2-bound

More from yellowgram: [OSS tools](https://www.yellowgram.dev/oss).

**Status:** public MIT · npm `send-permit2-bound@0.1.0` · no Polar

Pin Uniswap **Permit2** by chain and bound `approve` / `permit*` / `permitTransferFrom*` calldata at `eth_sendRawTransaction`. One job: pin + calldata caps. No phishing UX. Compose after `send-approve-bound`. No keys. No simulation.

> **Charter:** [CHARTER.md](./CHARTER.md) — no Soft\* · no Polar/checkout · no custody

## Pin (local)

```bash
npm install
npm test
npm run demo:offline
```

See [docs/DEMO.md](./docs/DEMO.md) for the sealed offline fixture walkthrough.

## Policy shape

```json
{
  "enabled": true,
  "permit2ByChainId": {
    "1": "0x000000000022D473030F116dDEE9F6B43aC78BA3"
  },
  "requirePinnedTo": true,
  "spenders": ["0xSpender…"],
  "maxAmountRaw": "1000",
  "maxExpiration": "2000000000"
}
```

- `permit2ByChainId` is a local pin map (not a live oracle). Documented optional zkSync pin: `324` → `0x0000000000225e31D15943971F47aD3022F714Fa`.
- `requirePinnedTo` defaults **true**. Empty map + enabled → every P0 Permit2 selector denies `permit2_unpinned`.
- `spenders` must be non-empty when `enabled: true`.
- `maxExpiration` must be a positive unix-seconds ceiling (`>= 1`). `maxExpiration: 0` is refused at policy load.
- `enabled: false` is the only allow-all and must be explicit; boot logs `gate_disabled`.

## Honesty (locked)

maxAmountRaw is an integer in the token's smallest unit (uint160 path for AllowanceTransfer). This package does not apply decimals.

Permit2 AllowanceTransfer expiration 0 means the allowance expires at the current block timestamp. This gate treats expiration 0 as permit2_over_cap when the policy requires a positive maxExpiration.

This package is not a Permit2 phishing wallet and does not present EIP-712 typed data for humans to sign. Typed-data attest→raw linkage is out of P0 (not exported).

Calldata whose selector is not in this package's Permit2 P0 pin set is passed through, including Permit2 transferFrom/lockdown and multicall wrappers. This gate does not unwind inner calls and does not re-check standing Permit2 allowances on transferFrom.

ERC-20 approve or increaseAllowance with spender equal to a Permit2 address is not decoded here. That path belongs to send-approve-bound.

SignatureTransfer binds the spender in the typed hash; the recipient in `transferDetails` is caller-supplied. This gate bounds permitted amounts and deadlines from calldata and does not claim to lock the recipient.

## P0 selectors (keccak-verified)

| Selector | Name |
| --- | --- |
| `0x87517c45` | AllowanceTransfer `approve` |
| `0x2b67b570` | AllowanceTransfer `permit` **PermitSingle** |
| `0x2a2d80d1` | AllowanceTransfer `permit` **PermitBatch** |
| `0x30f28b7a` | SignatureTransfer `permitTransferFrom` single |
| `0xedd9444b` | SignatureTransfer `permitTransferFrom` batch |
| `0x137c29fe` | SignatureTransfer `permitWitnessTransferFrom` |
| `0xeeb4577c` | Witness alternate order (decode or `permit2_undecodable`) |

Any leaf over amount / expiration / spender policy denies the **entire** batch.

## Deny codes (P0)

| Code | Meaning |
| --- | --- |
| `permit2_unpinned` | `to` is not the pinned Permit2 for `chainId` under pin-required |
| `permit2_over_cap` | amount, expiration, sigDeadline, or deadline over policy |
| `permit2_spender_denied` | spender not allowlisted |
| `permit2_undecodable` | Permit2-shaped but undecodable / non-canonical (FC) |
| `tx_unparseable` | signed raw could not be parsed (middleware) |

## JSON-RPC

| Code | Meaning |
| --- | --- |
| **-32081** | `eth_sendTransaction` refused — no key custody |
| **-32086** | Permit2 deny or unparseable raw (`error.data.package = "send-permit2-bound"`) |

Not `-32080`…`-32085` (those belong to other send-path packages). Unparseable raw **never** fail-opens.

Contract create (`to` null) is forwarded without Permit2 decode; constructor-hidden grants are outside P0.

## Compose

`send-allow → send-approve-bound → send-permit2-bound → …`

## License

MIT — [LICENSE](./LICENSE).
