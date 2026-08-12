import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ImageSourcePropType,
  FlatList,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { RootStackNavigationProp } from '../types/navigation';
import { logger } from '@/utils/logger';
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

interface BannerProps {
  banners?: ImageSourcePropType[];
  image?: ImageSourcePropType;
  onPress?: (index: number) => void;
  fetchBannerData?: () => Promise<ImageSourcePropType[]>;
  /** Optional per-block style from CMS (e.g. { borderRadius, height }) */
  blockStyle?: { borderRadius?: number; height?: number };
  /** First hero/banner block on home: first slide loads with high priority. */
  isFirstBannerBlock?: boolean;
}

export default function Banner({
  banners,
  image,
  onPress,
  fetchBannerData,
  blockStyle,
  isFirstBannerBlock = false,
}: BannerProps) {
  const navigation = useNavigation<RootStackNavigationProp>();
  const initialBanners = image ? [image] : (banners ?? []);

  const [bannerImages, setBannerImages] = useState<ImageSourcePropType[]>(initialBanners);
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList<ImageSourcePropType>>(null);
  const { width: windowWidth } = useResponsive();
  const horizontalPad = Spacing.lg(windowWidth);
  const verticalPad = Spacing.xl(windowWidth);
  const sectionGap = Spacing.md(windowWidth);

  /** One slide = full width inside padded container */
  const slideWidth = useMemo(
    () => Math.max(0, windowWidth - horizontalPad * 2),
    [windowWidth, horizontalPad],
  );
  const dotSize = Math.max(6, scale(8, windowWidth));
  const activeDotWidth = Math.max(12, scale(16, windowWidth));

  useEffect(() => {
    if (fetchBannerData) {
      const loadBanners = async () => {
        try {
          const data = await fetchBannerData();
          setBannerImages(data);
        } catch (error) {
          logger.error('Error fetching banner data', error);
          setBannerImages([]);
        }
      };
      loadBanners();
    } else {
      setBannerImages(image ? [image] : (banners ?? []));
    }
  }, [fetchBannerData, banners, image]);

  const updateIndexFromOffset = (scrollX: number) => {
    if (slideWidth <= 0) return;
    const index = Math.round(scrollX / slideWidth);
    setCurrentIndex(Math.max(0, Math.min(index, bannerImages.length - 1)));
  };

  const handleScroll = (event: any) => {
    updateIndexFromOffset(event.nativeEvent.contentOffset.x);
  };

  const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    updateIndexFromOffset(event.nativeEvent.contentOffset.x);
  };

  const handlePress = useCallback((index: number) => {
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
  }, [bannerImages, navigation, onPress]);

  const keyExtractor = useCallback((item: ImageSourcePropType, index: number) => {
    const id = (item as any)?._id ?? (item as any)?.id ?? index;
    return `slide-${index}-${String(id)}`;
  }, []);

  const renderSlide = useCallback(
    ({ item: banner, index }: { item: ImageSourcePropType; index: number }) => {
      const tap = bannerIsTapEnabled(banner);
      const b = banner as any;
      const contentFit = resolveBannerContentFit(b?.contentFit);
      const preferredHeightRaw = Number(b?.dimensions?.preferredHeight);
      const preferredHeight =
        Number.isFinite(preferredHeightRaw) && preferredHeightRaw > 0
          ? preferredHeightRaw
          : undefined;
      const slideHeight = resolveBannerSlideHeight(slideWidth, {
        variant: 'hero',
        aspectRatio: b?.aspectRatio,
        preferredHeight,
        blockHeight: blockStyle?.height,
        screenWidth: windowWidth,
      });
      const borderRadius =
        blockStyle?.borderRadius != null
          ? scale(blockStyle.borderRadius, windowWidth)
          : scale(12, windowWidth);
      const aspect =
        slideWidth > 0 ? slideWidth / slideHeight : getBannerAspectRatio('hero', b?.aspectRatio);
      const inner = (
        <BannerMedia
          imageUrl={typeof b?.imageUrl === 'string' ? b.imageUrl : undefined}
          uri={typeof b?.uri === 'string' ? b.uri : undefined}
          videoUrl={typeof b?.videoUrl === 'string' ? b.videoUrl : undefined}
          title={typeof b?.title === 'string' ? b.title : 'Banner'}
          id={b?._id ?? b?.id ?? index}
          style={styles.bannerImage}
          contentFit={contentFit}
          priority={isFirstBannerBlock && index === 0 ? 'high' : 'low'}
          recyclingKey={`banner-${String(b?._id ?? b?.id ?? index)}`}
        />
      );
      const boxStyle = [
        styles.imageContainer,
        { width: slideWidth, aspectRatio: aspect, borderRadius },
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
    [
      slideWidth,
      windowWidth,
      blockStyle?.height,
      blockStyle?.borderRadius,
      handlePress,
      isFirstBannerBlock,
    ],
  );

  const getItemLayout = useCallback(
    (_data: ArrayLike<ImageSourcePropType> | null | undefined, index: number) => ({
      length: slideWidth,
      offset: slideWidth * index,
      index,
    }),
    [slideWidth]
  );

  if (!bannerImages || bannerImages.length === 0) {
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        {
          paddingHorizontal: horizontalPad,
          paddingVertical: verticalPad,
          gap: sectionGap,
        },
      ]}
    >
      <FlatList
        ref={flatListRef}
        data={bannerImages}
        renderItem={renderSlide}
        keyExtractor={keyExtractor}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
        nestedScrollEnabled
        bounces={false}
        style={[styles.list, { width: slideWidth }]}
        getItemLayout={getItemLayout}
        removeClippedSubviews={false}
        extraData={slideWidth}
      />

      {bannerImages.length > 1 && (
        <View style={styles.dotsContainer} accessibilityLabel="Banner page indicators">
          {bannerImages.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentIndex
                  ? [styles.activeDot, { width: activeDotWidth, height: dotSize }]
                  : [styles.inactiveDot, { width: dotSize, height: dotSize }],
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
  },
  list: {
    flexGrow: 0,
    alignSelf: 'center',
  },
  imageContainer: {
    overflow: 'hidden',
    backgroundColor: '#EDEDED',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
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
  dot: {
    borderRadius: 4,
  },
  activeDot: {
    backgroundColor: '#034703',
  },
  inactiveDot: {
    backgroundColor: '#BABABA',
  },
});
