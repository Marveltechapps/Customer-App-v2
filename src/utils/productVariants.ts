import type { ImageSourcePropType } from 'react-native';
import type { ProductVariant } from '../components/features/product/ProductVariantModal';
import { getProductImageSource } from './productImage';
import * as productService from '../services/products/productService';

/** Same rules as customer-backend `productBaseName` — group only true size SKUs of one catalog title. */
export function productBaseName(name: string | undefined | null): string {
  if (name == null || typeof name !== 'string') return '';
  let s = name.trim().replace(/\s+/g, ' ');
  s = s.replace(/\s*[-–—]\s*\d+(\.\d+)?\s*(g|kg|ml|mL|l|L|pc|pcs|pack)\b\s*$/i, '').trim();
  s = s.replace(/\s+\d+(\.\d+)?\s*(g|kg|ml|mL|l|L)\s*$/i, '').trim();
  return s.toLowerCase();
}

/** Same as backend `productLineDedupeKey` — one carousel card per product line. */
export function productLineDedupeKey(name: string | undefined | null): string {
  const base = productBaseName(name);
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 3) {
    return parts.slice(1).join(' ');
  }
  return base;
}

type ProductLikeForDedupe = {
  id?: string;
  _id?: string;
  name?: string;
  hierarchyCode?: string;
};

/** Deduplicate list payloads (e.g. similar products) — one card per product line (see backend `dedupeProductsByBaseName`). */
export function dedupeProductsByProductLine<T extends ProductLikeForDedupe>(
  products: T[],
  maxCount?: number,
): T[] {
  if (!Array.isArray(products) || products.length === 0) return products;
  const seen = new Set<string>();
  const out: T[] = [];
  for (const p of products) {
    const idFallback = p.id ?? (p._id != null ? String(p._id) : '');
    const line = productLineDedupeKey(p.name);
    const code = p.hierarchyCode && String(p.hierarchyCode).trim();
    const key = code ? `h:${code}::${line || idFallback}` : line || `__id:${idFallback}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
    if (typeof maxCount === 'number' && maxCount > 0 && out.length >= maxCount) break;
  }
  return out;
}

function filterVariantRowsToProductLine(
  parentName: string | undefined,
  rows: ProductVariantRow[],
): ProductVariantRow[] {
  const base = productBaseName(parentName);
  if (!base || rows.length <= 1) return rows;
  if (!rows.some((r) => r.name)) return rows;
  const filtered = rows.filter((r) => !r.name || productBaseName(r.name) === base);
  return filtered.length > 0 ? filtered : rows;
}

/** Normalized variant row from customer API (list, search, category, product detail). */
export interface ProductVariantRow {
  id: string;
  /** Purchasable product document id (parent for embedded variants; SKU id for hierarchy siblings). */
  productId?: string;
  /** Catalog title for this SKU (when hierarchy siblings are separate docs). Used to drop wrong rows. */
  name?: string;
  size: string;
  price?: number;
  originalPrice?: number;
  /** Optional per-SKU media (hierarchy siblings or enriched API rows). */
  imageUrl?: string;
  thumbnailUrl?: string;
  cardImageUrl?: string;
  images?: string[];
}

/**
 * Build `{ id, size }[]` for ProductCard when only lightweight options are needed.
 */
export function cardOptionsFromVariantRows(rows: ProductVariantRow[]): Array<{ id: string; size: string }> {
  return rows.map((v) => ({ id: v.id, size: v.size }));
}

/**
 * Resolve variant rows from a product-like API object (or empty → single default line).
 */
export function variantRowsFromApiProduct(p: {
  id?: string;
  _id?: string;
  variants?: unknown;
  price?: number;
  originalPrice?: number;
  mrp?: number;
  quantity?: string;
  size?: string;
}): ProductVariantRow[] {
  const raw = p?.variants;
  const pid = String(p.id ?? p._id ?? '');
  if (!Array.isArray(raw) || raw.length === 0) {
    if (!pid) return [];
    const anyP = p as Record<string, unknown>;
    const single: ProductVariantRow[] = [
      {
        id: pid,
        productId: pid,
        name: typeof p.name === 'string' ? p.name : undefined,
        size: String(p.quantity ?? p.size ?? '').trim() || '1 unit',
        price: typeof p.price === 'number' ? p.price : Number(p.price ?? 0),
        originalPrice:
          typeof p.originalPrice === 'number'
            ? p.originalPrice
            : Number(p.mrp ?? p.originalPrice ?? p.price ?? 0),
        imageUrl: typeof anyP.imageUrl === 'string' ? anyP.imageUrl : undefined,
        thumbnailUrl: typeof anyP.thumbnailUrl === 'string' ? anyP.thumbnailUrl : undefined,
        cardImageUrl: typeof anyP.cardImageUrl === 'string' ? anyP.cardImageUrl : undefined,
        images: Array.isArray(anyP.images) ? (anyP.images as string[]) : undefined,
      },
    ];
    return single;
  }
  const mapped = raw.map((v: any, i: number) => {
    const id = String(v.id ?? v._id ?? `${pid}-v${i}`);
    const productId = String(v.productId ?? v.id ?? v._id ?? pid);
    return {
      id,
      productId,
      name: typeof v.name === 'string' ? v.name : undefined,
      size: String(v.size ?? v.quantity ?? '').trim() || '1 unit',
      price: typeof v.price === 'number' ? v.price : v.price != null ? Number(v.price) : undefined,
      originalPrice:
        typeof v.originalPrice === 'number'
          ? v.originalPrice
          : v.originalPrice != null
            ? Number(v.originalPrice)
            : v.mrp != null
              ? Number(v.mrp)
              : undefined,
      imageUrl: typeof v.imageUrl === 'string' ? v.imageUrl : undefined,
      thumbnailUrl: typeof v.thumbnailUrl === 'string' ? v.thumbnailUrl : undefined,
      cardImageUrl: typeof v.cardImageUrl === 'string' ? v.cardImageUrl : undefined,
      images: Array.isArray(v.images) ? v.images : undefined,
    };
  });
  const parentName = typeof p.name === 'string' ? p.name : undefined;
  return filterVariantRowsToProductLine(parentName, mapped);
}

function variantRowHasImage(v: ProductVariantRow): boolean {
  return Boolean(
    (v.imageUrl && v.imageUrl.trim()) ||
      (v.thumbnailUrl && v.thumbnailUrl.trim()) ||
      (v.cardImageUrl && v.cardImageUrl.trim()) ||
      (Array.isArray(v.images) && v.images.length > 0)
  );
}

export function buildModalVariantsFromRows(
  product: {
    image: ImageSourcePropType;
    discount: string;
    price: number;
    originalPrice: number;
    name?: string;
    id?: string;
  },
  rows: ProductVariantRow[],
  getLineQuantity: (productId: string, variantId: string) => number,
  cardProductId?: string,
): ProductVariant[] {
  const cardId = String(cardProductId ?? product.id ?? '').trim();
  return rows.map((v) => {
    const lineProductId = String(v.productId ?? cardId).trim();
    const image = variantRowHasImage(v)
      ? getProductImageSource({
          name: product.name,
          id: product.id,
          imageUrl: v.imageUrl,
          thumbnailUrl: v.thumbnailUrl,
          cardImageUrl: v.cardImageUrl,
          images: v.images,
        })
      : product.image;
    return {
      id: v.id,
      productId: lineProductId,
      size: v.size,
      image,
      price: v.price ?? product.price,
      originalPrice: v.originalPrice ?? product.originalPrice,
      discount: product.discount,
      quantity: getLineQuantity(lineProductId, v.id),
    };
  });
}

function formatDiscountFromProduct(product: Record<string, unknown> | null | undefined): string {
  if (!product) return '';
  const existing = product.discount;
  if (existing != null && String(existing).trim()) return String(existing);
  const mrp = Number(product.mrp || product.originalPrice || 0);
  const price = Number(product.price || 0);
  if (mrp > 0 && price > 0 && mrp > price) {
    const pct = Math.round(((mrp - price) / mrp) * 100);
    return pct > 0 ? `${pct}% OFF` : '';
  }
  return '';
}

/**
 * Loads the canonical variant list from GET /products/:id (same as PDP).
 * Use for variant drawers on home, search, and category when list payloads only embed partial rows.
 */
export async function fetchModalVariantsForProduct(
  productId: string,
  getLineQuantity: (productId: string, variantId: string) => number,
): Promise<ProductVariant[]> {
  const resp = await productService.getProductDetail(productId);
  if (!resp?.success || !resp.data) {
    return [];
  }
  const payloadAny = resp.data as {
    product?: Record<string, unknown>;
    variants?: unknown[];
  };
  const product = payloadAny?.product ?? (payloadAny as Record<string, unknown>);
  const variantsRaw = Array.isArray(payloadAny?.variants) ? payloadAny.variants : [];
  const pidStr = String(product?._id ?? product?.id ?? productId);
  const pname = String(product?.name ?? '');
  const productAny = product as Record<string, unknown> & {
    _id?: string;
    id?: string;
    name?: string;
    price?: number;
    mrp?: number;
    originalPrice?: number;
  };
  const rows =
    variantsRaw.length > 0
      ? variantRowsFromApiProduct({ ...productAny, id: pidStr, name: pname, variants: variantsRaw })
      : variantRowsFromApiProduct({ ...productAny, id: pidStr, name: pname });
  const discount = formatDiscountFromProduct(productAny);
  const fallbackImg = getProductImageSource({ name: pname, id: pidStr, ...productAny });
  return buildModalVariantsFromRows(
    {
      image: fallbackImg,
      discount,
      price: Number(productAny.price ?? 0),
      originalPrice: Number(productAny.mrp ?? productAny.originalPrice ?? productAny.price ?? 0),
      name: pname,
      id: pidStr,
    },
    rows,
    getLineQuantity,
    pidStr,
  );
}
