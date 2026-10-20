# Changelog

## 0.2.0

- Deprecated. Merged into `l2-send-guard` 1.x, which fixes nested-call decoding, EIP-7702 authorizations, cumulative limits, ungated submit methods and memory-only state. This version behaves like 0.1.0 and emits one `DeprecationWarning` on import.
- Removed internal planning files.
- The `send-permit2-bound` bin answers `--help`/`-h` (help on stdout, exit 0, no configuration needed) and `--version`/`-v`. Any other argument is a usage error (exit 2); 0.1.0 ignored arguments and started the gate.
- On a configuration error the bin now lets the deprecation warning print before it exits 1 (0.1.0 exited first, so CLI users never saw it).
- `PERMIT2_SELECTORS` is the new name; the 0.1.0 name `P0_PERMIT2_SELECTORS` is still exported as a deprecated alias, so every 0.1.0 import keeps working.

## 0.1.0

- Non-custodial at-send gate: pin Uniswap Permit2 by chain; bound approve / permit* / permitTransferFrom* calldata
- Spender / amount / expiration caps; batch leaf deny-all (typed-data linkage not checked)
- Compose after send-approve-bound; fail-closed deny codes (`-32086`); refuse unsigned submit (`-32081`)
- Offline `demo:offline` with fixed fixtures, and tests
- MIT licensed
