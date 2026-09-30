# Security

send-permit2-bound bounds Permit2-shaped calldata on already-signed `eth_sendRawTransaction` paths. It does not custody keys. It does not provide phishing UX. It does not simulate. It is not a hosted service or mainnet SLA.

## Honesty (locked)

Permit2 AllowanceTransfer expiration 0 means the allowance expires at the current block timestamp. This gate treats expiration 0 as permit2_over_cap when the policy requires a positive maxExpiration.

This package is not a Permit2 phishing wallet and does not present EIP-712 typed data for humans to sign. Typed-data attest→raw linkage is out of P0 (not exported).

Calldata whose selector is not in this package's Permit2 P0 pin set is passed through, including Permit2 transferFrom/lockdown and multicall wrappers. This gate does not unwind inner calls and does not re-check standing Permit2 allowances on transferFrom.

ERC-20 approve or increaseAllowance with spender equal to a Permit2 address is not decoded here. That path belongs to send-approve-bound.

SignatureTransfer binds the spender in the typed hash; the recipient in `transferDetails` is caller-supplied. This gate bounds permitted amounts and deadlines from calldata and does not claim to lock the recipient.

Unlimited AllowanceTransfer amount (`type(uint160).max`) and SignatureTransfer amount (`type(uint256).max`) are always denied while the gate is enabled. There is no operator off switch.

Pins are local (`permit2ByChainId`). There is no live pin oracle; an empty map under `requirePinnedTo` denies rather than allow.

## Bind

Default listen address is `127.0.0.1`. Binding `0.0.0.0` without an ACL makes the proxy an unauthenticated forwarder onto your upstream RPC.

## Reporting

Do not open a public issue with a funded raw transaction or a private key. Prefer a private advisory when a private repo exists. Include package version/commit and a sealed repro. No bug-bounty program in this package.
