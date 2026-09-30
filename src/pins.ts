/** Canonical Uniswap Permit2 (non-zkSync). Local pin — not a live oracle. */
export const PERMIT2_ETH_MAINNET =
  "0x000000000022d473030f116ddee9f6b43ac78ba3";

/** Uniswap Permit2 on zkSync (docs override). Local pin — not fetched live. */
export const PERMIT2_ZKSYNC =
  "0x0000000000225e31d15943971f47ad3022f714fa";

/** AllowanceTransfer approve(address,address,uint160,uint48) */
export const SELECTOR_PERMIT2_APPROVE = "0x87517c45";

/** AllowanceTransfer permit PermitSingle — permit(address,((address,uint160,uint48,uint48),address,uint256),bytes) */
export const SELECTOR_PERMIT2_PERMIT_SINGLE = "0x2b67b570";

/** AllowanceTransfer permit PermitBatch — permit(address,((address,uint160,uint48,uint48)[],address,uint256),bytes) */
export const SELECTOR_PERMIT2_PERMIT_BATCH = "0x2a2d80d1";

/** SignatureTransfer permitTransferFrom single */
export const SELECTOR_PERMIT2_PERMIT_TRANSFER_FROM = "0x30f28b7a";

/** SignatureTransfer permitTransferFrom batch */
export const SELECTOR_PERMIT2_PERMIT_TRANSFER_FROM_BATCH = "0xedd9444b";

/** SignatureTransfer permitWitnessTransferFrom (bytes32,string,bytes argument order) */
export const SELECTOR_PERMIT2_PERMIT_WITNESS_TRANSFER_FROM = "0x137c29fe";

/** Witness alternate order (string,bytes32,bytes) — Permit2-shaped; decode or undecodable, never pass-through when pinned. */
export const SELECTOR_PERMIT2_PERMIT_WITNESS_TRANSFER_FROM_ALT = "0xeeb4577c";

/** @deprecated Mislabel in scaffold — was batch. Use SELECTOR_PERMIT2_PERMIT_BATCH. */
export const SELECTOR_PERMIT2_PERMIT = SELECTOR_PERMIT2_PERMIT_BATCH;

export const P0_PERMIT2_SELECTORS = new Set([
  SELECTOR_PERMIT2_APPROVE,
  SELECTOR_PERMIT2_PERMIT_SINGLE,
  SELECTOR_PERMIT2_PERMIT_BATCH,
  SELECTOR_PERMIT2_PERMIT_TRANSFER_FROM,
  SELECTOR_PERMIT2_PERMIT_TRANSFER_FROM_BATCH,
  SELECTOR_PERMIT2_PERMIT_WITNESS_TRANSFER_FROM,
  SELECTOR_PERMIT2_PERMIT_WITNESS_TRANSFER_FROM_ALT,
]);

export const UINT160_MAX = (1n << 160n) - 1n;
export const UINT256_MAX =
  0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn;
