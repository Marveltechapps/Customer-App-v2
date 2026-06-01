import React, { useState, useRef, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Image, ImageSourcePropType, NativeScrollEvent, NativeSyntheticEvent, TouchableOpacity } from 'react-native';
import { getWindowDimensions, scale, getSpacing } from '../utils/responsive';

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
  
  // Responsive banner dimensions
  const bannerDimensions = useMemo(() => {
    const screenWidth = getWindowDimensions().width;
    
    // Calculate banner width to fit within viewport
    // Products container has padding: 8px
    // Banner container has padding: 8px left + 8px right = 16px
    // So available width = screenWidth - 72 (sidebar) - 8 (products padding) - 16 (banner padding) = screenWidth - 96
    const sidebarWidth = scale(72);
    const productsPadding = getSpacing(8); // Left padding in products container
    const bannerContainerPadding = getSpacing(20); // 8px left + 8px right in banner container
    const bannerGap = getSpacing(8); // Gap between banners
    
    // Calculate available width for banner
    const availableWidth = screenWidth - sidebarWidth - productsPadding - bannerContainerPadding;
    
    // Banner should fit within available width
    // Use 269 as max width (design spec), but scale down if needed to fit viewport
    const maxBannerWidth = scale(269);
    const bannerWidth = Math.min(maxBannerWidth, availableWidth);
    const bannerHeight = Math.round((bannerWidth * 146) / 269); // Maintain aspect ratio
    
    return {
      bannerWidth,
      bannerHeight,
      bannerGap,
    };
  }, []);
  
  const { bannerWidth, bannerHeight, bannerGap } = bannerDimensions;

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
          {banners.map((banner, index) => (
            <TouchableOpacity
              key={banner.id}
              style={[styles.bannerItem, { width: bannerWidth, height: bannerHeight }]}
              onPress={() => onBannerPress?.(banner)}
              activeOpacity={onBannerPress ? 0.8 : 1}
              disabled={!onBannerPress}
            >
              <Image source={banner.image} style={[styles.bannerImage, { width: bannerWidth, height: bannerHeight }]} resizeMode="stretch" />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Pagination Dots */}
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
    height: 146,
  },
  scrollContent: {
    alignItems: 'center',
  },
  bannerItem: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    overflow: 'hidden',
  },
  bannerImage: {
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
    backgroundColor: '#034703', // Green color for active indicator
  },
  paginationDotInactive: {
    width: 8,
    height: 8,
    backgroundColor: '#BABABA',
  },
});

