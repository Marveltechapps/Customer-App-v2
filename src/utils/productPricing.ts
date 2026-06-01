/**
 * Display discount label for product cards: prefer CMS `discount` string, else derive "% OFF" from MRP vs price.
 */
export function formatProductDiscountLabel(product: {
  discount?: unknown;
  mrp?: number;
  originalPrice?: number;
  price?: number;
}): string {
  const existing = product?.discount;
  if (existing != null && String(existing).trim()) return String(existing);
  const price = Number(product?.price ?? 0);
  const mrp = Number(product?.mrp ?? 0);
  const op = Number(product?.originalPrice ?? 0);
  const compareAt = mrp > 0 ? mrp : op;
  if (compareAt > 0 && price > 0 && compareAt > price) {
    const pct = Math.round(((compareAt - price) / compareAt) * 100);
    return pct > 0 ? `${pct}% OFF` : '';
  }
  return '';
}

/** Strikethrough amount: prefer MRP, then originalPrice, then selling price. */
export function resolveProductOriginalPrice(product: {
  mrp?: number;
  originalPrice?: number;
  price?: number;
}): number {
  const mrp = Number(product?.mrp ?? 0);
  const op = Number(product?.originalPrice ?? 0);
  const price = Number(product?.price ?? 0);
  if (mrp > 0) return mrp;
  if (op > 0) return op;
  return price;
}
