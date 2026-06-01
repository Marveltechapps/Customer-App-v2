import type { CartItem } from '../contexts/CartContext';
import { normalizeVariantId } from './cartLineIdentity';
import { MAX_CART_QTY_PER_ITEM } from './cartConstants';

export { MAX_CART_QTY_PER_ITEM } from './cartConstants';

type AddToCartFn = (item: Omit<CartItem, 'quantity'>) => void;
type UpdateQuantityFn = (productId: string, variantId: string, quantity: number) => void;
type GetLineQuantityFn = (productId: string, variantId: string) => number;

/**
 * Single fullstack-safe path: add new line (qty 1) or increment existing — never both.
 */
export function addOrIncrementCartLine(
  addToCart: AddToCartFn,
  updateQuantity: UpdateQuantityFn,
  getLineQuantity: GetLineQuantityFn,
  item: Omit<CartItem, 'quantity'>,
): void {
  const productId = String(item.productId || '').trim();
  const variantId = normalizeVariantId(productId, item.variantId);
  const payload = { ...item, productId, variantId };
  const current = getLineQuantity(productId, variantId);
  if (current <= 0) {
    addToCart(payload);
    return;
  }
  updateQuantity(
    productId,
    variantId,
    Math.min(MAX_CART_QTY_PER_ITEM, current + 1),
  );
}
