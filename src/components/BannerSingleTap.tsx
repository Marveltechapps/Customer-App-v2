import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { RootStackNavigationProp } from '../types/navigation';
import { bannerIsTapEnabled } from '@/utils/bannerInteraction';
import { handleRedirect } from '../utils/navigation/linkHandler';
import BannerMedia from './BannerMedia';
import {
  resolveBannerContentFit,
  resolveBannerSlideHeight,
  getBannerAspectRatio,
  scale,
  Spacing,
  useResponsive,
} from '../utils/responsive';

type BlockStyle = { borderRadius?: number; height?: number };

type Props = {
  banner: Record<string, unknown>;
  /** Match hero (Banner) vs mid (BannerSection) sizing */
  layout: 'hero' | 'mid';
  blockStyle?: BlockStyle;
  /** First hero/banner block on home — single slide uses high fetch priority. */
  isFirstBannerBlock?: boolean;
};

/**
 * Single full-width banner tap target — used when carousel is disabled in CMS.
 */
export default function BannerSingleTap({
  banner,
  layout,
  blockStyle,
  isFirstBannerBlock = false,
}: Props) {
  const navigation = useNavigation<RootStackNavigationProp>();
  const { width: windowWidth } = useResponsive();
  const item = banner as Record<string, unknown>;
  const isHero = layout === 'hero';
  const variant = isHero ? 'hero' : 'secondary';
  const padH = Spacing.lg(windowWidth);
  const padV = Spacing.xl(windowWidth);
  const slideWidth = Math.max(0, windowWidth - padH * 2);

  const preferredHeightRaw = Number(
    (item.dimensions as { preferredHeight?: number } | undefined)?.preferredHeight,
  );
  const preferredHeight =
    Number.isFinite(preferredHeightRaw) && preferredHeightRaw > 0
      ? preferredHeightRaw
      : undefined;

  const height = useMemo(
    () =>
      resolveBannerSlideHeight(slideWidth, {
        variant,
        aspectRatio: item.aspectRatio as string | number | null | undefined,
        preferredHeight,
        blockHeight: blockStyle?.height,
        screenWidth: windowWidth,
      }),
    [slideWidth, variant, item.aspectRatio, preferredHeight, blockStyle?.height, windowWidth],
  );
  const aspect =
    slideWidth > 0
      ? slideWidth / height
      : getBannerAspectRatio(variant, item.aspectRatio as string | number | null | undefined);
  const defaultRadius = isHero ? scale(12, windowWidth) : scale(8, windowWidth);
  const borderRadius =
    blockStyle?.borderRadius != null
      ? scale(blockStyle.borderRadius, windowWidth)
      : defaultRadius;

  const bannerIdStr =
    item._id != null ? String(item._id) : item.id != null ? String(item.id) : '';

  const handlePress = () => {
    if (!bannerIsTapEnabled(item)) {
      return;
    }
    if (item.redirectType && item.redirectValue) {
      handleRedirect(
        {
          redirectType: item.redirectType as string,
          redirectValue: item.redirectValue as string,
        },
        navigation,
      );
      return;
    }
    if (item.link) {
      handleRedirect(item.link as string, navigation);
      return;
    }
    if (bannerIdStr) {
      navigation.navigate('BannerDetail', {
        bannerId: bannerIdStr,
        title: typeof item.title === 'string' ? item.title : 'Banner',
      });
      return;
    }
    navigation.navigate('BannerDetail', { title: 'Banner' });
  };

  const tap = bannerIsTapEnabled(item);
  const imageId = bannerIdStr || 'banner';
  const contentFit = resolveBannerContentFit(
    typeof item.contentFit === 'string' ? item.contentFit : undefined,
  );
  const imageProps = {
    imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : undefined,
    uri: typeof item.uri === 'string' ? item.uri : undefined,
    title: typeof item.title === 'string' ? item.title : 'Banner',
    id: imageId,
    style: [styles.img, { borderRadius }],
    contentFit,
    priority: (isFirstBannerBlock ? 'high' : 'normal') as 'high' | 'normal',
    recyclingKey: `banner-single-${imageId}`,
  };

  return (
    <View style={[styles.wrap, { paddingHorizontal: padH, paddingVertical: padV }]}>
      {tap ? (
        <TouchableOpacity
          style={[styles.box, { aspectRatio: aspect, borderRadius }]}
          onPress={handlePress}
          activeOpacity={0.9}
        >
          <BannerMedia
            {...imageProps}
            videoUrl={typeof item.videoUrl === 'string' ? item.videoUrl : undefined}
          />
        </TouchableOpacity>
      ) : (
        <View style={[styles.box, { aspectRatio: aspect, borderRadius }]}>
          <BannerMedia
            {...imageProps}
            videoUrl={typeof item.videoUrl === 'string' ? item.videoUrl : undefined}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  box: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#EDEDED',
  },
  img: {
    width: '100%',
    height: '100%',
  },
});
