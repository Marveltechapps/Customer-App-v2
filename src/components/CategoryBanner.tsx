import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  ImageSourcePropType,
  NativeScrollEvent,
  NativeSyntheticEvent,
  TouchableOpacity,
} from 'react-native';
import {
  useDimensions,
  scale,
  getSpacing,
  resolveBannerSlideHeight,
  getBannerAspectRatio,
} from '../utils/responsive';

export interface CategoryBannerItem {
  id: string;
  image: ImageSourcePropType;
  link?: string | null;
}

interface CategoryBannerProps {
  banners: CategoryBannerItem[];
  onBannerPress?: (banner: CategoryBannerItem) => void;
}

export default function CategoryBanner({ banners, onBannerPress }: CategoryBannerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const { width: screenWidth } = useDimensions();

  // Responsive banner dimensions — recomputed live on rotation/resize.
  const bannerDimensions = useMemo(() => {
    const sidebarWidth = scale(72, screenWidth);
    const productsPadding = getSpacing(8, screenWidth);
    const bannerContainerPadding = getSpacing(20, screenWidth);
    const bannerGap = getSpacing(8, screenWidth);

    const availableWidth =
      screenWidth - sidebarWidth - productsPadding - bannerContainerPadding;

    const maxBannerWidth = scale(269, screenWidth);
    const bannerWidth = Math.min(maxBannerWidth, availableWidth);
    const bannerHeight = resolveBannerSlideHeight(bannerWidth, {
      variant: 'secondary',
      screenWidth,
    });
    const aspect =
      bannerWidth > 0 ? bannerWidth / bannerHeight : getBannerAspectRatio('secondary');

    return {
      bannerWidth,
      bannerHeight,
      bannerGap,
      aspect,
    };
  }, [screenWidth]);

  const { bannerWidth, bannerHeight, bannerGap, aspect } = bannerDimensions;

  if (banners.length === 0) {
    return null;
  }

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const bannerWidthWithGap = bannerWidth + bannerGap;
    const index = Math.round(scrollPosition / bannerWidthWithGap);
    const newIndex = Math.min(Math.max(0, index), banners.length - 1);
    setActiveIndex(newIndex);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.bannerContainer, { height: bannerHeight }]}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { gap: bannerGap }]}
          onMomentumScrollEnd={handleScroll}
          snapToInterval={bannerWidth + bannerGap}
          snapToAlignment="start"
          decelerationRate="fast"
        >
          {banners.map((banner) => (
            <TouchableOpacity
              key={banner.id}
              style={[
                styles.bannerItem,
                { width: bannerWidth, aspectRatio: aspect },
              ]}
              onPress={() => onBannerPress?.(banner)}
              activeOpacity={onBannerPress ? 0.8 : 1}
              disabled={!onBannerPress}
            >
              <Image
                source={banner.image}
                style={styles.bannerImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {banners.length > 1 && (
        <View style={styles.paginationContainer}>
          {banners.map((_, index) => (
            <View
              key={index}
              style={[
                styles.paginationDot,
                index === activeIndex ? styles.paginationDotActive : styles.paginationDotInactive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 4,
    paddingVertical: 16,
    gap: 8,
  },
  bannerContainer: {
    width: '100%',
  },
  scrollContent: {
    alignItems: 'center',
  },
  bannerItem: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#EDEDED',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    paddingTop: 0,
  },
  paginationDot: {
    borderRadius: 4,
  },
  paginationDotActive: {
    width: 16,
    height: 8,
    backgroundColor: '#034703',
  },
  paginationDotInactive: {
    width: 8,
    height: 8,
    backgroundColor: '#BABABA',
  },
});
