/**
 * Purchase quantity caps come from Master Sheet `MaxOrderLimit` only.
 * null / missing / <= 0 → unlimited (stock limits still apply on the server).
 */

export function resolveMaxOrderLimit(maxOrderLimit?: number | null): number | null {
  if (maxOrderLimit == null || maxOrderLimit === ('' as unknown)) return null;
  const n = Number(maxOrderLimit);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

/** Cap a desired qty by MaxOrderLimit; unlimited when limit is null. */
export function capCartQuantity(quantity: number, maxOrderLimit?: number | null): number {
  const q = Math.max(0, Number(quantity) || 0);
  const cap = resolveMaxOrderLimit(maxOrderLimit);
  if (cap == null) return q;
  return Math.min(cap, q);
}

export function canIncreaseCartQty(
  currentQty: number,
  maxOrderLimit?: number | null
): boolean {
  const cap = resolveMaxOrderLimit(maxOrderLimit);
  if (cap == null) return true;
  return currentQty < cap;
}

export function maxOrderLimitMessage(maxOrderLimit?: number | null): string | null {
  const cap = resolveMaxOrderLimit(maxOrderLimit);
  if (cap == null) return null;
  return `Maximum ${cap} items can be purchased.`;
}

/**
 * @deprecated Hardcoded per-item caps are removed. Prefer `resolveMaxOrderLimit` /
 * `capCartQuantity` from product.maxOrderLimit. Kept as unlimited for any legacy imports.
 */
export const MAX_CART_QTY_PER_ITEM = Number.MAX_SAFE_INTEGER;
