/**
 * Centralized placeholder image — bundled asset (works offline / in simulator).
 * Remote placeholder URLs from AppConfig are mapped to the local asset at runtime.
 */
import type { ImageSourcePropType } from 'react-native';

/** URI sentinel consumed by CmsRemoteImage (not loaded over the network). */
export const LOCAL_PLACEHOLDER_URI = 'local://product-placeholder';

export const LOCAL_PLACEHOLDER_IMAGE: ImageSourcePropType = require('../assets/images/product-image-1.png');

/** Legacy default kept for AppConfig merge; not fetched by the image loader. */
export const DEFAULT_PLACEHOLDER = 'https://placehold.co/200x200?text=No+Image';
export const DEFAULT_PLACEHOLDER_WIDE = 'https://placehold.co/400x200?text=No+Image';

let _placeholderUrl = LOCAL_PLACEHOLDER_URI;
let _placeholderUrlWide = LOCAL_PLACEHOLDER_URI;

export function isLocalPlaceholderUri(uri: string | null | undefined): boolean {
  if (typeof uri !== 'string') return false;
  const trimmed = uri.trim();
  return trimmed === LOCAL_PLACEHOLDER_URI || trimmed.startsWith('local://');
}

/** Stub hosts (placehold.co, via.placeholder.com, etc.) — use bundled asset, no network fetch. */
export function isRemotePlaceholderServiceUrl(uri: string | null | undefined): boolean {
  if (typeof uri !== 'string' || !uri.trim()) return false;
  if (isLocalPlaceholderUri(uri)) return false;
  try {
    const host = new URL(uri.trim()).hostname.toLowerCase();
    return (
      host === 'placehold.co' ||
      host.endsWith('.placehold.co') ||
      host === 'via.placeholder.com' ||
      host === 'placeholder.com' ||
      host.endsWith('.placeholder.com')
    );
  } catch {
    return /placehold\.co|via\.placeholder\.com|placeholder\.com/i.test(uri);
  }
}

export function shouldUseLocalPlaceholder(uri: string | null | undefined): boolean {
  return isLocalPlaceholderUri(uri) || isRemotePlaceholderServiceUrl(uri);
}

/** Safe `Image` / `ExpoImage` source — never passes `local://` to the native URL loader. */
export function imageSourceFromResolvedUrl(url: string | null | undefined): ImageSourcePropType {
  if (typeof url !== 'string' || !url.trim()) {
    return LOCAL_PLACEHOLDER_IMAGE;
  }
  const trimmed = url.trim();
  if (shouldUseLocalPlaceholder(trimmed)) {
    return LOCAL_PLACEHOLDER_IMAGE;
  }
  return { uri: trimmed };
}

export function setPlaceholderUrls(config?: { placeholderUrl?: string }) {
  if (config?.placeholderUrl) {
    _placeholderUrl = shouldUseLocalPlaceholder(config.placeholderUrl)
      ? LOCAL_PLACEHOLDER_URI
      : config.placeholderUrl;
    _placeholderUrlWide =
      config.placeholderUrl.includes('200x200') && shouldUseLocalPlaceholder(config.placeholderUrl)
        ? LOCAL_PLACEHOLDER_URI
        : config.placeholderUrl.replace('200x200', '400x200') || LOCAL_PLACEHOLDER_URI;
  }
}

export function getPlaceholderUrl(): string {
  return _placeholderUrl;
}

export function getPlaceholderUrlWide(): string {
  return _placeholderUrlWide;
}
