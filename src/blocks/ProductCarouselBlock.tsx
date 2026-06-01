import React, { useMemo } from 'react';
import DealsSection from '../components/sections/DealsSection';
import type { BlockProps } from './types';
import type { Product } from '../components/features/product/ProductCard';
import { getProductImageSource, productImageCatalogFromApi } from '../utils/productImage';
import { formatProductDiscountLabel, resolveProductOriginalPrice } from '../utils/productPricing';
import { variantRowsFromApiProduct } from '../utils/productVariants';

function normalizeProducts(raw: unknown[]): Product[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p: any) => {
    const id = String(p._id ?? p.id ?? '');
    const rows = variantRowsFromApiProduct({ ...p, id });
    return {
      id,
      name: p.name ?? '',
      image: getProductImageSource(p),
      imageCatalog: productImageCatalogFromApi(p),
      price: typeof p.price === 'number' ? p.price : Number(p.price ?? 0),
      originalPrice: resolveProductOriginalPrice(p),
      discount: formatProductDiscountLabel(p),
      quantity: p.quantity ?? rows[0]?.size ?? '',
      variants: rows,
      gstRate: typeof p.gstRate === 'number' ? p.gstRate : typeof p.taxPercent === 'number' ? p.taxPercent : undefined,
      hierarchyCode: typeof p.hierarchyCode === 'string' ? p.hierarchyCode : undefined,
    };
  });
}

export default function ProductCarouselBlock({
  config,
  data,
  homeBlockIndex,
  firstCarouselBlockIndex,
}: BlockProps) {
  const title = (config?.title as string) || undefined;
  const rawProducts = (data?.products as unknown[]) || [];
  const fetchProducts = useMemo(
    () => async () => normalizeProducts(rawProducts),
    [rawProducts]
  );
  const isFirstCarousel =
    typeof homeBlockIndex === 'number' &&
    typeof firstCarouselBlockIndex === 'number' &&
    firstCarouselBlockIndex >= 0 &&
    homeBlockIndex === firstCarouselBlockIndex;
  return (
    <DealsSection
      title={title}
      fetchProducts={fetchProducts}
      highPriorityImageCount={isFirstCarousel ? 3 : 0}
    />
  );
}
