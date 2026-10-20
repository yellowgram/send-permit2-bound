# send-permit2-bound (deprecated)

**This package is merged into [`l2-send-guard`](https://github.com/yellowgram/l2-safety-proxy) 1.x and gets no more fixes.**
Version 0.2.0 behaves like 0.1.0 and prints one deprecation warning when imported or run. The bin also answers `send-permit2-bound --help` and `--version` (see the CHANGELOG).

## Why

send-permit2-bound did one slice of a bigger job (bounded Permit2 approvals). On its own it had gaps that a single tool closes better:

- Only the top-level call was decoded, so `Permit2.approve(attacker, max)` inside Multicall3, Safe `execTransaction` or a 7702 batch `execute` was allowed.
- EIP-7702 `authorizationList` was ignored.
- Off-chain Permit2 signatures could only be checked by a separate tool.

`l2-send-guard` 1.x checks every call inside a transaction against one policy file, gates EIP-7702
delegations, keeps rolling caps and idempotency keys in a persistent store, watches what arrives, and
ships a guarded signer that applies the policy to the transactions, typed data and 7702 authorizations it
signs, and refuses plain messages unless you allow them.

## Migrating

```sh
npm uninstall send-permit2-bound
npm install l2-send-guard
```

What you used here is now the same `tokens.<token>.approve` rules, which apply to Permit2 too, plus `permit2.maxExpirySeconds`. Denials are now `-32083` with `error.data.policyCode` such as `PERMIT2_EXPIRY_TOO_LONG` (was `-32086`).
The full guide is at https://github.com/yellowgram/l2-safety-proxy#migrating.

## License

MIT
