import { logger } from '@/utils/logger';
import { getApiErrorMessage } from '../services/api/types';
import type { AppConfigData } from '../contexts/AppConfigContext';
import { homeService } from '../services/home/homeService';
import { couponService, type Coupon } from '../services/coupons/couponService';
import processLegacyHomeBanners from './enrichHomeBannerBlocks';
import { prefetchHomeImagesFromBlocks } from './prefetchHomeImages';
import { getProductImageSource } from './productImage';

export type HomeConfigState = {
  searchPlaceholder?: string;
  heroVideoUrl?: string;
  categorySectionTitle?: string;
  organicTagline?: string;
  organicIconUrl?: string;
  deliveryTypeLabel?: string;
} | null;

export type CategoryListItem = {
  id: string;
  name: string;
  image: ReturnType<typeof getProductImageSource>;
};

export type CategoryGroup = {
  id: string;
  title: string;
  categories: CategoryListItem[];
};

export async function processBootstrapHomeBlocks(
  bootstrapData: Record<string, unknown>,
): Promise<any[]> {
  const homePage = (bootstrapData.pages as { home?: { blocks?: unknown[] } } | undefined)?.home;
  if (!homePage?.blocks?.length) return [];

  const legacySectionDefinitions = (bootstrapData as { legacy?: { config?: { sectionDefinitions?: unknown[] } } })
    ?.legacy?.config?.sectionDefinitions;
  const sectionLabelByKey = new Map(
    Array.isArray(legacySectionDefinitions)
      ? legacySectionDefinitions
          .filter((d: { key?: string; label?: string }) => d?.key && d?.label)
          .map((d: { key: string; label: string }) => [String(d.key), String(d.label)])
      : [],
  );

  const correctedBlocks = (homePage.blocks || []).map((block: { type?: string; id?: string; config?: Record<string, unknown> }) => {
    if (block?.type !== 'categoryGrid') return block;
    const id = String(block?.id ?? '');
    const match = id.match(/^legacy-(.+)-\d+$/);
    if (!match) return block;
    const sectionKey = match[1];
    const correctTitle = sectionLabelByKey.get(sectionKey);
    if (!correctTitle) return block;
    return {
      ...block,
      config: {
        ...(block.config || {}),
        title: correctTitle,
      },
    };
  });

  const legacy = (bootstrapData as { legacy?: { bannerIdsByKey?: Record<string, string[]> } })?.legacy;
  try {
    if (typeof processLegacyHomeBanners === 'function') {
      return await processLegacyHomeBanners(correctedBlocks, legacy);
    }
    logger.warn('processLegacyHomeBanners is not a function');
  } catch (e) {
    logger.error('Error in processLegacyHomeBanners', e);
  }
  return correctedBlocks;
}

export async function mapHomePayloadToCategoryGroups(): Promise<CategoryGroup[]> {
  const res = await homeService.getHomePayload();
  const data = res?.data ?? res;
  const rawCategories = data?.categories ?? [];
  const typeByKey = data?.typeByKey ?? {};
  const sectionKey = Object.keys(typeByKey).find((k) => typeByKey[k] === 'super_category');
  const sectionDef = sectionKey
    ? (data?.config?.sectionDefinitions ?? []).find((d: { key?: string }) => d.key === sectionKey)
    : null;
  const sectionTitle: string | undefined = sectionDef?.label;
  if (!sectionTitle) return [];

  if (!Array.isArray(rawCategories) || rawCategories.length === 0) {
    return [{ id: 'main', title: sectionTitle, categories: [] }];
  }

  const categories: CategoryListItem[] = rawCategories.map((c: { _id?: string; id?: string; name?: string; imageUrl?: string }) => ({
    id: String(c._id ?? c.id),
    name: c.name ?? '',
    image: getProductImageSource({
      imageUrl: c.imageUrl,
      name: c.name,
      id: String(c._id ?? c.id ?? ''),
    }),
  }));

  return [{ id: 'main', title: sectionTitle, categories }];
}

export async function fetchHomeCouponsList(): Promise<Coupon[]> {
  try {
    const res = await couponService.listCoupons({});
    if (res.success && res.data?.coupons) {
      return res.data.coupons
        .filter((c) => c.showInSections?.includes('HOME_BANNER'))
        .sort((a, b) => (a.priorityRank || 10) - (b.priorityRank || 10));
    }
  } catch (err) {
    logger.warn('Failed to fetch home coupons', err);
  }
  return [];
}

export type CatalogBootstrapResult = {
  bootstrapData: Record<string, unknown> | null;
  homeConfig: HomeConfigState;
  cmsBlocks: any[] | null;
  appConfig: AppConfigData | null;
  homeError: string | null;
};

export async function loadCatalogBootstrapSession(): Promise<CatalogBootstrapResult> {
  try {
    const bootstrapResp = await homeService.getBootstrap();
    if (!bootstrapResp?.success || !bootstrapResp?.data) {
      return {
        bootstrapData: null,
        homeConfig: null,
        cmsBlocks: null,
        appConfig: null,
        homeError: 'Failed to load home data',
      };
    }

    const data = bootstrapResp.data as Record<string, unknown>;
    const homeConfig = (data.homeConfig as HomeConfigState) ?? null;
    const appConfig = (data as { appConfig?: AppConfigData }).appConfig ?? null;
    const homePage = (data.pages as { home?: { blocks?: unknown[] } } | undefined)?.home;

    if (homePage?.blocks?.length) {
      const blocks = await processBootstrapHomeBlocks(data);
      prefetchHomeImagesFromBlocks(blocks);
      return {
        bootstrapData: data,
        homeConfig,
        cmsBlocks: blocks,
        appConfig,
        homeError: null,
      };
    }

    return {
      bootstrapData: data,
      homeConfig,
      cmsBlocks: [],
      appConfig,
      homeError: 'No home content configured.',
    };
  } catch (err) {
    const msg = getApiErrorMessage(err, 'Failed to load home data');
    logger.error('Home bootstrap failed', { message: msg });
    let homeError = msg;
    if (String(msg).toLowerCase().includes('internal server error') || String(msg).toLowerCase().includes('500')) {
      homeError = 'Server error while loading home. Some content may be missing.';
    }
    return {
      bootstrapData: null,
      homeConfig: null,
      cmsBlocks: null,
      appConfig: null,
      homeError,
    };
  }
}
