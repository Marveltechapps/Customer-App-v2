import type { CartItem } from '../contexts/CartContext';
import type { ProductVariantRow } from './productVariants';
import {
  type CartLineLike,
  findCartLine,
  getLineQuantityFromItems,
  matchCartLine,
  normalizeVariantId,
  resolveCartAddPayload,
} from './cartLineIdentity';

export interface ResolvedProductCartLine {
  /** Purchasable product id for API calls */
  productId: string;
  /** Normalized variant id for API calls */
  variantId: string;
  quantity: number;
  cartLine?: CartItem;
  activeVariantId: string;
}

export function resolveVariantRowProductId(
  row: Pick<ProductVariantRow, 'id' | 'productId'>,
  cardProductId: string,
): string {
  return String(row.productId ?? cardProductId).trim();
}

export function isVariantRowInCart(
  cartItems: CartLineLike[],
  row: Pick<ProductVariantRow, 'id' | 'productId'>,
  cardProductId: string,
): boolean {
  const pid = resolveVariantRowProductId(row, cardProductId);
  return cartItems.some(
    (it) => (it.quantity ?? 0) > 0 && matchCartLine(it, pid, row.id),
  );
}

/**
 * Resolve cart-backed quantity and API keys for a product card.
 * Handles hierarchy siblings, embedded variants, and normalized server ids.
 */
export function resolveProductCartLine(
  cartItems: CartItem[],
  cardProductId: string,
  variantRows: ProductVariantRow[],
  selectedVariantId?: string,
): ResolvedProductCartLine {
  const activeVariantId =
    selectedVariantId || variantRows[0]?.id || cardProductId;
  const activeRow =
    variantRows.find((r) => r.id === activeVariantId) || variantRows[0];
  const defaultProductId = activeRow
    ? resolveVariantRowProductId(activeRow, cardProductId)
    : cardProductId;
  const defaultVariantId = activeRow
    ? normalizeVariantId(defaultProductId, activeRow.id)
    : normalizeVariantId(cardProductId, cardProductId);

  const searchOrder = activeRow
    ? [activeRow, ...variantRows.filter((r) => r.id !== activeRow.id)]
    : variantRows;

  for (const row of searchOrder) {
    const pid = resolveVariantRowProductId(row, cardProductId);
    const line = cartItems.find(
      (it) => it.quantity > 0 && matchCartLine(it, pid, row.id),
    );
    if (line) {
      return {
        productId: line.productId,
        variantId: line.variantId,
        quantity: line.quantity,
        cartLine: line,
        activeVariantId: row.id,
      };
    }
  }

  const fallbackLine = cartItems.find((it) => {
    if (it.quantity <= 0) return false;
    if (String(it.productId) === String(cardProductId)) return true;
    return variantRows.some((r) => {
      const pid = resolveVariantRowProductId(r, cardProductId);
      return matchCartLine(it, pid, r.id);
    });
  });

  if (fallbackLine) {
    const matchedRow =
      variantRows.find((r) =>
        matchCartLine(
          fallbackLine,
          resolveVariantRowProductId(r, cardProductId),
          r.id,
        ),
      ) ?? activeRow;
    return {
      productId: fallbackLine.productId,
      variantId: fallbackLine.variantId,
      quantity: fallbackLine.quantity,
      cartLine: fallbackLine,
      activeVariantId: matchedRow?.id ?? activeVariantId,
    };
  }

  return {
    productId: defaultProductId,
    variantId: defaultVariantId,
    quantity: 0,
    activeVariantId,
  };
}

export function buildCartItemPayload(
  cardProductId: string,
  productName: string,
  row: ProductVariantRow,
  product: {
    image: unknown;
    price: number;
    originalPrice: number;
    discount: string;
    gstRate?: number;
  },
): Omit<CartItem, 'quantity'> {
  const productId = resolveVariantRowProductId(row, cardProductId);
  const { variantId } = resolveCartAddPayload(productId, row.id);
  return {
    variantId,
    productId,
    productName,
    variantSize: row.size,
    image: product.image,
    price: row.price ?? product.price,
    originalPrice: row.originalPrice ?? product.originalPrice,
    discount: product.discount,
    gstRate: typeof product.gstRate === 'number' ? product.gstRate : 0,
  };
}

export { getLineQuantityFromItems, findCartLine, resolveCartAddPayload };
