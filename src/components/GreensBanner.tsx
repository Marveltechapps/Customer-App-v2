import React, { useMemo } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, ImageSourcePropType } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { RootStackNavigationProp } from '../types/navigation';
import { bannerIsTapEnabled } from '@/utils/bannerInteraction';
import { handleRedirect } from '../utils/navigation/linkHandler';
import {
  resolveBannerSlideHeight,
  getBannerAspectRatio,
  scale,
  Spacing,
  useResponsive,
} from '../utils/responsive';

interface GreensBannerProps {
  image?: ImageSourcePropType;
  onPress?: () => void;
  blockStyle?: { borderRadius?: number; height?: number };
}

export default function GreensBanner({ image, onPress, blockStyle }: GreensBannerProps) {
  const navigation = useNavigation<RootStackNavigationProp>();
  const { width: screenWidth } = useResponsive();
  const horizontalPad = Spacing.lg(screenWidth);
  const bannerWidth = Math.max(0, screenWidth - horizontalPad * 2);
  const bannerHeight = useMemo(
    () =>
      resolveBannerSlideHeight(bannerWidth, {
        variant: 'promo',
        blockHeight: blockStyle?.height,
        screenWidth,
      }),
    [bannerWidth, blockStyle?.height, screenWidth],
  );
  const aspect =
    bannerWidth > 0 ? bannerWidth / bannerHeight : getBannerAspectRatio('promo');
  const borderRadius =
    blockStyle?.borderRadius != null
      ? scale(blockStyle.borderRadius, screenWidth)
      : scale(10, screenWidth);

  if (!image) {
    return null;
  }

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }
    const imgAny = image as any;
    if (imgAny && typeof imgAny === 'object') {
      if (!bannerIsTapEnabled(imgAny)) {
        return;
      }
      if (imgAny.redirectType && imgAny.redirectValue) {
        handleRedirect(
          { redirectType: imgAny.redirectType, redirectValue: imgAny.redirectValue },
          navigation,
        );
        return;
      }
      if (imgAny.link) {
        handleRedirect(imgAny.link, navigation);
        return;
      }
    }
  };

  return (
    <View
      style={[
        styles.container,
        { paddingHorizontal: horizontalPad, paddingTop: Spacing.section(screenWidth) },
      ]}
    >
      <View style={styles.bannerWrapper}>
        <TouchableOpacity
          style={[
            styles.bannerContainer,
            { width: bannerWidth, aspectRatio: aspect, borderRadius },
          ]}
          onPress={handlePress}
          activeOpacity={0.9}
        >
          <Image source={image} style={styles.bannerImage} resizeMode="cover" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 0,
    width: '100%',
  },
  bannerWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  bannerContainer: {
    overflow: 'hidden',
    backgroundColor: '#EDEDED',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
});
