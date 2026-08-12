/**
 * Responsive Utilities
 * Production-ready screen sizing helpers for phones and tablets.
 * All scale helpers read live window dimensions so rotation stays correct.
 */

import React, { useMemo } from 'react';
import { Dimensions, PixelRatio, useWindowDimensions } from 'react-native';

/** Design baseline (iPhone 14 Pro) */
export const BASE_WIDTH = 393;
export const BASE_HEIGHT = 852;

/** Breakpoints (shortest side / width) */
export const BREAKPOINTS = {
  smallPhone: 375,
  phone: 430,
  largePhone: 500,
  tablet: 768,
  largeTablet: 1024,
} as const;

type Dims = { width: number; height: number };

function getLiveWindow(): Dims {
  const { width, height } = Dimensions.get('window');
  return { width, height };
}

/**
 * Scale by width vs design baseline.
 * Soft-capped on tablets so UI does not become oversized.
 */
export const scale = (size: number, width?: number): number => {
  const w = width ?? getLiveWindow().width;
  const raw = (w / BASE_WIDTH) * size;
  if (w >= BREAKPOINTS.largeTablet) return size * 1.35;
  if (w >= BREAKPOINTS.tablet) return size * 1.2;
  return raw;
};

export const verticalScale = (size: number, height?: number): number => {
  const h = height ?? getLiveWindow().height;
  const raw = (h / BASE_HEIGHT) * size;
  if (h >= 1100) return size * 1.25;
  if (h >= 900) return size * 1.12;
  return raw;
};

export const moderateScale = (size: number, factor: number = 0.5, width?: number): number => {
  return size + (scale(size, width) - size) * factor;
};

export const getScreenDimensions = (): Dims => getLiveWindow();
export const getWindowDimensions = getScreenDimensions;

export const isTablet = (width?: number): boolean => {
  const w = width ?? getLiveWindow().width;
  return w >= BREAKPOINTS.tablet;
};

export const isLargeTablet = (width?: number): boolean => {
  const w = width ?? getLiveWindow().width;
  return w >= BREAKPOINTS.largeTablet;
};

export const isSmallScreen = (width?: number): boolean => {
  const w = width ?? getLiveWindow().width;
  return w < BREAKPOINTS.smallPhone;
};

export const getPixelRatio = (): number => PixelRatio.get();

export const getSpacing = (size: number, width?: number): number => scale(size, width);

export const wp = (percentage: number, width?: number): number => {
  const w = width ?? getLiveWindow().width;
  return (w * percentage) / 100;
};

export const hp = (percentage: number, height?: number): number => {
  const h = height ?? getLiveWindow().height;
  return (h * percentage) / 100;
};

/**
 * Font scaling — moderated and capped so tablets stay balanced.
 */
export const scaleFont = (
  size: number,
  min?: number,
  max?: number,
  width?: number,
): number => {
  const w = width ?? getLiveWindow().width;
  let scaled = moderateScale(size, 0.35, w);
  if (w >= BREAKPOINTS.largeTablet) scaled = size * 1.15;
  else if (w >= BREAKPOINTS.tablet) scaled = size * 1.08;
  if (min !== undefined && scaled < min) return min;
  if (max !== undefined && scaled > max) return max;
  // Hard safety: never blow up body text past ~1.25× on any device
  const hardMax = max ?? size * 1.25;
  return Math.min(scaled, hardMax);
};

export const getBorderRadius = (size: number, width?: number): number => scale(size, width);

/**
 * Normalized spacing scale (design tokens → device pixels).
 */
export const Spacing = {
  xxs: (w?: number) => getSpacing(2, w),
  xs: (w?: number) => getSpacing(4, w),
  sm: (w?: number) => getSpacing(8, w),
  md: (w?: number) => getSpacing(12, w),
  lg: (w?: number) => getSpacing(16, w),
  xl: (w?: number) => getSpacing(20, w),
  xxl: (w?: number) => getSpacing(24, w),
  section: (w?: number) => getSpacing(32, w),
} as const;

export const getCardWidth = (
  cardsPerRow: number = 2,
  gap: number = 12,
  padding: number = 16,
  screenWidth?: number,
): number => {
  const w = screenWidth ?? getLiveWindow().width;
  const containerPadding = padding * 2;
  const gaps = (cardsPerRow - 1) * gap;
  return (w - containerPadding - gaps) / cardsPerRow;
};

export type TwoColumnCardWidthOpts = {
  horizontalPadding: number;
  columnGap: number;
  sidebarWidth?: number;
};

export const getTwoColumnCardWidth = (
  screenWidth: number,
  opts: TwoColumnCardWidthOpts,
): number => {
  const sidebarWidth = opts.sidebarWidth ?? 0;
  return (screenWidth - sidebarWidth - opts.horizontalPadding - opts.columnGap) / 2;
};

/**
 * Dynamic column count for category / product grids.
 * Phones: 3 · Large phones: 3–4 · Tablets: 4–6 · Large tablets: 5–7
 */
export const getCategoryColumns = (
  screenWidth: number,
  options?: { minColumns?: number; maxColumns?: number; preferredCardWidth?: number },
): number => {
  const minColumns = options?.minColumns ?? 3;
  const maxColumns = options?.maxColumns ?? 7;
  const preferred = options?.preferredCardWidth ?? 110;
  const horizontalPadding = 16 * 2;
  const gap = 12;
  const available = Math.max(200, screenWidth - horizontalPadding);

  let cols = Math.floor((available + gap) / (preferred + gap));
  cols = Math.max(minColumns, Math.min(maxColumns, cols));

  if (screenWidth >= BREAKPOINTS.largeTablet) cols = Math.max(cols, 6);
  else if (screenWidth >= BREAKPOINTS.tablet) cols = Math.max(cols, 4);
  else if (screenWidth >= BREAKPOINTS.largePhone) cols = Math.max(cols, 3);
  else cols = Math.min(cols, 3);

  return Math.max(minColumns, Math.min(maxColumns, cols));
};

export type GridMetrics = {
  columns: number;
  cardWidth: number;
  gap: number;
  horizontalPadding: number;
};

/**
 * Equal-width grid metrics — cards fill the row with even gaps (no max-width clamp).
 */
export const getGridMetrics = (
  screenWidth: number,
  options?: {
    columns?: number;
    gap?: number;
    horizontalPadding?: number;
    minColumns?: number;
    maxColumns?: number;
    preferredCardWidth?: number;
  },
): GridMetrics => {
  const horizontalPadding = options?.horizontalPadding ?? 16;
  const gap = options?.gap ?? 12;
  const columns =
    options?.columns ??
    getCategoryColumns(screenWidth, {
      minColumns: options?.minColumns,
      maxColumns: options?.maxColumns,
      preferredCardWidth: options?.preferredCardWidth,
    });
  const available = Math.max(
    120,
    screenWidth - horizontalPadding * 2 - gap * Math.max(0, columns - 1),
  );
  const cardWidth = Math.floor(available / columns);
  return { columns, cardWidth, gap, horizontalPadding };
};

/** Hero video aspect from design (≈ 0.89 width/height inverted → height/width). */
export const VIDEO_HERO_ASPECT = 340 / 381;

/**
 * Full-width hero video height with soft min/max for phones and tablets.
 */
export const getVideoHeroHeight = (screenWidth: number): number => {
  const base = screenWidth * VIDEO_HERO_ASPECT * 1.12;
  if (screenWidth >= BREAKPOINTS.largeTablet) {
    return Math.min(Math.max(base, 360), 520);
  }
  if (screenWidth >= BREAKPOINTS.tablet) {
    return Math.min(Math.max(base, 340), 460);
  }
  return Math.min(Math.max(base, 280), 420);
};

/**
 * Dashboard home banners are standardized to 21:9 (width ÷ height).
 * Promo rail stays a shorter strip (~3.6:1) for the greens/coupon style.
 */
export const BANNER_ASPECT = {
  hero: 21 / 9,
  secondary: 21 / 9,
  promo: 349 / 96,
} as const;

export type BannerVariant = keyof typeof BANNER_ASPECT;

/** Parse CMS aspect strings like "21:9" → width/height. `auto` → null. */
export const parseBannerAspectRatio = (raw?: string | null): number | null => {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s || s === 'auto') return null;
  const m = s.match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!(w > 0) || !(h > 0)) return null;
  return w / h;
};

/** CMS contentFit → expo-image fit (`fill` maps to cover so creatives fill the card). */
export const resolveBannerContentFit = (
  raw?: string | null,
): 'cover' | 'contain' => {
  const f = String(raw ?? '').trim().toLowerCase();
  if (f === 'contain' || f === 'none') return 'contain';
  return 'cover';
};

/**
 * Banner slide height from available width + aspect (width ÷ height).
 * Soft clamps keep phone/tablet cards compact without locking a fixed px height.
 */
export const getBannerHeight = (
  slideWidth: number,
  variant: BannerVariant = 'secondary',
  aspectOverride?: number | null,
): number => {
  const aspect =
    aspectOverride != null && aspectOverride > 0
      ? aspectOverride
      : BANNER_ASPECT[variant];
  const height = slideWidth / aspect;
  if (variant === 'hero') return Math.round(Math.min(Math.max(height, 110), 260));
  if (variant === 'promo') return Math.round(Math.min(Math.max(height, 64), 140));
  return Math.round(Math.min(Math.max(height, 100), 220));
};

export type BannerSlideMetricsOpts = {
  variant?: BannerVariant;
  /** CMS `aspectRatio` string or numeric width/height */
  aspectRatio?: string | number | null;
  /** CMS `dimensions.preferredHeight` (design px) — used as a soft max */
  preferredHeight?: number | null;
  /** Block style height override (design px) — scaled to slide width */
  blockHeight?: number | null;
  screenWidth?: number;
};

/**
 * Resolve banner card height for the current slide width.
 * Prefer fluid aspect ratio; scale CMS px heights vs design baseline.
 */
export const resolveBannerSlideHeight = (
  slideWidth: number,
  opts: BannerSlideMetricsOpts = {},
): number => {
  const variant = opts.variant ?? 'secondary';
  const screenW = opts.screenWidth ?? slideWidth;
  const parsedAspect =
    typeof opts.aspectRatio === 'number' && opts.aspectRatio > 0
      ? opts.aspectRatio
      : parseBannerAspectRatio(
          typeof opts.aspectRatio === 'string' ? opts.aspectRatio : null,
        );

  if (opts.blockHeight != null && opts.blockHeight > 0) {
    return Math.round(scale(opts.blockHeight, screenW));
  }

  let height = getBannerHeight(slideWidth, variant, parsedAspect);
  if (opts.preferredHeight != null && opts.preferredHeight > 0) {
    const maxH = scale(opts.preferredHeight, screenW);
    height = Math.min(height, maxH);
  }
  return height;
};

/** Aspect ratio (width/height) for RN `aspectRatio` style — keeps cards fluid on rotate. */
export const getBannerAspectRatio = (
  variant: BannerVariant = 'secondary',
  aspectOverride?: string | number | null,
): number => {
  if (typeof aspectOverride === 'number' && aspectOverride > 0) return aspectOverride;
  const parsed =
    typeof aspectOverride === 'string' ? parseBannerAspectRatio(aspectOverride) : null;
  return parsed ?? BANNER_ASPECT[variant];
};

/**
 * Horizontal product card width for carousels.
 */
export const getProductCarouselCardWidth = (screenWidth: number): number => {
  if (screenWidth >= BREAKPOINTS.largeTablet) return Math.min(160, screenWidth * 0.14);
  if (screenWidth >= BREAKPOINTS.tablet) return Math.min(148, screenWidth * 0.18);
  if (screenWidth >= BREAKPOINTS.largePhone) return Math.min(140, screenWidth * 0.32);
  return Math.min(126.5, (screenWidth - 32 - 12) / 2.4);
};

/**
 * Hook: live window dimensions (updates on rotation).
 */
export const useDimensions = () => {
  const { width, height } = useWindowDimensions();
  return useMemo(() => ({ width, height }), [width, height]);
};

/**
 * Hook: live dimensions + bound helpers that recompute on resize/rotation.
 */
export const useResponsive = () => {
  const { width, height } = useWindowDimensions();
  return useMemo(
    () => ({
      width,
      height,
      isTablet: width >= BREAKPOINTS.tablet,
      isLargeTablet: width >= BREAKPOINTS.largeTablet,
      isSmallScreen: width < BREAKPOINTS.smallPhone,
      isLandscape: width > height,
      scale: (size: number) => scale(size, width),
      verticalScale: (size: number) => verticalScale(size, height),
      moderateScale: (size: number, factor?: number) => moderateScale(size, factor, width),
      scaleFont: (size: number, min?: number, max?: number) => scaleFont(size, min, max, width),
      wp: (pct: number) => wp(pct, width),
      hp: (pct: number) => hp(pct, height),
      spacing: (size: number) => getSpacing(size, width),
      getCategoryColumns: (opts?: Parameters<typeof getCategoryColumns>[1]) =>
        getCategoryColumns(width, opts),
      getGridMetrics: (opts?: Parameters<typeof getGridMetrics>[1]) => getGridMetrics(width, opts),
      getVideoHeroHeight: () => getVideoHeroHeight(width),
      getBannerHeight: (
        slideWidth: number,
        variant?: BannerVariant,
        aspectOverride?: number | null,
      ) => getBannerHeight(slideWidth, variant, aspectOverride),
      resolveBannerSlideHeight: (slideWidth: number, opts?: BannerSlideMetricsOpts) =>
        resolveBannerSlideHeight(slideWidth, { ...opts, screenWidth: opts?.screenWidth ?? width }),
      getBannerAspectRatio: (
        variant?: BannerVariant,
        aspectOverride?: string | number | null,
      ) => getBannerAspectRatio(variant, aspectOverride),
      resolveBannerContentFit,
      productCardWidth: getProductCarouselCardWidth(width),
    }),
    [width, height],
  );
};
