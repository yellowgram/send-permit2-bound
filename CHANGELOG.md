# Changelog

## 0.1.0

- Non-custodial at-send gate: pin Uniswap Permit2 by chain; bound approve / permit* / permitTransferFrom* calldata
- Spender / amount / expiration caps; optional typed linkage stub (no phishing UX)
- Compose after send-approve-bound; fail-closed deny codes (`-32086`); refuse unsigned submit (`-32081`)
- Offline `demo:offline` fixtures + vitest; sealed honesty lines
- Public MIT source on GitHub; **not published to npm**; no Polar
