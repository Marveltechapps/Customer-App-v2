import React, { useMemo } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import { getProductImageUrl } from '../utils/productImage';
import CmsRemoteImage, { type CmsImagePriority } from './common/CmsRemoteImage';

type Props = {
  imageUrl?: string;
  uri?: string;
  title?: string;
  id?: string | number;
  style?: StyleProp<ViewStyle>;
  contentFit: 'cover' | 'contain' | 'fill' | 'none';
  transition?: number;
  priority?: CmsImagePriority;
  recyclingKey?: string;
};

/**
 * Resolves CMS banner URLs (localhost / relative / uploads) like product images, rewrites host
 * for device/emulator in dev, and falls back to a visible placeholder if the request fails.
 *
 * Uses CmsRemoteImage (expo-image). Early resize is opt-in on CmsRemoteImage to avoid 0×0 decode on first layout.
 */
export default function BannerRemoteImage({
  imageUrl,
  uri,
  title,
  id,
  style,
  contentFit,
  transition = 120,
  priority = 'normal',
  recyclingKey,
}: Props) {
  const primaryUri = useMemo(() => {
    const raw =
      (typeof imageUrl === 'string' && imageUrl.trim() ? imageUrl.trim() : undefined) ??
      (typeof uri === 'string' && uri.trim() ? uri.trim() : undefined);
    return getProductImageUrl({
      imageUrl: raw,
      name: title,
      id: id != null ? String(id) : undefined,
    });
  }, [imageUrl, uri, title, id]);
  const rKey =
    recyclingKey ?? (id != null ? `banner-${String(id)}` : `banner-${primaryUri.slice(0, 48)}`);

  return (
    <CmsRemoteImage
      uri={primaryUri}
      style={[{ backgroundColor: '#EDEDED' }, style]}
      contentFit={contentFit}
      transition={transition}
      priority={priority}
      recyclingKey={rKey}
    />
  );
}
