/**
 * Placeholder helpers — catalog images only; no bundled fallback assets.
 */
import type { ImageSourcePropType } from 'react-native';

/** Legacy sentinel; never used as a displayed image source. */
export const LOCAL_PLACEHOLDER_URI = 'local://product-placeholder';

export const DEFAULT_PLACEHOLDER = '';
export const DEFAULT_PLACEHOLDER_WIDE = '';

let _placeholderUrl = '';
let _placeholderUrlWide = '';

export function isLocalPlaceholderUri(uri: string | null | undefined): boolean {
  if (typeof uri !== 'string') return false;
  const trimmed = uri.trim();
  return trimmed === LOCAL_PLACEHOLDER_URI || trimmed.startsWith('local://');
}

/** Stub hosts (placehold.co, via.placeholder.com, etc.) — skip network fetch. */
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

/** Image source for resolved catalog URL only — empty URI when missing. */
export function imageSourceFromResolvedUrl(url: string | null | undefined): ImageSourcePropType {
  if (typeof url !== 'string' || !url.trim() || shouldUseLocalPlaceholder(url)) {
    return { uri: '' };
  }
  return { uri: url.trim() };
}

export function setPlaceholderUrls(_config?: { placeholderUrl?: string }): void {
  _placeholderUrl = '';
  _placeholderUrlWide = '';
}

export function getPlaceholderUrl(): string {
  return _placeholderUrl;
}

export function getPlaceholderUrlWide(): string {
  return _placeholderUrlWide;
}
