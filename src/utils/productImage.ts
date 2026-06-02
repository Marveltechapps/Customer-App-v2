/**
 * Product / CMS image URL helper.
 *
 * Bootstrap contract (see backend `customerMediaEnrichment.js`): prefer display-sized fields when set.
 * Resolution order:
 * - Products & categories: `thumbnailUrl` → `cardImageUrl` → `images[0]` → `imageUrl` → nested `image`
 * - Banners: `bannerImageUrl` → `thumbnailUrl` → `imageUrl` → `uri` → nested `image`
 *
 * Returns empty string when no catalog URL resolves (no bundled placeholders).
 */
import {
  imageSourceFromResolvedUrl,
  isRemotePlaceholderServiceUrl,
  shouldUseLocalPlaceholder,
} from '../config/placeholder';
import type { ImageSourcePropType } from 'react-native';
import { getEnvConfigSafe, rewriteLocalhostInMediaUrl } from '../config/env';
import { logger } from './logger';

export type ImageFit = 'cover' | 'contain';
export const IMAGE_RETRY_MAX_ATTEMPTS = 3;

export function getImageFitFromUrl(url: string | null | undefined): ImageFit {
  if (typeof url !== 'string') return 'contain';
  const raw = url.trim();
  if (!raw) return 'contain';

  // Detect tags from path/filename; ignore query string (?w=...&q=...).
  const path = raw.split('?')[0]?.toLowerCase() ?? '';
  if (!path) return 'contain';

  // If both appear, prefer `withbg` (explicitly requests filled treatment).
  if (path.includes('withbg')) return 'cover';
  if (path.includes('withoutbg')) return 'contain';
  return 'contain';
}

export function buildRetriableImageUrl(url: string, attempt: number): string {
  const trimmed = typeof url === 'string' ? url.trim() : '';
  if (!trimmed) return '';
  if (shouldUseLocalPlaceholder(trimmed)) return trimmed;

  const safeAttempt = Math.max(0, attempt);
  const ts = Date.now();
  try {
    const u = new URL(trimmed);
    u.searchParams.set('__img_retry', String(safeAttempt));
    u.searchParams.set('__img_ts', String(ts));
    return u.toString();
  } catch {
    const sep = trimmed.includes('?') ? '&' : '?';
    return `${trimmed}${sep}__img_retry=${safeAttempt}&__img_ts=${ts}`;
  }
}

export function getRetryDelayMs(attempt: number): number {
  // Exponential backoff in 1s-3s range.
  const safeAttempt = Math.max(1, attempt);
  return Math.min(1000 * Math.pow(2, safeAttempt - 1), 3000);
}

/** HTTP status from CDN that means the catalog URL will not load — skip retries. */
export function isUnreachableImageHttpStatus(status: number): boolean {
  return status === 404 || status === 410 || status >= 500;
}

export function isPermanentImageLoadFailure(errorLike: unknown): boolean {
  const text = String((errorLike as { message?: string })?.message ?? errorLike ?? '').toLowerCase();
  if (!text) return false;
  if (text.includes('404') || text.includes('410')) return true;
  if (text.includes('status code 404') || text.includes('status code 410')) return true;
  if (text.includes('status code 5')) return true;
  if (text.includes('invalid response status code 5')) return true;
  return false;
}

export function classifyImageNetworkError(errorLike: unknown): string {
  const text = String((errorLike as { message?: string })?.message ?? errorLike ?? '').toLowerCase();
  if (!text) return 'unknown';
  if (text.includes('timeout') || text.includes('timed out') || text.includes('abort')) return 'timeout';
  if (
    text.includes('ssl') ||
    text.includes('certificate') ||
    text.includes('cert') ||
    text.includes('trust') ||
    text.includes('secure connection')
  ) {
    return 'certificate';
  }
  if (text.includes('network') || text.includes('internet') || text.includes('offline')) return 'network';
  return 'unknown';
}

/** Decode each path segment fully, then re-encode (fixes %26 → %2526 from decodeURI). */
/**
 * SKU master import adds ?q=&w= for resizing; static CloudFront PNG/JPEG URLs often 500 with those params.
 */
export function stripStaticImageOptimizerParams(url: string): string {
  const trimmed = String(url || '').trim();
  if (!trimmed) return trimmed;
  try {
    const u = new URL(trimmed);
    const path = u.pathname.toLowerCase();
    const isStaticAsset = /\.(png|jpe?g|webp|gif|avif|bmp|svg)$/i.test(path);
    const isCdnHost =
      u.hostname.includes('cloudfront.net') ||
      u.hostname.includes('amazonaws.com') ||
      u.pathname.includes('/prod/products/');
    if (isStaticAsset || isCdnHost) {
      u.searchParams.delete('q');
      u.searchParams.delete('w');
    }
    return u.toString();
  } catch {
    return trimmed
      .replace(/([?&])q=\d+(&|$)/gi, '$2')
      .replace(/([?&])w=\d+(&|$)/gi, '$2')
      .replace(/\?&/, '?')
      .replace(/[?&]$/, '');
  }
}

export function normalizeMediaPathname(pathname: string): string {
  return pathname
    .split('/')
    .map((segment) => {
      if (!segment) return '';
      try {
        const decoded = decodeURIComponent(segment.replace(/\+/g, ' '));
        return encodeURIComponent(decoded);
      } catch {
        try {
          return encodeURIComponent(decodeURIComponent(segment));
        } catch {
          return segment;
        }
      }
    })
    .join('/');
}

function resolveImageUrl(inputUrl: string): string | null {
  let url = inputUrl?.trim();
  if (!url) return null;

  // Normalize common malformed protocol variants from APIs.
  if (/^https?:\/(?!\/)/i.test(url)) {
    url = url.replace(/^https?:\/(?!\/)/i, (m) => `${m}/`);
  }
  if (/^www\./i.test(url)) {
    url = `https://${url}`;
  }

  // Scheme-less local dev URLs from CMS, e.g. `localhost:3333/uploads/...`
  if (
    !/^https?:\/\//i.test(url) &&
    !url.startsWith('//') &&
    !url.startsWith('/') &&
    !/^uploads\//i.test(url) &&
    !url.startsWith('file://') &&
    !url.startsWith('data:') &&
    /^(localhost|127\.0\.0\.1)(:\d+)?\//i.test(url)
  ) {
    url = `http://${url}`;
  }

  // Already a valid absolute URL for RN <Image />
  if (/^https?:\/\//i.test(url) || url.startsWith('file://') || url.startsWith('data:')) {
    if (!/^https?:\/\//i.test(url)) return url;
    try {
      const u = new URL(url);
      // Prefer HTTPS for remote hosts; keep localhost/dev aliases on HTTP.
      const isLocalHost =
        u.hostname === 'localhost' ||
        u.hostname === '127.0.0.1' ||
        u.hostname === '10.0.2.2' ||
        /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname);
      if (u.protocol === 'http:' && !isLocalHost) {
        u.protocol = 'https:';
      }
      u.pathname = normalizeMediaPathname(u.pathname);
      const normalizedAbsolute = stripStaticImageOptimizerParams(u.toString());
      return rewriteLocalhostInMediaUrl(normalizedAbsolute);
    } catch {
      // Fall back to minimal safe encoding.
      try {
        return rewriteLocalhostInMediaUrl(encodeURI(url));
      } catch {
        return rewriteLocalhostInMediaUrl(url);
      }
    }
  }
  if (url.startsWith('//')) return rewriteLocalhostInMediaUrl(`https:${url}`);

  // Common backend patterns: `/uploads/<file>` or `uploads/<file>`
  try {
    const { apiBaseUrl } = getEnvConfigSafe();
    const u = new URL(apiBaseUrl);

    if (url.startsWith('/')) return rewriteLocalhostInMediaUrl(`${u.origin}${url}`);
    if (/^uploads\//i.test(url)) return rewriteLocalhostInMediaUrl(`${u.origin}/${url}`);
  } catch {
    // ignore and fall back to placeholder
  }

  return null;
}

type ProductLikeImageInput = {
  images?: string[];
  imageUrl?: string;
  /** Preferred list/tile URL from bootstrap when optimized assets exist. */
  thumbnailUrl?: string;
  cardImageUrl?: string;
  name?: string;
  id?: string;
  _id?: string;
  /** CMS often sends a plain URL string here (categories, legacy payloads). */
  image?: string | { uri?: string };
  thumbnail?: string;
};

/** First non-empty image field from CMS banner / carousel payloads. */
export function pickBannerRawImageUrl(b: {
  bannerImageUrl?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  uri?: string;
  image?: string | { uri?: string };
} | null | undefined): string | undefined {
  if (!b) return undefined;
  const take = (s: unknown): string | undefined =>
    typeof s === 'string' && s.trim() ? s.trim() : undefined;
  return (
    take(b.bannerImageUrl) ??
    take(b.thumbnailUrl) ??
    take(b.imageUrl) ??
    take(b.uri) ??
    (typeof b.image === 'string' ? take(b.image) : take(b.image && typeof b.image === 'object' ? b.image.uri : undefined))
  );
}

/** Collect stub URLs from API fields (for master-sheet diagnostics). */
export function collectStubImageUrls(p: ProductLikeImageInput | null | undefined): string[] {
  if (!p) return [];
  const stubs: string[] = [];
  const check = (label: string, val: unknown) => {
    if (typeof val === 'string' && val.trim() && isRemotePlaceholderServiceUrl(val)) {
      stubs.push(`${label}: ${val.trim()}`);
    }
  };
  check('thumbnailUrl', p.thumbnailUrl);
  check('cardImageUrl', p.cardImageUrl);
  check('imageUrl', p.imageUrl);
  if (Array.isArray(p.images)) {
    p.images.forEach((u, i) => check(`images[${i}]`, u));
  }
  if (typeof p.image === 'string') check('image', p.image);
  else if (p.image && typeof p.image === 'object' && 'uri' in p.image) {
    check('image.uri', p.image.uri);
  }
  check('thumbnail', p.thumbnail);
  return stubs;
}

export type ProductImageMasterSheetRow = {
  productId: string;
  productName: string;
  thumbnailUrl: string;
  cardImageUrl: string;
  imageUrl: string;
  imagesFirst: string;
  legacyImage: string;
  resolvedDisplayUrl: string;
  attemptedUri: string;
  issue: 'stub_url_in_catalog' | 'unresolved' | 'load_failed' | 'ok';
  stubUrlsInCatalog: string[];
};

/** Structured row for master-sheet lookup when an image is missing or fails to load. */
export function buildProductImageMasterSheetRow(
  p: ProductLikeImageInput | null | undefined,
  opts?: {
    resolvedUrl?: string;
    attemptedUri?: string;
    issue?: ProductImageMasterSheetRow['issue'];
  },
): ProductImageMasterSheetRow {
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : '');
  const legacyImage =
    typeof p?.image === 'string'
      ? str(p.image)
      : p?.image && typeof p.image === 'object' && 'uri' in p.image
        ? str(p.image.uri)
        : '';
  const stubUrlsInCatalog = collectStubImageUrls(p);
  return {
    productId: str(p?.id ?? p?._id),
    productName: str(p?.name),
    thumbnailUrl: str(p?.thumbnailUrl),
    cardImageUrl: str(p?.cardImageUrl),
    imageUrl: str(p?.imageUrl),
    imagesFirst: Array.isArray(p?.images) && p.images.length > 0 ? str(p.images[0]) : '',
    legacyImage,
    resolvedDisplayUrl: opts?.resolvedUrl ?? '',
    attemptedUri: opts?.attemptedUri ?? '',
    issue: opts?.issue ?? (stubUrlsInCatalog.length > 0 ? 'stub_url_in_catalog' : 'ok'),
    stubUrlsInCatalog,
  };
}

function pickRawImageUrl(p: ProductLikeImageInput): string | undefined {
  const take = (s: unknown): string | undefined => {
    if (typeof s !== 'string' || !s.trim()) return undefined;
    const trimmed = s.trim();
    if (isRemotePlaceholderServiceUrl(trimmed)) return undefined;
    return trimmed;
  };

  const fromThumb = take(p.thumbnailUrl);
  if (fromThumb) return fromThumb;
  const fromCard = take(p.cardImageUrl);
  if (fromCard) return fromCard;

  if (Array.isArray(p.images) && p.images.length > 0) {
    for (const img of p.images) {
      const u = take(img);
      if (u) return u;
    }
  }
  const fromImageUrl = take(p.imageUrl);
  if (fromImageUrl) return fromImageUrl;

  if (p.image != null) {
    if (typeof p.image === 'string') {
      const u = take(p.image);
      if (u) return u;
    } else if (typeof p.image === 'object' && p.image.uri != null) {
      const u = take(p.image.uri);
      if (u) return u;
    }
  }

  const legThumb = take(p.thumbnail);
  if (legThumb) return legThumb;

  return undefined;
}

/** Raw catalog image fields attached to product cards for master-sheet diagnostics. */
export function productImageCatalogFromApi(
  p: (ProductLikeImageInput & { variants?: Array<{ thumbnailUrl?: string; cardImageUrl?: string; imageUrl?: string; images?: string[] }> }) | null | undefined,
) {
  if (!p) return undefined;
  const firstVariant = Array.isArray(p.variants)
    ? p.variants.find(
        (v) =>
          v?.imageUrl?.trim() ||
          v?.thumbnailUrl?.trim() ||
          v?.cardImageUrl?.trim() ||
          (Array.isArray(v?.images) && v.images.length > 0),
      )
    : undefined;
  return {
    thumbnailUrl: p.thumbnailUrl ?? firstVariant?.thumbnailUrl,
    cardImageUrl: p.cardImageUrl ?? firstVariant?.cardImageUrl,
    imageUrl: p.imageUrl ?? firstVariant?.imageUrl,
    images:
      Array.isArray(p.images) && p.images.length > 0 ? p.images : firstVariant?.images,
    variants: p.variants,
  };
}

/** `Image` / `ExpoImage` source with bundled asset for local placeholder sentinel URLs. */
export function getProductImageSource(
  p: ProductLikeImageInput | null | undefined,
): ImageSourcePropType {
  const url = getProductImageUrl(p);
  return imageSourceFromResolvedUrl(url);
}

/** All resolvable catalog image URLs (cleaned), best-first — no placeholder entries. */
export function collectProductImageUrlCandidates(
  p: ProductLikeImageInput | null | undefined,
): string[] {
  if (!p) return [];
  const rawUrls: string[] = [];
  const add = (s: unknown) => {
    if (typeof s === 'string' && s.trim() && !isRemotePlaceholderServiceUrl(s.trim())) {
      rawUrls.push(s.trim());
    }
  };
  add(p.thumbnailUrl);
  add(p.cardImageUrl);
  if (Array.isArray(p.images)) {
    for (const img of p.images) add(img);
  }
  add(p.imageUrl);
  if (typeof p.image === 'string') add(p.image);
  else if (p.image && typeof p.image === 'object' && 'uri' in p.image) add(p.image.uri);
  add(p.thumbnail);

  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const raw of rawUrls) {
    const bare = stripStaticImageOptimizerParams(raw);
    const resolved = resolveImageUrl(bare) ?? resolveImageUrl(raw);
    if (!resolved || shouldUseLocalPlaceholder(resolved) || seen.has(resolved)) continue;
    seen.add(resolved);
    candidates.push(resolved);
  }
  return candidates;
}

export function getProductImageUrl(p: ProductLikeImageInput | null | undefined): string {
  const candidates = collectProductImageUrlCandidates(p);
  if (candidates.length > 0) return candidates[0];

  const stubUrls = collectStubImageUrls(p);
  const issue = stubUrls.length > 0 ? 'stub_url_in_catalog' : 'unresolved';
  logger.warn('[IMAGE_MASTER_SHEET] Product image missing — check catalog row', {
    ...buildProductImageMasterSheetRow(p, { issue }),
  });
  return '';
}

/** Cart line / order line payloads from API or optimistic cart state. */
export type CartLineImageInput = {
  productId?: string;
  productName?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  cardImageUrl?: string;
  images?: string[];
  image?: unknown;
};

function pickStringField(obj: unknown, key: string): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/** Resolve a cart line's display image URL (same field order as catalog products). */
export function resolveCartLineImageUrl(item: CartLineImageInput | null | undefined): string {
  if (!item) return '';

  const imageObj = item.image;
  const nestedUri =
    imageObj && typeof imageObj === 'object' && !Array.isArray(imageObj)
      ? pickStringField(imageObj, 'uri')
      : undefined;

  return getProductImageUrl({
    id: String(item.productId ?? ''),
    name: item.productName,
    thumbnailUrl: item.thumbnailUrl,
    cardImageUrl: item.cardImageUrl,
    images: item.images,
    imageUrl:
      item.imageUrl ??
      pickStringField(imageObj, 'url') ??
      pickStringField(imageObj, 'imageUrl') ??
      nestedUri,
    image:
      typeof imageObj === 'string'
        ? imageObj
        : nestedUri
          ? { uri: nestedUri }
          : undefined,
  });
}
