/**
 * Warm expo-image disk/memory cache for home: P0 first banner slide, P1 first category grid,
 * P2 first three products in the first product/collection carousel, then remaining URLs in block order.
 */
import { Image } from 'expo-image';
import { shouldUseLocalPlaceholder } from '../config/placeholder';
import { getProductImageUrl, pickBannerRawImageUrl } from './productImage';

const PLACEHOLDER_HOST = /placehold\.co/i;
const BATCH_SIZE = 5;
const PRIORITY_PRODUCT_CAP = 3;

function isPrefetchableHttpUrl(u: string): boolean {
  return /^https?:\/\//i.test(u) && !PLACEHOLDER_HOST.test(u) && !shouldUseLocalPlaceholder(u);
}

function addDeduped(bucket: string[], seen: Set<string>, url: string) {
  if (!isPrefetchableHttpUrl(url) || seen.has(url)) return;
  seen.add(url);
  bucket.push(url);
}

function bannerToUrl(b: Record<string, unknown>, idx: number): string {
  const raw = pickBannerRawImageUrl(b as Parameters<typeof pickBannerRawImageUrl>[0]);
  return getProductImageUrl({
    imageUrl: raw,
    id: String(b._id ?? b.id ?? idx),
    name: typeof b.title === 'string' ? b.title : undefined,
  });
}

/**
 * Ordered URL list: priority segment first, then the rest (global dedupe preserves first occurrence).
 */
export function getHomeImagePrefetchUrls(blocks: unknown[] | null | undefined): string[] {
  const priority: string[] = [];
  const rest: string[] = [];
  const seen = new Set<string>();

  let firstBannerBlock = true;
  let firstCategoryGrid = true;
  let firstCarousel = true;
  let priorityProductsLeft = PRIORITY_PRODUCT_CAP;

  for (const block of blocks || []) {
    const b = block as { type?: string; data?: Record<string, unknown> };
    const type = b?.type;
    const data = b?.data || {};

    if (type === 'heroBanner' || type === 'bannerCarousel') {
      const banners = (data.banners as unknown[]) || [];
      for (let i = 0; i < banners.length; i++) {
        const url = bannerToUrl(banners[i] as Record<string, unknown>, i);
        if (firstBannerBlock && i === 0) {
          addDeduped(priority, seen, url);
        } else {
          addDeduped(rest, seen, url);
        }
      }
      firstBannerBlock = false;
    } else if (type === 'categoryGrid') {
      const categories = (data.categories as unknown[]) || [];
      for (const c of categories) {
        const cat = c as Record<string, unknown>;
        const url = getProductImageUrl({
          ...cat,
          id: String(cat._id ?? cat.id ?? ''),
          name: typeof cat.name === 'string' ? cat.name : undefined,
        } as Parameters<typeof getProductImageUrl>[0]);
        addDeduped(firstCategoryGrid ? priority : rest, seen, url);
      }
      firstCategoryGrid = false;
    } else if (type === 'productCarousel' || type === 'collectionCarousel') {
      const products = (data.products as unknown[]) || [];
      for (const p of products) {
        const url = getProductImageUrl(p as Parameters<typeof getProductImageUrl>[0]);
        if (firstCarousel && priorityProductsLeft > 0) {
          addDeduped(priority, seen, url);
          priorityProductsLeft--;
        } else {
          addDeduped(rest, seen, url);
        }
      }
      if (firstCarousel) firstCarousel = false;
    } else if (type === 'lifestyleGrid') {
      const items = (data.items as unknown[]) || [];
      for (const item of items) {
        const it = item as Record<string, unknown>;
        const url = getProductImageUrl({
          ...it,
          id: String(it._id ?? it.id ?? ''),
          name: typeof it.name === 'string' ? it.name : undefined,
        } as Parameters<typeof getProductImageUrl>[0]);
        addDeduped(rest, seen, url);
      }
    } else if (type === 'promoImage') {
      const promoBlocks = data.promoBlocks as Record<string, Record<string, unknown>>;
      if (promoBlocks && typeof promoBlocks === 'object') {
        for (const v of Object.values(promoBlocks)) {
          if (v && typeof v === 'object') {
            const url = getProductImageUrl({ ...(v as object), id: 'promo' } as Parameters<typeof getProductImageUrl>[0]);
            addDeduped(rest, seen, url);
          }
        }
      }
    }
  }

  return [...priority, ...rest];
}

async function prefetchBatch(urls: string[]): Promise<void> {
  await Promise.all(
    urls.map((u) =>
      Image.prefetch(u, { cachePolicy: 'memory-disk' }).catch(() => {
        /* ignore single-URL failures */
      })
    )
  );
}

/**
 * Non-blocking: batches prefetch to limit concurrent network/decodes.
 */
export function prefetchHomeImagesFromBlocks(blocks: unknown[] | null | undefined): void {
  const urls = getHomeImagePrefetchUrls(blocks);
  if (urls.length === 0) return;

  void (async () => {
    try {
      for (let i = 0; i < urls.length; i += BATCH_SIZE) {
        const chunk = urls.slice(i, i + BATCH_SIZE);
        await prefetchBatch(chunk);
      }
    } catch {
      /* ignore */
    }
  })();
}
