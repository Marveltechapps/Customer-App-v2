import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ImageSourcePropType,
  FlatList,
  Animated,
  TouchableOpacity,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { logger } from '@/utils/logger';
import { bannerIsTapEnabled } from '@/utils/bannerInteraction';
import { handleRedirect } from '../../utils/navigation/linkHandler';
import type { RootStackNavigationProp } from '../../types/navigation';
import BannerRemoteImage from '../BannerRemoteImage';

/** Backend banner shape: { imageUrl, link?, ... }; also accepts ImageSourcePropType */
export type BannerItem = ImageSourcePropType | { imageUrl: string; link?: string; [k: string]: unknown };

interface BannerSectionProps {
  banners?: BannerItem[];
  onPress?: (index: number) => void;
  fetchBannerData?: () => Promise<BannerItem[]>;
  blockStyle?: { borderRadius?: number; height?: number };
  isFirstBannerBlock?: boolean;
}

export default function BannerSection({
  banners,
  onPress,
  fetchBannerData,
  blockStyle,
  isFirstBannerBlock = false,
}: BannerSectionProps) {
  const navigation = useNavigation<RootStackNavigationProp>();
  const [bannerImages, setBannerImages] = useState<BannerItem[]>(
    banners && banners.length > 0 ? banners : []
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList<BannerItem>>(null);
  const autoScrollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dotAnimationRef = useRef(new Animated.Value(0)).current;
  const { width: windowWidth } = useWindowDimensions();

  // Sync when banners prop updates (e.g. from home payload)
  useEffect(() => {
    if (banners && banners.length > 0) {
      setBannerImages(banners);
    } else if (!fetchBannerData) {
      setBannerImages([]);
    }
  }, [banners, fetchBannerData]);

  /** Full-width slides — must match styles.container paddingHorizontal (16 × 2) exactly for paging. */
  const slideWidth = useMemo(() => {
    const horizontalPad = 16 * 2;
    return Math.max(0, windowWidth - horizontalPad);
  }, [windowWidth]);

  // Placeholder for API integration
  useEffect(() => {
    if (fetchBannerData) {
      const loadBanners = async () => {
        setLoading(true);
        try {
          const data = await fetchBannerData();
          setBannerImages(data);
        } catch (error) {
          logger.error('Error fetching banner data', error);
          // Fallback to provided banners or dummy data
          setBannerImages(banners ?? []);
        } finally {
          setLoading(false);
        }
      };
      loadBanners();
    }
  }, [fetchBannerData, banners]);

  const scheduleAutoAdvance = useCallback(() => {
    if (bannerImages.length <= 1) return;

    if (autoScrollTimerRef.current) {
      clearInterval(autoScrollTimerRef.current);
    }
    dotAnimationRef.setValue(0);
    Animated.timing(dotAnimationRef, {
      toValue: 1,
      duration: 5000,
      useNativeDriver: false,
    }).start();

    autoScrollTimerRef.current = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % bannerImages.length;
        flatListRef.current?.scrollToOffset({
          offset: next * slideWidth,
          animated: true,
        });
        return next;
      });
    }, 5000);
  }, [bannerImages.length, slideWidth, dotAnimationRef]);

  // Auto-advance on load; cleared on drag, resumed on momentum end
  useEffect(() => {
    if (bannerImages.length <= 1) return;
    scheduleAutoAdvance();
    return () => {
      if (autoScrollTimerRef.current) {
        clearInterval(autoScrollTimerRef.current);
      }
    };
  }, [bannerImages.length, scheduleAutoAdvance]);

  const updateIndexFromOffset = (scrollX: number) => {
    if (slideWidth <= 0) return;
    const index = Math.round(scrollX / slideWidth);
    setCurrentIndex(Math.max(0, Math.min(index, bannerImages.length - 1)));
  };

  const handleScrollBeginDrag = () => {
    if (autoScrollTimerRef.current) {
      clearInterval(autoScrollTimerRef.current);
      autoScrollTimerRef.current = null;
    }
  };

  const handleScroll = (event: any) => {
    updateIndexFromOffset(event.nativeEvent.contentOffset.x);
  };

  const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    updateIndexFromOffset(scrollPosition);
    scheduleAutoAdvance();
  };

  const handlePress = useCallback(
    (index: number) => {
      const item = bannerImages[index] as any;
      if (onPress) {
        onPress(index);
        return;
      }

      if (!bannerIsTapEnabled(item)) {
        return;
      }

      if (item && typeof item === 'object') {
        if (item.redirectType && item.redirectValue) {
          handleRedirect({ redirectType: item.redirectType, redirectValue: item.redirectValue }, navigation);
          return;
        }
        if (item.link) {
          handleRedirect(item.link, navigation);
          return;
        }
        const bid = item._id ?? item.id;
        if (bid) {
          navigation.navigate('BannerDetail', {
            bannerId: String(bid),
            title: typeof item.title === 'string' ? item.title : 'Banner',
          });
          return;
        }
      }

      navigation.navigate('BannerDetail', { title: 'Banner' });
    },
    [bannerImages, navigation, onPress]
  );

  const keyExtractor = useCallback((item: BannerItem, index: number) => {
    const id = (item as any)?._id ?? (item as any)?.id ?? index;
    return `slide-${index}-${String(id)}`;
  }, []);

  const renderSlide = useCallback(
    ({ item: banner, index }: { item: BannerItem; index: number }) => {
      const tap = bannerIsTapEnabled(banner);
      const b = banner as any;
      const contentFit: 'fill' = 'fill';
      const preferredHeightRaw = Number(b?.dimensions?.preferredHeight);
      const preferredHeight = Number.isFinite(preferredHeightRaw) && preferredHeightRaw > 0 ? preferredHeightRaw : undefined;
      const inner = (
        <BannerRemoteImage
          imageUrl={typeof b?.imageUrl === 'string' ? b.imageUrl : undefined}
          uri={typeof b?.uri === 'string' ? b.uri : undefined}
          title={typeof b?.title === 'string' ? b.title : 'Banner'}
          id={b?._id ?? b?.id ?? index}
          style={styles.image}
          contentFit={contentFit}
          priority={isFirstBannerBlock && index === 0 ? 'high' : 'low'}
          recyclingKey={`banner-${String(b?._id ?? b?.id ?? index)}`}
        />
      );
      const boxStyle = [
        styles.imageContainer,
        { width: slideWidth },
        (blockStyle?.height != null
          ? { height: blockStyle.height }
          : preferredHeight != null
            ? { height: preferredHeight }
            : null),
        blockStyle?.borderRadius != null && { borderRadius: blockStyle.borderRadius },
      ];
      if (!tap) {
        return <View style={boxStyle}>{inner}</View>;
      }
      return (
        <TouchableOpacity style={boxStyle} onPress={() => handlePress(index)} activeOpacity={0.9}>
          {inner}
        </TouchableOpacity>
      );
    },
    [slideWidth, blockStyle?.height, blockStyle?.borderRadius, handlePress, isFirstBannerBlock]
  );

  const getItemLayout = useCallback(
    (_data: ArrayLike<BannerItem> | null | undefined, index: number) => ({
      length: slideWidth,
      offset: slideWidth * index,
      index,
    }),
    [slideWidth]
  );

  return (
    <View style={styles.container}>
      {/* FlatList: reliable horizontal paging when nested in the home ScrollView */}
      <FlatList
        ref={flatListRef}
        data={bannerImages}
        renderItem={renderSlide}
        keyExtractor={keyExtractor}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScroll={handleScroll}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
        nestedScrollEnabled
        bounces={false}
        decelerationRate="fast"
        style={[styles.list, { width: slideWidth }]}
        getItemLayout={getItemLayout}
        removeClippedSubviews={false}
      />

      {/* Dot indicators only when multiple slides (static single banner = no dots) */}
      {bannerImages.length > 1 && (
        <View style={styles.dotsContainer} accessibilityLabel="Banner page indicators">
          {bannerImages.map((_, index) => {
            const isActive = index === currentIndex;
            const animatedWidth = dotAnimationRef.interpolate({
              inputRange: [0, 1],
              outputRange: [8, 16], // Animate from 8px to 16px
            });

            return (
              <View key={index} style={styles.dotWrapper}>
                {isActive ? (
                  <Animated.View
                    style={[
                      styles.dot,
                      styles.activeDot,
                      {
                        width: animatedWidth,
                      },
                    ]}
                  />
                ) : (
                  <View
                    style={[
                      styles.dot,
                      styles.inactiveDot,
                    ]}
                  />
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 12,
  },
  list: {
    flexGrow: 0,
    alignSelf: 'center',
  },
  imageContainer: {
    height: 198, // default; can be overridden per banner by dimensions.preferredHeight
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    width: '100%',
    zIndex: 2,
    paddingVertical: 4,
  },
  dotWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    borderRadius: 4,
    height: 8,
  },
  activeDot: {
    backgroundColor: '#034703',
  },
  inactiveDot: {
    width: 8,
    backgroundColor: '#BABABA',
  },
});
