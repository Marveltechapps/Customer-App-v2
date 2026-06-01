import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { RootStackNavigationProp } from '../types/navigation';
import { bannerIsTapEnabled } from '@/utils/bannerInteraction';
import { handleRedirect } from '../utils/navigation/linkHandler';
import BannerMedia from './BannerMedia';

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
export default function BannerSingleTap({ banner, layout, blockStyle, isFirstBannerBlock = false }: Props) {
  const navigation = useNavigation<RootStackNavigationProp>();
  const item = banner as Record<string, unknown>;
  const isHero = layout === 'hero';
  const defaultHeight = isHero ? 340 : 198;
  const defaultRadius = isHero ? 12 : 8;
  const padH = isHero ? 12 : 16;

  const bannerIdStr = item._id != null ? String(item._id) : item.id != null ? String(item.id) : '';

  const handlePress = () => {
    if (!bannerIsTapEnabled(item)) {
      return;
    }
    if (item.redirectType && item.redirectValue) {
      handleRedirect({ redirectType: item.redirectType as string, redirectValue: item.redirectValue as string }, navigation);
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

  const height = blockStyle?.height ?? defaultHeight;
  const borderRadius = blockStyle?.borderRadius ?? defaultRadius;

  const tap = bannerIsTapEnabled(item);

  const imageId = bannerIdStr || 'banner';
  const contentFit: 'fill' = 'fill';
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
    <View style={[styles.wrap, { paddingHorizontal: padH }]}>
      {tap ? (
        <TouchableOpacity
          style={[styles.box, { height, borderRadius }]}
          onPress={handlePress}
          activeOpacity={0.9}
        >
          <BannerMedia
            {...imageProps}
            videoUrl={typeof item.videoUrl === 'string' ? item.videoUrl : undefined}
          />
        </TouchableOpacity>
      ) : (
        <View style={[styles.box, { height, borderRadius }]}>
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
    paddingVertical: 20,
  },
  box: {
    width: '100%',
    overflow: 'hidden',
  },
  img: {
    width: '100%',
    height: '100%',
  },
});
