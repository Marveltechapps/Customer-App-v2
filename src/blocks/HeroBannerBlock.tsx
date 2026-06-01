import React, { useMemo } from 'react';
import Banner from '../components/Banner';
import BannerSingleTap from '../components/BannerSingleTap';
import EmptySectionState from '../components/sections/EmptySectionState';
import type { BlockProps } from './types';
import { getProductImageUrl, pickBannerRawImageUrl } from '../utils/productImage';

function normalizeBanners(raw: unknown[]): Record<string, unknown>[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((b: any) => {
    const out: Record<string, unknown> = {
    uri: getProductImageUrl({
      imageUrl: pickBannerRawImageUrl(b),
      id: String(b._id ?? b.id ?? ''),
      name: b.title,
    }),
    imageUrl: b.imageUrl,
    videoUrl: b.videoUrl,
    link: b.link,
    redirectType: b.redirectType,
    redirectValue: b.redirectValue,
    _id: b._id,
    title: b.title,
    };
    // Preserve legacy default behavior: omit the field when backend doesn't send it.
    if (b && (b.isNavigable === true || b.isNavigable === false || b.isNavigable === null)) {
      out.isNavigable = b.isNavigable;
    }
    return out;
  });
}

export default function HeroBannerBlock({
  config,
  data,
  homeBlockIndex,
  firstBannerBlockIndex,
}: BlockProps) {
  const rawBanners = (data?.banners as unknown[]) || [];
  const bannerCacheKey = useMemo(
    () =>
      JSON.stringify(
        rawBanners.map((b: any) => [b?._id ?? b?.id ?? '', b?.imageUrl ?? b?.uri ?? '', b?.link ?? '']),
      ),
    [rawBanners],
  );
  const banners = useMemo(() => normalizeBanners(rawBanners), [bannerCacheKey]);
  const style = config?.style as { borderRadius?: number; height?: number } | undefined;
  const title = config?.title as string | undefined;
  const isFirstBannerBlock =
    typeof homeBlockIndex === 'number' &&
    typeof firstBannerBlockIndex === 'number' &&
    firstBannerBlockIndex >= 0 &&
    homeBlockIndex === firstBannerBlockIndex;
  /** Multiple resolved banners = carousel; single = static (ignore stale/wrong config.carousel). */
  const useCarousel = banners.length > 1;
  if (banners.length === 0) {
    return <EmptySectionState title={title || 'Highlights'} />;
  }
  if (!useCarousel) {
    return (
      <BannerSingleTap
        banner={banners[0] as Record<string, unknown>}
        layout="hero"
        blockStyle={style}
        isFirstBannerBlock={isFirstBannerBlock}
      />
    );
  }
  return <Banner banners={banners} blockStyle={style} isFirstBannerBlock={isFirstBannerBlock} />;
}
