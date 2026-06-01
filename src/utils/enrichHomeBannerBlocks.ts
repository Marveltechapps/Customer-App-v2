import { logger } from '@/utils/logger';
import { bannerService } from '../services/banner/bannerService';

export type LegacyBannerIdsPayload = {
  bannerIdsByKey?: Record<string, string[]>;
};

/**
 * If bootstrap `pages.home.blocks` has fewer resolved `data.banners` than the section's
 * configured `bannerIds` (e.g. home payload dropped inactive/missing rows), fetch each
 * banner by id so carousel (dots + swipe) can render for blocks like Giri-10, and so
 * single static banner sections still appear when the only slide was missing from the payload.
 */
export async function processLegacyHomeBanners(
  blocks: any[],
  legacy: LegacyBannerIdsPayload | null | undefined
): Promise<any[]> {
  if (!legacy?.bannerIdsByKey || !Array.isArray(blocks)) return blocks;

  const bannerIdsByKey = legacy.bannerIdsByKey;
  const out: any[] = [];

  for (const block of blocks) {
    if (block?.type !== 'heroBanner' && block?.type !== 'bannerCarousel') {
      out.push(block);
      continue;
    }

    const m = String(block?.id ?? '').match(/^legacy-(.+)-(\d+)$/);
    const sk = m ? m[1] : '';
    const ids = sk ? bannerIdsByKey[sk] : undefined;
    const cur = Array.isArray(block.data?.banners) ? block.data.banners : [];

    if (!ids || ids.length === 0) {
      out.push(block);
      continue;
    }
    // Single-banner sections (e.g. "Giri Plants · Static") must still be enriched when bootstrap
    // resolved 0 slides but legacy.bannerIdsByKey has the id (inactive/missed row).
    if (cur.length >= ids.length) {
      out.push(block);
      continue;
    }

    const byId = new Map<string, any>();
    for (const b of cur) {
      const id = String((b as any)?._id ?? (b as any)?.id ?? '');
      if (id) byId.set(id, b);
    }

    const missing = ids.filter((id) => id && !byId.has(String(id)));
    if (missing.length > 0) {
      const pairs = await Promise.all(
        missing.map(async (id) => {
          try {
            const res = await bannerService.getById(String(id));
            const doc = res?.success && res.data ? res.data : null;
            if (doc && ((doc as any).imageUrl || (doc as any).videoUrl)) {
              return [String(id), doc] as const;
            }
          } catch (e) {
            logger.warn('enrichHomeBannerBlocks: fetch banner failed', { id, e });
          }
          return null;
        })
      );
      for (const pair of pairs) {
        if (pair) byId.set(pair[0], pair[1]);
      }
    }

    const ordered = ids.map((id) => byId.get(String(id))).filter(Boolean);
    // Apply whenever we recovered missing slides (including 1 static banner that was empty before).
    if (ordered.length > cur.length) {
      out.push({
        ...block,
        data: { ...block.data, banners: ordered },
        config: { ...(block.config || {}), carousel: ordered.length > 1 },
      });
    } else {
      out.push(block);
    }
  }

  return out;
}

export default processLegacyHomeBanners;
