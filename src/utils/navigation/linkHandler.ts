import { Linking } from 'react-native';
import type { RootStackNavigationProp } from '../../types/navigation';

export type RedirectPayload =
  | { redirectType: string; redirectValue: string }
  | string
  | undefined;

/**
 * Handle CMS redirect (typed redirectType + redirectValue) or legacy link string.
 */
export function handleRedirect(redirect: RedirectPayload, navigation: RootStackNavigationProp) {
  try {
    if (!redirect) return;

    // Typed redirect from new CMS
    if (typeof redirect === 'object' && redirect.redirectType) {
      const { redirectType, redirectValue } = redirect;
      const val = String(redirectValue || '').trim();
      if (redirectType === 'none') return;

      switch (redirectType) {
        case 'page':
          navigation.navigate('DynamicPage', { slug: val });
          return;
        case 'product':
          navigation.navigate('ProductDetail', { productId: val });
          return;
        case 'category':
          navigation.navigate('CategoryProducts', { categoryId: val, categoryName: '' } as any);
          return;
        case 'subcategory':
          navigation.navigate('CategoryProducts', { categoryId: val, categoryName: '' } as any);
          return;
        case 'collection':
          navigation.navigate('CollectionProducts', { collectionId: val });
          return;
        case 'banner':
          navigation.navigate('BannerDetail', { title: '', bannerId: val });
          return;
        case 'section':
          // Current app has no dedicated section screen; route via dynamic page bridge
          navigation.navigate('DynamicPage', { slug: `section:${val}` } as any);
          return;
        case 'search':
          navigation.navigate('SearchResults', { query: val });
          return;
        case 'url':
          Linking.openURL(val).catch((err) => console.warn('Failed to open URL', val, err));
          return;
        case 'screen': {
          const [screenPart, paramsPart] = val.split(':', 2);
          const params: Record<string, string> = {};
          if (paramsPart) {
            try {
              const usp = new URLSearchParams(paramsPart);
              usp.forEach((v, k) => { params[k] = v; });
            } catch {
              paramsPart.split('&').forEach((pair) => {
                const [k, v] = pair.split('=');
                if (k) params[k] = decodeURIComponent(v || '');
              });
            }
          }
          navigation.navigate(screenPart as any, params);
          return;
        }
        default:
          handleHomeLink(val, navigation);
      }
      return;
    }

    // Legacy link string
    if (typeof redirect === 'string') {
      handleHomeLink(redirect, navigation);
    }
  } catch (err) {
    console.warn('Navigation failed for redirect', redirect, err);
  }
}

// Parses links: product:id, category:id, http(s)://..., or ScreenName:param1=val&param2=val
export function handleHomeLink(link: string | undefined, navigation: RootStackNavigationProp) {
  if (!link) return;
  if (typeof link !== 'string') {
    // Defensive: some CMS payloads may send non-string link values (objects). Ignore and log.
    // Higher-level redirect handling (handleRedirect) supports typed redirects (objects).
    console.warn('handleHomeLink: ignored non-string link value', link);
    return;
  }
  const trimmed = link.trim();

  // External URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    Linking.openURL(trimmed).catch((err) => {
      console.warn('Failed to open URL', trimmed, err);
    });
    return;
  }

  // page:<slug> → DynamicPage (legacy link format for CMS pages)
  if (trimmed.startsWith('page:')) {
    const slug = trimmed.slice(5).trim();
    if (slug) {
      try {
        navigation.navigate('DynamicPage', { slug });
      } catch (err) {
        console.warn('Navigation failed for link', link, err);
      }
    }
    return;
  }

  // product:<productId> → ProductDetail
  if (trimmed.startsWith('product:')) {
    const productId = trimmed.slice(8).trim();
    if (productId) {
      try {
        navigation.navigate('ProductDetail', { productId });
      } catch (err) {
        console.warn('Navigation failed for link', link, err);
      }
    }
    return;
  }

  // category:<categoryId> → CategoryProducts (categoryName resolved from API on load)
  if (trimmed.startsWith('category:')) {
    const categoryId = trimmed.slice(9).trim();
    if (categoryId) {
      try {
        navigation.navigate('CategoryProducts', { categoryId, categoryName: '' });
      } catch (err) {
        console.warn('Navigation failed for link', link, err);
      }
    }
    return;
  }

  // In-app deep link format: ScreenName or ScreenName:param1=val&param2=val
  const [screenPart, paramsPart] = trimmed.split(':', 2);
  const screen = screenPart;
  let params: Record<string, any> = {};
  if (paramsPart) {
    try {
      const usp = new URLSearchParams(paramsPart);
      usp.forEach((value, key) => {
        params[key] = value;
      });
    } catch (e) {
      // fallback: crude parse
      paramsPart.split('&').forEach((pair) => {
        const [k, v] = pair.split('=');
        if (k) params[k] = decodeURIComponent(v || '');
      });
    }
  }

  try {
    navigation.navigate((screen as unknown) as any, params);
  } catch (err) {
    console.warn('Navigation failed for link', link, err);
  }
}

export default handleHomeLink;

