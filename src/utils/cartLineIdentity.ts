/**
 * Cart line identity — mirrors customer-backend cartService.js
 * (normalizeVariantId + matchCartLine) so UI and server use the same keys.
 */

export interface CartLineRef {
  productId: string;
  variantId: string;
}

export interface CartLineLike extends CartLineRef {
  quantity?: number;
}

/** Stable cart line key — empty variantId and productId-only SKUs must match. */
export function normalizeVariantId(productId: string, variantId?: string | null): string {
  const pid = String(productId || '').trim();
  const vid = variantId != null ? String(variantId).trim() : '';
  if (!vid || vid === pid) return pid;
  return vid;
}

export function matchCartLine(
  line: CartLineLike,
  productId: string,
  variantId?: string | null,
): boolean {
  const pid = String(productId || '').trim();
  const vid = normalizeVariantId(pid, variantId);
  const lineVid = normalizeVariantId(line.productId, line.variantId);
  return String(line.productId || '').trim() === pid && lineVid === vid;
}

export function resolveCartAddPayload(productId: string, variantId: string): CartLineRef {
  const pid = String(productId || '').trim();
  return {
    productId: pid,
    variantId: normalizeVariantId(pid, variantId),
  };
}

export function findCartLine<T extends CartLineLike>(
  items: T[],
  productId: string,
  variantId: string,
): T | undefined {
  return items.find((it) => matchCartLine(it, productId, variantId));
}

export function getLineQuantityFromItems(
  items: CartLineLike[],
  productId: string,
  variantId: string,
): number {
  const line = findCartLine(items, productId, variantId);
  return line?.quantity ?? 0;
}

/** Stable UI key for a cart line (product + normalized variant). */
export function cartLineKey(productId: string, variantId: string): string {
  const payload = resolveCartAddPayload(productId, variantId);
  return `${payload.productId}::${payload.variantId}`;
}

export function findCartLineByKey<T extends CartLineLike>(
  items: T[],
  lineKey: string,
): T | undefined {
  const sep = lineKey.indexOf('::');
  if (sep <= 0) return undefined;
  return findCartLine(items, lineKey.slice(0, sep), lineKey.slice(sep + 2));
}
